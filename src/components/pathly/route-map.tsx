import { useEffect } from "react";
import {
  BookOpen,
  Check,
  Clock,
  Flag,
  Gauge,
  Layers,
  Lock,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Btn, Chip, Panel, ProgressBar } from "@/components/pathly/ui";
import { difficultyTone, type NodeState, type StepView } from "@/lib/route-map";
import { cn } from "@/lib/utils";

const stateLabel: Record<NodeState, string> = {
  concluído: "Concluída",
  atual: "Etapa atual",
  futuro: "Próxima",
  bloqueado: "Bloqueada",
};

const impactTone = {
  médio: "neutral" as const,
  alto: "accent" as const,
  "muito alto": "primary" as const,
};

/* ---------------- node ---------------- */

function NodeDot({ step, active }: { step: StepView; active: boolean }) {
  const s = step.state;
  return (
    <span className="relative grid place-items-center">
      {s === "atual" && (
        <span className="absolute inline-flex size-12 animate-[pulse_2.4s_cubic-bezier(0.4,0,0.6,1)_infinite] rounded-full bg-primary/20" />
      )}
      <span
        className={cn(
          "relative grid size-11 place-items-center rounded-2xl border font-display text-sm font-semibold transition-all duration-300",
          s === "concluído" && "border-primary/40 bg-primary text-primary-foreground",
          s === "atual" &&
            "border-primary bg-primary/15 text-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_12%,transparent)]",
          s === "futuro" && "border-border bg-surface-2 text-foreground/70",
          s === "bloqueado" && "border-border/60 bg-surface-2/60 text-muted-foreground",
          active && "scale-105",
        )}
      >
        {s === "concluído" ? (
          <Check className="size-5" />
        ) : s === "bloqueado" ? (
          <Lock className="size-4" />
        ) : (
          step.order
        )}
      </span>
    </span>
  );
}

function NodeCard({
  step,
  active,
  onSelect,
  align = "left",
}: {
  step: StepView;
  active: boolean;
  onSelect: () => void;
  align?: "left" | "right";
}) {
  const locked = step.state === "bloqueado";
  return (
    <button
      onClick={onSelect}
      className={cn(
        "tap group w-full rounded-3xl border p-4 text-left transition-all duration-300",
        "border-border bg-surface-1/70 hover:-translate-y-0.5 hover:border-primary/30",
        active && "border-primary/50 bg-primary/[0.06] shadow-[0_18px_50px_-30px_var(--color-primary)]",
        locked && "opacity-70",
        align === "right" && "lg:text-right",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase",
          align === "right" && "lg:justify-end",
          step.state === "atual" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {step.state === "atual" && <Sparkles className="size-3" />}
        {stateLabel[step.state]}
      </div>
      <p className="mt-1.5 font-display text-base font-semibold text-balance">{step.title}</p>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{step.goal}</p>
      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-1.5",
          align === "right" && "lg:justify-end",
        )}
      >
        <Chip>{step.eta}</Chip>
        <Chip tone={difficultyTone[step.difficulty]}>{step.difficulty}</Chip>
        <Chip tone="xp">
          <Zap className="size-3" /> {step.xp}
        </Chip>
      </div>
      {step.state !== "bloqueado" && step.checksTotal > 0 && (
        <div className="mt-3">
          <ProgressBar value={step.state === "concluído" ? 100 : step.checkPct} />
        </div>
      )}
      <p
        className={cn(
          "mt-3 text-xs text-muted-foreground",
          align === "right" && "lg:text-right",
        )}
      >
        Renda projetada{" "}
        <span className="font-medium text-foreground">
          R$ {step.incomeAfter.toLocaleString("pt-BR")}
        </span>
      </p>
    </button>
  );
}

/* ---------------- trilha ---------------- */

