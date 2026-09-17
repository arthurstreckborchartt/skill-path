import type { Cardinalidade, ModeloDeDados } from "./contrato";
import { ROTULO_TIPO } from "./contrato";

/**
 * O ERD, em Mermaid, derivado do modelo.
 *
 * Derivado, e não escrito pela IA junto com o resto: um diagrama redigido à parte do schema sai
 * dessincronizado na primeira alteração, e um diagrama que mente é pior que nenhum. Aqui ele é
 * sempre o mesmo modelo, visto de outro jeito.
 *
 * Mermaid porque é texto: cabe no banco, entra num README, e o GitHub renderiza sozinho. Uma
 * imagem exigiria gerar e guardar arquivo para algo que a pessoa vai querer colar em outro lugar.
 */

/** A notação de pé de galinha do Mermaid, dos dois lados da relação. */
const NOTACAO: Record<Cardinalidade, string> = {
  "1:1": "||--||",
  "1:N": "||--o{",
  "N:N": "}o--o{",
};

function tipoCurto(tipo: string, enumValores: string[]): string {
  if (enumValores.length > 0) return "enum";
  // Mermaid não aceita espaço no tipo do atributo.
  return tipo.replace(/\s+/g, "_");
}

export function gerarErd(m: ModeloDeDados): string {
  const linhas: string[] = ["erDiagram"];

  for (const e of m.entidades) {
    linhas.push(`    ${e.nome} {`);

    for (const c of e.colunas) {
      const marcas: string[] = [];
      if (e.chavePrimaria.includes(c.nome)) marcas.push("PK");
      if (m.relacoes.some((r) => r.de === e.nome && r.coluna === c.nome)) marcas.push("FK");
      if (c.unica && !e.chavePrimaria.includes(c.nome)) marcas.push("UK");

      // O comentário entre aspas é onde cabe a explicação sem quebrar a sintaxe.
      const nota = c.sensivel ? "dado sensivel" : c.descricao.slice(0, 40);
      linhas.push(
        `        ${tipoCurto(c.tipoLogico, c.enumValores)} ${c.nome}${marcas.length ? ` ${marcas.join(",")}` : ""}${nota ? ` "${nota.replace(/"/g, "")}"` : ""}`,
      );
    }

    if (e.temTimestamps) {
      linhas.push(`        data_hora criado_em "automatico"`);
      linhas.push(`        data_hora atualizado_em "automatico"`);
    }
    if (e.temSoftDelete) linhas.push(`        data_hora apagado_em "soft delete"`);

    linhas.push("    }");
  }

  for (const r of m.relacoes) {
    // O rótulo da relação é o que explica a leitura do diagrama: "pedidos pertence a clientes".
    linhas.push(`    ${r.para} ${NOTACAO[r.cardinalidade]} ${r.de} : "${r.coluna}"`);
  }

  return linhas.join("\n");
}

/** A documentação das tabelas em Markdown, para colar num README ou numa wiki. */
export function gerarDocumentacao(m: ModeloDeDados, nomeProjeto: string): string {
  const partes: string[] = [`# Modelo de dados — ${nomeProjeto}`, ""];

  if (m.notas.length > 0) {
    partes.push("## Decisões deste modelo", "");
    partes.push(...m.notas.map((n) => `- ${n}`));
    partes.push("");
  }

  partes.push("## Diagrama", "", "```mermaid", gerarErd(m), "```", "");

  for (const e of m.entidades) {
    partes.push(`## ${e.nome}`, "", e.descricao, "");
    if (e.porqueExiste) partes.push(`**Por que existe:** ${e.porqueExiste}`, "");

    partes.push("| Coluna | Tipo | Regras | O que é |", "| --- | --- | --- | --- |");

    for (const c of e.colunas) {
      const regras: string[] = [];
      if (e.chavePrimaria.includes(c.nome)) regras.push("chave primária");
      if (m.relacoes.some((r) => r.de === e.nome && r.coluna === c.nome)) {
        const r = m.relacoes.find((x) => x.de === e.nome && x.coluna === c.nome)!;
        regras.push(`aponta para ${r.para}`);
      }
      if (c.obrigatoria) regras.push("obrigatória");
      if (c.unica) regras.push("única");
      if (c.sensivel) regras.push("**dado sensível**");
      if (c.enumValores.length > 0) regras.push(`valores: ${c.enumValores.join(", ")}`);

      partes.push(
        `| \`${c.nome}\` | ${ROTULO_TIPO[c.tipoLogico]} | ${regras.join(", ") || "—"} | ${c.descricao} |`,
      );
    }
    partes.push("");

    if (e.temSoftDelete) {
      partes.push(
        `> **Soft delete:** esta tabela marca \`apagado_em\` em vez de remover a linha. ${e.porqueSoftDelete}`,
        "",
      );
    }
    if (e.temAuditoria) {
      partes.push(
        `> **Auditoria:** guarda \`criado_por\` e \`atualizado_por\`. ${e.porqueAuditoria}`,
        "",
      );
    }
  }

  if (m.relacoes.length > 0) {
    partes.push("## Relacionamentos", "");
    for (const r of m.relacoes) {
      partes.push(`### ${r.de} → ${r.para} (${r.cardinalidade})`, "", r.porque, "");
    }
  }

  return partes.join("\n");
}
