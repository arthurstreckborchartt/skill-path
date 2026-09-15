/**
 * Onboarding data model.
 *
 * This is the contract between the onboarding flow and the (future)
 * recommendation engine. Everything the engine needs to build a route lives in
 * `OnboardingProfile` — normalized ids, never UI labels — so the engine can be
 * plugged in later without touching the UI.
 */

export const ONBOARDING_VERSION = 1;
export const ONBOARDING_STORAGE_KEY = "pathly.onboarding.v1";

export type Option<T extends string = string> = {
  id: T;
  label: string;
  hint?: string;
};

/* ---------- catalogs (stable ids for the engine) ---------- */

export type GoalId =
  | "earn_more"
  | "first_job"
  | "career_switch"
  | "internship"
  | "remote_work"
  | "freelance"
  | "build_career"
  | "entrepreneurship";

export const goals: Option<GoalId>[] = [
  { id: "earn_more", label: "Ganhar mais", hint: "Aumentar a renda no que já faço" },
  { id: "first_job", label: "Conseguir meu primeiro emprego", hint: "Entrar no mercado" },
  { id: "career_switch", label: "Trocar de área", hint: "Migrar para outro campo" },
  { id: "internship", label: "Conseguir estágio", hint: "Primeira experiência formal" },
  { id: "remote_work", label: "Trabalhar remotamente", hint: "Liberdade de lugar" },
  { id: "freelance", label: "Começar como freelancer", hint: "Clientes e projetos próprios" },
  { id: "build_career", label: "Construir uma carreira", hint: "Crescimento de longo prazo" },
  { id: "entrepreneurship", label: "Empreender", hint: "Criar meu próprio negócio" },
];

export type HorizonId = "3m" | "6m" | "12m" | "24m" | "open";

export const horizons: (Option<HorizonId> & { months: number | null })[] = [
  { id: "3m", label: "3 meses", months: 3, hint: "Ritmo intenso" },
  { id: "6m", label: "6 meses", months: 6, hint: "Equilibrado" },
  { id: "12m", label: "1 ano", months: 12, hint: "Consistente" },
  { id: "24m", label: "2 anos", months: 24, hint: "Sem pressa" },
  { id: "open", label: "Sem prazo específico", months: null, hint: "No meu tempo" },
];

export type SituationId = "student" | "employed" | "unemployed" | "freelancer" | "founder";

export const situations: Option<SituationId>[] = [
  { id: "student", label: "Estudante" },
  { id: "employed", label: "Empregado" },
  { id: "unemployed", label: "Desempregado" },
  { id: "freelancer", label: "Freelancer" },
  { id: "founder", label: "Empreendedor" },
];

export type AreaId =
  | "tech"
  | "design"
  | "marketing"
  | "sales"
  | "finance"
  | "engineering"
  | "admin"
  | "audiovisual"
  | "data"
  | "ai"
  | "other";

