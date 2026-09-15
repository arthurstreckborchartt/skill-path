import { createFileRoute } from "@tanstack/react-router";
import { gerarRotaComIA } from "@/lib/ia/gerar-rota";
import { paraRouteSteps } from "@/lib/ia/contrato";
import type { OnboardingProfile } from "@/lib/onboarding";
import { fontesDe, lerEnv } from "@/lib/server-env";

/**
 * POST /api/rota — gera a rota com IA.
 *
 * Existe como rota de servidor por um motivo só: a chave da Anthropic. Ela nunca pode chegar ao
 * navegador, então a chamada acontece aqui, e o cliente só recebe o resultado.
 *
 * Três proteções, todas porque cada chamada gasta dinheiro de verdade:
 *   1. exige sessão válida do Supabase (o token é conferido no Supabase, não só decodificado);
 *   2. limita uma geração por minuto por pessoa;
 *   3. grava o resultado, para nunca gerar duas vezes a mesma coisa.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Confere o token no Supabase. Decodificar o JWT localmente não prova nada: só a assinatura prova. */
async function usuarioDoToken(
  token: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<string | null> {
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!r.ok) return null;
  const corpo = (await r.json()) as { id?: string };
  return typeof corpo.id === "string" ? corpo.id : null;
}

export const Route = createFileRoute("/api/rota")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        if (!supabaseUrl || !anonKey)
          return erro(500, "Supabase não está configurado no servidor.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para gerar sua rota.");

        const userId = await usuarioDoToken(token, supabaseUrl, anonKey);
        if (!userId) return erro(401, "Sessão expirada. Entre de novo.");

        let perfil: OnboardingProfile;
        try {
          perfil = (await request.json()) as OnboardingProfile;
        } catch {
          return erro(400, "Corpo da requisição inválido.");
        }
        if (!perfil || typeof perfil !== "object" || !Array.isArray(perfil.desiredAreas)) {
          return erro(400, "Perfil do onboarding incompleto.");
        }

        // Cabeçalhos de quem está pedindo: toda leitura e escrita abaixo passa pela RLS da pessoa,
        // então nenhuma chave de service role é necessária aqui.
        const comoUsuario = {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        };

        // Freio de gasto: uma geração por minuto por pessoa.
        const recente = await fetch(
          `${supabaseUrl}/rest/v1/pathly_routes?select=created_at&order=created_at.desc&limit=1`,
          { headers: comoUsuario },
        );
        if (recente.ok) {
          const linhas = (await recente.json()) as { created_at?: string }[];
          const ultima = linhas[0]?.created_at;
          if (ultima && Date.now() - new Date(ultima).getTime() < 60_000) {
            return erro(429, "Sua rota acabou de ser gerada. Espere um minuto para gerar de novo.");
          }
        }

        const resultado = await gerarRotaComIA(perfil, lerEnv("ANTHROPIC_API_KEY"));
        if (!resultado.ok) {
          // 503 e não 500: a rota por regras assume no cliente, e isto não é erro da pessoa.
          return erro(503, "A geração por IA não está disponível agora.", {
            motivo: resultado.motivo,
            detalhe: resultado.detalhe,
            // Só booleanos, nunca o valor: é a diferença entre "a variável não foi configurada"
            // e "foi configurada mas o servidor não enxerga", que sem isto é indistinguível.
            ...(resultado.motivo === "sem-chave" ? { fontes: fontesDe("ANTHROPIC_API_KEY") } : {}),
          });
        }

        const rendaAtual = perfil.income?.noIncome ? 0 : (perfil.income?.current ?? 0);
        const rendaMeta = Math.max(perfil.income?.target ?? rendaAtual + 1000, rendaAtual + 500);
        const steps = paraRouteSteps(resultado.rota, {
          rendaAtual,
          rendaMeta,
          horasPorSemana: perfil.study?.hoursPerWeek ?? 7,
        });

        const signature = steps.map((s) => s.id).join("|");

        // Se a gravação falhar, a rota ainda vai para a tela: perder o resultado de uma chamada
        // que já foi paga, por causa do banco, seria o pior dos dois mundos.
        await fetch(`${supabaseUrl}/rest/v1/pathly_routes`, {
          method: "POST",
          headers: { ...comoUsuario, Prefer: "return=minimal" },
          body: JSON.stringify({
            user_id: userId,
            area: perfil.desiredAreas[0] ?? "other",
            generator: "ia",
            signature,
            steps,
          }),
        }).catch(() => undefined);

        return new Response(JSON.stringify({ papel: resultado.rota.papel, signature, steps }), {
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
