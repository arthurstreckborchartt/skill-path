import type { RouteStep } from "@/lib/route-map";

/**
 * Contrato da rota gerada por IA.
 *
 * Regra central, e ela não é estética: **a IA escreve o conteúdo de estudo, nunca a matemática
 * de dinheiro.** O modelo devolve título, objetivo, habilidades, projetos e tarefas; quem calcula
 * `incomeAfter`, `xp`, `eta`, `week` e `order` é o servidor, com a mesma conta determinística de
 * sempre — a divisão da distância entre a renda atual e a meta.
 *
 * O motivo: um número de renda inventado por um modelo, exibido numa tela, vira promessa de
 * salário. A Pathly não promete emprego nem renda, e a única forma de garantir isso é a IA não
 * ter acesso a essa caneta.
 */

/** O que o modelo devolve por etapa. Deliberadamente sem nenhum campo numérico de renda. */
export type EtapaIA = {
  titulo: string;
  objetivo: string;
  porque: string;
  marco: string;
  habilidades: string[];
  projetos: string[];
  dificuldade: "fácil" | "médio" | "difícil";
  impacto: "médio" | "alto" | "muito alto";
  horas: number;
  tarefas: string[];
};

export type RotaIA = {
  papel: string;
  etapas: EtapaIA[];
};

/**
 * Schema para `output_config.format`. A API valida a resposta contra ele, então o que chega aqui
 * já tem a forma certa — o `validarRota` abaixo continua existindo porque "forma certa" não é o
 * mesmo que "conteúdo utilizável" (lista vazia, horas zeradas, uma etapa só).
 */
export const SCHEMA_ROTA = {
  type: "object" as const,
  properties: {
    papel: {
      type: "string",
      description:
        "O papel profissional que a rota leva a pessoa a exercer. Ex.: 'Analista de Dados'.",
    },
    etapas: {
      type: "array",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Curto, concreto, sem jargão de marketing." },
          objetivo: {
            type: "string",
            description: "Uma frase: o que a pessoa consegue fazer ao terminar.",
          },
          porque: {
            type: "string",
            description: "Por que isso importa para a meta dela, em 1-2 frases.",
          },
          marco: {
            type: "string",
            description: "O marco profissional concreto que esta etapa destrava.",
          },
          habilidades: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          projetos: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string" },
            description: "Projetos de portfólio que provam a habilidade.",
          },
          dificuldade: { type: "string", enum: ["fácil", "médio", "difícil"] },
          impacto: { type: "string", enum: ["médio", "alto", "muito alto"] },
          horas: { type: "number", description: "Carga total estimada da etapa, entre 6 e 60." },
          tarefas: {
            type: "array",
            minItems: 4,
            maxItems: 8,
            items: { type: "string" },
            description:
              "Tarefas pequenas e verificáveis, na ordem de execução. Cada uma precisa caber numa sessão de estudo e começar com um verbo no infinitivo.",
          },
        },
        required: [
          "titulo",
          "objetivo",
          "porque",
          "marco",
          "habilidades",
          "projetos",
          "dificuldade",
          "impacto",
          "horas",
          "tarefas",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["papel", "etapas"],
  additionalProperties: false,
};

/** Barreira de sanidade: schema garante forma, isto garante que dá para usar. */
export function validarRota(valor: unknown): RotaIA | null {
  if (!valor || typeof valor !== "object") return null;
  const r = valor as Partial<RotaIA>;
  if (typeof r.papel !== "string" || !r.papel.trim()) return null;
  if (!Array.isArray(r.etapas) || r.etapas.length < 4) return null;

  const etapas = r.etapas.filter(
    (e): e is EtapaIA =>
      !!e &&
      typeof e.titulo === "string" &&
      e.titulo.trim().length > 0 &&
      typeof e.objetivo === "string" &&
      Array.isArray(e.habilidades) &&
      e.habilidades.length > 0 &&
      Array.isArray(e.tarefas) &&
      e.tarefas.length >= 3 &&
      typeof e.horas === "number" &&
      Number.isFinite(e.horas),
  );

  if (etapas.length < 4) return null;
  return { papel: r.papel.trim(), etapas };
}

/** Sem acento, sem espaço: vira id estável de etapa. */
function slug(texto: string, i: number): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${i + 1}-${base || "etapa"}`;
}

function arredondarDez(n: number): number {
  return Math.round(n / 10) * 10;
}

/**
 * Converte a saída do modelo para o formato que as telas já renderizam. Tudo que é número de
 * dinheiro, ordem, semana ou XP é calculado aqui — nunca vem do modelo.
 */
export function paraRouteSteps(
  rota: RotaIA,
  opcoes: { rendaAtual: number; rendaMeta: number; horasPorSemana: number },
): RouteStep[] {
  const { rendaAtual, rendaMeta, horasPorSemana } = opcoes;
  const total = rota.etapas.length;
  const horasSeguras = Math.max(2, horasPorSemana);
  let semana = 1;

  return rota.etapas.map((e, i) => {
    const horas = Math.min(60, Math.max(6, Math.round(e.horas)));
    const semanas = Math.max(1, Math.round(horas / horasSeguras));
    const semanaInicio = semana;
    semana += semanas;

    // Mesma conta determinística da rota por regras: a distância até a meta dividida pelo
    // progresso na rota. É marco alcançado, não previsão de salário.
    const peso = (i + 1) / total;
    const incomeAfter = arredondarDez(rendaAtual + (rendaMeta - rendaAtual) * peso);

    // Derivado do impacto, não gerado pelo modelo: a tela mostra isto como estimativa editorial
    // da Pathly, e um número inventado por IA exibido como porcentagem viraria estatística falsa.
    const demandPct = e.impacto === "muito alto" ? 85 : e.impacto === "alto" ? 70 : 55;

    return {
      id: slug(e.titulo, i),
      order: i + 1,
      title: e.titulo,
      goal: e.objetivo,
      eta: semanas === 1 ? "1 semana" : `${semanas} semanas`,
      difficulty: e.dificuldade,
      impact: e.impacto,
      incomeAfter,
      skills: e.habilidades,
      projects: e.projetos,
      resources: [],
      checklist: e.tarefas.map((label, ci) => ({ id: `c${ci + 1}`, label, done: false })),
      xp: 120 + i * 40 + (e.dificuldade === "difícil" ? 80 : e.dificuldade === "médio" ? 40 : 0),
      status: i === 0 ? "em andamento" : "bloqueado",
      why: e.porque,
      impactLevel: e.impacto,
      prereqs: i === 0 ? [] : [slug(rota.etapas[i - 1]!.titulo, i - 1)],
      milestone: e.marco,
      demandPct,
      hours: horas,
      week: semanaInicio,
    };
  });
}
