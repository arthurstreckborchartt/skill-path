import type { Coluna, Entidade, ModeloDeDados, TipoLogico } from "./contrato";

/**
 * Tradução do modelo lógico para SQL de cada banco.
 *
 * É aqui que "funciona para PostgreSQL, MySQL e outras" deixa de ser promessa e vira código. O
 * modelo guarda `tipoLogico: "dinheiro"`; este arquivo sabe que isso é `numeric(12,2)` no
 * Postgres, `DECIMAL(12,2)` no MySQL e `REAL` no SQLite — com um aviso, porque SQLite não tem
 * decimal exato e guardar dinheiro nele dá diferença de centavo.
 *
 * Cada dialeto declara também o que NÃO tem. Enum nativo existe no Postgres e no MySQL; no SQLite
 * vira `CHECK (coluna IN (...))`. Fingir que os três são iguais entregaria SQL que não roda.
 */

export const DIALETOS = ["postgres", "mysql", "sqlite"] as const;
export type Dialeto = (typeof DIALETOS)[number];

export const ROTULO_DIALETO: Record<Dialeto, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

/** Adivinha o dialeto pelo que o plano técnico escolheu, para a tela já abrir no certo. */
export function dialetoDaStack(banco: string): Dialeto {
  const t = banco.toLowerCase();
  if (t.includes("sqlite")) return "sqlite";
  if (t.includes("mysql") || t.includes("mariadb")) return "mysql";
  // Postgres é o padrão: é o que Supabase, Neon, Render e Railway entregam.
  return "postgres";
}

type Traducao = {
  tipo: (c: Coluna) => string;
  /** Tipo da chave primária gerada automaticamente. */
  chaveAuto: string;
  padrao: (valor: string, c: Coluna) => string | null;
  /** Declaração de enum antes das tabelas (Postgres) ou vazio. */
  enumAntes: (entidades: Entidade[]) => string[];
  /** Restrição extra para simular enum onde ele não existe. */
  enumComoCheck: boolean;
  /** Avisos do dialeto para este modelo. Aparecem junto do SQL. */
  avisos: (m: ModeloDeDados) => string[];
  aspas: (nome: string) => string;
};

function enumNome(tabela: string, coluna: string): string {
  return `${tabela}_${coluna}_enum`;
}

