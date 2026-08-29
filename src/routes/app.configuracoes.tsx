import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ChevronRight, FileText, LogOut, RefreshCcw, Shield, Sliders } from "lucide-react";
import { Btn, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import {
  LEGAL_DOCUMENT_LABEL,
  LEGAL_DOCUMENTS,
  LEGAL_ROUTE,
  type LegalDocumentType,
} from "@/lib/legal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Pathly" },
      {
        name: "description",
        content: "Ajuste sua meta, ritmo de estudo, notificações e privacidade na Pathly.",
      },
      { property: "og:title", content: "Configurações — Pathly" },
      { property: "og:description", content: "Recalcule a rota quando o seu cenário mudar." },
    ],
  }),
  component: SettingsPage,
});

function Toggle({ label, hint, initial }: { label: string; hint: string; initial?: boolean }) {
  const [on, setOn] = useState(initial ?? false);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn(!on)}
        className={cn(
          "tap relative h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-primary" : "bg-muted",
        )}
      >
        <span
          className={cn(
            "absolute top-1 size-5 rounded-full bg-background transition-transform duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
            on ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Bell;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      <div className="mt-3 divide-y divide-border">{children}</div>
    </Panel>
  );
}

function SettingsPage() {
  const [hours, setHours] = useState(12);

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Ajuste a rota ao seu momento" />

      <Reveal>
        <Section icon={Sliders} title="Rota e ritmo">
          <div className="py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Horas livres por semana</p>
              <span className="font-display text-sm text-primary">{hours}h</span>
            </div>
            <input
              type="range"
              min={2}
              max={40}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              aria-label="Horas livres por semana"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Alterar o ritmo recalcula os prazos das etapas ainda não concluídas.
            </p>
          </div>
          <Toggle
            label="Modo intenso"
            hint="Etapas mais curtas e metas semanais mais agressivas"
            initial={false}
          />
          <Toggle
            label="Incluir freelas na rota"
            hint="Gera renda antes da meta principal ser atingida"
            initial
          />
        </Section>
      </Reveal>

      <Reveal delay={80}>
        <Section icon={Bell} title="Notificações">
          <Toggle label="Lembrete diário" hint="Um empurrão no horário que você escolher" initial />
          <Toggle
            label="Novas oportunidades"
            hint="Quando surgir vaga acima de 70% de match"
            initial
          />
          <Toggle label="Resumo semanal" hint="Seu progresso e XP da semana" initial={false} />
        </Section>
      </Reveal>

      <Reveal delay={140}>
        <Section icon={Shield} title="Conta e privacidade">
          <Toggle
            label="Perfil visível para empresas"
            hint="Recrutadores podem ver seu portfólio"
            initial={false}
          />
          <div className="flex flex-wrap gap-3 pt-4">
            <Btn variant="outline" size="sm">
              <RefreshCcw className="size-4" /> Recalcular rota
            </Btn>
            <Btn variant="ghost" size="sm">
              <LogOut className="size-4" /> Sair da conta
            </Btn>
          </div>
        </Section>
      </Reveal>

      <Reveal delay={180}>
        <Section icon={FileText} title="Documentos">
          <div className="divide-y divide-border">
            {(["terms", "privacy"] as LegalDocumentType[]).map((type) => (
              <Link
                key={type}
                to={LEGAL_ROUTE[type]}
                className="tap flex min-h-14 items-center justify-between gap-3 py-1 text-sm"
              >
                <span>{LEGAL_DOCUMENT_LABEL[type]}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  v{LEGAL_DOCUMENTS[type].version} <ChevronRight className="size-4" />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </Reveal>
    </div>
  );
}
