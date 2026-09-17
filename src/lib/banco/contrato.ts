/**
 * O modelo de dados do projeto — a fonte de onde saem ERD, SQL, migrations e diagnóstico.
 *
 * ## A decisão que define este módulo: a IA não escreve SQL
 *
 * Seria mais rápido pedir "escreva o CREATE TABLE deste projeto" e mostrar o resultado. Mas aí:
 *
 * - **Não dá para trocar de dialeto.** O SQL viria fixo em Postgres, e gerar de novo para MySQL
 *   custaria outra chamada, com risco de as duas versões divergirem.
 * - **Não dá para detectar problema com confiança.** "Falta índice nesta FK" viraria algo que o
 *   modelo talvez mencione — e talvez não. Aqui é uma checagem que roda sempre.
 * - **Não dá para confiar no ERD.** Um diagrama escrito à parte do SQL sai dessincronizado na
 *   primeira alteração.
 *
 * Então a IA devolve um modelo estruturado, e o SQL, o ERD e o diagnóstico são **derivados dele
 * por código**. Mesma lição de `ia/contrato.ts`, onde o dinheiro é calculado no servidor e o
 * modelo só descreve a trilha.
 *
 * ## Tipos lógicos, não tipos SQL
 *
 * `tipoLogico: "dinheiro"` vira `numeric(12,2)` no Postgres, `DECIMAL(12,2)` no MySQL e
 * `REAL` com nota no SQLite. Se o contrato guardasse "numeric(12,2)", o modelo estaria preso a um
 * dialeto e a promessa de funcionar em vários seria só aparência.
 */

export const TIPOS_LOGICOS = [
  "uuid",
  "texto",
  "texto_curto",
  "inteiro",
  "decimal",
  "dinheiro",
  "booleano",
  "data",
  "data_hora",
  "json",
  "enum",
] as const;
export type TipoLogico = (typeof TIPOS_LOGICOS)[number];

export const ROTULO_TIPO: Record<TipoLogico, string> = {
  uuid: "identificador",
  texto: "texto longo",
  texto_curto: "texto curto",
  inteiro: "número inteiro",
  decimal: "número decimal",
  dinheiro: "valor em dinheiro",
  booleano: "sim/não",
  data: "data",
  data_hora: "data e hora",
  json: "estrutura livre",
  enum: "lista fechada",
};

export type Coluna = {
  nome: string;
  tipoLogico: TipoLogico;
  /** Só quando `tipoLogico` é `enum`. É o que vira type no Postgres e CHECK no SQLite. */
  enumValores: string[];
  /** Só para `texto_curto`. Sem isto, o dialeto escolhe um padrão. */
  tamanho: number | null;
  obrigatoria: boolean;
  unica: boolean;
  /** `agora`, `uuid`, `true`, `false`, `0` ou um literal. Traduzido por dialeto. */
  padrao: string | null;
  descricao: string;
  /** A explicação didática deste campo. "Esse campo deve ser unique porque…" */
  porque: string;
  /**
   * Dado pessoal ou sensível pela LGPD.
   *
   * Marcado no modelo, e não deduzido pelo nome, porque `documento` pode ser um CPF num sistema e
   * o número de uma nota fiscal em outro — quem sabe é quem modelou.
   */
  sensivel: boolean;
};

export type Cardinalidade = "1:1" | "1:N" | "N:N";

export type Relacao = {
  /** A tabela que guarda a chave estrangeira. */
  de: string;
  para: string;
  /** A coluna de `de` que aponta para a chave primária de `para`. */
  coluna: string;
  cardinalidade: Cardinalidade;
  /** "Essa relação é 1:N porque…" — o texto que ensina. */
  porque: string;
  aoApagarPai: "cascade" | "restrict" | "set null";
};

export type Indice = {
  tabela: string;
  colunas: string[];
  unico: boolean;
  porque: string;
};

export type Restricao = {
  tabela: string;
  nome: string;
  /** Expressão de CHECK, em SQL comum aos dialetos: `preco >= 0`, `status <> ''`. */
  expressao: string;
  porque: string;
};

export type Entidade = {
  nome: string;
  descricao: string;
  /** "Você precisa de uma tabela users porque…" — a explicação de existência. */
  porqueExiste: string;
  colunas: Coluna[];
  /** Nomes de colunas. Quase sempre uma; composta em tabela de ligação N:N. */
  chavePrimaria: string[];
  temTimestamps: boolean;
  /**
   * Apagar marcando em vez de remover.
   *
   * `porqueSoftDelete` é obrigatório quando ligado: soft delete complica toda consulta do sistema
   * para sempre, e ligar "por precaução" é o jeito mais comum de pagar esse preço à toa.
   */
  temSoftDelete: boolean;
  porqueSoftDelete: string;
  /** Registro de quem alterou o quê. Mesmo raciocínio: só com justificativa. */
  temAuditoria: boolean;
  porqueAuditoria: string;
};

