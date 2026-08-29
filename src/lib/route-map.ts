import { useCallback, useEffect, useMemo, useState } from "react";
import { steps as baseSteps, user, type Difficulty, type Step } from "@/lib/mock";

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

export const routeSteps: RouteStep[] = baseSteps.map((s) => ({
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

/* ---------------- progresso persistente ---------------- */

const KEY = "pathly.route.v1";

export type RouteProgress = {
  /** ids de etapas concluídas */
  done: string[];
  /** "stepId:checkId" marcados */
  checks: string[];
};

const initialProgress: RouteProgress = {
  done: routeSteps.filter((s) => s.status === "concluído").map((s) => s.id),
  checks: routeSteps.flatMap((s) =>
    s.checklist.filter((c) => c.done).map((c) => `${s.id}:${c.id}`),
  ),
};

function read(): RouteProgress {
  if (typeof window === "undefined") return initialProgress;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return initialProgress;
    const parsed = JSON.parse(raw) as Partial<RouteProgress>;
    return {
      done: parsed.done ?? initialProgress.done,
      checks: parsed.checks ?? initialProgress.checks,
    };
  } catch {
    return initialProgress;
  }
}

export type StepView = RouteStep & {
  state: NodeState;
  checksDone: number;
  checksTotal: number;
  checkPct: number;
  checkedIds: string[];
};

export function useRouteProgress() {
  const [progress, setProgress] = useState<RouteProgress>(initialProgress);
  const [hydrated, setHydrated] = useState(false);
  const [celebrating, setCelebrating] = useState<{ id: string; xp: number } | null>(null);

  useEffect(() => {
    setProgress(read());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(progress));
    } catch {
      /* ignora quota */
    }
  }, [progress, hydrated]);

  const currentIndex = useMemo(() => {
    const i = routeSteps.findIndex((s) => !progress.done.includes(s.id));
    return i === -1 ? routeSteps.length - 1 : i;
  }, [progress.done]);

  const views: StepView[] = useMemo(
    () =>
      routeSteps.map((s, i) => {
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
    [progress, currentIndex],
  );

  const toggleCheck = useCallback((stepId: string, checkId: string) => {
    const key = `${stepId}:${checkId}`;
    setProgress((p) => ({
      ...p,
      checks: p.checks.includes(key) ? p.checks.filter((k) => k !== key) : [...p.checks, key],
    }));
  }, []);

  const completeStep = useCallback((stepId: string) => {
    const step = routeSteps.find((s) => s.id === stepId);
    if (!step) return;
    setProgress((p) =>
      p.done.includes(stepId)
        ? p
        : {
            done: [...p.done, stepId],
            checks: Array.from(
              new Set([...p.checks, ...step.checklist.map((c) => `${stepId}:${c.id}`)]),
            ),
          },
    );
    setCelebrating({ id: stepId, xp: step.xp });
    window.setTimeout(() => setCelebrating(null), 2200);
  }, []);

  const reopenStep = useCallback((stepId: string) => {
    setProgress((p) => ({ ...p, done: p.done.filter((id) => id !== stepId) }));
  }, []);

  const reset = useCallback(() => setProgress(initialProgress), []);

  const stats = useMemo(() => {
    const done = views.filter((s) => s.state === "concluído");
    const partialHours = views
      .filter((s) => s.state !== "concluído")
      .reduce((acc, s) => acc + (s.hours * s.checkPct) / 100, 0);
    const hours = Math.round(done.reduce((a, s) => a + s.hours, 0) + partialHours);
    const skills = Array.from(new Set(done.flatMap((s) => s.skills)));
    const projects = done.flatMap((s) => s.projects);
    const totalXp = done.reduce((a, s) => a + s.xp, 0);
    const percent = Math.round((done.length / routeSteps.length) * 100);
    const current = views[currentIndex];
    const remainingWeeks = views
      .filter((s) => s.state !== "concluído")
      .reduce((a, s) => a + Math.max(1, Math.round(s.hours / Math.max(4, user.hoursPerWeek))), 0);
    return {
      percent,
      doneCount: done.length,
      total: routeSteps.length,
      hours,
      skills,
      projects,
      totalXp,
      current,
      incomeNow: done.length ? done[done.length - 1].incomeAfter : user.currentIncome,
      monthsLeft: Math.max(1, Math.round(remainingWeeks / 4.3)),
    };
  }, [views, currentIndex]);

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
  };
}
