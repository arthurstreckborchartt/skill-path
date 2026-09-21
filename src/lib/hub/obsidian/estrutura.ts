import type { TipoDeSincronia } from "./contrato";

/**
 * A estrutura de pastas — **sugerida**, nunca obrigatória.
 *
 * ## Por que ela não pode ser obrigatória
 *
 * Quem já usa Obsidian há um ano tem um vault organizado do jeito dele, com convenção própria,
 * links que dependem de caminho e provavelmente um Dataview apontando para pastas específicas.
 * Um produto que chega exigindo `PATHLY/Projects/` ou reorganiza o vault de alguém, ou é
 * abandonado na primeira tela.
 *
 * Então: a estrutura abaixo é o que o Pathly **propõe** quando a pessoa não tem preferência, e
 * todo caminho é remapeável. `CAMINHOS` é só o ponto de partida de `Mapeamento`.
 *
 * ## A estrutura proposta
 *
 * ```
 * PATHLY/
 * ├── Projects/
 * │   ├── NEXOS-Finance/
 * │   ├── NEXOS-Fit/
 * │   └── PATHLY/
 * ├── Blueprints/
 * ├── Technical-Decisions/
 * ├── Tasks/
 * ├── Errors/
 * ├── Research/
 * ├── Integrations/
 * └── Logs/
 * ```
 *
 * Duas escolhas dentro dela valem explicação:
 *
 * - **`Projects/<nome>/README.md` é a nota-índice**, e é a única que mistura tipos: estado,
 *   próximo passo e links para as demais. É a nota que a pessoa abre primeiro, e ter que pular
 *   entre sete arquivos para saber onde o projeto está anularia o propósito.
 * - **Nomes em inglês** porque é a convenção do exemplo que você deu e porque casa com o resto
 *   do ecossistema Obsidian (templates, plugins, exemplos). O conteúdo das notas é em português.
 */

export const RAIZ_PADRAO = "PATHLY";

/**
 * Onde cada tipo de conteúdo mora, relativo à raiz.
 *
 * `{projeto}` é substituído pelo nome do projeto, já higienizado para virar nome de pasta.
 */
export const CAMINHOS: Record<TipoDeSincronia, string> = {
  blueprint: "Blueprints/{projeto}.md",
  decisoes: "Technical-Decisions/{projeto}.md",
  estado: "Projects/{projeto}/README.md",
  tarefas: "Tasks/{projeto}.md",
  erros: "Errors/{projeto}.md",
  pesquisa: "Research/{projeto}",
  logs: "Logs/{projeto}.md",
};

/** As pastas que o Pathly propõe criar. `Integrations/` fica de fora: ainda não escreve nada lá. */
export const PASTAS_PROPOSTAS = [
  "Projects",
  "Blueprints",
  "Technical-Decisions",
  "Tasks",
  "Errors",
  "Research",
  "Logs",
] as const;

/**
 * Um nome de projeto virando nome de pasta.
 *
 * Tira o que o sistema de arquivos recusa e o que o Obsidian trata como sintaxe de link — `[`,
 * `]`, `#`, `|` quebram wikilinks, e um nome de nota que quebra link é uma nota que ninguém
 * alcança pelo grafo.
 */
export function comoPasta(nome: string): string {
  const limpo = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 60);

  /* Nome que sobrou vazio viraria um caminho terminando em barra, que grava na pasta errada. */
  return limpo || "projeto-sem-nome";
}

export type Mapeamento = {
  raiz: string;
  caminhos: Record<TipoDeSincronia, string>;
};

export function mapeamentoPadrao(): Mapeamento {
  return { raiz: RAIZ_PADRAO, caminhos: { ...CAMINHOS } };
}

/**
 * O caminho final de um tipo, para um projeto.
 *
 * Raiz vazia é aceita de propósito: quem já tem o vault organizado costuma querer as notas na
 * raiz dele, sem uma pasta `PATHLY/` por cima.
 */
export function caminhoDe(m: Mapeamento, tipo: TipoDeSincronia, projeto: string): string {
  const relativo = m.caminhos[tipo].replace("{projeto}", comoPasta(projeto));
  return m.raiz ? `${m.raiz}/${relativo}` : relativo;
}

/** A pasta que contém um caminho. `""` quando o caminho já está na raiz. */
export function pastaDe(caminho: string): string {
  const i = caminho.lastIndexOf("/");
  return i < 0 ? "" : caminho.slice(0, i);
}

/** As pastas que precisam existir para este projeto, sem repetir. */
export function pastasNecessarias(
  m: Mapeamento,
  projeto: string,
  tipos: readonly TipoDeSincronia[],
): string[] {
  const pastas = new Set<string>();
  for (const t of tipos) {
    const p = pastaDe(caminhoDe(m, t, projeto));
    if (p) pastas.add(p);
  }
  return [...pastas].sort();
}

/**
 * Valida um caminho remapeado antes de gravar qualquer coisa nele.
 *
 * O `..` é o que mais importa: um caminho com `..` escapa da pasta autorizada, e toda a
 * granularidade de permissão desta integração dependeria de alguém nunca digitar isso.
 */
export function validarCaminho(caminho: string): string | null {
  if (!caminho.trim()) return "O caminho não pode ficar vazio.";
  if (caminho.startsWith("/")) return "Use um caminho relativo ao vault, sem barra no começo.";
  if (caminho.split("/").includes("..")) {
    return "Caminho com “..” sai da pasta autorizada. Escreva o caminho completo dentro do vault.";
  }
  if (!caminho.endsWith(".md") && !caminho.includes("{projeto}")) {
    return "O caminho de uma nota precisa terminar em .md.";
  }
  if (/[<>:"|?*]/.test(caminho)) return "Esses caracteres não valem em nome de arquivo.";
  return null;
}

// =============================================================================================
// Os blocos de cada tipo
// =============================================================================================

/**
 * O nome do bloco que cada tipo escreve na nota.
 *
 * Um tipo, um bloco. É o que permite o Pathly atualizar decisões sem tocar no estado, mesmo
 * quando as duas coisas caem na mesma nota — como acontece no `README.md` do projeto.
 */
export const BLOCO_DO_TIPO: Record<TipoDeSincronia, string> = {
  blueprint: "blueprint",
  decisoes: "decisoes",
  estado: "estado",
  tarefas: "tarefas",
  erros: "erros",
  pesquisa: "pesquisa",
  logs: "logs",
};

/**
 * Os tipos que caem na nota-índice do projeto, além do próprio `estado`.
 *
 * `README.md` reúne estado e próximo passo porque é a nota que a pessoa abre primeiro. Os outros
 * tipos viram links a partir dela, e não cópias — duplicar conteúdo entre notas é como um vault
 * começa a mentir.
 */
export function ehNotaIndice(m: Mapeamento, tipo: TipoDeSincronia, projeto: string): boolean {
  return caminhoDe(m, tipo, projeto) === caminhoDe(m, "estado", projeto);
}