const POSTGRES: Traducao = {
  chaveAuto: "uuid primary key default gen_random_uuid()",
  tipo: (c) => {
    const mapa: Record<TipoLogico, string> = {
      uuid: "uuid",
      texto: "text",
      texto_curto: `varchar(${c.tamanho ?? 255})`,
      inteiro: "integer",
      decimal: "numeric(12,4)",
      dinheiro: "numeric(12,2)",
      booleano: "boolean",
      data: "date",
      data_hora: "timestamptz",
      json: "jsonb",
      enum: "TIPO_ENUM",
    };
    return mapa[c.tipoLogico];
  },
  padrao: (valor) => {
    if (valor === "agora") return "now()";
    if (valor === "uuid") return "gen_random_uuid()";
    if (valor === "true" || valor === "false") return valor;
    if (/^-?\d+(\.\d+)?$/.test(valor)) return valor;
    return `'${valor.replace(/'/g, "''")}'`;
  },
  enumAntes: (entidades) =>
    entidades.flatMap((e) =>
      e.colunas
        .filter((c) => c.tipoLogico === "enum")
        .map(
          (c) =>
            `create type ${enumNome(e.nome, c.nome)} as enum (${c.enumValores
              .map((v) => `'${v.replace(/'/g, "''")}'`)
              .join(", ")});`,
        ),
    ),
  enumComoCheck: false,
  avisos: () => [],
  aspas: (n) => n,
};

const MYSQL: Traducao = {
  chaveAuto: "CHAR(36) PRIMARY KEY DEFAULT (UUID())",
  tipo: (c) => {
    const mapa: Record<TipoLogico, string> = {
      uuid: "CHAR(36)",
      texto: "TEXT",
      texto_curto: `VARCHAR(${c.tamanho ?? 255})`,
      inteiro: "INT",
      decimal: "DECIMAL(12,4)",
      dinheiro: "DECIMAL(12,2)",
      booleano: "TINYINT(1)",
      data: "DATE",
      data_hora: "DATETIME",
      json: "JSON",
      // `?? []` porque o mapa inteiro e avaliado antes de ser indexado: sem isto, uma coluna
      // de data quebra aqui ao tentar ler os valores de um enum que ela nao tem.
      enum: `ENUM(${(c.enumValores ?? []).map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`,
    };
    return mapa[c.tipoLogico];
  },
  padrao: (valor, c) => {
    if (valor === "agora") return "CURRENT_TIMESTAMP";
    if (valor === "uuid") return "(UUID())";
    if (valor === "true") return "1";
    if (valor === "false") return "0";
    if (/^-?\d+(\.\d+)?$/.test(valor)) return valor;
    // TEXT e JSON não aceitam DEFAULT literal no MySQL sem parênteses.
    if (c.tipoLogico === "texto" || c.tipoLogico === "json") return null;
    return `'${valor.replace(/'/g, "''")}'`;
  },
  enumAntes: () => [],
  enumComoCheck: false,
  avisos: (m) => {
    const avisos: string[] = [];
    if (m.entidades.some((e) => e.colunas.some((c) => c.tipoLogico === "uuid"))) {
      avisos.push(
        "UUID no MySQL vira CHAR(36), que ocupa 36 bytes por chave. Em tabelas que vão passar de alguns milhões de linhas, um INT AUTO_INCREMENT é bem mais leve — a troca vale a pena se você espera esse volume.",
      );
    }
    if (m.entidades.some((e) => e.colunas.some((c) => c.tipoLogico === "texto" && c.padrao))) {
      avisos.push(
        "Colunas TEXT no MySQL não aceitam valor padrão. Os DEFAULT dessas colunas foram omitidos do script.",
      );
    }
    return avisos;
  },
  aspas: (n) => `\`${n}\``,
};

const SQLITE: Traducao = {
  chaveAuto: "TEXT PRIMARY KEY",
  tipo: (c) => {
    const mapa: Record<TipoLogico, string> = {
      uuid: "TEXT",
      texto: "TEXT",
      texto_curto: "TEXT",
      inteiro: "INTEGER",
      decimal: "REAL",
      dinheiro: "INTEGER",
      booleano: "INTEGER",
      data: "TEXT",
      data_hora: "TEXT",
      json: "TEXT",
      enum: "TEXT",
    };
    return mapa[c.tipoLogico];
  },
  padrao: (valor) => {
    if (valor === "agora") return "CURRENT_TIMESTAMP";
    if (valor === "true") return "1";
    if (valor === "false") return "0";
    if (valor === "uuid") return null; // Sem função nativa: quem insere gera o id.
    if (/^-?\d+(\.\d+)?$/.test(valor)) return valor;
    return `'${valor.replace(/'/g, "''")}'`;
  },
  enumAntes: () => [],
  enumComoCheck: true,
  avisos: (m) => {
    const avisos: string[] = [];
    if (m.entidades.some((e) => e.colunas.some((c) => c.tipoLogico === "dinheiro"))) {
      avisos.push(
        "SQLite não tem tipo decimal exato. Valores em dinheiro viraram INTEGER — guarde em centavos (R$ 19,90 = 1990) e divida por 100 só para mostrar. Guardar em REAL causa diferença de centavo no fechamento.",
      );
    }
    if (m.entidades.some((e) => e.colunas.some((c) => c.tipoLogico === "uuid"))) {
      avisos.push(
        "SQLite não gera UUID sozinho. O id precisa ser criado pelo seu código antes do INSERT.",
      );
    }
    if (m.entidades.some((e) => e.colunas.some((c) => c.tipoLogico === "enum"))) {
      avisos.push(
        "SQLite não tem ENUM. As listas fechadas viraram CHECK (coluna IN (...)), que dá a mesma garantia.",
      );
    }
    avisos.push(
      "Chaves estrangeiras no SQLite só são verificadas com `PRAGMA foreign_keys = ON;` — precisa rodar em cada conexão.",
    );
    return avisos;
  },
  aspas: (n) => `"${n}"`,
};