export const areas: Option<AreaId>[] = [
  { id: "tech", label: "Tecnologia" },
  { id: "design", label: "Design" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Vendas" },
  { id: "finance", label: "Finanças" },
  { id: "engineering", label: "Engenharia" },
  { id: "admin", label: "Administração" },
  { id: "audiovisual", label: "Audiovisual" },
  { id: "data", label: "Dados" },
  { id: "ai", label: "IA" },
  { id: "other", label: "Outras" },
];

export type ExperienceId = "none" | "lt1" | "1to3" | "3to5" | "gt5";

export const experiences: (Option<ExperienceId> & { years: number })[] = [
  { id: "none", label: "Nenhuma experiência", years: 0, hint: "Estou começando agora" },
  { id: "lt1", label: "Menos de 1 ano", years: 0.5 },
  { id: "1to3", label: "1 a 3 anos", years: 2 },
  { id: "3to5", label: "3 a 5 anos", years: 4 },
  { id: "gt5", label: "Mais de 5 anos", years: 6 },
];

export type SkillLevel = "iniciante" | "intermediário" | "avançado";

export const skillLevels: SkillLevel[] = ["iniciante", "intermediário", "avançado"];

export type SkillEntry = {
  name: string;
  level: SkillLevel;
  custom: boolean;
};

/** Suggested skills grouped by area — used for the tag picker. */
export const skillCatalog: { group: string; items: string[] }[] = [
  {
    group: "Tecnologia",
    items: ["Python", "JavaScript", "TypeScript", "React", "Node.js", "SQL", "Git", "HTML/CSS"],
  },
  {
    group: "Dados & IA",
    items: ["Excel", "Power BI", "Pandas", "Machine Learning", "Prompt de IA"],
  },
  { group: "Design", items: ["Figma", "Photoshop", "Illustrator", "UI Design", "Motion"] },
  {
    group: "Negócios",
    items: ["Vendas", "Marketing", "Tráfego pago", "Copywriting", "Gestão de projetos"],
  },
  { group: "Outras", items: ["Inglês", "Atendimento", "Escrita", "Edição de vídeo"] },
];

export const professionSuggestions = [
  "Auxiliar administrativo",
  "Analista administrativo",
  "Atendente",
  "Vendedor",
  "Estagiário",
  "Estudante",
  "Professor",
  "Designer gráfico",
  "Social media",
  "Analista de marketing",
  "Analista financeiro",
  "Suporte técnico",
  "Desenvolvedor front-end",
  "Desenvolvedor back-end",
  "Analista de dados",
  "Motorista de aplicativo",
  "Autônomo",
  "Não estou trabalhando",
];

export type LearningStyleId = "video" | "reading" | "projects" | "exercises" | "mixed";

export const learningStyles: Option<LearningStyleId>[] = [
  { id: "video", label: "Vídeos" },
  { id: "reading", label: "Leitura" },
  { id: "projects", label: "Projetos" },
  { id: "exercises", label: "Exercícios" },
  { id: "mixed", label: "Misturado" },
];

export type BudgetId = "free" | "50" | "100" | "300" | "any";

export const budgets: (Option<BudgetId> & { monthly: number | null })[] = [
  { id: "free", label: "Somente gratuitos", monthly: 0 },
  { id: "50", label: "Até R$ 50/mês", monthly: 50 },
  { id: "100", label: "Até R$ 100/mês", monthly: 100 },
  { id: "300", label: "Até R$ 300/mês", monthly: 300 },
  { id: "any", label: "Sem preferência", monthly: null },
];

export type WorkModelId = "onsite" | "hybrid" | "remote" | "any";

export const workModels: Option<WorkModelId>[] = [
  { id: "onsite", label: "Presencial" },
  { id: "hybrid", label: "Híbrido" },
  { id: "remote", label: "Remoto" },
  { id: "any", label: "Indiferente" },
];

export type OpportunityId = "job" | "internship" | "freelance" | "own_project" | "unsure";

export const opportunityTypes: Option<OpportunityId>[] = [
  { id: "job", label: "Emprego" },
  { id: "internship", label: "Estágio" },
  { id: "freelance", label: "Freelancer" },
  { id: "own_project", label: "Projeto próprio" },
  { id: "unsure", label: "Ainda não sei" },
];

export const studyPresets: { id: string; label: string; hoursPerWeek: number }[] = [
  { id: "30min_day", label: "30 min/dia", hoursPerWeek: 3.5 },
  { id: "1h_day", label: "1h/dia", hoursPerWeek: 7 },
  { id: "2h_day", label: "2h/dia", hoursPerWeek: 14 },
  { id: "5h_week", label: "5h/semana", hoursPerWeek: 5 },
  { id: "10h_week", label: "10h/semana", hoursPerWeek: 10 },
];

/* ---------- profile ---------- */

/**
 * Campos coletados que ainda NÃO influenciam a rota gerada (`generateRoute`):
 * `learningStyles`, `budget`, `workModel`, `opportunities` e `study.presetId`.
 * Ficam salvos no perfil, e as telas que perguntam avisam que não mudam o conteúdo — nenhuma
 * delas promete um efeito que não existe. Antes de usar qualquer um deles no gerador, ajuste
 * também o texto da tela correspondente em routes/onboarding.tsx.
 *
 * `goal`, `income.horizon`, `situation`, `currentProfession` e `skills` também não entram no
 * gerador, mas aparecem no app (Perfil e Rota), então a resposta tem destino visível.
 */
export type OnboardingProfile = {
  version: number;
  goal: GoalId | null;
  income: {
    current: number | null;
    noIncome: boolean;
    target: number | null;
    horizon: HorizonId | null;
  };
  situation: SituationId | null;
  currentProfession: string;
  /**
   * O que a pessoa quer fazer, com as próprias palavras. Opcional de propósito — quem não quiser
   * escrever segue sem. É a entrada mais rica que temos para a geração por IA, porque as
   * perguntas fechadas não capturam intenção ("quero sair do suporte e mexer com dados da
   * empresa onde já trabalho" diz muito mais que "área: dados").
   */
  goalText: string;
  desiredAreas: AreaId[];
  experience: ExperienceId | null;
  skills: SkillEntry[];
  study: { hoursPerWeek: number; presetId: string | null };
  learningStyles: LearningStyleId[];
  budget: BudgetId | null;
  workModel: WorkModelId | null;
  opportunities: OpportunityId[];
  /** progress metadata */
  lastScreenIndex: number;
  updatedAt: string | null;
  completedAt: string | null;
};

export function emptyProfile(): OnboardingProfile {
  return {
    version: ONBOARDING_VERSION,
    goal: null,
    income: { current: null, noIncome: false, target: null, horizon: null },
    situation: null,
    currentProfession: "",
    goalText: "",
    desiredAreas: [],
    experience: null,
    skills: [],
    study: { hoursPerWeek: 7, presetId: "1h_day" },
    learningStyles: [],
    budget: null,
    workModel: null,
    opportunities: [],
    lastScreenIndex: 0,
    updatedAt: null,
    completedAt: null,
  };
}

/* ---------- persistence (localStorage today, Cloud later) ---------- */

export function loadProfile(): OnboardingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingProfile>;
    if (parsed?.version !== ONBOARDING_VERSION) return null;
    return { ...emptyProfile(), ...parsed } as OnboardingProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: OnboardingProfile): OnboardingProfile {
  const next = { ...profile, updatedAt: new Date().toISOString() };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable — the flow keeps working in memory */
    }
  }
  return next;
}

