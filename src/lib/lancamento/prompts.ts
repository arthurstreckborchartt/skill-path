import { montarPrompt, type Destino, type TipoPrompt } from "@/lib/copilot/prompt-builder";
import type { ContextoLancamento, Passo, Trilha } from "./contrato";

/**
 * O prompt de um passo do lançamento, pronto para colar num agente de código.
 *
 * ## Por que isto não reimplementa a montagem
 *
 * O `prompt-builder` já resolve a parte difícil: as regras de convivência que não podem variar,
 * o contexto do projeto, e o ajuste por destino — Claude, Cursor, Codex, Lovable, ChatGPT.
 * Duplicar aqui criaria dois lugares onde essas regras existem, e o segundo envelheceria em
 * silêncio.
 *
 * O que este módulo traz é a **tarefa**: a frase imperativa que descreve o que fazer, vinda do
 * catálogo e já preenchida com os dados do projeto. O resto vem de lá.
 *
 * ## O tipo de trabalho não é sempre "deploy"
 *
 * Um passo de índice é trabalho de banco; um de cabeçalho de segurança é trabalho de segurança.
 * Mandar tudo como `deploy` faria o prompt pedir ao agente o enquadramento errado, e prompt com
 * enquadramento errado gera código com a preocupação errada.
 */

const TIPO_POR_TRILHA: Record<Trilha, TipoPrompt> = {
  "pre-lancamento": "deploy",
  seguranca: "seguranca",
  banco: "banco",
  desempenho: "backend",
  producao: "deploy",
};

export function temPrompt(passo: Passo): boolean {
  return typeof passo.tarefa === "function";
}

/**
 * `null` quando o passo não tem tarefa de código.
 *
 * Vários não têm, e é de propósito: registrar um domínio, ligar backup no painel do provedor ou
 * restaurar um backup não são coisas que um agente faz por você. Oferecer um prompt para elas
 * seria fingir que a parte difícil é escrever código.
 */
export function promptDoPasso(
  passo: Passo,
  contexto: ContextoLancamento,
  destino: Destino,
  progresso: number,
): string | null {
  if (!passo.tarefa) return null;

  const tarefa = [
    passo.tarefa(contexto),
    "",
    `Contexto do passo: ${passo.titulo}.`,
    `Por que importa: ${passo.porque}`,
    `Como conferir que ficou pronto: ${passo.comoValidar}`,
    passo.armadilha ? `Erro comum a evitar: ${passo.armadilha}` : null,
    `Ambientes em que isto vale: ${passo.ambientes.join(", ")}.`,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return montarPrompt({
    destino,
    tipo: TIPO_POR_TRILHA[passo.trilha],
    alvo: { tipo: "livre", tarefa },
    nomeProjeto: contexto.nomeProjeto,
    blueprint: contexto.blueprint,
    modelo: contexto.modelo,
    api: contexto.api,
    /*
     * Decisões, estado do banco e etapas concluídas ficam vazios de propósito: este módulo não
     * os carrega, e passá-los pela metade seria pior que não passar — o prompt diria ao agente
     * que o projeto não decidiu nada, quando na verdade ninguém perguntou.
     */
    decisoes: [],
    estadoBanco: null,
    jaExiste: [],
    etapasConcluidas: [],
    progresso,
  });
}