const TRADUCOES: Record<Dialeto, Traducao> = {
  postgres: POSTGRES,
  mysql: MYSQL,
  sqlite: SQLITE,
};

function tipoDaColuna(c: Coluna, d: Dialeto): string {
  const t = TRADUCOES[d];
  const bruto = t.tipo(c);
  if (bruto === "TIPO_ENUM") return "ENUM_PLACEHOLDER";
  return bruto;
}

function linhaDaColuna(
  e: Entidade,
  c: Coluna,
  d: Dialeto,
  ehPk: boolean,
): { linha: string; check: string | null } {
  const t = TRADUCOES[d];
  const nome = t.aspas(c.nome);

  let tipo = tipoDaColuna(c, d);
  if (tipo === "ENUM_PLACEHOLDER") tipo = enumNome(e.nome, c.nome);

  const partes = [nome, tipo];

  // PK de uma coluna só entra inline; composta vai na cláusula própria no fim da tabela.
  if (ehPk && e.chavePrimaria.length === 1) partes.push("primary key");
  else if (c.obrigatoria) partes.push("not null");

  if (c.unica && !ehPk) partes.push("unique");

  if (c.padrao) {
    const p = t.padrao(c.padrao, c);
    if (p) partes.push(`default ${p}`);
  }

  const check =
    t.enumComoCheck && c.tipoLogico === "enum" && c.enumValores.length > 0
      ? `check (${nome} in (${c.enumValores.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")}))`
      : null;

  return { linha: partes.join(" "), check };
}

/**
 * Uma coluna completa, para quando o gerador precisa de um tipo sem ter uma coluna do modelo.
 *
 * Antes daqui era `{ tipoLogico: "data_hora" } as Coluna` — um cast que mentia sobre o objeto e
 * derrubava o gerador do MySQL, que le `enumValores` ao montar a tabela de tipos. Cast para
 * silenciar o compilador esconde exatamente este tipo de falta.
 */
function colunaSintetica(tipoLogico: TipoLogico): Coluna {
  return {
    nome: "",
    tipoLogico,
    enumValores: [],
    tamanho: null,
    obrigatoria: false,
    unica: false,
    padrao: null,
    descricao: "",
    porque: "",
    sensivel: false,
  };
}

/** As colunas que `temTimestamps`, `temSoftDelete` e `temAuditoria` acrescentam. */
function colunasAutomaticas(e: Entidade, d: Dialeto): string[] {
  const t = TRADUCOES[d];
  const agora = t.padrao("agora", colunaSintetica("data_hora"));
  const dataHora = t.tipo(colunaSintetica("data_hora"));
  const uuid = t.tipo(colunaSintetica("uuid"));
  const linhas: string[] = [];

  if (e.temTimestamps) {
    linhas.push(`${t.aspas("criado_em")} ${dataHora} not null default ${agora}`);
    linhas.push(`${t.aspas("atualizado_em")} ${dataHora} not null default ${agora}`);
  }
  if (e.temSoftDelete) {
    linhas.push(`${t.aspas("apagado_em")} ${dataHora}`);
  }
  if (e.temAuditoria) {
    linhas.push(`${t.aspas("criado_por")} ${uuid}`);
    linhas.push(`${t.aspas("atualizado_por")} ${uuid}`);
  }
  return linhas;
}

export type SaidaSql = { sql: string; avisos: string[] };

