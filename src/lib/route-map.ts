import { useCallback, useEffect, useMemo, useState } from "react";
import { steps as baseSteps, user, type Difficulty, type Step } from "@/lib/mock";
import { generateRoute, roleLabelForArea } from "@/lib/route-templates";
import {
  experiences,
  goals,
  horizons,
  loadProfile,
  situations,
  type SkillLevel,
} from "@/lib/onboarding";

export type NodeState = "concluído" | "atual" | "futuro" | "bloqueado";

export type RouteStep = Step & {
  /** Por que aprender isso */
  why: string;
  /** Impacto esperado em escala */
  impactLevel: "médio" | "alto" | "muito alto";
  /** Pré-requisitos (ids de etapas) */
  prereqs: string[];
  /** Marco profissional relacionado */
  milestone: string;
  /** % das oportunidades recomendadas que pedem essa habilidade */
  demandPct: number;
  /** carga total estimada em horas */
  hours: number;
  /** semana prevista de início dentro da rota */
  week: number;
};

type Extra = Omit<RouteStep, keyof Step>;

const extras: Record<string, Extra> = {
  s1: {
    why: "Sem lógica e sintaxe sólidas todo o resto da rota vira decoreba. É aqui que você deixa de copiar tutorial e começa a resolver problema.",
    impactLevel: "alto",
    prereqs: [],
    milestone: "Primeiro código próprio funcionando",
    demandPct: 96,
    hours: 36,
    week: 1,
  },
  s2: {
    why: "APIs são o coração do trabalho back-end. É a primeira habilidade que aparece literalmente escrita nas vagas júnior que você quer.",
    impactLevel: "muito alto",
    prereqs: ["s1"],
    milestone: "Pronto para vagas de estágio/júnior back-end",
    demandPct: 87,
    hours: 48,
    week: 4,
  },
  s3: {
    why: "Recrutador não lê promessa, lê repositório. Um projeto público bem apresentado é o que transforma estudo em prova.",
    impactLevel: "muito alto",
    prereqs: ["s2"],
    milestone: "Portfólio com prova real de entrega",
    demandPct: 74,
    hours: 24,
    week: 8,
  },
  s4: {
    why: "Toda aplicação real guarda dados. Sem SQL você é barrado no teste técnico mesmo sabendo programar.",
    impactLevel: "muito alto",
    prereqs: ["s2"],
    milestone: "Aprovação em testes técnicos de dados",
    demandPct: 91,
    hours: 44,
    week: 10,
  },
  s5: {
    why: "Freela paga a conta enquanto você estuda e gera repertório de cliente real — dois coelhos com o mesmo tiro.",
    impactLevel: "alto",
    prereqs: ["s3", "s4"],
    milestone: "Primeira renda extra com tecnologia",
    demandPct: 41,
    hours: 60,
    week: 14,
  },
  s6: {
    why: "Docker e CI separam quem fez curso de quem trabalha em produção. É o salto do júnior raso para o júnior disputado.",
    impactLevel: "alto",
    prereqs: ["s4"],
    milestone: "Perfil competitivo para pleno em 12 meses",
    demandPct: 68,
    hours: 56,
    week: 20,
  },
  s7: {
    why: "Você já terá a habilidade; falta a embalagem. Currículo e LinkedIn alinhados multiplicam a resposta sem precisar de skill nova.",
    impactLevel: "médio",
    prereqs: ["s3"],
    milestone: "Presença profissional pronta para o mercado",
    demandPct: 100,
    hours: 10,
    week: 26,
  },
  s8: {
    why: "Candidatura é funil: volume qualificado com repertório técnico é o que fecha a diferença entre R$ 2.600 e R$ 8.000.",
    impactLevel: "muito alto",
    prereqs: ["s6", "s7"],
    milestone: "Primeira oferta formal na área",
    demandPct: 100,
    hours: 40,
    week: 28,
  },
  s9: {
    why: "Especializar é o que puxa o salário para cima depois de entrar. Dados ou cloud são as trilhas com melhor teto hoje.",
    impactLevel: "muito alto",
    prereqs: ["s8"],
    milestone: "Faixa de R$ 8.000/mês alcançada",
    demandPct: 57,
    hours: 64,
    week: 34,
  },
};

