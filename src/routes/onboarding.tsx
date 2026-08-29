import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { Btn, Logo, ProgressBar } from "@/components/pathly/ui";
import { onboardingQuestions } from "@/lib/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Monte sua rota — Pathly" },
      {
        name: "description",
        content: "Responda 10 perguntas rápidas e receba sua rota personalizada de habilidades.",
      },
      { property: "og:title", content: "Monte sua rota na Pathly" },
      {
        property: "og:description",
        content: "Renda atual, meta, tempo livre e interesses. O resto a Pathly organiza.",
      },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [building, setBuilding] = useState(false);

  const q = onboardingQuestions[index]!;
  const total = onboardingQuestions.length;
  const progress = ((index + (building ? 1 : 0)) / total) * 100;
  const current = answers[q.key];

  function setAnswer(value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [q.key]: value }));
  }

  function toggleMulti(option: string) {
    const list = Array.isArray(current) ? current : [];
    setAnswer(list.includes(option) ? list.filter((o) => o !== option) : [...list, option]);
  }

  function next() {
    if (index + 1 < total) {
      setIndex(index + 1);
      return;
    }
    setBuilding(true);
    setTimeout(() => navigate({ to: "/app" }), 2200);
  }

  if (building) {
    return (
      <div className="halo grid min-h-screen place-items-center px-6">
        <div className="animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)_both] w-full max-w-md text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-3xl bg-signal shadow-[var(--shadow-glow)]">
            <Sparkles className="size-6 text-primary-foreground" />
          </span>
          <h1 className="mt-7 font-display text-2xl font-semibold">Montando sua rota</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cruzando sua meta de renda com habilidades, projetos e oportunidades.
          </p>
          <div className="mt-8 space-y-3 text-left">
            {["Analisando ponto de partida", "Definindo etapas", "Selecionando projetos"].map(
              (label, i) => (
                <div key={label} className="flex items-center gap-3 rounded-2xl bg-surface p-4">
                  <Loader2
                    className="size-4 animate-spin text-primary"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="tap">
          <Logo />
        </Link>
        <span className="text-xs text-muted-foreground">
          {index + 1} de {total}
        </span>
      </header>

      <div className="px-5 sm:px-8">
        <ProgressBar value={progress} delay={80} className="h-1" />
      </div>

      <main className="flex flex-1 items-center px-5 py-10 sm:px-8">
        <div key={q.key} className="animate-[fade-up_0.45s_cubic-bezier(0.16,1,0.3,1)_both] mx-auto w-full max-w-lg">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{q.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">{q.hint}</p>

          <div className="mt-9">
            {(q.kind === "money" || q.kind === "text") && (
              <input
                autoFocus
                inputMode={q.kind === "money" ? "numeric" : "text"}
                value={typeof current === "string" ? current : ""}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder={q.placeholder}
                className="h-16 w-full rounded-2xl border border-input bg-surface/60 px-5 font-display text-2xl outline-none transition-all placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
              />
            )}

            {q.kind === "options" && (
              <div className="grid gap-2.5">
                {q.options?.map((option) => {
                  const active = current === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setAnswer(option)}
                      className={cn(
                        "tap flex items-center justify-between rounded-2xl border px-5 py-4 text-left text-sm transition-all",
                        active
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-surface/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {option}
                      <span
                        className={cn(
                          "grid size-5 place-items-center rounded-full transition-colors",
                          active ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {active && <Check className="size-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {q.kind === "multi" && (
              <div className="flex flex-wrap gap-2.5">
                {q.options?.map((option) => {
                  const active = Array.isArray(current) && current.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleMulti(option)}
                      className={cn(
                        "tap rounded-full border px-4 py-2.5 text-sm transition-all",
                        active
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border bg-surface/50 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center gap-3">
            {index > 0 && (
              <Btn variant="ghost" size="lg" onClick={() => setIndex(index - 1)}>
                <ArrowLeft className="size-4" /> Voltar
              </Btn>
            )}
            <Btn size="lg" className="flex-1 sm:flex-none" onClick={next}>
              {index + 1 === total ? "Gerar minha rota" : "Continuar"}
              <ArrowRight className="size-4" />
            </Btn>
          </div>
        </div>
      </main>
    </div>
  );
}
