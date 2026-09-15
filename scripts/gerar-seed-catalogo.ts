/**
 * Gera supabase/seed-catalogo.sql a partir de src/lib/catalog.ts.
 *
 * O catálogo tem uma fonte de verdade só: o arquivo TypeScript. Este script traduz para SQL
 * em vez de manter duas listas em paralelo, que sempre divergem.
 *
 * Uso:  bun run scripts/gerar-seed-catalogo.ts
 */
import { writeFileSync } from "node:fs";
import { CATALOG } from "../src/lib/catalog";

/** Licença da fonte, por provedor. Ver supabase/FONTES-DE-CONTEUDO.md. */
const LICENCA: Record<string, string> = {
  freeCodeCamp: "BSD-3-Clause",
  "Ebook Foundation": "CC-BY-4.0",
};

function sqlText(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlArray(items: string[]): string {
  return items.length === 0 ? "'{}'" : `array[${items.map(sqlText).join(", ")}]`;
}

const linhas = CATALOG.map((r) => {
  const colunas = [
    sqlText(r.slug),
    sqlText(r.title),
    sqlText(r.url),
    sqlText(r.kind),
    sqlText(r.provider),
    sqlText(r.language),
    String(r.isFree),
    sqlArray(r.topics),
    sqlArray(r.areas),
    r.level ? sqlText(r.level) : "null",
    sqlText(r.summary),
    sqlText(r.provider),
    sqlText(LICENCA[r.provider] ?? "link + descrição própria"),
  ];
  return `  (${colunas.join(", ")})`;
});

const sql = `-- GERADO por scripts/gerar-seed-catalogo.ts — não edite à mão.
-- Fonte de verdade: src/lib/catalog.ts. Para atualizar, mude lá e rode o script de novo.
--
-- Rode depois de supabase/schema.sql. Reexecutar é seguro: o slug é único e o on conflict
-- atualiza a linha em vez de duplicar.

insert into public.pathly_resources
  (slug, title, url, kind, provider, language, is_free, topics, areas, level, summary, source, source_license)
values
${linhas.join(",\n")}
on conflict (slug) do update set
  title = excluded.title,
  url = excluded.url,
  kind = excluded.kind,
  provider = excluded.provider,
  language = excluded.language,
  is_free = excluded.is_free,
  topics = excluded.topics,
  areas = excluded.areas,
  level = excluded.level,
  summary = excluded.summary,
  source = excluded.source,
  source_license = excluded.source_license;
`;

writeFileSync("supabase/seed-catalogo.sql", sql, "utf-8");
console.log(`seed gerado: ${CATALOG.length} materiais -> supabase/seed-catalogo.sql`);