/** A rota fixa de demonstração — usada como exemplo público e como fallback antes da hidratação. */
const DEMO_STEPS: RouteStep[] = baseSteps.map((s) => ({
  ...s,
  ...(extras[s.id] ?? {
    why: "Etapa complementar da sua rota.",
    impactLevel: "médio" as const,
    prereqs: [],
    milestone: "Progresso na rota",
    demandPct: 50,
    hours: 20,
    week: 1,
  }),
}));

export const difficultyTone: Record<Difficulty, "primary" | "accent" | "xp"> = {
  fácil: "primary",
  médio: "accent",
  difícil: "xp",
};

/* ---------------- perfil ativo: demo ou gerado do onboarding real ---------------- */

export type ActiveProfile = {
  /** Nulo para rota personalizada — o onboarding não coleta nome, e não inventamos um. */
  firstName: string | null;
  role: string;
  target: string;
  currentIncome: number;
  goalIncome: number;
  hoursPerWeek: number;
  deadlineMonths: number;
  goalType: string;
  /** Só preenchidos para rota personalizada — respostas reais do onboarding, não fabricadas. */
  situationLabel: string | null;
  experienceLabel: string | null;
  /** Habilidades que a pessoa declarou já ter no onboarding — vazio na rota demo. */
  declaredSkills: { name: string; level: SkillLevel }[];
  isPersonalized: boolean;
};

const DEMO_PROFILE: ActiveProfile = {
  firstName: user.firstName,
  role: user.role,
  target: user.target,
  currentIncome: user.currentIncome,
  goalIncome: user.goalIncome,
  hoursPerWeek: user.hoursPerWeek,
  deadlineMonths: user.deadlineMonths,
  goalType: user.goalType,
  situationLabel: null,
  experienceLabel: null,
  declaredSkills: [],
  isPersonalized: false,
};

/**
 * Lê o perfil salvo do onboarding e gera a rota real. Só roda no cliente — no HTML do servidor
 * e no primeiro paint do cliente sempre voltamos pro exemplo demo (idêntico dos dois lados,
 * sem risco de mismatch de hidratação), e só depois de montado trocamos pra rota real, dentro
 * de um efeito — mesmo padrão que já protege o progresso.
 */
function resolveActiveRoute(): { steps: RouteStep[]; profile: ActiveProfile } {
  if (typeof window === "undefined") return { steps: DEMO_STEPS, profile: DEMO_PROFILE };
  const onboarding = loadProfile();
  if (!onboarding?.completedAt) return { steps: DEMO_STEPS, profile: DEMO_PROFILE };

  const steps = generateRoute(onboarding);
  const horizonMonths = horizons.find((h) => h.id === onboarding.income.horizon)?.months ?? 10;
  const profile: ActiveProfile = {
    firstName: null,
    role: onboarding.currentProfession.trim() || "sua profissão atual",
    target: roleLabelForArea(onboarding.desiredAreas[0]),
    currentIncome: onboarding.income.noIncome ? 0 : (onboarding.income.current ?? 0),
    goalIncome: Math.max(onboarding.income.target ?? 0, 500),
    hoursPerWeek: Math.max(2, onboarding.study.hoursPerWeek || 7),
    deadlineMonths: horizonMonths,
    goalType: goals.find((g) => g.id === onboarding.goal)?.label ?? "Crescer na carreira",
    situationLabel: situations.find((s) => s.id === onboarding.situation)?.label ?? null,
    experienceLabel: experiences.find((e) => e.id === onboarding.experience)?.label ?? null,
    declaredSkills: onboarding.skills.map((s) => ({ name: s.name, level: s.level })),
    isPersonalized: true,
  };
  return { steps, profile };
}

/* ---------------- progresso persistente ---------------- */

const KEY = "pathly.route.v1";

export type RouteProgress = {
  /** ids de etapas concluídas */
  done: string[];
  /** "stepId:checkId" marcados */
  checks: string[];
  /** última data (YYYY-MM-DD, horário local) em que algo foi marcado como concluído */
  lastActiveDate: string | null;
  /** dias consecutivos com pelo menos uma conclusão real — nunca inventado */
  streak: number;
};

/**
 * Os ids das etapas ("step-1".."step-7") repetem entre os modelos de rota, então progresso salvo
 * de uma rota antiga combinaria com as etapas de uma rota nova gerada num novo onboarding.
 * A assinatura identifica de qual rota o progresso é: se mudar, o progresso salvo é descartado.
 */
