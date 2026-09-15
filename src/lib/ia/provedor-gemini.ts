import { SISTEMA, resumirPerfil } from "@/lib/ia/prompt";
import { validarRota, type RotaIA } from "@/lib/ia/contrato";
import type { OnboardingProfile } from "@/lib/onboarding";

/**
 * Provedor do plano gratuito: Gemini, camada gratuita.
 *
 * Por que aqui não há SDK: o `@google/generative-ai` traria mais um pacote ao bundle do Worker
 * para fazer um único POST. A API é REST simples e `fetch` existe nativo no runtime — o SDK não
 * pagaria o próprio peso.
 *
 * Obtenção da chave: aistudio.google.com/apikey, gratuito e sem cartão.
 */

/**
 * O nome do modelo é a parte mais perecível deste arquivo: o Google aposenta versões e a API
 * responde com erro dizendo qual é a sucessora. Por isso ele é sobrescrevível por env
 * (`GEMINI_MODELO`) — quando cair de novo, é variável de ambiente, não deploy de código.
 */
const MODELO_PADRAO = "gemini-3.6-flash";

/**
 * O Gemini aceita um subconjunto do OpenAPI, não o JSON Schema completo: os tipos são em
 * MAIÚSCULAS e `additionalProperties` não existe. É por isso que este schema é escrito à mão em
 * vez de reaproveitar o `SCHEMA_ROTA` do Claude — converter um no outro daria mais linhas e mais
 * chance de erro silencioso do que manter os dois lado a lado.
 */
const SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    papel: { type: "STRING" },
    etapas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          objetivo: { type: "STRING" },
          porque: { type: "STRING" },
          marco: { type: "STRING" },
          habilidades: { type: "ARRAY", items: { type: "STRING" } },
          projetos: { type: "ARRAY", items: { type: "STRING" } },
          dificuldade: { type: "STRING", enum: ["fácil", "médio", "difícil"] },
          impacto: { type: "STRING", enum: ["médio", "alto", "muito alto"] },
          horas: { type: "NUMBER" },
          tarefas: { type: "ARRAY", items: { type: "STRING" } },
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
      },
    },
  },
  required: ["papel", "etapas"],
};

export type SaidaProvedor =
  | { ok: true; rota: RotaIA }
  | {
      ok: false;
      motivo: "sem-chave" | "recusa" | "invalida" | "erro";
      detalhe?: string | undefined;
    };

type RespostaGemini = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

export async function gerarComGemini(
  perfil: OnboardingProfile,
  apiKey: string | undefined,
  modelo: string | undefined = MODELO_PADRAO,
): Promise<SaidaProvedor> {
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo || MODELO_PADRAO}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SISTEMA }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Monte a trilha de estudo desta pessoa. Entre 6 e 10 etapas, cada uma com 4 a 8 tarefas.\n\n${resumirPerfil(perfil)}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA_GEMINI,
            maxOutputTokens: 8192,
          },
        }),
      },
    );

    const corpo = (await r.json()) as RespostaGemini;

    if (!r.ok) {
      const msg = corpo.error?.message ?? `HTTP ${r.status}`;
      // 429 na camada gratuita é cota do dia, não falha: merece nome próprio para o log.
      return {
        ok: false,
        motivo: "erro",
        detalhe: r.status === 429 ? "cota gratuita esgotada" : msg,
      };
    }

    // Bloqueio por política vem com 200 e sem candidato.
    if (corpo.promptFeedback?.blockReason) {
      return { ok: false, motivo: "recusa", detalhe: corpo.promptFeedback.blockReason };
    }

    const texto = corpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!texto.trim()) return { ok: false, motivo: "invalida", detalhe: "resposta vazia" };

    const rota = validarRota(JSON.parse(texto));
    if (!rota) return { ok: false, motivo: "invalida" };
    return { ok: true, rota };
  } catch (error) {
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}
