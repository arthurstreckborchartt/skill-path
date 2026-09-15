/**
 * Contrato da lição gerada por IA — o conteúdo que a pessoa realmente lê e responde.
 *
 * Isto existe porque o que havia antes eram frases de template: "Ao final, você vai conseguir
 * explicar e aplicar {tarefa} no contexto de {etapa}". Preenchimento de lacuna não ensina
 * ninguém, e o quiz anterior usava como alternativas os objetivos das outras etapas — a resposta
 * certa estava escrita no topo da própria tela, e era a mesma para todas as tarefas da etapa.
 *
 * Aqui as perguntas têm que ser sobre o assunto, e as alternativas erradas têm que ser erros
 * plausíveis de quem está aprendendo — não ruído de outra etapa.
 */

export type Alternativa = {
  texto: string;
  correta: boolean;
  /** Por que está certa, ou qual confusão leva a escolhê-la. Aparece depois de responder. */
  porque: string;
};

export type Pergunta = {
  enunciado: string;
  alternativas: Alternativa[];
};

export type Licao = {
  /** 2 a 4 parágrafos que ensinam o conceito. Sem enrolação, sem repetir o título. */
  explicacao: string[];
  /** Um exemplo concreto, com números, comandos ou nomes reais. */
  exemplo: string;
  /** O passo a passo de execução da tarefa. */
  passos: string[];
  /** Erros comuns de quem está começando. */
  armadilhas: string[];
  perguntas: Pergunta[];
  /** O que a pessoa precisa produzir para provar que aprendeu. */
  pratica: string;
};

export const SCHEMA_LICAO = {
  type: "object" as const,
  properties: {
    explicacao: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description:
        "Parágrafos que ENSINAM o conceito a quem nunca viu. Explique o que é, como funciona e por que existe. Não repita o título da tarefa nem diga 'é importante aprender isso'.",
    },
    exemplo: {
      type: "string",
      description:
        "Um exemplo concreto e específico: números reais, comandos reais, nomes reais. Nada de 'por exemplo, imagine uma empresa'.",
    },
    passos: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" },
      description: "Como executar a tarefa, na ordem. Cada passo começa com verbo no infinitivo.",
    },
    armadilhas: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description: "Erros que quem está começando comete de verdade neste assunto específico.",
    },
    perguntas: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          enunciado: {
            type: "string",
            description:
              "Pergunta sobre o ASSUNTO, que exige entender e não decorar. Nunca pergunte qual é o objetivo da etapa.",
          },
          alternativas: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                texto: { type: "string" },
                correta: { type: "boolean" },
                porque: {
                  type: "string",
                  description:
                    "Se correta, por que é. Se errada, qual confusão comum leva a escolhê-la — nunca 'está errada'.",
                },
              },
              required: ["texto", "correta", "porque"],
              additionalProperties: false,
            },
          },
        },
        required: ["enunciado", "alternativas"],
        additionalProperties: false,
      },
    },
    pratica: {
      type: "string",
      description:
        "O que a pessoa precisa fazer e mostrar para provar que aprendeu. Verificável por ela mesma.",
    },
  },
  required: ["explicacao", "exemplo", "passos", "armadilhas", "perguntas", "pratica"],
  additionalProperties: false,
};

/** Schema não garante conteúdo utilizável: uma pergunta sem resposta certa passa pelo schema. */
export function validarLicao(valor: unknown): Licao | null {
  if (!valor || typeof valor !== "object") return null;
  const l = valor as Partial<Licao>;

  if (
    !Array.isArray(l.explicacao) ||
    l.explicacao.filter((p) => typeof p === "string" && p.trim()).length < 2
  ) {
    return null;
  }
  if (typeof l.exemplo !== "string" || !l.exemplo.trim()) return null;
  if (!Array.isArray(l.passos) || l.passos.length < 2) return null;
  if (!Array.isArray(l.perguntas) || l.perguntas.length < 1) return null;

  const perguntas = l.perguntas.filter((p) => {
    if (!p || typeof p.enunciado !== "string" || !Array.isArray(p.alternativas)) return false;
    if (p.alternativas.length < 2) return false;
    // Exatamente uma correta. Zero deixaria a pessoa sem saída; mais de uma quebra a correção.
    return p.alternativas.filter((a) => a?.correta === true).length === 1;
  });

  if (perguntas.length === 0) return null;

  return {
    explicacao: l.explicacao.filter((p) => typeof p === "string" && p.trim()),
    exemplo: l.exemplo,
    passos: l.passos.filter((p) => typeof p === "string" && p.trim()),
    armadilhas: Array.isArray(l.armadilhas)
      ? l.armadilhas.filter((p) => typeof p === "string" && p.trim())
      : [],
    perguntas,
    pratica: typeof l.pratica === "string" ? l.pratica : "",
  };
}