export type ModeloDeDados = {
  entidades: Entidade[];
  relacoes: Relacao[];
  indices: Indice[];
  restricoes: Restricao[];
  /** Decisões gerais do modelo, em texto. Aparece como "por que este modelo é assim". */
  notas: string[];
};

// ---------------------------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------------------------

function texto(v: unknown, minimo: number): string | null {
  return typeof v === "string" && v.trim().length >= minimo ? v.trim() : null;
}

function nomeSql(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  // Nome que não serve como identificador vira SQL quebrado lá na frente, e o erro apareceria
  // longe daqui — na hora de copiar o script.
  return /^[a-z_][a-z0-9_]{0,62}$/.test(t) ? t : null;
}

function validarColuna(v: unknown): Coluna | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<Coluna>;

  const nome = nomeSql(c.nome);
  if (!nome) return null;

  const tipoLogico = TIPOS_LOGICOS.includes(c.tipoLogico as TipoLogico)
    ? (c.tipoLogico as TipoLogico)
    : "texto";

  const enumValores =
    tipoLogico === "enum" && Array.isArray(c.enumValores)
      ? c.enumValores.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      : [];

  // Enum sem valores não é enum. Vira texto, que ao menos funciona.
  const tipoFinal: TipoLogico =
    tipoLogico === "enum" && enumValores.length < 2 ? "texto" : tipoLogico;

  return {
    nome,
    tipoLogico: tipoFinal,
    enumValores: tipoFinal === "enum" ? enumValores : [],
    tamanho: typeof c.tamanho === "number" && c.tamanho > 0 ? Math.min(c.tamanho, 10_000) : null,
    obrigatoria: c.obrigatoria === true,
    unica: c.unica === true,
    padrao: texto(c.padrao, 1),
    descricao: texto(c.descricao, 3) ?? "",
    porque: texto(c.porque, 5) ?? "",
    sensivel: c.sensivel === true,
  };
}

function validarEntidade(v: unknown): Entidade | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Entidade>;

  const nome = nomeSql(e.nome);
  if (!nome) return null;

  const colunas = (Array.isArray(e.colunas) ? e.colunas : [])
    .map(validarColuna)
    .filter((c): c is Coluna => c !== null);
  if (colunas.length < 2) return null;

  const nomes = new Set(colunas.map((c) => c.nome));
  const chavePrimaria = (Array.isArray(e.chavePrimaria) ? e.chavePrimaria : [])
    .map((x) => nomeSql(x))
    .filter((x): x is string => x !== null && nomes.has(x));

  return {
    nome,
    descricao: texto(e.descricao, 5) ?? "",
    porqueExiste: texto(e.porqueExiste, 15) ?? "",
    colunas,
    // Sem PK declarada, assume a primeira coluna. Tabela sem chave primária é um problema que o
    // diagnóstico aponta; inventar uma aqui esconderia o defeito em vez de mostrá-lo.
    chavePrimaria: chavePrimaria.length > 0 ? chavePrimaria : [],
    temTimestamps: e.temTimestamps === true,
    temSoftDelete: e.temSoftDelete === true,
    porqueSoftDelete: texto(e.porqueSoftDelete, 10) ?? "",
    temAuditoria: e.temAuditoria === true,
    porqueAuditoria: texto(e.porqueAuditoria, 10) ?? "",
  };
}

/**
 * Encontra a tabela que uma coluna `algo_id` aponta.
 *
 * Testa o nome cru e as formas de plural do português: `produto_id` acha `produtos`,
 * `ficha_tecnica_id` acha `fichas_tecnicas`. Não é adivinhação — é a convenção que o próprio
 * prompt manda a IA seguir.
 */
function tabelaApontada(coluna: string, tabelas: Set<string>): string | null {
  if (!coluna.endsWith("_id")) return null;
  const base = coluna.slice(0, -3);
  if (!base) return null;

  const candidatos = [base, `${base}s`, `${base}es`];

  // Plural de nome composto pluraliza a primeira palavra: ficha_tecnica -> fichas_tecnicas.
  const partes = base.split("_");
  if (partes.length > 1) {
    const [primeira, ...resto] = partes;
    candidatos.push([`${primeira}s`, ...resto].join("_"));
    candidatos.push([`${primeira}s`, ...resto.map((r) => `${r}s`)].join("_"));
  }

  return candidatos.find((c) => tabelas.has(c)) ?? null;
}

/**
 * Deduz as relações que o modelo deixou de declarar.
 *
 * Em 17/09/2026 um modelo veio com sete tabelas, colunas `produto_id` e `venda_id`, índices
 * criados em cima delas — e `relacoes: []`. A IA entendeu os relacionamentos e não preencheu o
 * campo. Sem as relações não há chave estrangeira no SQL, e o banco deixa de garantir justamente
 * o que mais importa: que um item aponte para uma venda que existe.
 *
 * Deduzir é seguro aqui porque a evidência é forte: uma coluna `produto_id` numa base que tem a
 * tabela `produtos` não é ambígua. O texto explicativo sai mais seco que o da IA, e isso é melhor
 * que uma chave estrangeira ausente.
 */