function routeSignature(steps: RouteStep[], profile: ActiveProfile): string {
  return [
    profile.isPersonalized ? "p" : "demo",
    profile.target,
    profile.goalType,
    steps.map((s) => `${s.id}|${s.title}`).join(">"),
  ].join("::");
}

/** Rota demo já vem com progresso de exemplo pré-preenchido; rota real gerada começa sempre zerada. */
function seedProgress(steps: RouteStep[], isPersonalized: boolean): RouteProgress {
  if (isPersonalized) {
    return { done: [], checks: [], lastActiveDate: null, streak: 0 };
  }
  return {
    done: steps.filter((s) => s.status === "concluído").map((s) => s.id),
    checks: steps.flatMap((s) => s.checklist.filter((c) => c.done).map((c) => `${s.id}:${c.id}`)),
    lastActiveDate: null,
    streak: 0,
  };
}

function readProgress(fallback: RouteProgress, signature: string): RouteProgress {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<RouteProgress> & { signature?: string };
    // Progresso de outra rota (outro onboarding / outra área) não vale para esta.
    if (parsed.signature !== signature) return fallback;
    return {
      done: parsed.done ?? fallback.done,
      checks: parsed.checks ?? fallback.checks,
      lastActiveDate: parsed.lastActiveDate ?? fallback.lastActiveDate,
      streak: parsed.streak ?? fallback.streak,
    };
  } catch {
    return fallback;
  }
}

