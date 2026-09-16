/**
 * Os schemas JSON que a IA preenche, um por bloco.
 *
 * Separados de `contrato.ts` porque são grandes e mudam por outro motivo: o contrato muda quando
 * a forma do dado muda; o schema muda quando a qualidade da saída precisa melhorar. Misturar os
 * dois faria toda correção de prompt tocar o arquivo de tipos.
 *
 * As `description` de cada campo não são documentação — são instrução para o modelo, e é onde a
 * qualidade da saída realmente se decide. Vale escrevê-las como ordem, não como explicação.
 */

import type { Bloco } from "./contrato";

const ESQUEMA_FUNDACAO = {
  type: "object" as const,
  properties: {
    nome: {
      type: "string",
      description: "Nome curto e pronunciável para o produto. Sem 'Pro', 'Hub', 'AI' ou 'X'.",
    },
    descricao: {
      type: "string",
      description:
        "Uma frase que explica o produto para quem nunca ouviu falar dele. Concreta, sem jargão de investidor.",
    },
    problema: {
      type: "string",
      description:
        "A dor concreta que existe hoje, para uma pessoa específica, num momento específico. Nunca 'falta de organização' ou 'processos ineficientes' — diga o que dói, quando dói e o que custa.",
    },
    publico: {
      type: "string",
      description:
        "Quem paga. Seja específico: 'academias de bairro com 100 a 500 alunos e um dono que também treina' vale mais que 'donos de academia'.",
    },
    persona: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Um primeiro nome comum no Brasil." },
        papel: { type: "string" },
        contexto: {
          type: "string",
          description: "O dia dela hoje, sem o produto. O que faz, com o que, quantas vezes.",
        },
        dores: {
          type: "array",
          minItems: 2,
          maxItems: 4,
          items: { type: "string" },
          description: "Dores que essa pessoa reconheceria como dela ao ler.",
        },
        alternativaAtual: {
          type: "string",
          description:
            "Como ela resolve isso HOJE: planilha, caderno, WhatsApp, um concorrente com nome. Nunca 'nada' — sempre existe algo, nem que seja mal feito.",
        },
      },
      required: ["nome", "papel", "contexto", "dores", "alternativaAtual"],
      additionalProperties: false,
    },
    propostaDeValor: {
      type: "string",
      description:
        "Por que trocar a alternativa atual por isto. Precisa ser melhor o suficiente para justificar a troca, não apenas diferente.",
    },
    modeloDeNegocio: {
      type: "object",
      properties: {
        tipo: { type: "string", description: "assinatura, uso, licença, comissão ou gratuito." },
        precoSugerido: {
          type: "string",
          description: "Faixa em reais, para o mercado brasileiro. Ex: 'R$ 89 a R$ 149 por mês'.",
        },
        justificativa: {
          type: "string",
          description:
            "Por que esse preço: quanto o cliente gasta hoje com a alternativa, ou quanto ele ganha/economiza com isto.",
        },
      },
      required: ["tipo", "precoSugerido", "justificativa"],
      additionalProperties: false,
    },
  },
  required: [
    "nome",
    "descricao",
    "problema",
    "publico",
    "persona",
    "propostaDeValor",
    "modeloDeNegocio",
  ],
  additionalProperties: false,
};

const ESQUEMA_PRODUTO = {
  type: "object" as const,
  properties: {
    funcionalidades: {
      type: "array",
      minItems: 6,
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          descricao: {
            type: "string",
            description: "O que a pessoa consegue fazer. Comece com um verbo.",
          },
          prioridade: {
            type: "string",
            enum: ["mvp", "depois"],
            description:
              "'mvp' só para o que, se faltar, torna o produto inútil. Se tudo é mvp, nada é — no máximo um terço da lista deve ser mvp.",
          },
          porque: {
            type: "string",
            description:
              "Justifique a prioridade. Para 'depois', diga o que precisa acontecer antes de valer a pena.",
          },
          complexidade: { type: "string", enum: ["baixa", "media", "alta"] },
        },
        required: ["nome", "descricao", "prioridade", "porque", "complexidade"],
        additionalProperties: false,
      },
    },
    foraDoEscopo: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
      description:
        "O que este produto deliberadamente NÃO faz, e que alguém poderia esperar que fizesse. Isso protege o escopo.",
    },
  },
  required: ["funcionalidades", "foraDoEscopo"],
  additionalProperties: false,
};

