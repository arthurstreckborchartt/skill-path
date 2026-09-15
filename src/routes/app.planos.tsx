import { useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Check, Sparkles, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel } from "@/components/pathly/ui";
import { PLANOS, usePlan, type Plano } from "@/lib/plan";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/planos")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Planos — Pathly" },
      {
        name: "description",
        content: "O plano gratuito e o Pro da Pathly, lado a lado.",
      },
    ],
  }),
  component: PlanosPage,
});

function CardPlano({
  plano,
  atual,
  ocupado,
  onEscolher,
}: {
  plano: Plano;
  atual: boolean;
  ocupado: boolean;
  onEscolher: () => void;
}) {
  const destaque = plano.id === "pro";
  return (
    <Panel
      className={cn("relative flex flex-col", destaque && "border-primary/40 bg-primary/[0.04]")}
    >
      {destaque && (
        <span className="absolute -top-3 left-5">
          <Chip tone="primary">
            <Sparkles className="size-3" /> Mais completo
          </Chip>
        </span>
      )}

      <div>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold">{plano.nome}</h2>
          {atual && <Chip tone="muted">Seu plano</Chip>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{plano.resumo}</p>
        <p className="mt-4 font-display text-3xl font-semibold">
          {plano.preco}{" "}
          <span className="text-sm font-normal text-muted-foreground">{plano.periodo}</span>
        </p>
      </div>

      <ul className="mt-5 flex-1 space-y-2 text-sm">
        {plano.inclui.map((item) => (
          <li key={item} className="flex gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{item}</span>
          </li>
        ))}
        {plano.naoInclui.map((item) => (
          <li key={item} className="flex gap-2 text-muted-foreground">
            <X className="mt-0.5 size-4 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {destaque ? (
          <Btn size="lg" className="w-full" onClick={onEscolher} disabled={ocupado}>
            {ocupado ? "Abrindo…" : atual ? "Gerenciar assinatura" : "Assinar o Pro"}
          </Btn>
        ) : (
          <Btn variant="ghost" size="lg" className="w-full" disabled>
            {atual ? "Plano atual" : "Incluído no Pro"}
          </Btn>
        )}
      </div>
    </Panel>
  );
}

function PlanosPage() {
  const { plan, conferindo } = usePlan();
  const busca = useSearch({ strict: false }) as { assinatura?: string };
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /**
   * Manda para o Stripe. Quem já assina cai no portal — cancelar, trocar cartão, ver faturas —
   * em vez de um segundo checkout, que criaria duas assinaturas e duas cobranças.
   */
  async function irParaStripe() {
    setOcupado(true);
    setErro(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setErro("Entre de novo para assinar.");
        return;
      }
      const r = await fetch("/api/assinatura", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const corpo = (await r.json()) as { url?: string; erro?: string };
      if (!r.ok || !corpo.url) {
        setErro(corpo.erro ?? "Não foi possível abrir o pagamento agora.");
        return;
      }
      window.location.href = corpo.url;
    } catch {
      setErro("Não foi possível abrir o pagamento agora.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        subtitle="O gratuito mostra a rota inteira e libera as duas primeiras etapas. O Pro destrava o resto."
      />

      {/* O webhook do Stripe pode levar alguns segundos para chegar, então a volta do checkout
          nem sempre encontra o plano já atualizado. Dizer isso evita a pessoa achar que pagou à toa. */}
      {busca.assinatura === "ok" && (
        <Panel className="border-primary/40 bg-primary/[0.06]">
          <p className="text-sm">
            <span className="font-semibold">Assinatura confirmada.</span> Seus 14 dias grátis
            começaram agora. Se o plano ainda aparecer como Gratuito aqui, atualize a página em
            alguns segundos.
          </p>
        </Panel>
      )}

      {busca.assinatura === "cancelada" && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Você saiu do pagamento e nada foi cobrado. O plano Gratuito continua valendo.
          </p>
        </Panel>
      )}

      {erro && (
        <Panel className="border-destructive/40 bg-destructive/[0.06]">
          <p className="text-sm">{erro}</p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {PLANOS.map((p) => (
          <CardPlano
            key={p.id}
            plano={p}
            atual={!conferindo && plan === p.id}
            ocupado={ocupado}
            onEscolher={irParaStripe}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        14 dias grátis. Cancele quando quiser, direto por aqui — o acesso continua até o fim do
        período já pago.
      </p>
    </div>
  );
}
