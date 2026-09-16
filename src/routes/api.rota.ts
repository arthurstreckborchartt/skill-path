import { createFileRoute } from "@tanstack/react-router";
import { gerarRota, type Plano } from "@/lib/ia/gerar-rota";
import { SERVICOS_COMPAT } from "@/lib/ia/provedor-openai-compat";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado } from "@/lib/entrada-segura";
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

        const corpoLido = await lerJsonLimitado<OnboardingProfile>(request);
        if (!corpoLido.ok) {
          return erro(
            400,
            corpoLido.motivo === "grande"
              ? "Requisição grande demais."
              : "Corpo da requisição inválido.",
          );
        }
        const perfil = corpoLido.dados;
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

        /**
         * Teto por hora, contado no banco.
         *
         * O freio abaixo (uma por minuto) lê `pathly_routes.created_at` e por isso só enxerga
         * gerações que DERAM CERTO. Quem fizesse a geração falhar em laço — perfil que dispara
         * recusa, provedor fora — não era contado por ele e chamava os provedores à vontade.
         * Este conta toda tentativa.
         */
        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "rota",
          LIMITES.rota.limite,
          LIMITES.rota.janelaMinutos,
        );
        if (uso.permitido === false) {
          return erro(429, "Você gerou muitas rotas em pouco tempo. Tente de novo mais tarde.", {
            usadas: uso.usadas,
            limite: uso.limite,
          });
        }

        // Freio curto, complementar: evita duas gerações seguidas por engano de clique.
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

        /**
         * O plano sai do banco, e isso não é preciosismo. O `usePlan()` do cliente guarda o plano
         * no localStorage — é estado de tela, e qualquer pessoa edita pelo devtools. Se o plano
         * viesse no corpo desta requisição, marcar "pro" no navegador passaria a gastar a conta
         * da Anthropic de graça. Enquanto a Stripe não existe ninguém tem `plano = 'pro'` no
         * banco, então todo mundo cai no provedor gratuito — que é exatamente o desejado.
         */
        let plano: Plano = "free";
        const perfilSalvo = await fetch(
          `${supabaseUrl}/rest/v1/pathly_profiles?select=plano&user_id=eq.${userId}&limit=1`,
          { headers: comoUsuario },
        );
        if (perfilSalvo.ok) {
          const linhas = (await perfilSalvo.json()) as { plano?: string }[];
          if (linhas[0]?.plano === "pro") plano = "pro";
        }

        // `lerEnv` é passado como função porque só o servidor sabe onde os secrets vivem no
        // Cloudflare — a cadeia não precisa saber disso, só pedir a variável pelo nome.
        const resultado = await gerarRota(perfil, plano, lerEnv);
        if (!resultado.ok) {
          // 503 e não 500: a rota por regras assume no cliente, e isto não é erro da pessoa.
          return erro(503, "A geração por IA não está disponível agora.", {
            motivo: resultado.motivo,
            detalhe: resultado.detalhe,
            // Só booleanos, nunca o valor: é a diferença entre "a variável não foi configurada"
            // e "foi configurada mas o servidor não enxerga", que sem isto é indistinguível.
            plano,
            // Qual provedor foi tentado e como terminou. Sem isto, "gratuito sem chave" e "Pro
            // com o Claude fora do ar" viram a mesma mensagem opaca.
            tentativas: resultado.tentativas,
            ...(resultado.motivo === "sem-chave"
              ? {
                  // Booleanos, nunca valores: diz quais fornecedores estão configurados e onde a
                  // variável foi vista, que é o que separa "não configurei" de "configurei e o
                  // servidor não enxerga".
                  fontes: {
                    gemini: fontesDe("GEMINI_API_KEY"),
                    claude: fontesDe("ANTHROPIC_API_KEY"),
                    ...Object.fromEntries(SERVICOS_COMPAT.map((s) => [s.id, fontesDe(s.envChave)])),
                  },
                }
              : {}),
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
            generator: resultado.provedor,
            signature,
            steps,
          }),
        }).catch(() => undefined);

        const corpo = {
          papel: resultado.rota.papel,
          signature,
          steps,
          provedor: resultado.provedor,
        };
        return new Response(JSON.stringify(corpo), {
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
