import type { Analise, ContextoSeguranca, Gravidade } from "./riscos";
import type { RiscoExtra } from "./extras";

/**
 * O checklist de segurança do projeto.
 *
 * Derivado da análise, e não escrito à parte: um checklist que não sabe o que a análise
 * encontrou lista as mesmas vinte linhas para todo mundo, e quem lê aprende a ignorá-lo.
 *
 * A ordem importa. O que tem evidência vem primeiro, porque é o que já se sabe que está errado.
 * Depois o crítico sem evidência, e por último o resto. Um checklist que começa por "configure o
 * CORS" enquanto existe senha sem hash no banco ensina a prioridade errada.
 */

export type ItemSeguranca = {
  /** O que conferir. Uma ação, não um tema. */
  texto: string;
  /** Como conferir, concretamente. */
  como: string;
  gravidade: Gravidade;
  /** A evidência que motivou este item, quando houver. */
  evidencia: string | null;
  riscoId: string;
};

const PESO: Record<Gravidade, number> = { critico: 0, alto: 1, medio: 2 };

export function gerarChecklist(
  analise: Analise,
  extras: RiscoExtra[],
  c: ContextoSeguranca,
): ItemSeguranca[] {
  const itens: ItemSeguranca[] = [];

  // 1. O que tem evidência: um item por evidência, porque cada uma é um lugar concreto.
  for (const a of analise.confirmados) {
    for (const evidencia of a.evidencias) {
      itens.push({
        texto: a.risco.titulo,
        como: a.risco.comoValidar[0] ?? "Confira à mão.",
        gravidade: a.risco.gravidade,
        evidencia,
        riscoId: a.risco.id,
      });
    }
  }

  // 2. O que se aplica sem evidência automática, do mais grave para o menos.
  for (const a of [...analise.paraConferir].sort(
    (x, y) => PESO[x.risco.gravidade] - PESO[y.risco.gravidade],
  )) {
    itens.push({
      texto: a.risco.titulo,
      como: a.risco.comoValidar[0] ?? "Confira à mão.",
      gravidade: a.risco.gravidade,
      evidencia: null,
      riscoId: a.risco.id,
    });
  }

  // 3. Os específicos do projeto, quando a IA encontrou algum.
  for (const e of extras) {
    itens.push({
      texto: e.titulo,
      como: e.comoValidar[0] ?? "Confira à mão.",
      gravidade: e.gravidade,
      evidencia: null,
      riscoId: `extra-${e.titulo.slice(0, 20)}`,
    });
  }

  /**
   * O item final, que nunca sai da lista.
   *
   * A análise lê o plano, não o código. Terminar o checklist sem dizer isso deixaria a pessoa
   * marcar tudo e concluir que está segura — que é o resultado mais perigoso que este módulo
   * poderia produzir.
   */
  itens.push({
    texto: "Conferi o que esta análise não alcança",
    como: `Esta lista saiu do seu plano${c.modelo ? "" : " (sem modelo de dados)"}${c.api ? "" : " (sem mapa de API)"}, não do seu código. Antes de lançar, releia as rotas que mexem em dinheiro e em dado pessoal com os olhos de quem quer invadir.`,
    gravidade: "alto",
    evidencia: null,
    riscoId: "limites",
  });

  return itens;
}

/** O resumo numérico, para a tela abrir com o tamanho do problema. */
export function contarRiscos(analise: Analise, extras: RiscoExtra[]) {
  const evidencias = analise.confirmados.reduce((n, a) => n + a.evidencias.length, 0);
  const criticosConfirmados = analise.confirmados.filter(
    (a) => a.risco.gravidade === "critico",
  ).length;

  return {
    evidencias,
    criticosConfirmados,
    aplicaveis: analise.confirmados.length + analise.paraConferir.length + extras.length,
    foraDoProjeto: analise.foraDoProjeto.length,
  };
}

/** O relatório em Markdown, para anexar num README ou mandar para alguém revisar. */
export function gerarRelatorio(
  analise: Analise,
  extras: RiscoExtra[],
  nomeProjeto: string,
  limites: string[],
): string {
  const p: string[] = [`# Análise de segurança — ${nomeProjeto}`, ""];

  p.push("## O que esta análise vê e o que não vê", "", ...limites.map((l) => `- ${l}`), "");

  if (analise.confirmados.length > 0) {
    p.push("## Encontrado no seu plano", "");
    for (const a of analise.confirmados) {
      p.push(`### ${a.risco.titulo} (${a.risco.gravidade})`, "");
      p.push("**Onde:**", "", ...a.evidencias.map((e) => `- ${e}`), "");
      p.push(`**O que pode acontecer:** ${a.risco.oQuePodeAcontecer}`, "");
      p.push(`**Por que importa:** ${a.risco.porqueImporta}`, "");
      p.push("**Como prevenir:**", "", ...a.risco.comoPrevenir.map((x) => `- ${x}`), "");
      p.push("**Como validar:**", "", ...a.risco.comoValidar.map((x) => `- ${x}`), "");
    }
  }

  if (extras.length > 0) {
    p.push("## Riscos específicos deste projeto", "");
    for (const e of extras) {
      p.push(`### ${e.titulo} (${e.gravidade})`, "");
      p.push(`**O que pode acontecer:** ${e.oQuePodeAcontecer}`, "");
      p.push(`**Por que importa:** ${e.porqueImporta}`, "");
      p.push("**Como prevenir:**", "", ...e.comoPrevenir.map((x) => `- ${x}`), "");
      p.push("**Como validar:**", "", ...e.comoValidar.map((x) => `- ${x}`), "");
    }
  }

  p.push("## A conferir à mão", "");
  for (const a of analise.paraConferir) {
    p.push(`### ${a.risco.titulo} (${a.risco.gravidade})`, "");
    p.push(`**O que pode acontecer:** ${a.risco.oQuePodeAcontecer}`, "");
    p.push(`**Por que importa:** ${a.risco.porqueImporta}`, "");
    p.push("**Como prevenir:**", "", ...a.risco.comoPrevenir.map((x) => `- ${x}`), "");
    p.push("**Como validar:**", "", ...a.risco.comoValidar.map((x) => `- ${x}`), "");
  }

  if (analise.foraDoProjeto.length > 0) {
    p.push("## Não se aplica a este projeto", "");
    for (const { risco, porque } of analise.foraDoProjeto) {
      p.push(`- **${risco.titulo}** — ${porque}`);
    }
    p.push("");
  }

  return p.join("\n");
}
