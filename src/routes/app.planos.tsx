import { useEffect, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Btn, Chip, Logo, PageHeader, Panel } from "@/components/pathly/ui";
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
      { property: "og:title", content: "Planos — Pathly" },
      {
        property: "og:description",
        content: "Compare os planos da Pathly e libere sua rota profissional completa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlanosPage,
});

function CheckoutPathly({
  email,
  ocupado,
  erro,
  onClose,
  onConfirmar,
}: {
  email: string;
  ocupado: boolean;
  erro: string | null;
  onClose: () => void;
  onConfirmar: () => void;
}) {
  const pro = PLANOS.find((plano) => plano.id === "pro");

  useEffect(() => {
    function fecharComEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !ocupado) onClose();
    }
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fecharComEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", fecharComEscape);
    };
  }, [ocupado, onClose]);

  if (!pro) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
    >
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8 lg:px-10">
        <header className="flex h-16 items-center justify-between border-b border-border/70">
          <Logo />
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <LockKeyhole className="size-3.5 text-primary" />
            Ambiente seguro
          </div>
        </header>

        <main className="grid flex-1 items-center gap-8 py-5 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-12">
          <section className="order-2 animate-fade-up lg:order-1 lg:pr-4">
            <Btn
              variant="ghost"
              size="sm"
              className="-ml-4 mb-7 hidden lg:inline-flex"
              onClick={onClose}
              disabled={ocupado}
            >
              <ArrowLeft className="size-4" /> Voltar aos planos
            </Btn>

            <Chip tone="primary" className="mb-4">
              <Sparkles className="size-3" /> 14 dias por nossa conta
            </Chip>
            <h1
              id="checkout-title"
              className="max-w-xl font-display text-4xl font-semibold leading-tight sm:text-5xl"
            >
              Sua rota inteira, sem bloqueios.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Acesse cada etapa, projeto e habilidade que liga sua situação atual à sua próxima meta
              profissional.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {pro.inclui.slice(0, 4).map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 border-t border-border/70 py-3 text-sm"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="order-1 animate-fade-up [animation-delay:100ms] lg:order-2">
            <div className="mb-4 flex items-center justify-between lg:hidden">
              <Btn variant="ghost" size="sm" className="-ml-4" onClick={onClose} disabled={ocupado}>
                <ArrowLeft className="size-4" /> Planos
              </Btn>
              <Chip tone="primary">
                <Sparkles className="size-3" /> 14 dias grátis
              </Chip>
            </div>
            <div className="overflow-hidden rounded-lg border border-primary/30 bg-card shadow-[var(--shadow-lift)]">
              <div className="bg-foreground p-5 text-background sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                      Seu plano
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-semibold">Pathly Pro</h2>
                  </div>
                   <span className="grid size-11 place-items-center rounded-md border border-background/20 text-background">
                     <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                       <path d="M5 19c0-5 4-5 6-7s1-6-1-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                       <circle cx="18" cy="6.5" r="2.6" fill="currentColor" />
                     </svg>
                   </span>
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Depois do período grátis</p>
                    <p className="mt-1 font-display text-3xl font-semibold">{pro.preco}</p>
                  </div>
                  <span className="pb-1 text-sm text-muted-foreground">{pro.periodo}</span>
                </div>

                <div className="space-y-4 py-5">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Hoje</span>
                    <span className="font-semibold text-primary">R$ 0</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-muted-foreground">Período grátis</span>
                    <span className="font-medium">14 dias</span>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg bg-surface-2 p-3.5">
                    <CreditCard className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Conta da assinatura</p>
                      <p className="truncate text-sm font-medium">{email}</p>
                    </div>
                  </div>
                </div>

                {erro && (
                  <p
                    className="mb-4 rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 text-sm"
                    role="alert"
                  >
                    {erro}
                  </p>
                )}

                <Btn size="lg" className="w-full" onClick={onConfirmar} disabled={ocupado}>
                  {ocupado ? "Preparando pagamento…" : "Continuar para pagamento"}
                  {!ocupado && <ArrowRight className="size-4" />}
                </Btn>

                <div className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>
                    Você será encaminhado ao Stripe para informar o cartão. A Pathly não armazena
                    seus dados de pagamento.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

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
  const [checkoutAberto, setCheckoutAberto] = useState(false);
  const [email, setEmail] = useState("Sua conta Pathly");

  async function abrirCheckout() {
    setErro(null);
    if (plan === "pro") {
      await irParaStripe();
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setErro("Entre de novo para assinar.");
      return;
    }
    setEmail(data.session.user.email ?? "Sua conta Pathly");
    setCheckoutAberto(true);
  }

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
            onEscolher={() => void abrirCheckout()}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        14 dias grátis. Cancele quando quiser, direto por aqui — o acesso continua até o fim do
        período já pago.
      </p>

      {checkoutAberto && (
        <CheckoutPathly
          email={email}
          ocupado={ocupado}
          erro={erro}
          onClose={() => setCheckoutAberto(false)}
          onConfirmar={() => void irParaStripe()}
        />
      )}
    </div>
  );
}
