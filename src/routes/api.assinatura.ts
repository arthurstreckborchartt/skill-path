import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { chamarStripe } from "@/lib/pagamento/stripe";

/**
 * POST /api/assinatura — abre o checkout do Stripe, ou o portal de quem já assina.
 *
 * Exige sessão válida: sem isso, qualquer um criaria checkouts em nome de outra pessoa. E o
 * e-mail vem do token conferido no Supabase, nunca do corpo da requisição — deixar o cliente
 * escolher o e-mail do cliente Stripe seria entregar a assinatura de alguém a quem pedisse.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: JSON_HEADERS });
}

type Usuario = { id: string; email?: string };

async function usuarioDoToken(
  token: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<Usuario | null> {
  const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  });
  if (!r.ok) return null;
  const corpo = (await r.json()) as Usuario;
  return typeof corpo.id === "string" ? corpo : null;
}

export const Route = createFileRoute("/api/assinatura")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        const chaveStripe = lerEnv("STRIPE_SECRET_KEY");
        const precoPro = lerEnv("STRIPE_PRICE_PRO");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");
        if (!chaveStripe || !precoPro) return erro(503, "Pagamento ainda não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para assinar.");

        const usuario = await usuarioDoToken(token, supabaseUrl, anonKey);
        if (!usuario) return erro(401, "Sessão expirada. Entre de novo.");

        const origem = new URL(request.url).origin;
        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };

        // Já existe cliente no Stripe para esta pessoa?
        const perfilResp = await fetch(
          `${supabaseUrl}/rest/v1/pathly_profiles?select=stripe_customer_id,plano&user_id=eq.${usuario.id}&limit=1`,
          { headers: comoUsuario },
        );
        const linhas = perfilResp.ok
          ? ((await perfilResp.json()) as { stripe_customer_id?: string; plano?: string }[])
          : [];
        const clienteExistente = linhas[0]?.stripe_customer_id;

        // Quem já é Pro vai para o portal, não para um segundo checkout — senão acabaria com
        // duas assinaturas e duas cobranças.
        if (linhas[0]?.plano === "pro" && clienteExistente) {
          const portal = await chamarStripe<{ url: string }>(
            "/billing_portal/sessions",
            chaveStripe,
            { customer: clienteExistente, return_url: `${origem}/app/planos` },
          );
          if (!portal.ok) return erro(502, `Stripe: ${portal.erro}`);
          return new Response(JSON.stringify({ url: portal.dados.url, tipo: "portal" }), {
            headers: JSON_HEADERS,
          });
        }

        const sessao = await chamarStripe<{ url: string }>("/checkout/sessions", chaveStripe, {
          mode: "subscription",
          line_items: [{ price: precoPro, quantity: 1 }],
          success_url: `${origem}/app/planos?assinatura=ok`,
          cancel_url: `${origem}/app/planos?assinatura=cancelada`,
          // Reaproveita o cliente quando existe; senão o Stripe cria e o webhook guarda o id.
          ...(clienteExistente
            ? { customer: clienteExistente }
            : { customer_email: usuario.email }),
          subscription_data: {
            trial_period_days: 14,
            // O user_id viaja na assinatura porque é por ele que o webhook encontra a pessoa.
            // Sem isso, um evento do Stripe chegaria sem saber a quem pertence.
            metadata: { user_id: usuario.id },
          },
          client_reference_id: usuario.id,
          metadata: { user_id: usuario.id },
          locale: "pt-BR",
          allow_promotion_codes: true,
        });

        if (!sessao.ok) return erro(502, `Stripe: ${sessao.erro}`);
        return new Response(JSON.stringify({ url: sessao.dados.url, tipo: "checkout" }), {
          headers: JSON_HEADERS,
        });
      },
    },
  },
});
