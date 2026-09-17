import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { FORMATO_ETAPA, SCHEMA_ETAPA, validarEtapa, type ConteudoEtapa } from "./etapa-contrato";
import { diretrizesEmTexto } from "./regras";
import { ROTULO_NIVEL, type Respostas } from "./respostas";
import type { Blueprint, Etapa } from "./contrato";

/**
 * Escreve o conteúdo de UMA etapa do roadmap. **Só no servidor.**
 *
 * O que torna isto diferente de perguntar a um chatbot "como faço migrations?" é o contexto: a
 * etapa é escrita sabendo a stack escolhida, os nomes das tabelas deste projeto, o que as etapas
 * anteriores já entregaram e o nível técnico de quem vai executar. A resposta genérica a pessoa
 * já consegue sozinha — o que ela não consegue é a resposta para o projeto dela.
 */

const SISTEMA = `Você escreve o passo a passo de UMA etapa da construção de um software, para a
pessoa que vai executá-la.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

COMO ESCREVER:
- Fale do projeto DESTA pessoa. Cite os nomes reais das tabelas, telas e serviços dela. Uma
  explicação que serviria para qualquer projeto não serve para nenhum.
- Seja concreto: nome de arquivo, comando de terminal, nome de coluna. Nada de "configure o
  ambiente adequadamente".
- Não repita o título da etapa como se fosse explicação.
- Não motive. Ensine.

AS DUAS TRILHAS:
- "prompt" é para quem vai pedir a uma IA de código. Escreva o prompt COMPLETO, pronto para
  colar, carregando o contexto do projeto e dizendo o que NÃO deve ser alterado.
- "modoManual" é para quem vai digitar tudo à mão, sem IA nenhuma. Precisa bastar sozinho.
  Nunca escreva "peça para a IA" dentro dele — isso quebra a única razão de ele existir.

O QUE NUNCA FAZER:
- Não invente URL, número de versão nem estatística.
- Não prometa prazo de sucesso nem resultado de negócio.
- Não sugira ferramenta paga sem dizer que existe alternativa gratuita, quando existir.`;

/** O que já foi entregue antes — para a etapa não repetir trabalho nem pressupor o que não existe. */
function jaFeito(todas: Etapa[], atual: Etapa): string {
  const anteriores = todas.filter((e) => e.ordem < atual.ordem);
  if (anteriores.length === 0) {
    return "Esta é a primeira etapa do projeto. Nada foi construído ainda.";
  }
  const dependencias = atual.dependeDe
    .map((d) => todas.find((e) => e.ordem === d))
    .filter((e): e is Etapa => Boolean(e));

  return [
    `## O que já foi entregue nas etapas anteriores`,
    ...anteriores.slice(-8).map((e) => `- Etapa ${e.ordem}: ${e.entrega}`),
    dependencias.length > 0
      ? `\nEsta etapa depende diretamente de: ${dependencias.map((d) => `etapa ${d.ordem} (${d.titulo})`).join(", ")}.`
      : "",
  ].join("\n");
}

function contextoTecnico(bp: Blueprint): string {
  const t = bp.tecnico;
  if (!t) return "";

  const partes = [
    `## O projeto`,
    `Stack: ${t.stack.frontend} / ${t.stack.backend} / ${t.stack.banco} / ${t.stack.hospedagem}`,
    `Arquitetura: ${t.arquitetura}`,
  ];

  if (t.tabelas.length > 0) {
    partes.push(
      `Tabelas: ${t.tabelas.map((x) => `${x.nome} (${x.campos.map((c) => c.nome).join(", ")})`).join(" | ")}`,
    );
  }
  if (t.endpoints.length > 0) {
    partes.push(`Endpoints: ${t.endpoints.map((e) => `${e.metodo} ${e.caminho}`).join(", ")}`);
  }
  if (t.autenticacao.necessaria) {
    partes.push(`Autenticação: ${t.autenticacao.metodo}`);
  }
  if (t.integracoes.length > 0) {
    partes.push(`Integrações: ${t.integracoes.map((i) => i.nome).join(", ")}`);
  }

  return partes.join("\n");
}

/** Os requisitos que esta etapa provavelmente atende, para o checklist apontar para eles. */
function requisitosRelacionados(bp: Blueprint, etapa: Etapa): string {
  const rf = bp.produto?.requisitosFuncionais ?? [];
  if (rf.length === 0) return "";

  const alvo = `${etapa.titulo} ${etapa.entrega}`.toLowerCase();
  const provaveis = rf.filter((r) => {
    const palavras = r.funcionalidade
      .toLowerCase()
      .split(/\s+/)
      .filter((p) => p.length > 4);
    return palavras.some((p) => alvo.includes(p));
  });

  const lista = provaveis.length > 0 ? provaveis : rf.slice(0, 4);
  return [
    ``,
    `## Requisitos funcionais que podem se encaixar aqui`,
    ...lista.map(
      (r) => `- ${r.id} (${r.funcionalidade}): ${r.descricao} — pronto quando: ${r.criterioAceite}`,
    ),
  ].join("\n");
}

/** Medido: uma etapa completa sai em 25 a 50s. O orçamento dá espaço para uma segunda tentativa. */
const TETO_MS = 80_000;

export async function gerarEtapa(
  etapa: Etapa,
  todasEtapas: Etapa[],
  blueprint: Blueprint,
  respostas: Respostas,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<ConteudoEtapa>> {
  const usuario = [
    `Escreva o passo a passo desta etapa:`,
    ``,
    `**Etapa ${etapa.ordem} — ${etapa.titulo}**`,
    `Fase: ${etapa.fase}`,
    `O que ela entrega: ${etapa.entrega}`,
    `Estimativa: ${etapa.estimativaHoras} horas`,
    ``,
    contextoTecnico(blueprint),
    requisitosRelacionados(blueprint, etapa),
    ``,
    jaFeito(todasEtapas, etapa),
    ``,
    `## Quem vai executar`,
    `Nível técnico: ${ROTULO_NIVEL[respostas.nivelTecnico]}`,
    `Vai construir: ${respostas.comoConstroi.map((m) => (m === "ia" ? "pedindo a uma IA" : "programando à mão")).join(" e ")}`,
    ``,
    diretrizesEmTexto(respostas),
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA_ETAPA,
      formato: FORMATO_ETAPA,
      validar: validarEtapa,
      tetoMs: TETO_MS,
      maxTokens: 10_240,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
