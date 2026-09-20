import { CATALOGO } from "./catalogo";
import {
  AMBIENTES,
  PESO_FONTE,
  TRILHAS,
  idConfirmacao,
  type Ambiente,
  type ContextoLancamento,
  type Estado,
  type Fonte,
  type ProgressoTrilha,
  type Relatorio,
  type Resultado,
  type Trilha,
} from "./contrato";

/**
 * Roda o catálogo contra o projeto.
 *
 * ## A ordem de decisão, e por que ela é esta
 *
 * 1. O passo se aplica? Se não, sai da lista — com o motivo contado, não escondido.
 * 2. O app consegue verificar? Então verifica, e a pessoa não tem o que clicar.
 * 3. Não consegue? Então ela pode confirmar, e a confirmação vale menos.
 *
 * O passo 2 vindo antes do 3 é o módulo inteiro. Invertendo, uma confirmação sobrescreveria uma
 * verificação — e a pessoa poderia declarar pronto o que o app acabou de reprovar.
 */

export type Confirmacoes = Record<string, { em: string }>;

function avaliar(
  passo: (typeof CATALOGO)[number],
  c: ContextoLancamento,
  conf: Confirmacoes,
): Resultado {
  if (passo.verificar) {
    const r = passo.verificar(c);
    return {
      passo,
      estado: r.estado,
      fonte: passo.fonte ?? "automatica",
      evidencia: r.evidencia,
      // Verificado não é confirmável. Deixar confirmar aqui seria deixar a pessoa
      // discordar da evidência clicando.
      aceitaConfirmacao: false,
    };
  }

  const confirmado = conf[idConfirmacao(passo.id)];
  if (confirmado) {
    return {
      passo,
      estado: "passou",
      fonte: "confirmacao",
      evidencia: `Você confirmou em ${new Date(confirmado.em).toLocaleDateString("pt-BR")}. É confirmação, não verificação — o Pathly não enxerga isto.`,
      aceitaConfirmacao: true,
    };
  }

  return {
    passo,
    estado: passo.bloqueiaLancamento ? "bloqueio" : "atencao",
    fonte: "pendente",
    evidencia: "",
    aceitaConfirmacao: true,
  };
}

export function gerarRelatorio(c: ContextoLancamento, conf: Confirmacoes): Relatorio {
  const aplicaveis = CATALOGO.filter((p) => (p.aplicaSe ? p.aplicaSe(c) : true));
  const resultados = aplicaveis.map((p) => avaliar(p, c, conf));

  const porTrilha: ProgressoTrilha[] = TRILHAS.map((trilha) =>
    progressoDe(
      trilha,
      resultados.filter((r) => r.passo.trilha === trilha),
    ),
  );

  /*
   * Bloqueio é só o que o passo declarou como impeditivo E não passou. Um passo comum em estado
   * de atenção não segura o lançamento — se segurasse, a pessoa aprenderia a ignorar a lista
   * inteira, que é o oposto do que este módulo quer.
   */
  const bloqueios = resultados.filter((r) => r.passo.bloqueiaLancamento && r.estado !== "passou");

  const total = resultados.length;
  const soma = resultados.reduce((s, r) => s + peso(r), 0);

  return {
    resultados,
    porTrilha,
    bloqueios,
    percentualGeral: total === 0 ? 0 : Math.round((soma / total) * 100),
    naoAplicaveis: CATALOGO.length - aplicaveis.length,
  };
}

/** Só quem passou soma, e soma conforme a fonte. Atenção e bloqueio valem zero. */
function peso(r: Resultado): number {
  return r.estado === "passou" ? PESO_FONTE[r.fonte] : 0;
}

function progressoDe(trilha: Trilha, rs: Resultado[]): ProgressoTrilha {
  const conta = (e: Estado) => rs.filter((r) => r.estado === e).length;
  const porFonte = (f: Fonte) => rs.filter((r) => r.estado === "passou" && r.fonte === f).length;
  const soma = rs.reduce((s, r) => s + peso(r), 0);

  return {
    trilha,
    aplicaveis: rs.length,
    passou: conta("passou"),
    atencao: conta("atencao"),
    bloqueio: conta("bloqueio"),
    verificados: porFonte("automatica") + porFonte("sonda"),
    confirmados: porFonte("confirmacao"),
    percentual: rs.length === 0 ? 0 : Math.round((soma / rs.length) * 100),
  };
}

// ---------------------------------------------------------------------------------------------
// Corte por ambiente
// ---------------------------------------------------------------------------------------------

export type ProgressoAmbiente = {
  ambiente: Ambiente;
  aplicaveis: number;
  pendentes: number;
  bloqueios: number;
  percentual: number;
};

/**
 * O mesmo relatório, olhado por ambiente.
 *
 * Existe porque a pergunta que a pessoa faz não é "quanto falta no total" — é "posso publicar em
 * produção?". Um passo que só vale em produção não deve diluir o progresso de staging, e um passo
 * pendente de desenvolvimento não deve parecer bloqueio de lançamento.
 */
export function progressoPorAmbiente(rel: Relatorio): ProgressoAmbiente[] {
  return AMBIENTES.map((ambiente) => {
    const rs = rel.resultados.filter((r) => r.passo.ambientes.includes(ambiente));
    const soma = rs.reduce((s, r) => s + peso(r), 0);
    return {
      ambiente,
      aplicaveis: rs.length,
      pendentes: rs.filter((r) => r.fonte === "pendente").length,
      bloqueios: rs.filter((r) => r.passo.bloqueiaLancamento && r.estado !== "passou").length,
      percentual: rs.length === 0 ? 0 : Math.round((soma / rs.length) * 100),
    };
  });
}

/**
 * O veredito de lançamento, em uma frase.
 *
 * Deliberadamente não devolve "pronto" quando há qualquer bloqueio, por mais alto que esteja o
 * percentual. Percentual alto com bloqueio aberto é exatamente a situação em que alguém publica.
 */
export function veredito(rel: Relatorio): { pode: boolean; frase: string } {
  if (rel.bloqueios.length > 0) {
    const n = rel.bloqueios.length;
    return {
      pode: false,
      frase: `${n} ${n === 1 ? "bloqueio aberto" : "bloqueios abertos"}. Cada um perde dado, vaza segredo, ou deixa o app inacessível — nenhum é questão de capricho.`,
    };
  }
  const pendentes = rel.resultados.filter((r) => r.fonte === "pendente").length;
  if (pendentes > 0) {
    return {
      pode: true,
      frase: `Nenhum bloqueio. Ainda há ${pendentes} ${pendentes === 1 ? "passo sem resposta" : "passos sem resposta"} — dá para publicar, sabendo o que ficou por conferir.`,
    };
  }
  return {
    pode: true,
    frase:
      "Nenhum bloqueio e nenhum passo sem resposta. O que o Pathly consegue conferir, conferiu.",
  };
}
