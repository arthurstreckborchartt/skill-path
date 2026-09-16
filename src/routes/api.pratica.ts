import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { avaliarPratica, type EnvioPratica } from "@/lib/ia/avaliar-pratica";

/**
 * POST /api/pratica — corrige o que a pessoa escreveu.
 *
 * Diferente de `/api/licao`, aqui **não há cache**: a resposta é de uma pessoa só e a correção
 * precisa falar do texto dela. Cachear seria devolver a correção de outra pessoa.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

export const Route = createFileRoute("/api/pratica")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para enviar.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");

        let envio: EnvioPratica;
        try {
          envio = (await request.json()) as EnvioPratica;
        } catch {
          return erro(400, "Corpo inválido.");
        }

        const resposta = (envio?.resposta ?? "").trim();
        if (!resposta) return erro(400, "Escreva sua resposta antes de enviar.");
        // Piso curto de propósito: quem escreveu "fiz" não produziu nada para corrigir, e
        // mandar isso ao modelo gastaria uma chamada para receber "está vago demais".
        if (resposta.length < 20) {
          return new Response(
            JSON.stringify({
              correcao: {
                aprovado: false,
                acertou: "Você começou, mas ainda não dá para avaliar.",
                faltou:
                  "A resposta está curta demais. Descreva o que você fez, com o que usou e o que obteve de resultado.",
                proximoPasso: "Reescreva contando o passo a passo do que você fez na prática.",
              },
              local: true,
            }),
            { headers: JSON_HEADERS },
          );
        }

        const saida = await avaliarPratica(
          { tarefa: envio.tarefa ?? "", pratica: envio.pratica ?? "", resposta },
          lerEnv,
        );

        if (!saida.ok) {
          return erro(503, "A correção não está disponível agora.", {
            motivo: saida.motivo,
            detalhe: saida.detalhe,
          });
        }

        return new Response(JSON.stringify({ correcao: saida.correcao }), {
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