/** Dia do calendário do usuário, não UTC: às 21h no Brasil o dia UTC já virou e a sequência erraria. */
function localIso(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function todayIso(): string {
  return localIso(new Date());
}

function isYesterday(dateIso: string, today: string): boolean {
  const d = new Date(`${dateIso}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return localIso(d) === today;
}

/** Marca hoje como dia ativo, incrementando a sequência só quando há um dia real de intervalo. */
function bumpStreak(p: RouteProgress): RouteProgress {
  const today = todayIso();
  if (p.lastActiveDate === today) return p;
  const streak = p.lastActiveDate && isYesterday(p.lastActiveDate, today) ? p.streak + 1 : 1;
  return { ...p, lastActiveDate: today, streak };
}

export type StepView = RouteStep & {
  state: NodeState;
  checksDone: number;
  checksTotal: number;
  checkPct: number;
  checkedIds: string[];
};

export function useRouteProgress() {
  const [active, setActive] = useState<{ steps: RouteStep[]; profile: ActiveProfile }>({
    steps: DEMO_STEPS,
    profile: DEMO_PROFILE,
  });
  const [progress, setProgress] = useState<RouteProgress>(() => seedProgress(DEMO_STEPS, false));
  const [hydrated, setHydrated] = useState(false);
  const [celebrating, setCelebrating] = useState<{ id: string; xp: number } | null>(null);

  useEffect(() => {
    const resolved = resolveActiveRoute();
    setActive(resolved);
    const fallback = seedProgress(resolved.steps, resolved.profile.isPersonalized);
    setProgress(readProgress(fallback, routeSignature(resolved.steps, resolved.profile)));
    setHydrated(true);
  }, []);

  const signature = useMemo(
    () => routeSignature(active.steps, active.profile),
    [active.steps, active.profile],
  );

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ ...progress, signature }));
    } catch {
      /* ignora quota */
    }
  }, [progress, hydrated]);

  const steps = active.steps;
  const profile = active.profile;

  const currentIndex = useMemo(() => {
    const i = steps.findIndex((s) => !progress.done.includes(s.id));
    return i === -1 ? steps.length - 1 : i;
  }, [progress.done, steps]);

  const views: StepView[] = useMemo(
    () =>
      steps.map((s, i) => {
        const checkedIds = s.checklist
          .filter((c) => progress.checks.includes(`${s.id}:${c.id}`))
          .map((c) => c.id);
        const state: NodeState = progress.done.includes(s.id)
          ? "concluído"
          : i === currentIndex
            ? "atual"
            : i <= currentIndex + 1
              ? "futuro"
              : "bloqueado";
        return {
          ...s,
          state,
          checkedIds,
          checksDone: checkedIds.length,
          checksTotal: s.checklist.length,
          checkPct: Math.round((checkedIds.length / Math.max(1, s.checklist.length)) * 100),
        };
      }),
    [progress, currentIndex, steps],
  );

  const toggleCheck = useCallback((stepId: string, checkId: string) => {
    const key = `${stepId}:${checkId}`;
    setProgress((p) => {
      const turningOn = !p.checks.includes(key);
      const next = {
        ...p,
        checks: turningOn ? [...p.checks, key] : p.checks.filter((k) => k !== key),
      };
      return turningOn ? bumpStreak(next) : next;
    });
  }, []);

  const completeStep = useCallback(
    (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;
      setProgress((p) => {
        if (p.done.includes(stepId)) return p;
        // Rota é linear: concluir uma etapa com pré-requisito pendente quebraria XP, % e "etapa atual".
        if (!step.prereqs.every((id) => p.done.includes(id))) return p;
        const next = {
          ...p,
          done: [...p.done, stepId],
          checks: Array.from(
            new Set([...p.checks, ...step.checklist.map((c) => `${stepId}:${c.id}`)]),
          ),
        };
        return bumpStreak(next);
      });
      setCelebrating({ id: stepId, xp: step.xp });
      window.setTimeout(() => setCelebrating(null), 2200);
    },
    [steps],
  );

  const reopenStep = useCallback((stepId: string) => {
    setProgress((p) => ({ ...p, done: p.done.filter((id) => id !== stepId) }));
  }, []);

  const reset = useCallback(
    () => setProgress(seedProgress(steps, profile.isPersonalized)),
    [steps, profile.isPersonalized],
  );

  const stats = useMemo(() => {
    const done = views.filter((s) => s.state === "concluído");
    const partialHours = views
      .filter((s) => s.state !== "concluído")
      .reduce((acc, s) => acc + (s.hours * s.checkPct) / 100, 0);
    const hours = Math.round(done.reduce((a, s) => a + s.hours, 0) + partialHours);
    const skills = Array.from(new Set(done.flatMap((s) => s.skills)));
    const projects = done.flatMap((s) => s.projects);
    const totalXp = done.reduce((a, s) => a + s.xp, 0);
    const percent = Math.round((done.length / steps.length) * 100);
    const current = views[currentIndex];
    const remainingWeeks = views
      .filter((s) => s.state !== "concluído")
      .reduce(
        (a, s) => a + Math.max(1, Math.round(s.hours / Math.max(4, profile.hoursPerWeek))),
        0,
      );
    return {
      percent,
      doneCount: done.length,
      total: steps.length,
      hours,
      skills,
      projects,
      totalXp,
      current,
      incomeNow: done.at(-1)?.incomeAfter ?? profile.currentIncome,
      monthsLeft: Math.max(1, Math.round(remainingWeeks / 4.3)),
      streak: progress.streak,
    };
  }, [views, currentIndex, progress.streak, steps, profile]);

  return {
    views,
    currentIndex,
    stats,
    celebrating,
    toggleCheck,
    completeStep,
    reopenStep,
    reset,
    hydrated,
    profile,
  };
}

export type RouteProgressValue = ReturnType<typeof useRouteProgress>;

/* ---------------- nível a partir do XP real ---------------- */

const XP_LEVELS = [
  { level: 1, name: "Iniciante", xp: 0 },
  { level: 2, name: "Aprendiz", xp: 500 },
  { level: 3, name: "Praticante", xp: 1200 },
  { level: 4, name: "Construtor", xp: 2200 },
  { level: 5, name: "Especialista", xp: 3600 },
  { level: 6, name: "Avançado", xp: 5400 },
  { level: 7, name: "Mestre", xp: 7600 },
] as const;

export type LevelInfo = {
  level: number;
  name: string;
  xp: number;
  xpBase: number;
  xpToNext: number;
  progressPct: number;
  maxed: boolean;
};

export function levelFromXp(xp: number): LevelInfo {
  let current: (typeof XP_LEVELS)[number] = XP_LEVELS[0];
  let next: (typeof XP_LEVELS)[number] | undefined;
  for (const tier of XP_LEVELS) {
    if (xp >= tier.xp) current = tier;
    else {
      next = tier;
      break;
    }
  }
  const span = (next?.xp ?? current.xp) - current.xp || 1;
  return {
    level: current.level,
    name: current.name,
    xp,
    xpBase: current.xp,
    xpToNext: next?.xp ?? current.xp,
    progressPct: next ? Math.min(100, Math.round(((xp - current.xp) / span) * 100)) : 100,
    maxed: !next,
  };
}

/* ---------------- próxima ação ---------------- */

export type NextAction = {
  stepId: string;
  stepTitle: string;
  label: string;
  /** Sempre um valor real: minutos derivados do orçamento de horas da etapa, ou o eta autoral. */
  timeLabel: string;
  xp: number;
  isStepLevel: boolean;
};

/** `step.hours` cobre semanas de estudo — dividido por item de checklist já não é mais "uma sessão". */
function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `~${hours}h`;
}

/** A ação mais útil agora: o próximo item do checklist da etapa atual, ou concluir a etapa. */
export function getNextAction(views: StepView[], currentIndex: number): NextAction | null {
  const current = views[currentIndex];
  if (!current || current.state !== "atual") return null;

  const pendingCheck = current.checklist.find((c) => !current.checkedIds.includes(c.id));
  if (pendingCheck) {
    const perItem = Math.max(1, current.checksTotal);
    return {
      stepId: current.id,
      stepTitle: current.title,
      label: pendingCheck.label,
      timeLabel: formatTime(Math.max(10, Math.round((current.hours * 60) / perItem))),
      xp: Math.max(10, Math.round(current.xp / perItem)),
      isStepLevel: false,
    };
  }

  return {
    stepId: current.id,
    stepTitle: current.title,
    label: `Concluir etapa: ${current.title}`,
    timeLabel: current.eta,
    xp: current.xp,
    isStepLevel: true,
  };
}

/* ---------------- plano da semana ---------------- */

export type WeekPlanState = "concluído" | "hoje" | "próximo" | "bloqueado";

export type WeekPlanItem = {
  day: string;
  label: string;
  stepTitle: string;
  state: WeekPlanState;
};

const WEEK_DAYS = ["SEG", "TER", "QUA", "QUI", "SEX"];

/**
 * Achata o checklist de todas as etapas, na ordem da rota, reaproveitando o `NodeState` que já
 * existe por etapa (nunca inventa uma dependência nova entre itens de checklist). Mostra uma
 * janela de até 5 itens ao redor do primeiro item pendente ("hoje").
 */
type FlatCheckItem = { label: string; stepTitle: string; state: WeekPlanState; done: boolean };

export function getWeekPlan(views: StepView[]): WeekPlanItem[] {
  const flat: FlatCheckItem[] = views.flatMap((step) =>
    step.checklist.map((c): FlatCheckItem => {
      const done = step.checkedIds.includes(c.id);
      const state: WeekPlanState = done
        ? "concluído"
        : step.state === "bloqueado"
          ? "bloqueado"
          : "próximo";
      return { label: c.label, stepTitle: step.title, state, done };
    }),
  );

  const todayIndex = flat.findIndex((item) => !item.done && item.state !== "bloqueado");
  if (todayIndex >= 0) flat[todayIndex]!.state = "hoje";

  const start = Math.max(0, todayIndex === -1 ? flat.length - 5 : todayIndex - 2);
  return flat
    .slice(start, start + 5)
    .map((item, i) => ({ day: WEEK_DAYS[i] ?? `Dia ${i + 1}`, ...item }));
}

/* ---------------- insights ---------------- */

/** Só entra aqui o que dá para provar com os dados reais — sem "esta semana" (não guardamos data por conclusão). */
export function getInsights(
  views: StepView[],
  stats: RouteProgressValue["stats"],
  hoursPerWeek: number,
): string[] {
  const insights: string[] = [`Você já percorreu ${stats.percent}% da sua rota.`];

  const current = stats.current;
  if (current && current.state === "atual") {
    const remainingHours = (current.hours * (100 - current.checkPct)) / 100;
    const weeks = Math.max(1, Math.round(remainingHours / Math.max(4, hoursPerWeek)));
    insights.push(
      `Faltam aproximadamente ${weeks} semana${weeks === 1 ? "" : "s"} para o marco "${current.milestone}".`,
    );

    const currentPos = views.findIndex((s) => s.id === current.id);
    const nextProjectIndex = views.findIndex((s, i) => i > currentPos && s.projects.length > 0);
    if (nextProjectIndex >= 0) {
      const distance = nextProjectIndex - currentPos;
      insights.push(
        `Seu próximo projeto está a ${distance} etapa${distance === 1 ? "" : "s"} de distância.`,
      );
    }
  }

  if (stats.skills.length > 0) {
    insights.push(
      `Você já domina ${stats.skills.length} habilidade${stats.skills.length === 1 ? "" : "s"} da sua rota.`,
    );
  }

  return insights;
}
