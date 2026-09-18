import { supabase } from "@/integrations/supabase/client";
import type { Blueprint } from "@/lib/blueprint/contrato";
import type { Proposta } from "./contrato";
import { validarCaminho } from "./propostas";
import { mudarStatusProposta, registrarDecisao } from "./memoria";

/**
 * A aprovação: a única escrita do Copilot no Blueprint.
 *
 * Mora sozinha porque é a parte perigosa do sistema. Tudo o mais que o Copilot faz é reversível —
 * uma resposta ruim se ignora, uma proposta ruim se rejeita. Isto aqui muda o plano do projeto, e
 * o plano é o produto.
 *
 * Só roda a partir de uma proposta que a pessoa leu e aprovou. Não existe caminho neste arquivo
 * que comece numa resposta da IA.
 */

/**
 * Escreve um valor num caminho, sem alterar o objeto original.
 *
 * Cópia rasa por nível em vez de mutação: o Blueprint está em estado de React, e mutar um objeto
 * que já foi renderizado é a origem clássica de "mudei o dado e a tela não atualizou".
 *
 * Nível intermediário que não existe é criado como objeto vazio; nível que existe mas não é
 * objeto derruba a escrita — sobrescrever uma string com um objeto para caber um caminho
 * destruiria o que estava lá.
 */
export function escreverCaminho(
  blueprint: Blueprint,
  caminho: string,
  valor: unknown,
): { ok: true; blueprint: Blueprint } | { ok: false; motivo: string } {
  const v = validarCaminho(caminho);
  if (!v.ok) return { ok: false, motivo: v.motivo };

  const raiz = { ...blueprint } as Record<string, unknown>;
  let atual = raiz;

  for (let i = 0; i < v.segmentos.length - 1; i++) {
    const seg = v.segmentos[i] as string;
    const proximo = atual[seg];

    if (proximo === undefined || proximo === null) {
      atual[seg] = {};
    } else if (typeof proximo !== "object" || Array.isArray(proximo)) {
      return {
        ok: false,
        motivo: `"${v.segmentos.slice(0, i + 1).join(".")}" não é um objeto — não dá para escrever dentro dele.`,
      };
    } else {
      atual[seg] = { ...(proximo as Record<string, unknown>) };
    }

    atual = atual[seg] as Record<string, unknown>;
  }

  const ultimo = v.segmentos[v.segmentos.length - 1] as string;
  atual[ultimo] = valor;

  return { ok: true, blueprint: raiz as Blueprint };
}

/**
 * A chave de decisão de cada tipo de proposta.
 *
 * Fixa, e não escolhida pela IA: a chave é o que agrupa o histórico de um assunto. Se o modelo
 * escrevesse "banco-de-dados" hoje e "bancoDados" amanhã, a supersedência pararia de funcionar e
 * o projeto acumularia duas decisões ativas sobre a mesma coisa sem ninguém perceber.
 */
const CHAVE_POR_TIPO: Record<string, string> = {
  stack: "stack",
  banco: "banco",
  api: "api",
  auth: "auth",
  seguranca: "seguranca",
  funcionalidade: "funcionalidades",
  arquitetura: "arquitetura",
  requisito: "requisitos",
  decisao: "decisao",
};

export type ResultadoAprovacao =
  | { ok: true; blueprint: Blueprint; decisaoId: string }
  | { ok: false; motivo: string; blueprintAlterado: boolean };

/**
 * Aprova uma proposta: altera o Blueprint, registra a decisão e aposenta a anterior.
 *
 * ## A ordem das três escritas
 *
 * Não há transação entre elas, então uma pode falhar sozinha. Escolhi a ordem pelo estrago da
 * falha parcial, não pela elegância:
 *
 * 1. **Blueprint.** Se parar aqui, nada mudou em lugar nenhum e a proposta segue pendente.
 * 2. **Decisão.** Se parar aqui, o plano está certo e a auditoria incompleta — a proposta continua
 *    pendente, e aprovar de novo escreve o mesmo valor (idempotente) e completa o registro.
 * 3. **Status da proposta.** Só no fim, porque é ele que impede a repetição.
 *
 * A ordem inversa seria pior: uma decisão registrada dizendo "MySQL" sobre um plano que ainda diz
 * "PostgreSQL" faz o Copilot aconselhar sobre um projeto que não existe — e isso ninguém percebe
 * olhando a tela.
 */
export async function aprovarProposta(
  projetoId: string,
  userId: string,
  proposta: Proposta,
  blueprint: Blueprint,
): Promise<ResultadoAprovacao> {
  if (proposta.status !== "pendente") {
    return {
      ok: false,
      motivo: `Esta proposta já foi ${proposta.status}.`,
      blueprintAlterado: false,
    };
  }

  let novoBlueprint = blueprint;

  // 1. O Blueprint. Proposta sem campo afetado só registra decisão — é o caso de "decidimos não
  //    usar agentes", que muda o que vale sem mudar nenhum campo do plano.
  if (proposta.campoAfetado) {
    const escrita = escreverCaminho(blueprint, proposta.campoAfetado, proposta.valorProposto);
    if (!escrita.ok) return { ok: false, motivo: escrita.motivo, blueprintAlterado: false };

    const { error } = await supabase
      .from("pathly_projetos")
      .update({ conteudo: escrita.blueprint as never, atualizado_em: new Date().toISOString() })
      .eq("id", projetoId);

    if (error) {
      return {
        ok: false,
        motivo: "Não consegui salvar a mudança no plano. Nada foi alterado.",
        blueprintAlterado: false,
      };
    }

    novoBlueprint = escrita.blueprint;
  }

  // 2. A decisão, com o motivo que a pessoa leu antes de aprovar.
  const decisao = await registrarDecisao(projetoId, userId, {
    chave: CHAVE_POR_TIPO[proposta.tipo] ?? proposta.tipo,
    titulo: proposta.titulo,
    valor: descreverValor(proposta.valorProposto),
    motivo: proposta.motivo,
    origem: "copilot",
    confirmada: true,
  });

  if (!decisao.ok) {
    return {
      ok: false,
      motivo:
        "O plano foi alterado, mas não consegui registrar a decisão. Aprove de novo para completar o registro.",
      blueprintAlterado: proposta.campoAfetado !== null,
    };
  }

  // 3. A proposta sai de pendente por último.
  await mudarStatusProposta(proposta.id, "aprovada", decisao.id);

  return { ok: true, blueprint: novoBlueprint, decisaoId: decisao.id };
}

/**
 * O valor da decisão em texto.
 *
 * `valor` é `text` no banco de propósito: decisão é para ler, e "PostgreSQL" diz mais que
 * `{"banco":"PostgreSQL"}`. O JSON estruturado continua guardado na proposta, que é quem responde
 * "o que exatamente mudou".
 */
function descreverValor(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  if (Array.isArray(valor)) return valor.map(descreverValor).join(", ");

  const json = JSON.stringify(valor);
  return json.length > 200 ? `${json.slice(0, 197)}…` : json;
}
