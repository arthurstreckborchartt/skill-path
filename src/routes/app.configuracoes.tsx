import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  MessageSquare,
  RefreshCcw,
  Shield,
  Sliders,
} from "lucide-react";
import { Btn, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import { FeedbackForm } from "@/components/pathly/feedback-form";
import { signOut } from "@/lib/auth";
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
        content: "Refaça sua rota, envie feedback e gerencie sua conta na Pathly.",
      },
      { property: "og:title", content: "Configurações — Pathly" },
      { property: "og:description", content: "Recalcule a rota quando o seu cenário mudar." },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Shield;
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
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle="Ajuste a rota ao seu momento" />

      <Reveal>
        <Section icon={Sliders} title="Rota e ritmo">
          <p className="py-4 text-sm text-muted-foreground">
            O conteúdo e o ritmo da sua rota vêm das respostas do onboarding — principalmente a área
            escolhida, sua experiência e as horas que você tem por semana. Para mudar qualquer uma
            delas, refaça o onboarding.
          </p>
          <div className="pb-4">
            <Btn variant="outline" size="sm" onClick={() => navigate({ to: "/onboarding" })}>
              <RefreshCcw className="size-4" /> Refazer onboarding
            </Btn>
            <p className="mt-2 text-xs text-muted-foreground">
              Gera uma rota nova. O progresso da rota atual não é transferido.
            </p>
          </div>
        </Section>
      </Reveal>

      <Reveal delay={140}>
        <Section icon={Shield} title="Conta e privacidade">
          <div className="flex flex-wrap gap-3 pt-4">
            <Btn variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" /> Sair da conta
            </Btn>
          </div>
        </Section>
      </Reveal>

      <Reveal delay={160}>
        <Section icon={MessageSquare} title="Falar com a gente">
          <p className="pt-3 text-sm text-muted-foreground">
            Achou um erro ou sentiu falta de alguma coisa? Escreve aqui — chega direto pra quem
            constrói a Pathly.
          </p>
          <FeedbackForm />
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
