import type { Blueprint } from "@/lib/blueprint/contrato";
import type { PropostaSugerida, TipoProposta } from "./contrato";
import { gravarProposta, mudarStatusProposta, type NovaProposta } from "./memoria";

/**
 * O ciclo de vida de uma proposta.
 *
 * Uma proposta é o que o Copilot quer mudar e ainda não mudou. Ela existe para que toda alteração
 * do Blueprint tenha um autor humano, uma data e um motivo — e para que dê para responder, depois,
 * o que mudou e por quê.
 *
 * Este arquivo cria, recusa e cancela. **Aprovar não está aqui**: aprovar escreve no Blueprint, e
 * essa escrita é a parte perigosa do sistema. Ela mora sozinha, na fase seguinte.
 */

// ---------------------------------------------------------------------------------------------
// Caminhos dentro do Blueprint
// ---------------------------------------------------------------------------------------------

/**
 * Segmentos que nunca podem aparecer num caminho.
 *
 * `campoAfetado` vem de um modelo de linguagem, e um caminho como `__proto__.admin` transformaria
 * uma proposta aprovada em poluição de protótipo — mudando o comportamento de objetos que não têm
 * nada a ver com o Blueprint. É barato bloquear e caro descobrir depois.
 */
const SEGMENTOS_PROIBIDOS = new Set(["__proto__", "constructor", "prototype"]);

/** Os blocos do Blueprint em que uma proposta pode mexer. Fora deles, o caminho é recusado. */
const RAIZES_PERMITIDAS = new Set(["fundacao", "produto", "tecnico", "operacao", "execucao"]);

export type CaminhoValido = { ok: true; segmentos: string[] } | { ok: false; motivo: string };

/**
 * Valida um caminho de ponto — "tecnico.stack.banco" — antes de qualquer leitura ou escrita.
 *
 * Lista de permissão, não de bloqueio: um caminho só passa se a raiz for um bloco conhecido do
 * Blueprint. Bloquear o que é perigoso exige prever tudo que é perigoso; permitir o que é
 * conhecido exige prever só o que é útil.
 */
export function validarCaminho(caminho: string): CaminhoValido {
  const segmentos = caminho.split(".").map((s) => s.trim());

  if (segmentos.length === 0 || segmentos.some((s) => s.length === 0)) {
    return { ok: false, motivo: "Caminho vazio ou com segmento em branco." };
  }

  if (segmentos.some((s) => SEGMENTOS_PROIBIDOS.has(s))) {
    return { ok: false, motivo: "Caminho usa um segmento reservado do JavaScript." };
  }

  const raiz = segmentos[0];
  if (!raiz || !RAIZES_PERMITIDAS.has(raiz)) {
    return {
      ok: false,
      motivo: `"${raiz ?? ""}" não é um bloco do Blueprint. Esperado: ${[...RAIZES_PERMITIDAS].join(", ")}.`,
    };
  }

  return { ok: true, segmentos };
}

/**
 * Lê o valor que está hoje no caminho.
 *
 * É o `valor_atual` da proposta — o "antes" da mudança. Sem ele, uma proposta aprovada não
 * consegue responder o que foi substituído, e a trilha de auditoria fica pela metade.
 *
 * `undefined` quando o caminho não existe, o que é diferente de `null`: um campo ausente e um
 * campo explicitamente vazio contam histórias diferentes sobre o plano.
 */
export function lerCaminho(blueprint: Blueprint, caminho: string): unknown {
  const v = validarCaminho(caminho);
  if (!v.ok) return undefined;

  let atual: unknown = blueprint;
  for (const seg of v.segmentos) {
    if (atual === null || typeof atual !== "object") return undefined;
    atual = (atual as Record<string, unknown>)[seg];
  }
  return atual;
}

// ---------------------------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------------------------

/**
 * Os tipos que exigem confirmação humana.
 *
 * Todos, hoje — `TIPOS_PROPOSTA` já é a lista fechada do que mexe no plano. A função existe para
 * que a regra tenha um lugar: quando aparecer um tipo que não precisa de confirmação, ele é
 * excluído aqui, e não espalhado por condicionais na tela.
 */
export function exigeConfirmacao(_tipo: TipoProposta): boolean {
  return true;
}

export type ResultadoCriacao = {
  criadas: string[];
  /** As que foram recusadas antes de chegar ao banco, com o motivo. */
  recusadas: { titulo: string; motivo: string }[];
};

/**
 * Transforma as sugestões de uma resposta do Copilot em propostas pendentes.
 *
 * Recusa antes de gravar em vez de gravar e deixar a tela lidar: uma proposta com caminho inválido
 * viraria um botão "aprovar" que não tem como funcionar — e descobrir isso no clique é pior do que
 * nunca ter oferecido o botão.
 */
export async function criarPropostas(
  projetoId: string,
  userId: string,
  blueprint: Blueprint,
  sugeridas: PropostaSugerida[],
): Promise<ResultadoCriacao> {
  const criadas: string[] = [];
  const recusadas: { titulo: string; motivo: string }[] = [];

  for (const s of sugeridas) {
    let valorAtual: unknown = null;

    if (s.campoAfetado) {
      const v = validarCaminho(s.campoAfetado);
      if (!v.ok) {
        recusadas.push({ titulo: s.titulo, motivo: v.motivo });
        continue;
      }
      valorAtual = lerCaminho(blueprint, s.campoAfetado) ?? null;
    }

    /**
     * Proposta que não muda nada é descartada.
     *
     * Acontece quando o Copilot "propõe" o que já está no plano — normalmente porque a conversa
     * confirmou uma escolha existente. Virar um cartão de aprovação aqui ensinaria a pessoa a
     * aprovar sem ler, que é o oposto do que o passo de confirmação existe para fazer.
     */
    if (s.campoAfetado && JSON.stringify(valorAtual) === JSON.stringify(s.valorProposto)) {
      recusadas.push({ titulo: s.titulo, motivo: "O valor proposto já é o que está no plano." });
      continue;
    }

    const nova: NovaProposta = {
      tipo: s.tipo,
      titulo: s.titulo,
      descricao: s.descricao,
      campoAfetado: s.campoAfetado,
      valorAtual,
      valorProposto: s.valorProposto,
      motivo: s.motivo,
      impactos: s.impactos,
    };

    const id = await gravarProposta(projetoId, userId, nova);
    if (id) criadas.push(id);
    else recusadas.push({ titulo: s.titulo, motivo: "Não consegui gravar a proposta." });
  }

  return { criadas, recusadas };
}

// ---------------------------------------------------------------------------------------------
// Recusa e cancelamento
// ---------------------------------------------------------------------------------------------

/** A pessoa leu e disse não. A proposta fica no histórico — recusa também é decisão. */
export async function rejeitarProposta(id: string): Promise<boolean> {
  return mudarStatusProposta(id, "rejeitada");
}

/**
 * A proposta deixou de fazer sentido sem ninguém ter decidido nada.
 *
 * Diferente de rejeitada: acontece quando o plano mudou por outro caminho e a proposta ficou
 * obsoleta. Guardar as duas como "rejeitada" apagaria a diferença entre "eu não quis" e "não
 * fazia mais sentido", que é justamente o que alguém vai querer saber ao reler o histórico.
 */
export async function cancelarProposta(id: string): Promise<boolean> {
  return mudarStatusProposta(id, "cancelada");
}