export function RouteTrack({
  steps,
  selectedId,
  onSelect,
}: {
  steps: StepView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="relative space-y-3 lg:space-y-0">
      {/* espinha */}
      <span
        aria-hidden
        className="absolute top-2 bottom-2 left-[21px] w-px bg-gradient-to-b from-primary/60 via-border to-border lg:left-1/2"
      />
      {steps.map((step, i) => (
        <li
          key={step.id}
          className={cn(
            "relative animate-[fade-in_0.5s_cubic-bezier(0.16,1,0.3,1)_both]",
            "grid grid-cols-[44px_minmax(0,1fr)] items-start gap-4",
            "lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] lg:items-center lg:gap-0 lg:py-3",
          )}
          style={{ animationDelay: `${Math.min(i, 8) * 55}ms` }}
        >
          {/* coluna esquerda (desktop ímpar) */}
          <div className="hidden lg:block lg:pr-6">
            {i % 2 === 0 && (
              <NodeCard
                step={step}
                active={selectedId === step.id}
                onSelect={() => onSelect(step.id)}
                align="right"
              />
            )}
          </div>

          <div className="lg:flex lg:justify-center">
            <NodeDot step={step} active={selectedId === step.id} />
          </div>

          <div className="lg:pl-6">
            <div className="lg:hidden">
              <NodeCard
                step={step}
                active={selectedId === step.id}
                onSelect={() => onSelect(step.id)}
              />
            </div>
            <div className="hidden lg:block">
              {i % 2 === 1 && (
                <NodeCard
                  step={step}
                  active={selectedId === step.id}
                  onSelect={() => onSelect(step.id)}
                />
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- detalhe ---------------- */

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-2/50 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

export function StepDetail({
  step,
  allSteps,
  onToggleCheck,
  onComplete,
  onReopen,
  justCompleted,
}: {
  step: StepView;
  allSteps: StepView[];
  onToggleCheck: (checkId: string) => void;
  onComplete: () => void;
  onReopen: () => void;
  justCompleted: boolean;
}) {
  const locked = step.state === "bloqueado";
  const prereqs = step.prereqs
    .map((id) => allSteps.find((s) => s.id === id))
    .filter((s): s is StepView => Boolean(s));

  return (
    <div className="relative space-y-5">
      {justCompleted && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="animate-[scale-in_0.4s_cubic-bezier(0.16,1,0.3,1)_both] rounded-3xl border border-primary/40 bg-surface-1/95 px-6 py-5 text-center backdrop-blur">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <Check className="size-6" />
            </div>
            <p className="mt-3 font-display text-lg font-semibold">Etapa concluída</p>
            <p className="mt-1 text-sm text-xp">+{step.xp} XP</p>
            <p className="mt-1 text-xs text-muted-foreground">Próxima etapa liberada</p>
          </div>
        </div>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={step.state === "atual" ? "primary" : "neutral"}>
            Etapa {step.order} · {stateLabel[step.state]}
          </Chip>
          <Chip tone="xp">
            <Zap className="size-3" /> {step.xp} XP
          </Chip>
        </div>
        <h2 className="mt-3 font-display text-xl font-semibold text-balance">{step.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{step.goal}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          icon={<TrendingUp className="size-3" />}
          label="Impacto"
          value={step.impactLevel}
        />
        <Metric icon={<Clock className="size-3" />} label="Tempo" value={step.eta} />
        <Metric icon={<Gauge className="size-3" />} label="Dificuldade" value={step.difficulty} />
        <Metric
          icon={<TrendingUp className="size-3" />}
          label="Renda depois"
          value={`R$ ${step.incomeAfter.toLocaleString("pt-BR")}`}
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface-2/40 p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Por que aprender isso
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{step.why}</p>
      </div>

      <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4">
        <p className="text-sm">
          Essa habilidade aparece em{" "}
          <span className="font-display font-semibold text-primary">{step.demandPct}%</span> das
          oportunidades recomendadas para você.
        </p>
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Flag className="size-3.5 text-accent" /> Marco: {step.milestone}
        </p>
      </div>

      {prereqs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Pré-requisitos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prereqs.map((p) => (
              <Chip key={p.id} tone={p.state === "concluído" ? "primary" : "muted"}>
                {p.state === "concluído" ? <Check className="size-3" /> : <Lock className="size-3" />}
                {p.title}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Você aprenderá</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {step.skills.map((s) => (
              <Chip key={s} tone="primary">
                {s}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Projetos relacionados</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            {step.projects.map((p) => (
              <li key={p} className="flex gap-2">
                <Target className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Recursos de estudo</p>
        <div className="mt-2 space-y-2">
          {step.resources.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <BookOpen className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{r.label}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{r.type}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5" /> Checklist
          </span>
          <span className="font-medium">
            {step.checksDone}/{step.checksTotal}
          </span>
        </div>
        <ProgressBar value={step.checkPct} />
        <ul className="mt-3 space-y-1">
          {step.checklist.map((c) => {
            const checked = step.checkedIds.includes(c.id);
            return (
              <li key={c.id}>
                <button
                  disabled={locked}
                  onClick={() => onToggleCheck(c.id)}
                  className={cn(
                    "tap flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                    !locked && "hover:bg-surface-2/60",
                    locked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border transition-all duration-300",
                      checked
                        ? "scale-105 border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface-2",
                    )}
                  >
                    {checked && <Check className="size-3" />}
                  </span>
                  <span className={cn(checked && "text-muted-foreground line-through")}>
                    {c.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        {step.state === "concluído" ? (
          <>
            <Chip tone="primary">
              <Check className="size-3" /> Etapa concluída
            </Chip>
            <Btn variant="ghost" size="sm" onClick={onReopen}>
              Reabrir etapa
            </Btn>
          </>
        ) : locked ? (
          <Chip tone="muted">
            <Lock className="size-3" /> Conclua os pré-requisitos para liberar
          </Chip>
        ) : (
          <Btn onClick={onComplete}>
            <Check className="size-4" /> Concluir etapa
          </Btn>
        )}
      </div>
    </div>
  );
}

export function DetailSheet({
  step,
  onClose,
  children,
}: {
  step: StepView;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Fechar detalhes"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_0.25s_ease-out_both] bg-background/70 backdrop-blur-sm"
      />
      <div className="absolute inset-x-0 bottom-0 max-h-[88vh] animate-[slide-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both] overflow-y-auto rounded-t-3xl border-t border-border bg-surface-1 p-5 pb-24">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Etapa {step.order}</span>
          <button
            onClick={onClose}
            className="tap grid size-9 place-items-center rounded-full bg-surface-2 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
