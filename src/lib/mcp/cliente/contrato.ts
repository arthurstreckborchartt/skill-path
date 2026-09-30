/**
 * O Pathly como **cliente** MCP: os tipos e a impressão digital de uma ferramenta.
 *
 * Não confundir com `src/lib/mcp/gateway/`, que é o Pathly como **servidor** — lá o Claude chama o
 * Pathly. Aqui é o contrário: o Pathly chama servidores que a pessoa conectar.
 *
 * ## A inversão que estes tipos existem para segurar
 *
 * O portão de `pathly_acoes_externas` foi desenhado para um catálogo **declarado**: cada ação em
 * `provedores.ts` tem `resumo` escrito à mão, em português, por nós — e o comentário de lá diz que
 * essa frase "deve dizer o efeito, não o endpoint".
 *
 * Em MCP as ferramentas são **descobertas**, e a descrição vem de quem opera o servidor. A frase
 * que a pessoa lê deixa de ser nossa. Isso não impede nada, mas obriga três coisas, e duas delas
 * moram aqui:
 *
 * 1. Texto do servidor é marcado como tal (`DescobertaDeFerramenta.descricao` nunca é apresentada
 *    como palavra do Pathly — quem renderiza atribui).
 * 2. O que vincula a aprovação é o JSON, não a descrição — isso o portão já faz, pelo `payload`.
 * 3. **Mudou, aprova de novo**: a `impressao` abaixo.
 */

/** O que um servidor MCP devolve em `tools/list`, no que nos interessa. */
export type DescobertaDeFerramenta = {
  nome: string;
  /** Texto do servidor. Nunca é nossa palavra, e a tela precisa deixar isso claro. */
  descricao: string;
  /** JSON Schema da entrada, como veio. */
  entrada: unknown;
  /**
   * `true` quando o servidor se declarou destrutivo.
   *
   * Só sobe o peso, nunca desce — ver `impactoDe`. Um servidor hostil se declara inofensivo, e a
   * anotação dele não pode ser o que nos deixa relaxados.
   */
  destrutivaSegundoOServidor: boolean;
};

export type ServidorMcp = {
  nome: string;
  versao: string;
  /** A versão do protocolo que o servidor aceitou, que pode não ser a que pedimos. */
  protocolo: string;
};

/**
 * Serialização canônica: as mesmas chaves, sempre na mesma ordem.
 *
 * Sem isto a impressão mudaria quando o servidor reordenasse o JSON sem mudar nada — e uma
 * aprovação morreria por um detalhe de serialização. É a mesma escolha do Hub, que já registra:
 * "a ordem das chaves não muda a impressão; a integração muda".
 */
function canonico(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canonico).join(",")}]`;
  const chaves = Object.keys(v as Record<string, unknown>).sort();
  const pares = chaves.map(
    (k) => `${JSON.stringify(k)}:${canonico((v as Record<string, unknown>)[k])}`,
  );
  return `{${pares.join(",")}}`;
}

/**
 * A impressão digital de uma ferramenta: nome, descrição e schema de entrada.
 *
 * ## Por que a descrição entra
 *
 * Porque é o que a pessoa leu para decidir. Um servidor que troca
 * "lista os arquivos do projeto" por "lista e apaga os arquivos do projeto" mudou o que foi
 * aprovado, mesmo com o schema idêntico. Deixar a descrição de fora faria a impressão dizer
 * "nada mudou" sobre exatamente a mudança que importa.
 *
 * ## Por que o schema entra
 *
 * Porque ele define o que pode ser enviado. Um campo novo é uma capacidade nova.
 *
 * SHA-256 pelo Web Crypto, que existe no Worker e no navegador — sem dependência.
 */
export async function impressaoDaFerramenta(f: DescobertaDeFerramenta): Promise<string> {
  const texto = canonico({ nome: f.nome, descricao: f.descricao, entrada: f.entrada });
  const bytes = new TextEncoder().encode(texto);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type Impacto = "leitura" | "escrita" | "destrutiva";

/**
 * O peso de uma ferramenta MCP.
 *
 * A regra em uma frase: **a dica do servidor pode nos deixar mais cuidadosos, nunca menos.**
 *
 * O MCP tem `readOnlyHint` e `destructiveHint`, mas são anotações **do servidor** — e um servidor
 * hostil se declara somente-leitura. Então toda ferramenta nasce `escrita`, `destructiveHint`
 * sobe para `destrutiva`, e `readOnlyHint` **não** baixa para `leitura`. Quem baixa é a pessoa, na
 * tela, ferramenta por ferramenta — e aí é uma decisão dela, tomada à vista.
 */
export function impactoDe(f: DescobertaDeFerramenta): Impacto {
  return f.destrutivaSegundoOServidor ? "destrutiva" : "escrita";
}
