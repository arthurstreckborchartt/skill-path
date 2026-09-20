/**
 * As fases do projeto, e de onde elas vêm.
 *
 * Arquivo próprio, sem nenhum import de runtime, por duas razões. A primeira é organização: é uma
 * tabela, não comportamento. A segunda é que assim dá para exercitá-la fora do navegador — e há
 * aqui um invariante que quebra em silêncio: se alguém acrescentar uma regra em `proximo-passo.ts`
 * e esquecer de mapeá-la, a tela mostra "Plano" para um projeto que está em outra fase, sem erro
 * nenhum em lugar nenhum.
 */

export const FASES = [
  "descoberta",
  "plano",
  "arquitetura",
  "operacao",
  "construcao",
  "pronto",
] as const;
export type Fase = (typeof FASES)[number];

export const ROTULO_FASE: Record<Fase, string> = {
  descoberta: "Descoberta",
  plano: "Plano",
  arquitetura: "Arquitetura",
  operacao: "Operação",
  construcao: "Construção",
  pronto: "Pronto",
};

export const DESCRICAO_FASE: Record<Fase, string> = {
  descoberta: "Entendendo o que você quer construir, e para quem.",
  plano: "Definindo produto, fronteira do MVP e decisões técnicas.",
  arquitetura: "Desenhando dados, API, segurança e o papel da IA.",
  operacao: "Definindo o que sustenta o produto e a ordem de construir.",
  construcao: "Executando a trilha, etapa por etapa.",
  pronto: "O plano está completo e a trilha, terminada.",
};

/**
 * A fase vem do próximo passo, e não de uma contagem própria.
 *
 * Deduzir a fase separadamente criaria duas verdades sobre onde o projeto está — e no dia em que
 * discordassem, a tela mostraria uma fase e mandaria fazer outra coisa.
 */
const FASE_POR_PASSO: Record<string, Fase> = {
  questionario: "descoberta",
  fundacao: "plano",
  produto: "plano",
  tecnico: "plano",
  banco: "arquitetura",
  api: "arquitetura",
  seguranca: "arquitetura",
  "arquitetura-ia": "arquitetura",
  operacao: "operacao",
  execucao: "operacao",
  roadmap: "construcao",
  concluido: "pronto",
};

/** A fase de um passo. `null` quando o passo não foi mapeado — quem chama decide o que fazer. */
export function faseDoPasso(idDoPasso: string): Fase | null {
  return FASE_POR_PASSO[idDoPasso] ?? null;
}
