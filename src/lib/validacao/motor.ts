import { CATALOGO } from "./catalogo";
import {
  DOMINIOS,
  PESO_FONTE,
  type Confirmacoes,
  type ContextoValidacao,
  type Dominio,
  type Estado,
  type ProgressoDominio,
  type Resultado,
  type Verificacao,
} from "./contrato";

/**
 * O motor: roda o catálogo contra o projeto e diz o que passou, o que merece atenção e o que
 * bloqueia.
 *
 * ## A ordem de precedência, e por que ela importa
 *
 * Verificação automática sempre ganha da confirmação. Se o app olhou o modelo de dados e viu
 * senha sem hash, o fato de a pessoa ter marcado "senhas com hash" não muda nada — e mostrar
 * "passou" ali seria o app ajudando a esconder o problema.
 *
 * A confirmação só decide onde o app não consegue olhar.
 */

function rodarUma(v: Verificacao, c: ContextoValidacao, confirmacoes: Confirmacoes): Resultado {
  if (v.verificar) {
    const r = v.verificar(c);
    return {
      verificacao: v,
      estado: r.estado,
      // `sonda` quando a conclusão veio do banco real; `automatica` quando veio do plano.
      fonte: v.id === "banco-existe-de-verdade" ? "sonda" : "automatica",
      evidencia: r.evidencia,
      // Verificação automática não aceita confirmação: não há o que a pessoa acrescente.
      aceitaConfirmacao: false,
    };
  }

  const confirmada = confirmacoes[v.id];
  if (confirmada) {
    return {
      verificacao: v,
      estado: "passou",
      fonte: "confirmacao",
      evidencia: `Você confirmou em ${new Date(confirmada.em).toLocaleDateString("pt-BR")}. O app não consegue verificar isto sozinho.`,
      aceitaConfirmacao: true,
    };
  }

  return {
    verificacao: v,
    estado: "atencao",
    fonte: "pendente",
    evidencia: "",
    aceitaConfirmacao: true,
  };
}

export type RelatorioValidacao = {
  resultados: Resultado[];
  /** O que não se aplica a este projeto, com o motivo. Fica fora da conta de progresso. */
  foraDoEscopo: Verificacao[];
  porDominio: ProgressoDominio[];
  /** As que impedem concluir a etapa. Vazio = nada trava. */
  bloqueios: Resultado[];
  progressoGeral: number;
  /** Quantas conclusões vieram de verificação, e quantas de confirmação. */
  verificadas: number;
  confirmadas: number;
};

const ORDEM: Record<Estado, number> = { bloqueio: 0, atencao: 1, passou: 2 };

export function validar(c: ContextoValidacao, confirmacoes: Confirmacoes = {}): RelatorioValidacao {
  const aplicaveis: Verificacao[] = [];
  const foraDoEscopo: Verificacao[] = [];

  for (const v of CATALOGO) {
    if (v.aplicaSe && !v.aplicaSe(c)) foraDoEscopo.push(v);
    else aplicaveis.push(v);
  }

  const resultados = aplicaveis
    .map((v) => rodarUma(v, c, confirmacoes))
    // Bloqueio primeiro, depois atenção. A lista tem que abrir pelo que impede seguir.
    .sort((a, b) => ORDEM[a.estado] - ORDEM[b.estado]);

  const porDominio = DOMINIOS.map((d) => progressoDe(d, resultados)).filter(
    (p) => p.aplicaveis > 0,
  );

  /**
   * O progresso geral é a média ponderada das verificações, não a média dos domínios.
   *
   * Média de domínios daria o mesmo peso a "deploy" com 3 itens e a "segurança" com 5 — e faria
   * um domínio pequeno e fácil puxar o número inteiro para cima.
   */
  const soma = resultados.reduce(
    (s, r) => s + (r.estado === "passou" ? PESO_FONTE[r.fonte] : 0),
    0,
  );

  return {
    resultados,
    foraDoEscopo,
    porDominio,
    bloqueios: resultados.filter((r) => r.estado === "bloqueio"),
    progressoGeral: resultados.length === 0 ? 0 : Math.round((soma / resultados.length) * 100),
    verificadas: resultados.filter(
      (r) => r.estado === "passou" && (r.fonte === "automatica" || r.fonte === "sonda"),
    ).length,
    confirmadas: resultados.filter((r) => r.fonte === "confirmacao").length,
  };
}

function progressoDe(dominio: Dominio, todos: Resultado[]): ProgressoDominio {
  const meus = todos.filter((r) => r.verificacao.dominio === dominio);
  const soma = meus.reduce((s, r) => s + (r.estado === "passou" ? PESO_FONTE[r.fonte] : 0), 0);

  return {
    dominio,
    aplicaveis: meus.length,
    passou: meus.filter((r) => r.estado === "passou").length,
    atencao: meus.filter((r) => r.estado === "atencao").length,
    bloqueio: meus.filter((r) => r.estado === "bloqueio").length,
    verificadas: meus.filter(
      (r) => r.estado === "passou" && (r.fonte === "automatica" || r.fonte === "sonda"),
    ).length,
    confirmadas: meus.filter((r) => r.fonte === "confirmacao").length,
    percentual: meus.length === 0 ? 0 : Math.round((soma / meus.length) * 100),
  };
}

// ---------------------------------------------------------------------------------------------
// O portão
// ---------------------------------------------------------------------------------------------

export type Veredito = { pode: true } | { pode: false; motivo: string; bloqueios: Resultado[] };

/**
 * Se a pessoa pode marcar a etapa como concluída.
 *
 * O portão olha só os bloqueios: `atencao` não impede seguir, porque a maior parte do que o app
 * não consegue verificar cai ali, e travar por isso transformaria o recurso numa parede.
 *
 * O que trava é o que o app **viu** estar errado no plano dela — senha sem hash, endpoint sem
 * regra de acesso, segredo em variável pública. Nesses casos não há o que confirmar: a correção é
 * no plano, e o texto do bloqueio diz onde.
 */
export function podeConcluir(relatorio: RelatorioValidacao): Veredito {
  if (relatorio.bloqueios.length === 0) return { pode: true };

  return {
    pode: false,
    motivo:
      relatorio.bloqueios.length === 1
        ? "Uma verificação encontrou um problema no seu plano que precisa ser corrigido antes."
        : `${relatorio.bloqueios.length} verificações encontraram problemas no seu plano que precisam ser corrigidos antes.`,
    bloqueios: relatorio.bloqueios,
  };
}

/**
 * As verificações de um domínio, para a tela que mostra um por vez.
 *
 * Mantém a ordem do motor: bloqueio primeiro.
 */
export function doDominio(relatorio: RelatorioValidacao, dominio: Dominio): Resultado[] {
  return relatorio.resultados.filter((r) => r.verificacao.dominio === dominio);
}
