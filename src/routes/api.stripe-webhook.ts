import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { assinaturaValida } from "@/lib/pagamento/stripe";
import { cabecalhosServico } from "@/lib/supabase-servidor";

/**
 * POST /api/stripe-webhook — é aqui que alguém vira Pro.
 *
 * O endpoint é público: o Stripe precisa alcançá-lo sem credencial nossa. A **única** coisa que
 * separa um evento verdadeiro de um impostor é a assinatura HMAC — por isso ela é conferida
 * antes de qualquer outra coisa, e o corpo é lido como TEXTO CRU. Reserializar o JSON mudaria
 * bytes e invalidaria a conferência.
 *
 * A escrita usa a service role, que passa por cima de RLS e de privilégio de coluna. É o único
 * lugar do app que precisa dela, e é o motivo de `plano` não ser atualizável por `authenticated`:
 * assinatura se concede aqui, com o Stripe confirmando, ou não se concede.
 */

function ok() {
  // 200 sempre que o evento foi entendido. Erro faz o Stripe reenviar, e reenvio em cima de um
  // evento já aplicado só gera ruído.
  return new Response(JSON.stringify({ recebido: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

type Assinatura = {
  id: string;
  status: string;
  customer: string;
  current_period_end?: number;
  metadata?: { user_id?: string };
};

type Evento = {
  id: string;
  type: string;
  /** Instante em que o Stripe gerou o evento, em segundos. É por ele que a ordem é decidida. */
  created: number;
  data: { object: Record<string, unknown> };
};

/** Só estes status dão acesso. `trialing` inclui os 14 dias, que valem como Pro. */
const STATUS_COM_ACESSO = new Set(["active", "trialing"]);

/**
 * Aplica a mudança **só se este evento for mais novo** que o último já aplicado.
 *
 * O Stripe não garante ordem de entrega, e reenvia eventos quando não recebe 200. Sem esta
 * guarda, um `subscription.deleted` atrasado — chegando depois de um `created` mais recente —
 * rebaixaria para o gratuito alguém que está pagando. O prejuízo é do cliente e a causa seria
 * praticamente impossível de descobrir depois.
 *
 * O filtro `or(...)` faz a comparação acontecer no banco, dentro da própria escrita: ler o valor
 * antes e decidir aqui deixaria a janela entre a leitura e a gravação aberta para o evento
 * concorrente.
 */
async function atualizarPerfil(
  supabaseUrl: string,
  serviceRole: string,
  userId: string,
  campos: Record<string, unknown>,
  eventoEm?: number,
): Promise<boolean> {
  const marca = eventoEm ? new Date(eventoEm * 1000).toISOString() : null;
  const filtroOrdem = marca
    ? `&or=(assinatura_evento_em.is.null,assinatura_evento_em.lte.${encodeURIComponent(marca)})`
    : "";
  const corpo = marca ? { ...campos, assinatura_evento_em: marca } : campos;

  const r = await fetch(
    `${supabaseUrl}/rest/v1/pathly_profiles?user_id=eq.${userId}${filtroOrdem}`,
    {
      method: "PATCH",
      headers: cabecalhosServico(serviceRole, {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify(corpo),
    },
  );
  return r.ok;
}

export const Route = createFileRoute("/api/stripe-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const segredo = lerEnv("STRIPE_WEBHOOK_SECRET");
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");

        if (!segredo || !supabaseUrl || !serviceRole) {
          // 500 de propósito: o Stripe reenvia, e quando a configuração aparecer o evento entra.
          return new Response("webhook não configurado", { status: 500 });
        }

        const corpoCru = await request.text();
        const valido = await assinaturaValida(
          corpoCru,
          request.headers.get("stripe-signature"),
          segredo,
        );
        if (!valido) return new Response("assinatura inválida", { status: 400 });

        let evento: Evento;
        try {
          evento = JSON.parse(corpoCru) as Evento;
        } catch {
          return new Response("corpo inválido", { status: 400 });
        }

        switch (evento.type) {
          case "customer.subscription.created":
          case "customer.subscription.updated":
          case "customer.subscription.deleted": {
            const assinatura = evento.data.object as unknown as Assinatura;
            const userId = assinatura.metadata?.user_id;
            // Sem user_id não há a quem aplicar. Acontece com assinaturas criadas fora do app
            // (pelo painel do Stripe, por exemplo) — ignorar é melhor que adivinhar o dono.
            if (!userId) return ok();

            const temAcesso =
              evento.type !== "customer.subscription.deleted" &&
              STATUS_COM_ACESSO.has(assinatura.status);

            await atualizarPerfil(supabaseUrl, serviceRole, userId, {
              plano: temAcesso ? "pro" : "free",
              stripe_customer_id: assinatura.customer,
              assinatura_status:
                evento.type === "customer.subscription.deleted" ? "canceled" : assinatura.status,
              assinatura_ate: assinatura.current_period_end
                ? new Date(assinatura.current_period_end * 1000).toISOString()
                : null,
            });
            return ok();
          }

          case "checkout.session.completed": {
            // Redundante de propósito. O `subscription.created` já concede o acesso, mas este
            // evento chega primeiro e garante o vínculo com o cliente do Stripe mesmo que o
            // outro atrase ou se perca.
            const sessao = evento.data.object as {
              client_reference_id?: string;
              customer?: string;
            };
            if (sessao.client_reference_id && sessao.customer) {
              await atualizarPerfil(supabaseUrl, serviceRole, sessao.client_reference_id, {
                stripe_customer_id: sessao.customer,
              });
            }
            return ok();
          }

          default:
            // Evento que não nos diz respeito. 200 para o Stripe não ficar reenviando.
            return ok();
        }
      },
    },
  },
});