const ESQUEMA_TECNICO = {
  type: "object" as const,
  properties: {
    stack: {
      type: "object",
      properties: {
        frontend: { type: "string" },
        backend: { type: "string" },
        banco: { type: "string" },
        hospedagem: { type: "string" },
        justificativa: {
          type: "string",
          description:
            "Por que essas escolhas para ESTE projeto e ESTE público. Não elogie as tecnologias em geral.",
        },
      },
      required: ["frontend", "backend", "banco", "hospedagem", "justificativa"],
      additionalProperties: false,
    },
    arquitetura: {
      type: "string",
      description:
        "Como as partes conversam, em 3 a 5 frases. Descreva o caminho de uma requisição de ponta a ponta.",
    },
    tabelas: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "snake_case, plural." },
          descricao: { type: "string" },
          campos: {
            type: "array",
            minItems: 3,
            items: {
              type: "object",
              properties: {
                nome: { type: "string" },
                tipo: {
                  type: "string",
                  description:
                    "Tipo do banco escolhido: uuid, text, timestamptz, numeric, boolean.",
                },
                descricao: { type: "string" },
              },
              required: ["nome", "tipo", "descricao"],
              additionalProperties: false,
            },
          },
          relacoes: {
            type: "array",
            items: { type: "string" },
            description: "Em português: 'pertence a academia', 'tem muitos pagamentos'.",
          },
        },
        required: ["nome", "descricao", "campos", "relacoes"],
        additionalProperties: false,
      },
    },
    endpoints: {
      type: "array",
      minItems: 4,
      maxItems: 16,
      items: {
        type: "object",
        properties: {
          metodo: { type: "string", enum: ["GET", "POST", "PATCH", "PUT", "DELETE"] },
          caminho: { type: "string", description: "Ex: /api/alunos/:id" },
          descricao: { type: "string" },
          autenticado: { type: "boolean" },
        },
        required: ["metodo", "caminho", "descricao", "autenticado"],
        additionalProperties: false,
      },
    },
    seguranca: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: { type: "string" },
      description:
        "Cuidados específicos DESTE projeto, dados os dados que ele guarda. Não liste 'usar HTTPS' — isso é padrão em qualquer lugar.",
    },
    integracoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Serviço real, com nome. Ex: Stripe, Twilio." },
          para: { type: "string", description: "Para que serve neste projeto." },
          obrigatoria: {
            type: "boolean",
            description: "true só se o produto não funciona sem ela.",
          },
        },
        required: ["nome", "para", "obrigatoria"],
        additionalProperties: false,
      },
    },
    ia: {
      type: "string",
      description:
        "Onde IA agrega valor real neste produto. Se não agregar, diga isso claramente — enfiar IA onde não precisa é erro caro.",
    },
  },
  required: ["stack", "arquitetura", "tabelas", "endpoints", "seguranca", "integracoes", "ia"],
  additionalProperties: false,
};

const ESQUEMA_EXECUCAO = {
  type: "object" as const,
  properties: {
    fases: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          objetivo: { type: "string", description: "O que está pronto quando a fase termina." },
        },
        required: ["nome", "objetivo"],
        additionalProperties: false,
      },
      description:
        "A primeira fase é sempre fundação técnica (projeto, banco, autenticação). Telas nunca vêm antes do modelo de dados.",
    },
    etapas: {
      type: "array",
      minItems: 10,
      maxItems: 30,
      items: {
        type: "object",
        properties: {
          ordem: { type: "number", description: "Começa em 1, sem pular número." },
          titulo: { type: "string", description: "Comece com verbo no infinitivo." },
          entrega: {
            type: "string",
            description:
              "O que passa a existir quando esta etapa termina, de forma verificável. Nada de 'entender X' — entregas são coisas que existem.",
          },
          fase: { type: "string", description: "O nome exato de uma das fases acima." },
          dependeDe: {
            type: "array",
            items: { type: "number" },
            description: "Ordens das etapas que precisam estar prontas antes. Vazio se nenhuma.",
          },
          estimativaHoras: {
            type: "number",
            description: "Entre 1 e 20. Etapa maior que 20h deve ser dividida.",
          },
        },
        required: ["ordem", "titulo", "entrega", "fase", "dependeDe", "estimativaHoras"],
        additionalProperties: false,
      },
    },
    riscos: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          descricao: {
            type: "string",
            description:
              "Risco real deste projeto: técnico, de mercado ou de execução. Não 'o projeto pode atrasar'.",
          },
          impacto: { type: "string", enum: ["baixo", "medio", "alto"] },
          mitigacao: {
            type: "string",
            description: "Uma ação concreta, não 'monitorar de perto'.",
          },
        },
        required: ["descricao", "impacto", "mitigacao"],
        additionalProperties: false,
      },
    },
  },
  required: ["fases", "etapas", "riscos"],
  additionalProperties: false,
};

export const ESQUEMAS: Record<Bloco, Record<string, unknown>> = {
  fundacao: ESQUEMA_FUNDACAO,
  produto: ESQUEMA_PRODUTO,
  tecnico: ESQUEMA_TECNICO,
  execucao: ESQUEMA_EXECUCAO,
};
