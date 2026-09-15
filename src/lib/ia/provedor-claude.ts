import Anthropic from "@anthropic-ai/sdk";
import type { OnboardingProfile } from "@/lib/onboarding";
import { SCHEMA_ROTA, validarRota, type RotaIA } from "@/lib/ia/contrato";
import { SISTEMA, resumirPerfil } from "@/lib/ia/prompt";

/**
 * Provedor do plano Pro: Claude Opus 5. **Só roda no servidor** — a chave da Anthropic nunca
 * pode entrar no bundle, senão qualquer pessoa abre o devtools e gasta a conta.
 */

const MODELO = "claude-opus-5";

export type SaidaProvedor =
  | { ok: true; rota: RotaIA }
  | {
      ok: false;
      motivo: "sem-chave" | "recusa" | "invalida" | "erro";
      detalhe?: string | undefined;
    };

export async function gerarComClaude(
  perfil: OnboardingProfile,
  apiKey: string | undefined,
): Promise<SaidaProvedor> {
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  const client = new Anthropic({ apiKey });

  try {
    // Streaming porque a rota inteira é uma resposta longa, e um POST não-streaming com
    // max_tokens alto encosta no timeout de HTTP antes de terminar.
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      system: SISTEMA,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: SCHEMA_ROTA },
      },
      messages: [
        {
          role: "user",
          content: `Monte a trilha de estudo desta pessoa.\n\n${resumirPerfil(perfil)}`,
        },
      ],
    });

    const resposta = await stream.finalMessage();

    // Precisa vir antes de ler o content: numa recusa o content não tem o JSON.
    if (resposta.stop_reason === "refusal") {
      return {
        ok: false,
        motivo: "recusa",
        detalhe: resposta.stop_details?.explanation ?? undefined,
      };
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const rota = validarRota(JSON.parse(texto));
    if (!rota) return { ok: false, motivo: "invalida" };
    return { ok: true, rota };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, motivo: "erro", detalhe: "chave da Anthropic inválida" };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, motivo: "erro", detalhe: "limite de uso atingido" };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, motivo: "erro", detalhe: `API respondeu ${error.status}` };
    }
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}
