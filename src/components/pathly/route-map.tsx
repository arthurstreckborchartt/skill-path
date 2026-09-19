import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  Clock,
  Flag,
  Gauge,
  Gem,
  GraduationCap,
  Layers,
  Lock,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { Btn, Chip, Panel, ProgressBar } from "@/components/pathly/ui";
import { resourcesForTopics } from "@/lib/catalog";
import { buscasParaEtapa } from "@/lib/study-links";
import { ETAPAS_GRATIS, etapaBloqueadaPorPlano, usePlan } from "@/lib/plan";
import { useLearningSystem } from "@/lib/learning-context";
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
        <span className="absolute inline-flex size-12 rounded-md border border-foreground/20" />
      )}
      {/* Disco opaco atrás do número. Os fundos dos estados são translúcidos (bg-primary/15,
          bg-surface-2/60), então sem esta camada a espinha vertical atravessa o algarismo e os
          dois se misturam — era o que fazia os números parecerem conflitar com a linha. */}
      <span aria-hidden className="absolute size-11 rounded-md bg-background" />
      <span
        className={cn(
          "relative grid size-11 place-items-center rounded-md border font-display text-sm font-semibold transition-colors duration-200",
          s === "concluído" && "border-primary/40 bg-primary text-primary-foreground",
          s === "atual" && "border-foreground bg-surface text-foreground ring-2 ring-foreground/10",
          s === "futuro" && "border-border bg-surface-2 text-foreground/70",
          s === "bloqueado" && "border-border/60 bg-surface-2/60 text-muted-foreground",
          active && "border-foreground",
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
  const { isPro } = usePlan();
  const porPlano = etapaBloqueadaPorPlano(step.order, isPro);
  return (
    <button
      onClick={onSelect}
      className={cn(
        "tap group w-full rounded-md border p-4 text-left transition-colors duration-200",
        "border-border bg-surface hover:border-foreground/25 hover:bg-surface-2",
        active && "border-foreground/35 bg-surface-2",
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
        {porPlano && (
          <Chip tone="accent">
            <Gem className="size-3" /> Pro
          </Chip>
        )}
      </div>
      {step.state !== "bloqueado" && step.checksTotal > 0 && (
        <div className="mt-3">
          <ProgressBar value={step.state === "concluído" ? 100 : step.checkPct} />
        </div>
      )}
      <p className={cn("mt-3 text-xs text-muted-foreground", align === "right" && "lg:text-right")}>
        Meta parcial{" "}
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
        className="absolute top-2 bottom-2 left-[22px] w-px bg-border lg:left-1/2"
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
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-sm font-semibold">{value}</p>
    </div>
  );
}

/** Uma linha de material. Sempre um link de verdade: a versão anterior caía num `div` quando o
 *  catálogo não cobria o assunto, e clicar nele não fazia nada. */
function LinkEstudo({
  href,
  icon,
  title,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tap flex min-h-14 items-center justify-between gap-3 rounded-xl bg-surface-2/40 px-4 py-3 text-sm transition-colors hover:bg-surface-2"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta}</span>
        </span>
      </span>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function StepDetail({
  step,
  allSteps,
  onToggleCheck,
  onComplete,
  onReopen,
  justCompleted,
  hideActions,
}: {
  step: StepView;
  allSteps: StepView[];
  onToggleCheck: (checkId: string) => void;
  onComplete: () => void;
  onReopen: () => void;
  justCompleted: boolean;
  /** No sheet do celular as ações vão para o rodapé fixo, não para o fim do conteúdo. */
  hideActions?: boolean;
}) {
  const locked = step.state === "bloqueado";
  const prereqs = step.prereqs
    .map((id) => allSteps.find((s) => s.id === id))
    .filter((s): s is StepView => Boolean(s));
  const prereqsDone = prereqs.every((p) => p.state === "concluído");
  // Material real do catálogo para as habilidades desta etapa (ver src/lib/catalog.ts).
  const materiais = resourcesForTopics(step.skills);
  // Piso: o catálogo é curado e pequeno, então nem toda etapa tem item nele. As buscas garantem
  // que nenhuma etapa fique sem caminho (ver src/lib/study-links.ts).
  const buscas = buscasParaEtapa(step.skills);
  const { isPro } = usePlan();
  const learning = useLearningSystem();
  const bloqueadaPorPlano = etapaBloqueadaPorPlano(step.order, isPro) && step.state !== "concluído";
  const gratis = buscas.filter((b) => b.tipo === "grátis");
  const pagos = buscas.filter((b) => b.tipo === "pago");

  return (
    <div className="relative space-y-5">
      {justCompleted && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="animate-[fade-in_0.25s_ease-out_both] rounded-md border border-border bg-surface px-6 py-5 text-center shadow-[var(--shadow-lift)]">
            <div className="mx-auto grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
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

      {bloqueadaPorPlano && (
        <div className="rounded-md border border-border bg-surface-2 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Gem className="size-4 text-accent" /> Etapa do plano Pro
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            O plano gratuito libera as {ETAPAS_GRATIS} primeiras etapas. O conteúdo desta aqui
            continua visível — material, checklist e projetos — mas concluí-la e seguir a rota
            precisa do Pro.
          </p>
          <Link
            to="/app/planos"
            className="tap mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Ver os planos <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric icon={<TrendingUp className="size-3" />} label="Impacto" value={step.impactLevel} />
        <Metric icon={<Clock className="size-3" />} label="Tempo" value={step.eta} />
        <Metric icon={<Gauge className="size-3" />} label="Dificuldade" value={step.difficulty} />
        <Metric
          icon={<TrendingUp className="size-3" />}
          label="Meta parcial"
          value={`R$ ${step.incomeAfter.toLocaleString("pt-BR")}`}
        />
      </div>

      <div className="rounded-md border border-border bg-surface-2 p-4">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Por que aprender isso
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{step.why}</p>
      </div>

      <div className="rounded-md border border-border bg-surface-2 p-4">
        {/* demandPct é um peso autoral por etapa (route-templates.ts), não medição de vagas
            abertas. O texto precisa deixar isso explícito para não virar estatística falsa. */}
        <p className="text-sm">
          Peso desta habilidade na área:{" "}
          <span className="font-display font-semibold text-primary">{step.demandPct}%</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimativa editorial da Pathly sobre o quanto ela é exigida — não é uma medição de vagas
          abertas.
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
                {p.state === "concluído" ? (
                  <Check className="size-3" />
                ) : (
                  <Lock className="size-3" />
                )}
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

      {materiais.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">Material selecionado</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Conferido um por um pela Pathly. Todos gratuitos.
          </p>
          <div className="mt-2 space-y-2">
            {materiais.map((r) => (
              <LinkEstudo
                key={r.slug}
                href={r.url}
                icon={<BookOpen className="size-3.5" />}
                title={r.title}
                meta={`${r.provider} · ${r.kind}${r.language === "en" ? " · em inglês" : ""}`}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground">Estudar de graça</p>
        <div className="mt-2 space-y-2">
          {gratis.map((b) => (
            <LinkEstudo
              key={b.id}
              href={b.url}
              icon={<Play className="size-3.5" />}
              title={b.label}
              meta={`${b.provider} · ${b.hint}`}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground">Cursos pagos</p>
        {/* Dito explicitamente porque a Pathly não recebe nada por estes links e não assistiu a
            estes cursos: são buscas na plataforma, não indicação de um curso específico. */}
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Buscas nas plataformas. A Pathly não recebe comissão nem indica um curso específico.
        </p>
        <div className="mt-2 space-y-2">
          {pagos.map((b) => (
            <LinkEstudo
              key={b.id}
              href={b.url}
              icon={<GraduationCap className="size-3.5" />}
              title={b.label}
              meta={`${b.provider} · ${b.hint}`}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Layers className="size-3.5" /> Sessões com evidência
          </span>
          <span className="font-medium">
            {step.checksDone}/{step.checksTotal}
          </span>
        </div>
        <ProgressBar value={step.checkPct} />
        <ul className="mt-3 space-y-1">
          {step.checklist.map((c) => {
            const activityId = `${step.id}:${c.id}`;
            const activityProgress = learning.progressFor(activityId);
            const checked =
              activityProgress?.status === "completed" || step.checkedIds.includes(c.id);
            return (
              <li key={c.id}>
                <Link
                  to="/app/aprender/$activityId"
                  params={{ activityId }}
                  aria-disabled={locked || bloqueadaPorPlano}
                  onClick={(event) => {
                    if (locked || bloqueadaPorPlano) event.preventDefault();
                  }}
                  className={cn(
                    "tap flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors",
                    !locked && !bloqueadaPorPlano && "hover:bg-surface-2/60",
                    (locked || bloqueadaPorPlano) && "cursor-not-allowed opacity-60",
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
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", checked && "text-muted-foreground")}>
                      {c.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {activityProgress?.score != null
                        ? `${activityProgress.score}% · ${activityProgress.attempts} tentativa${activityProgress.attempts === 1 ? "" : "s"}`
                        : checked
                          ? "Histórico anterior preservado"
                          : "Aprender · testar · praticar"}
                    </span>
                  </span>
                  {!checked && !locked && !bloqueadaPorPlano && (
                    <ArrowUpRight className="size-4 shrink-0 text-primary" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {!hideActions && (
        <div className="border-t border-border pt-4">
          <StepActions
            step={step}
            prereqsDone={prereqsDone}
            onComplete={onComplete}
            onReopen={onReopen}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Ações da etapa. Fica separado porque no celular elas são fixadas no rodapé do sheet, na altura
 * do polegar, em vez de ficarem no fim de um conteúdo que exige rolar até o fim para alcançar.
 */
export function StepActions({
  step,
  prereqsDone,
  onComplete,
  onReopen,
  full,
}: {
  step: StepView;
  prereqsDone: boolean;
  onComplete: () => void;
  onReopen: () => void;
  full?: boolean;
}) {
  const locked = step.state === "bloqueado";
  const { isPro } = usePlan();

  // O paywall vem antes do cadeado de pré-requisito: quem está no gratuito não precisa descobrir
  // que cumpriu os pré-requisitos só para esbarrar no plano logo depois.
  if (etapaBloqueadaPorPlano(step.order, isPro) && step.state !== "concluído") {
    return (
      <Link
        to="/app/planos"
        className={cn(
          "tap inline-flex items-center justify-center gap-2 rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-85",
          full ? "h-12 w-full" : "h-10",
        )}
      >
        <Gem className="size-4" /> Liberar com o Pro
      </Link>
    );
  }

  if (step.state === "concluído") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="primary">
          <Check className="size-3" /> Etapa concluída
        </Chip>
        <Btn variant="ghost" size="sm" onClick={onReopen}>
          Reabrir etapa
        </Btn>
      </div>
    );
  }

  if (locked || !prereqsDone) {
    return (
      <Chip tone="muted">
        <Lock className="size-3" /> Conclua os pré-requisitos para liberar
      </Chip>
    );
  }

  if (step.checksDone < step.checksTotal) {
    return (
      <Chip tone="muted">
        <BookOpen className="size-3" /> Conclua as sessões para liberar a etapa
      </Chip>
    );
  }

  return (
    <Btn onClick={onComplete} size={full ? "lg" : "md"} className={cn(full && "w-full")}>
      <Check className="size-4" /> Concluir etapa
    </Btn>
  );
}

export function DetailSheet({
  step,
  onClose,
  children,
  footer,
}: {
  step: StepView;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Portal para o body, e não é preciosismo: o `<main>` do AppShell carrega
   * `animate-[fade-up_..._both]`, e o `both` mantém o `transform` aplicado depois que a animação
   * acaba. Um transform — mesmo a matriz identidade — faz o elemento virar o containing block de
   * todo `position: fixed` dentro dele. O sheet então era posicionado pelo fim da PÁGINA em vez
   * do fim da TELA e abria a 1468px numa viewport de 812: o fundo escurecia e nada aparecia.
   *
   * O `both` do main também foi trocado por `backwards`, o que resolve a causa. O portal fica
   * porque é o que impede a próxima camada com transform de reabrir o mesmo buraco.
   */
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        aria-label="Fechar detalhes"
        onClick={onClose}
        className="absolute inset-0 animate-[fade-in_0.2s_ease-out_both] bg-foreground/20"
      />
      <div className="absolute inset-x-0 bottom-0 flex max-h-[88svh] animate-[slide-up_0.3s_cubic-bezier(0.16,1,0.3,1)_both] flex-col rounded-t-xl border-t border-border bg-surface">
        {/* Alça: o gesto de fechar puxando para baixo é o esperado num sheet de celular, e o X
            fica no canto superior, fora do alcance do polegar. */}
        <button
          onClick={onClose}
          aria-label="Fechar detalhes"
          className="tap flex shrink-0 justify-center pt-3 pb-1"
        >
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
        </button>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-5 pb-5">
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

        {footer && (
          <div className="shrink-0 border-t border-border bg-surface px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