function inferirRelacoes(entidades: Entidade[], jaDeclaradas: Relacao[]): Relacao[] {
  const tabelas = new Set(entidades.map((e) => e.nome));
  const cobertas = new Set(jaDeclaradas.map((r) => `${r.de}.${r.coluna}`));
  const novas: Relacao[] = [];

  for (const e of entidades) {
    for (const c of e.colunas) {
      if (cobertas.has(`${e.nome}.${c.nome}`)) continue;
      if (e.chavePrimaria.includes(c.nome)) continue;

      const alvo = tabelaApontada(c.nome, tabelas);
      if (!alvo || alvo === e.nome) continue;

      novas.push({
        de: e.nome,
        para: alvo,
        coluna: c.nome,
        cardinalidade: "1:N",
        porque: `Cada linha de ${e.nome} pertence a um registro de ${alvo}, e o mesmo registro de ${alvo} pode aparecer em várias linhas de ${e.nome}.`,
        // `restrict` é o padrão seguro: impede apagar o pai enquanto houver filho, em vez de
        // apagar dados em cascata numa relação que ninguém declarou de propósito.
        aoApagarPai: "restrict",
      });
    }
  }

  return novas;
}

export function validarModelo(valor: unknown): ModeloDeDados | null {
  if (!valor || typeof valor !== "object") return null;
  const m = valor as Partial<ModeloDeDados>;

  const entidades = (Array.isArray(m.entidades) ? m.entidades : [])
    .map(validarEntidade)
    .filter((e): e is Entidade => e !== null);
  if (entidades.length < 1) return null;

  const existe = new Set(entidades.map((e) => e.nome));

  /**
   * Relação para tabela que não existe é descartada.
   *
   * Acontece quando o modelo cita uma entidade no plural errado ou inventa uma que não criou.
   * Manter geraria uma FK apontando para o nada — SQL que não roda, entregue como se rodasse.
   */
  const relacoes = (Array.isArray(m.relacoes) ? m.relacoes : []).filter((r): r is Relacao => {
    if (!r) return false;
    const de = nomeSql(r.de);
    const para = nomeSql(r.para);
    const coluna = nomeSql(r.coluna);
    if (!de || !para || !coluna) return false;
    if (!existe.has(de) || !existe.has(para)) return false;
    return entidades.find((e) => e.nome === de)?.colunas.some((c) => c.nome === coluna) ?? false;
  });

  const indices = (Array.isArray(m.indices) ? m.indices : []).filter((i): i is Indice => {
    if (!i || !nomeSql(i.tabela) || !existe.has(nomeSql(i.tabela)!)) return false;
    const entidade = entidades.find((e) => e.nome === nomeSql(i.tabela));
    const colunas = Array.isArray(i.colunas) ? i.colunas : [];
    return (
      colunas.length > 0 &&
      colunas.every((c) => entidade?.colunas.some((x) => x.nome === nomeSql(c)))
    );
  });

  const restricoes = (Array.isArray(m.restricoes) ? m.restricoes : []).filter(
    (r): r is Restricao =>
      Boolean(r) &&
      Boolean(nomeSql(r.tabela)) &&
      existe.has(nomeSql(r.tabela)!) &&
      Boolean(texto(r.expressao, 3)),
  );

  const declaradas: Relacao[] = relacoes.map((r) => ({
    de: nomeSql(r.de)!,
    para: nomeSql(r.para)!,
    coluna: nomeSql(r.coluna)!,
    cardinalidade: (["1:1", "1:N", "N:N"] as const).includes(r.cardinalidade)
      ? r.cardinalidade
      : "1:N",
    porque: texto(r.porque, 10) ?? "",
    aoApagarPai: (["cascade", "restrict", "set null"] as const).includes(r.aoApagarPai)
      ? r.aoApagarPai
      : "restrict",
  }));

  return {
    entidades,
    // As declaradas primeiro: a explicação da IA é melhor que a deduzida.
    relacoes: [...declaradas, ...inferirRelacoes(entidades, declaradas)],
    indices: indices.map((i) => ({
      tabela: nomeSql(i.tabela)!,
      colunas: i.colunas.map((c) => nomeSql(c)!).filter(Boolean),
      unico: i.unico === true,
      porque: texto(i.porque, 10) ?? "",
    })),
    restricoes: restricoes.map((r) => ({
      tabela: nomeSql(r.tabela)!,
      nome: nomeSql(r.nome) ?? `chk_${nomeSql(r.tabela)}`,
      expressao: r.expressao.trim(),
      porque: texto(r.porque, 10) ?? "",
    })),
    notas: (Array.isArray(m.notas) ? m.notas : []).filter(
      (n): n is string => typeof n === "string" && n.trim().length > 10,
    ),
  };
}
