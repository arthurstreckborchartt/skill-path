import { createFileRoute } from "@tanstack/react-router";
import { Check, Sparkles, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel } from "@/components/pathly/ui";
import { PLANOS, usePlan, type Plano } from "@/lib/plan";
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
  onEscolher,
}: {
  plano: Plano;
  atual: boolean;
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
        {atual ? (
          <Btn variant="ghost" size="lg" className="w-full" disabled>
            Plano atual
          </Btn>
        ) : (
          <Btn size="lg" className="w-full" onClick={onEscolher}>
            {destaque ? "Quero o Pro" : "Voltar para o Gratuito"}
          </Btn>
        )}
      </div>
    </Panel>
  );
}

function PlanosPage() {
  const { plan, mudar } = usePlan();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planos"
        subtitle="O gratuito mostra a rota inteira e libera as duas primeiras etapas. O Pro destrava o resto."
      />

      {/* A cobrança ainda não existe. Dizer isso antes do botão é o mínimo: um botão escrito
          "Quero o Pro" que não cobra, sem aviso, é o app mentindo para quem clicou. */}
      <Panel className="border-accent/40 bg-accent/[0.06]">
        <p className="text-sm">
          <span className="font-semibold">Ainda não estamos cobrando.</span> Esta tela é a prévia
          dos planos. O botão abaixo troca o seu plano na hora, de graça, para você ver como fica —
          nenhum cartão é pedido e nada é cobrado.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        {PLANOS.map((p) => (
          <CardPlano key={p.id} plano={p} atual={plan === p.id} onEscolher={() => mudar(p.id)} />
        ))}
      </div>
    </div>
  );
}
