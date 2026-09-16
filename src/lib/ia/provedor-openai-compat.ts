import { SISTEMA, resumirPerfil } from "@/lib/ia/prompt";
import { validarRota, type SaidaProvedor } from "@/lib/ia/contrato";
import type { OnboardingProfile } from "@/lib/onboarding";

/**
 * Um provedor para vários serviços.
 *
 * Groq, OpenRouter, Cerebras e Mistral expõem a mesma API de `/chat/completions` da OpenAI. Em
 * vez de quatro arquivos quase idênticos, é este, parametrizado por URL base, nome da variável de
 * ambiente e modelo. Acrescentar um serviço novo vira uma linha na tabela abaixo.
 *
 * Eles existem porque o gratuito não pode depender de um fornecedor só: em 15/09/2026 observei
 * três modelos do Gemini congestionados em poucos minutos. Um serviço cai, o seguinte atende.
 */

export type ServicoCompat = {
  id: string;
  /** Endpoint completo de chat completions. */
  url: string;
  /** Nome da variável de ambiente com a chave. Sem ela, o serviço é simplesmente pulado. */
  envChave: string;
  /**
   * Modelos a tentar, em ordem. É lista e não string pela mesma razão do Gemini: nome de modelo
   * é a parte que envelhece mais rápido, e catálogo gratuito muda sem aviso. `envModelo`
   * sobrescreve a lista inteira por um só.
   */
  modelos: string[];
  envModelo: string;
  /** Alguns exigem cabeçalhos próprios (o OpenRouter pede identificação do app). */
  cabecalhosExtra?: Record<string, string>;
};

/**
 * Ordem importa: do mais rápido e confiável para o mais genérico. O Groq vem primeiro porque
 * roda em hardware próprio e costuma responder em poucos segundos; o OpenRouter vem depois
 * porque é um roteador e herda a fila de quem estiver atrás dele.
 */
export const SERVICOS_COMPAT: ServicoCompat[] = [
  {
    id: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    envChave: "GROQ_API_KEY",
    /**
     * Conferidos na documentação do Groq em 16/09/2026 — os dois Llama continuam ativos, ao
     * contrário do que aconteceu com os nomes do Gemini e do OpenRouter que escrevi de memória.
     *
     * Os `gpt-oss` vêm logo atrás de propósito: os Llama aparecem como "enterprise pricing" na
     * tabela deles, e se a camada gratuita não os liberar o Groq falharia sem dizer por quê —
     * numa corrida em paralelo, um provedor que erra apenas perde, sem alarme. Os `gpt-oss` têm
     * preço por token normal e servem de piso.
     */
    modelos: [
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.1-8b-instant",
    ],
    envModelo: "GROQ_MODELO",
  },
  {
    id: "openrouter",
    url: "https://openrouter.ai/api/v1/chat/completions",
    envChave: "OPENROUTER_API_KEY",
    /**
     * Medidos com a chave real em 15/09/2026, não escolhidos por reputação. Dos 20 modelos
     * `:free` do catálogo, a maioria não serve: `z-ai/glm-5.2` e `google/gemma-4-26b` devolvem
     * "Provider returned error", `nemotron-3-ultra-550b` e `nemotron-3.5-lightning` estouram 30s
     * sem responder, e `thinkingmachines/inkling` só existe na API de agentes.
     *
     * Os três que sobraram, na ordem: o maior primeiro (120B, para a qualidade da trilha), o
     * mais rápido em seguida, e um lento como último recurso.
     *   nemotron-3-super-120b → 1,26s
     *   gemma-4-31b-it        → 0,93s
     *   nex-n2.5-pro          → 20,3s
     */
    modelos: [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "nex-agi/nex-n2.5-pro:free",
      "google/gemma-4-31b-it:free",
    ],
    envModelo: "OPENROUTER_MODELO",
    cabecalhosExtra: {
      "HTTP-Referer": "https://pathlyapp.app",
      "X-Title": "Pathly",
    },
  },
  {
    id: "cerebras",
    url: "https://api.cerebras.ai/v1/chat/completions",
    envChave: "CEREBRAS_API_KEY",
    modelos: ["llama-3.3-70b"],
    envModelo: "CEREBRAS_MODELO",
  },
  {
    id: "mistral",
    url: "https://api.mistral.ai/v1/chat/completions",
    envChave: "MISTRAL_API_KEY",
    modelos: ["mistral-small-latest"],
    envModelo: "MISTRAL_MODELO",
  },
];

/**
 * `json_object` garante JSON válido, mas não garante o FORMATO — diferente do `responseSchema`
 * do Gemini e do `output_config` do Claude. Por isso o formato vai descrito no pedido, e
 * `validarRota` continua sendo quem decide se a resposta serve. Nunca confiar na promessa do
 * modelo: a validação em tempo de execução é que é a garantia.
 */