/** O script completo de criação, no dialeto escolhido. */
export function gerarSql(m: ModeloDeDados, d: Dialeto): SaidaSql {
  const t = TRADUCOES[d];
  const blocos: string[] = [];

  const enums = t.enumAntes(m.entidades);
  if (enums.length > 0) {
    blocos.push(
      `-- Listas fechadas, declaradas antes das tabelas que as usam.\n${enums.join("\n")}`,
    );
  }

  for (const e of m.entidades) {
    const linhas: string[] = [];
    const checks: string[] = [];

    for (const c of e.colunas) {
      const ehPk = e.chavePrimaria.includes(c.nome);
      const { linha, check } = linhaDaColuna(e, c, d, ehPk);
      linhas.push(linha);
      if (check) checks.push(check);
    }

    linhas.push(...colunasAutomaticas(e, d));

    if (e.chavePrimaria.length > 1) {
      linhas.push(`primary key (${e.chavePrimaria.map((c) => t.aspas(c)).join(", ")})`);
    }

    // FKs vão dentro do CREATE TABLE: o SQLite não tem ALTER TABLE ADD CONSTRAINT, então fazer
    // fora funcionaria em dois dialetos e quebraria no terceiro.
    for (const r of m.relacoes.filter((x) => x.de === e.nome)) {
      const alvo = m.entidades.find((x) => x.nome === r.para);
      const pk = alvo?.chavePrimaria[0] ?? "id";
      const acao = r.aoApagarPai === "set null" ? "set null" : r.aoApagarPai;
      linhas.push(
        `foreign key (${t.aspas(r.coluna)}) references ${t.aspas(r.para)} (${t.aspas(pk)}) on delete ${acao}`,
      );
    }

    linhas.push(...checks);
    for (const r of m.restricoes.filter((x) => x.tabela === e.nome)) {
      linhas.push(`constraint ${t.aspas(r.nome)} check (${r.expressao})`);
    }

    const comentario = e.descricao ? `-- ${e.descricao}\n` : "";
    blocos.push(`${comentario}create table ${t.aspas(e.nome)} (\n  ${linhas.join(",\n  ")}\n);`);
  }

  const indices = m.indices.map((i) => {
    const nome = `idx_${i.tabela}_${i.colunas.join("_")}`.slice(0, 60);
    return `-- ${i.porque}\ncreate ${i.unico ? "unique " : ""}index ${t.aspas(nome)} on ${t.aspas(i.tabela)} (${i.colunas.map((c) => t.aspas(c)).join(", ")});`;
  });
  if (indices.length > 0) blocos.push(indices.join("\n\n"));

  return { sql: blocos.join("\n\n"), avisos: t.avisos(m) };
}

/**
 * O script de desfazer.
 *
 * Existe porque uma migration sem volta é uma migration que ninguém tem coragem de rodar. A ordem
 * é a inversa da criação: apagar a tabela referenciada antes de quem a referencia quebraria.
 */
export function gerarSqlDesfazer(m: ModeloDeDados, d: Dialeto): string {
  const t = TRADUCOES[d];
  const linhas = [...m.entidades].reverse().map((e) => `drop table if exists ${t.aspas(e.nome)};`);

  const enums =
    d === "postgres"
      ? m.entidades.flatMap((e) =>
          e.colunas
            .filter((c) => c.tipoLogico === "enum")
            .map((c) => `drop type if exists ${enumNome(e.nome, c.nome)};`),
        )
      : [];

  return [...linhas, ...enums].join("\n");
}

/** Nome de arquivo de migration, no padrão que quase toda ferramenta entende. */
export function nomeDaMigration(nomeProjeto: string): string {
  const carimbo = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const slug = nomeProjeto
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const n = c.codePointAt(0) ?? 0;
      return !(n >= 0x300 && n <= 0x36f);
    })
    .join("")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30);
  return `${carimbo}_criar_schema_${slug || "inicial"}`;
}