export function clearProfile() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
  }
}

/* ---------- derived values (placeholder for the engine) ---------- */

export type RouteMilestone = {
  id: string;
  label: string;
  caption: string;
  income: number;
};

/**
 * Deterministic preview of the income curve. No AI yet: it interpolates between
 * the declared starting point and the goal so the final screen can show a real
 * shape. The recommendation engine will replace this with generated steps.
 */
export function routePreview(profile: OnboardingProfile): RouteMilestone[] {
  const start = profile.income.noIncome ? 0 : (profile.income.current ?? 0);
  const goal = Math.max(profile.income.target ?? 0, start);
  const horizon = horizons.find((h) => h.id === profile.income.horizon);
  const months = horizon?.months ?? 12;

  const first = Math.round((start + (goal - start) * 0.35) / 50) * 50;
  const second = Math.round((start + (goal - start) * 0.7) / 50) * 50;

  return [
    { id: "today", label: "Hoje", caption: "Seu ponto de partida", income: start },
    {
      id: "milestone_1",
      label: "Primeiro marco",
      caption: `Fundamentos + primeiro projeto · ~${Math.max(1, Math.round(months * 0.3))} meses`,
      income: first,
    },
    {
      id: "milestone_2",
      label: "Próximo nível",
      caption: `Portfólio e primeiras entregas pagas · ~${Math.max(2, Math.round(months * 0.65))} meses`,
      income: second,
    },
    {
      id: "goal",
      label: "Objetivo",
      caption: horizon ? `Meta em ${horizon.label.toLowerCase()}` : "Meta sem prazo fixo",
      income: goal,
    },
  ];
}

export function brl(value: number) {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}