const FORMATO = `Responda SOMENTE com um objeto JSON, sem texto antes ou depois, neste formato exato:

{
  "papel": "string — o papel profissional que a rota leva a pessoa a exercer",
  "etapas": [
    {
      "titulo": "string",
      "objetivo": "string — uma frase: o que a pessoa consegue fazer ao terminar",
      "porque": "string — por que isso importa para a meta dela",
      "marco": "string — o marco profissional concreto que esta etapa destrava",
      "habilidades": ["string", "..."],
      "projetos": ["string", "..."],
      "dificuldade": "fácil" | "médio" | "difícil",
      "impacto": "médio" | "alto" | "muito alto",
      "horas": number,
      "tarefas": ["string", "..."]
    }
  ]
}

Entre 6 e 10 etapas. Cada etapa com 1 a 4 habilidades, 1 a 3 projetos e 4 a 8 tarefas.
Cada tarefa começa com verbo no infinitivo e cabe numa sessão de estudo.`;

/**
 * Teto padrão, usado só quando ninguém passa um. Quem chama normalmente informa o orçamento, e
 * ele manda: medido com o prompt real, o nemotron do OpenRouter leva ~49s para uma rota inteira.
 * Um teto fixo de 30s aqui abortava justamente as gerações que iam dar certo.
 */
const TETO_MS = 55_000;

type RespostaCompat = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string } | string;
};

/** O JSON pode vir cercado de crase ou de texto; isto extrai o objeto sem quebrar por isso. */
function extrairJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio === -1 || fim <= inicio) return null;
    try {
      return JSON.parse(limpo.slice(inicio, fim + 1));
    } catch {
      return null;
    }
  }
}

export async function gerarComCompat(
  perfil: OnboardingProfile,
  servico: ServicoCompat,
  apiKey: string,
  modelos: string[],
  tetoMs: number = TETO_MS,
): Promise<SaidaProvedor> {
  const limite = Date.now() + tetoMs;
  let ultima: SaidaProvedor = {
    ok: false,
    motivo: "erro",
    detalhe: `${servico.id}: sem tentativa`,
  };

  for (const modelo of modelos) {
    const restante = limite - Date.now();
    // Menos que isto não dá para uma geração completa; parar aqui deixa tempo para o próximo
    // serviço da cadeia, que vale mais do que uma tentativa fadada a estourar.
    if (restante < 8000) break;

    ultima = await umaChamada(perfil, servico, apiKey, modelo, restante);
    if (ultima.ok) return ultima;

    // Modelo que não existe ou foi aposentado: tenta o próximo da lista. Erro permanente de
    // outra natureza (chave inválida) afeta o serviço inteiro, então não adianta trocar.
    const trocarModeloAjuda =
      ultima.transitorio === true || ultima.status === 404 || ultima.status === 400;
    if (!trocarModeloAjuda) return ultima;
  }

  return ultima;
}

async function umaChamada(
  perfil: OnboardingProfile,
  servico: ServicoCompat,
  apiKey: string,
  modelo: string,
  tetoMs: number,
): Promise<SaidaProvedor> {
  try {
    const r = await fetch(servico.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(servico.cabecalhosExtra ?? {}),
      },
      signal: AbortSignal.timeout(Math.max(1000, tetoMs)),
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: `${SISTEMA}\n\n${FORMATO}` },
          {
            role: "user",
            content: `Monte a trilha de estudo desta pessoa.\n\n${resumirPerfil(perfil)}`,
          },
        ],
        response_format: { type: "json_object" },
        /**
         * Sem isto, um modelo de raciocínio despeja o pensamento dentro de `content` e gasta o
         * orçamento inteiro antes de chegar ao JSON. Medido: o nemotron-3-super-120b voltava com
         * `finish_reason: "length"` e um texto começando em "Okay, the user sent..."; com
         * `exclude` ele devolve 6 etapas em 11s. Provedores que não raciocinam ignoram o campo.
         */
        reasoning: { exclude: true },
        temperature: 0.7,
        max_tokens: 8192,
      }),
    });

    const corpo = (await r.json()) as RespostaCompat;

    if (!r.ok) {
      const msg =
        typeof corpo.error === "string"
          ? corpo.error
          : (corpo.error?.message ?? `HTTP ${r.status}`);
      return {
        ok: false,
        motivo: "erro",
        detalhe: `${servico.id}: ${msg}`,
        status: r.status,
        // Mesmo critério do Gemini: só repete o que passa sozinho.
        transitorio:
          r.status >= 500 || r.status === 429 || /overload|capacity|try again/i.test(msg),
      };
    }

    const texto = corpo.choices?.[0]?.message?.content ?? "";
    if (!texto.trim()) {
      return {
        ok: false,
        motivo: "erro",
        detalhe: `${servico.id}: resposta vazia`,
        transitorio: true,
      };
    }

    const rota = validarRota(extrairJson(texto));
    if (!rota)
      return { ok: false, motivo: "invalida", detalhe: `${servico.id}: formato inesperado` };
    return { ok: true, rota };
  } catch (error) {
    const abortou = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      motivo: "erro",
      detalhe: `${servico.id}: ${abortou ? "tempo esgotado" : error instanceof Error ? error.message : "falha"}`,
      transitorio: true,
    };
  }
}
