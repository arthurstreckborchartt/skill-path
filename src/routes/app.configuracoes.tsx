import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  FileText,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Plug,
  Shield,
  Sliders,
  Sun,
} from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
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
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Configurações — Pathly" },
      {
        name: "description",
        content: "Gerencie aparência, privacidade e sua conta na Pathly.",
      },
      { property: "og:title", content: "Configurações — Pathly" },
      { property: "og:description", content: "Ajuste sua experiência e gerencie sua conta." },
    ],
  }),
  component: SettingsPage,
});

const THEME_OPTIONS: { id: ThemeChoice; label: string; hint: string; icon: typeof Sun }[] = [
  { id: "system", label: "Tema do sistema", hint: "Acompanha o aparelho", icon: Monitor },
  { id: "light", label: "Claro", hint: "Fundo claro o tempo todo", icon: Sun },
  { id: "dark", label: "Escuro", hint: "Fundo escuro o tempo todo", icon: Moon },
];

function ThemePicker() {
  const { choice, resolved, setChoice } = useTheme();

  return (
    <div className="py-4">
      <div role="radiogroup" aria-label="Tema" className="grid gap-2 sm:grid-cols-3">
        {THEME_OPTIONS.map((option) => {
          const active = choice === option.id;
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(option.id)}
              className={cn(
                "tap flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-surface-2/40 hover:border-primary/30",
              )}
            >
              <Icon
                className={cn(
                  "size-4.5 shrink-0",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{option.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{option.hint}</span>
              </span>
              {active && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {choice === "system"
          ? `Seguindo o aparelho — agora está no ${resolved === "dark" ? "escuro" : "claro"}. Se você mudar o tema do celular, o app muda junto.`
          : "Sua escolha fica salva neste aparelho e vale nas próximas visitas."}
      </p>
    </div>
  );
}

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
      <PageHeader title="Configurações" subtitle="Aparência, integrações, privacidade e conta" />

      <Reveal>
        <Section icon={Palette} title="Aparência">
          <ThemePicker />
        </Section>
      </Reveal>

      <Reveal delay={120}>
        <Section icon={Plug} title="Integrações">
          <div className="divide-y divide-border">
            <Link
              to="/app/integracoes"
              className="tap flex min-h-14 items-center justify-between gap-3 py-1 text-sm"
            >
              <span>Contas e ações externas</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              to="/app/ferramentas"
              className="tap flex min-h-14 items-center justify-between gap-3 py-1 text-sm"
            >
              <span>Ferramentas de desenvolvimento</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              to="/app/obsidian"
              className="tap flex min-h-14 items-center justify-between gap-3 py-1 text-sm"
            >
              <span>Obsidian</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
            <Link
              to="/app/pontes"
              className="tap flex min-h-14 items-center justify-between gap-3 py-1 text-sm"
            >
              <span>Pontes locais</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
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
