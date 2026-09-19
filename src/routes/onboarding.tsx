import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Cloud, Sparkles, TrendingUp } from "lucide-react";
import { Btn, Logo, ProgressBar } from "@/components/pathly/ui";
import { useSession } from "@/lib/auth";
import { loadCloudProfile, saveCloudProfile } from "@/lib/cloud-sync";
import { gerarRotaIA, limparRotaIA } from "@/lib/ia/cliente";
import {
  CardSelect,
  FieldGroup,
  HoursSlider,
  LongTextField,
  MoneyField,
  SearchField,
  SkillLevelList,
  SkillPicker,
  ToggleRow,
} from "@/components/pathly/onboarding-fields";
import {
  areas,
  brl,
  budgets,
  emptyProfile,
  experiences,
  goals,
  horizons,
  learningStyles,
  loadProfile,
  opportunityTypes,
  professionSuggestions,
  routePreview,
  saveProfile,
  situations,
  skillCatalog,
  studyPresets,
  workModels,
  type OnboardingProfile,
  type SkillLevel,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Monte sua rota — Pathly" },
      {
        name: "description",
        content:
          "Uma conversa rápida sobre onde você está e onde quer chegar. A Pathly monta a rota de habilidades e projetos de portfólio.",
      },
      { property: "og:title", content: "Monte sua rota na Pathly" },
      {
        property: "og:description",
        content: "Renda atual, meta, tempo livre e habilidades. O resto a Pathly organiza.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type ScreenId =
  | "goal"
  | "income_current"
  | "income_target"
  | "situation"
  | "profession"
  | "areas"
  | "goal_text"
  | "experience"
  | "skills"
  | "skill_levels"
  | "study_time"
  | "learning"
  | "budget"
  | "work_model"
  | "opportunities";

type Screen = {
  id: ScreenId;
  chapter: string;
  title: string;
  hint: string;
  valid: (p: OnboardingProfile) => boolean;
  skip?: (p: OnboardingProfile) => boolean;
};

const screens: Screen[] = [
  {
    id: "goal",
    chapter: "Onde você quer chegar",
    title: "Pra começar: qual é o seu objetivo principal?",
    hint: "Escolha o que mais importa agora. Você pode mudar depois.",
    valid: (p) => !!p.goal,
  },
  {
    id: "income_current",
    chapter: "Onde você está hoje",
    title: "Quanto você ganha atualmente?",
    hint: "É daqui que partem os marcos da sua rota. Sem julgamento — ninguém além de você vê.",
    valid: (p) => p.income.noIncome || (p.income.current ?? 0) > 0,
  },
  {
    id: "income_target",
    chapter: "Onde você quer chegar",
    title: "E quanto você gostaria de ganhar?",
    hint: "A distância entre os dois números vira o marco de cada etapa da rota.",
    valid: (p) => (p.income.target ?? 0) > 0 && !!p.income.horizon,
  },
  {
    id: "situation",
    chapter: "Onde você está hoje",
    title: "Qual é a sua situação atual?",
    hint: "Fica registrado no seu perfil. Ainda não muda o conteúdo da rota.",
    valid: (p) => !!p.situation,
  },
  {
    id: "profession",
    chapter: "Onde você está hoje",
    title: "Qual é a sua profissão atual?",
    hint: "Digite e escolha uma sugestão, ou escreva do seu jeito.",
    valid: (p) => p.currentProfession.trim().length > 1,
  },
  {
    id: "areas",
    chapter: "Onde você quer chegar",
    title: "Em qual área você gostaria de trabalhar?",
    hint: "Escolha uma. É ela que define o conteúdo da sua rota.",
    valid: (p) => p.desiredAreas.length > 0,
  },
  {
    id: "goal_text",
    chapter: "Onde você quer chegar",
    title: "Conta com as suas palavras: o que você quer fazer?",
    hint: "Opcional, mas é o que mais personaliza a rota. Pode pular se preferir.",
    valid: () => true,
  },
  {
    id: "experience",
    chapter: "Onde você está hoje",
    title: "Quanta experiência profissional você tem?",
    hint: "Quem já tem experiência começa adiante, sem repetir fundamento.",
    valid: (p) => !!p.experience,
  },
  {
    id: "skills",
    chapter: "O que você já sabe",
    title: "Quais habilidades você já possui?",
    hint: "Marque tudo que se aplica e adicione as que faltarem.",
    valid: () => true,
  },
  {
    id: "skill_levels",
    chapter: "O que você já sabe",
    title: "Qual seu nível em cada uma?",
    hint: "Seja honesto — a rota começa exatamente onde você está.",
    valid: () => true,
    skip: (p) => p.skills.length === 0,
  },
  {
    id: "study_time",
    chapter: "Como você aprende",
    title: "Quanto tempo você tem para estudar?",
    hint: "É o que define o ritmo e o prazo estimado de cada etapa.",
    valid: (p) => p.study.hoursPerWeek > 0,
  },
  {
    id: "learning",
    chapter: "Como você aprende",
    title: "Como você prefere aprender?",
    hint: "Pode marcar mais de um. Fica no seu perfil; ainda não muda o conteúdo da rota.",
    valid: (p) => p.learningStyles.length > 0,
  },
  {
    id: "budget",
    chapter: "Como você aprende",
    title: "Está disposto a investir dinheiro em cursos?",
    hint: "As etapas da rota não dependem de curso pago. Isto fica registrado no seu perfil.",
    valid: (p) => !!p.budget,
  },
  {
    id: "work_model",
    chapter: "Onde você quer chegar",
    title: "Qual modelo de trabalho você prefere?",
    hint: "Fica registrado no seu perfil. Ainda não muda o conteúdo da rota.",
    valid: (p) => !!p.workModel,
  },
  {
    id: "opportunities",
    chapter: "Onde você quer chegar",
    title: "Que tipo de oportunidade você busca?",
    hint: "Última pergunta. Depois montamos sua rota.",
    valid: (p) => p.opportunities.length > 0,
  },
];

const analysisSteps = [
  "Lendo seu objetivo",
  "Mapeando suas habilidades",
  "Pesando sua experiência",
  "Encaixando no seu tempo disponível",
  "Ordenando as etapas por pré-requisito",
  "Escolhendo os projetos de portfólio",
];

type Phase = "questions" | "building" | "ready";

function Onboarding() {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<OnboardingProfile>(emptyProfile());
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [saved, setSaved] = useState(false);
  // A geração começa junto com a animação de "montando sua rota" e o BuildingScreen espera por
  // ela. Fica em estado, e não numa variável, para sobreviver aos re-renders da tela.
  const [trabalho, setTrabalho] = useState<Promise<unknown>>(() => Promise.resolve());
  const hydrated = useRef(false);

  // restore local answers first, then prefer the cloud copy when the user is authenticated
  useEffect(() => {
    if (sessionLoading) return;
    let active = true;

    async function hydrate() {
      const stored = loadProfile();
      const cloud = session?.user.id ? await loadCloudProfile(session.user.id) : null;
      if (!active) return;

      const restored =
        cloud && (!stored?.updatedAt || !cloud.updatedAt || cloud.updatedAt >= stored.updatedAt)
          ? cloud
          : stored;
      if (restored) {
        setProfile(restored);
        setIndex(Math.min(restored.lastScreenIndex, screens.length - 1));
      }
      hydrated.current = true;
    }

    void hydrate();
    return () => {
      active = false;
    };
  }, [session?.user.id, sessionLoading]);

  // autosave (debounced). Depois que o onboarding é concluído o `next()` já salvou tudo, e um
  // save extra aqui remontaria os timers da tela de "montando sua rota" via re-render.
  useEffect(() => {
    if (!hydrated.current || phase !== "questions") return;
    const t = setTimeout(() => {
      const next = saveProfile({ ...profile, lastScreenIndex: index });
      if (session?.user.id) void saveCloudProfile(session.user.id, next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
    }, 500);
    return () => clearTimeout(t);
  }, [profile, index, phase, session?.user.id]);

  /**
   * Sem esta guarda o onboarding era a porta dos fundos do app: `/onboarding` respondia a
   * qualquer pessoa, as respostas não iam para lugar nenhum (sem `session.user.id` o
   * `saveCloudProfile` nem é chamado) e no fim a pessoa era jogada em `/app/rota`, que bounce
   * para `/login`. Pior: quem voltava da janela do Google caía aqui e ficava preso, sem
   * caminho de volta para digitar e-mail e senha.
   */
  useEffect(() => {
    if (!sessionLoading && !session) navigate({ to: "/login" });
  }, [sessionLoading, session, navigate]);

  const visible = useMemo(() => screens.filter((s) => !s.skip?.(profile)), [profile]);
  const screen = visible[Math.min(index, visible.length - 1)]!;
  const position = visible.findIndex((s) => s.id === screen.id);
  const total = visible.length;
  const canAdvance = screen.valid(profile);

  function patch(next: Partial<OnboardingProfile>) {
    setProfile((prev) => ({ ...prev, ...next }));
  }

  function toggleList<T>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
  }

  function next() {
    if (position + 1 < total) {
      setIndex(position + 1);
      return;
    }
    const completed = { ...profile, completedAt: new Date().toISOString() };
    setProfile(completed);
    const next = saveProfile({ ...completed, lastScreenIndex: total - 1 });
    if (session?.user.id) void saveCloudProfile(session.user.id, next);

    // Rota antiga fora antes de pedir a nova: se a geração falhar, o certo é cair na rota por
    // regras do perfil novo, e não continuar mostrando a rota de um perfil que já mudou.
    limparRotaIA();
    setTrabalho(gerarRotaIA(completed));
    setPhase("building");
  }

  // Estável: BuildingScreen agenda os timers da animação num efeito que depende dessa referência.
  const goToReady = useCallback(() => setPhase("ready"), []);

  // Mesmo estado neutro de `/app`: no SSR e no primeiro paint a sessão ainda não foi lida, e
  // decidir antes disso mostraria as perguntas por um instante para quem vai ser redirecionado.
  if (sessionLoading || !session) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  if (phase === "building") {
    return <BuildingScreen onDone={goToReady} trabalho={trabalho} />;
  }

  if (phase === "ready") {
    return <ReadyScreen profile={profile} onGo={() => navigate({ to: "/app/rota" })} />;
  }

  const progress = ((position + (canAdvance ? 1 : 0.35)) / total) * 100;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between gap-3 px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 sm:px-8 sm:py-5">
        <Link to="/" className="tap min-w-0">
          <Logo />
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-opacity duration-500",
              saved ? "opacity-100" : "opacity-0",
            )}
          >
            <Cloud className="size-3.5" /> salvo
          </span>
          <span className="text-xs text-muted-foreground">
            {position + 1}/{total}
          </span>
        </div>
      </header>

      <div className="px-5 sm:px-8">
        <ProgressBar value={progress} delay={60} className="h-1" />
      </div>

      {/* pb-36 no celular abre espaço para o rodapé fixo sem cobrir a última opção da lista. */}
      <main className="flex flex-1 flex-col px-5 pt-8 pb-36 sm:px-8 sm:pt-12 sm:pb-12">
        <div
          key={screen.id}
          className="animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both] mx-auto w-full max-w-lg"
        >
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            {screen.chapter}
          </p>
          <h1 className="mt-3 font-display text-2xl leading-tight font-semibold text-balance sm:text-3xl">
            {screen.title}
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">{screen.hint}</p>

          <div className="mt-8">
            {screen.id === "goal" && (
              <CardSelect
                options={goals}
                value={profile.goal}
                onChange={(goal) => patch({ goal })}
              />
            )}

            {screen.id === "income_current" && (
              <div className="space-y-3">
                <MoneyField
                  value={profile.income.current}
                  disabled={profile.income.noIncome}
                  placeholder="2.600"
                  quick={[1518, 2500, 4000, 6000]}
                  onChange={(current) => patch({ income: { ...profile.income, current } })}
                />
                <ToggleRow
                  label="Não tenho renda atualmente"
                  active={profile.income.noIncome}
                  onClick={() =>
                    patch({
                      income: {
                        ...profile.income,
                        noIncome: !profile.income.noIncome,
                        current: profile.income.noIncome ? profile.income.current : null,
                      },
                    })
                  }
                />
              </div>
            )}

            {screen.id === "income_target" && (
              <div className="space-y-7">
                <FieldGroup label="Meta de renda">
                  <MoneyField
                    value={profile.income.target}
                    placeholder="8.000"
                    quick={[3000, 5000, 8000, 12000]}
                    onChange={(target) => patch({ income: { ...profile.income, target } })}
                  />
                </FieldGroup>
                <FieldGroup label="Em quanto tempo">
                  <CardSelect
                    options={horizons}
                    value={profile.income.horizon}
                    onChange={(horizon) => patch({ income: { ...profile.income, horizon } })}
                  />
                </FieldGroup>
              </div>
            )}

            {screen.id === "situation" && (
              <CardSelect
                options={situations}
                value={profile.situation}
                onChange={(situation) => patch({ situation })}
              />
            )}

            {screen.id === "profession" && (
              <SearchField
                value={profile.currentProfession}
                suggestions={professionSuggestions}
                placeholder="Buscar profissão"
                onChange={(currentProfession) => patch({ currentProfession })}
              />
            )}

            {screen.id === "areas" && (
              <CardSelect
                options={areas}
                value={profile.desiredAreas}
                onChange={(area) => patch({ desiredAreas: [area] })}
              />
            )}

            {screen.id === "goal_text" && (
              <LongTextField
                value={profile.goalText}
                onChange={(goalText) => patch({ goalText })}
                placeholder="Ex.: quero sair do atendimento e trabalhar com dados na empresa onde já estou"
                examples={[
                  "Quero migrar para programação e conseguir meu primeiro emprego júnior",
                  "Quero continuar na minha área, mas aprender dados para ganhar mais",
                  "Quero pegar freelas no fim de semana sem largar o emprego",
                ]}
              />
            )}

            {screen.id === "experience" && (
              <CardSelect
                columns={1}
                options={experiences}
                value={profile.experience}
                onChange={(experience) => patch({ experience })}
              />
            )}

            {screen.id === "skills" && (
              <SkillPicker
                catalog={skillCatalog}
                selected={profile.skills}
                onToggle={(name) => {
                  const exists = profile.skills.some(
                    (s) => s.name.toLowerCase() === name.toLowerCase(),
                  );
                  patch({
                    skills: exists
                      ? profile.skills.filter((s) => s.name.toLowerCase() !== name.toLowerCase())
                      : [...profile.skills, { name, level: "iniciante", custom: false }],
                  });
                }}
                onAdd={(name) =>
                  patch({ skills: [...profile.skills, { name, level: "iniciante", custom: true }] })
                }
              />
            )}

            {screen.id === "skill_levels" && (
              <SkillLevelList
                skills={profile.skills}
                onLevel={(name, level: SkillLevel) =>
                  patch({
                    skills: profile.skills.map((s) => (s.name === name ? { ...s, level } : s)),
                  })
                }
              />
            )}

            {screen.id === "study_time" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {studyPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        patch({
                          study: { hoursPerWeek: preset.hoursPerWeek, presetId: preset.id },
                        })
                      }
                      className={cn(
                        "tap rounded-full border px-4 py-2.5 text-sm transition-all",
                        profile.study.presetId === preset.id
                          ? "border-primary/50 bg-primary/12 text-primary"
                          : "border-border bg-surface/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <HoursSlider
                  value={profile.study.hoursPerWeek}
                  onChange={(hoursPerWeek) => patch({ study: { hoursPerWeek, presetId: null } })}
                />
              </div>
            )}

            {screen.id === "learning" && (
              <CardSelect
                multi
                options={learningStyles}
                value={profile.learningStyles}
                onChange={(style) =>
                  patch({ learningStyles: toggleList(profile.learningStyles, style) })
                }
              />
            )}

            {screen.id === "budget" && (
              <CardSelect
                columns={1}
                options={budgets}
                value={profile.budget}
                onChange={(budget) => patch({ budget })}
              />
            )}

            {screen.id === "work_model" && (
              <CardSelect
                options={workModels}
                value={profile.workModel}
                onChange={(workModel) => patch({ workModel })}
              />
            )}

            {screen.id === "opportunities" && (
              <CardSelect
                multi
                options={opportunityTypes}
                value={profile.opportunities}
                onChange={(opportunity) =>
                  patch({ opportunities: toggleList(profile.opportunities, opportunity) })
                }
              />
            )}
          </div>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:static sm:border-0 sm:bg-transparent sm:px-8 sm:pb-10">
        <div className="mx-auto flex w-full max-w-lg items-center gap-3">
          {position > 0 && (
            <Btn variant="outline" size="lg" onClick={() => setIndex(position - 1)}>
              <ArrowLeft className="size-4" />
              Voltar
            </Btn>
          )}
          <Btn size="lg" className="flex-1" disabled={!canAdvance} onClick={next}>
            {position + 1 === total ? "Gerar minha rota" : "Continuar"}
            <ArrowRight className="size-4" />
          </Btn>
        </div>
      </footer>
    </div>
  );
}

/* ---------- building ---------- */

/** Quanto a animação leva para completar os passos. É o piso da espera. */
const DURACAO_ANIMACAO_MS = 500 + analysisSteps.length * 620 + 700;

/**
 * Teto da espera. Acima disto a pessoa vai para a rota por regras e a geração segue em segundo
 * plano. 30s cobre o caminho bom com folga (~20s medidos) sem virar sala de espera.
 */
const TETO_ESPERA_MS = 30_000;

/** Quando avisar que está demorando — depois da animação, senão o aviso aparece por nada. */
const AVISO_MS = DURACAO_ANIMACAO_MS + 3_000;

function BuildingScreen({ onDone, trabalho }: { onDone: () => void; trabalho: Promise<unknown> }) {
  const [done, setDone] = useState(0);
  const [demorando, setDemorando] = useState(false);

  useEffect(() => {
    const timers = analysisSteps.map((_, i) => setTimeout(() => setDone(i + 1), 500 + i * 620));
    const aviso = setTimeout(() => setDemorando(true), AVISO_MS);

    /**
     * A tela espera a geração, mas só até um teto.
     *
     * Esperar sem teto seria prender a pessoa: medimos gerações de 20s no caminho bom e mais de
     * 60s quando o provedor gratuito está congestionado. Um minuto de animação é pior que
     * qualquer rota.
     *
     * Passado o teto, seguimos com a rota por regras — que é completa — e a geração **continua
     * em segundo plano**. Quando ela termina, a tela da rota troca sozinha (ver EVENTO_ROTA_IA).
     * Cortar a chamada aqui seria jogar fora uma requisição já consumida da cota.
     *
     * O piso é a animação: chegar antes dela deixaria a tela piscar e passar.
     */
    const animacao = new Promise<void>((r) => setTimeout(r, DURACAO_ANIMACAO_MS));
    const teto = new Promise<void>((r) => setTimeout(r, TETO_ESPERA_MS));

    let vivo = true;
    void animacao
      .then(() => Promise.race([trabalho, teto]))
      .then(() => {
        if (vivo) onDone();
      });

    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
      clearTimeout(aviso);
    };
  }, [onDone, trabalho]);

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span className="relative mx-auto grid size-14 place-items-center rounded-md bg-primary">
            <Sparkles className="relative size-7 text-primary-foreground" />
          </span>
          <h1 className="mt-7 font-display text-2xl font-semibold text-balance sm:text-3xl">
            Estamos montando sua rota…
          </h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            Montando a sequência de habilidades e os projetos a partir do que você respondeu.
          </p>
        </div>

        <div className="mt-9 space-y-2.5">
          {analysisSteps.map((label, i) => {
            const state = done > i ? "done" : done === i ? "active" : "idle";
            return (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-4 py-3.5 transition-colors duration-300",
                  state === "done"
                    ? "border-primary/40 bg-primary/8"
                    : state === "active"
                      ? "border-border bg-surface"
                      : "border-transparent bg-surface/30 opacity-45",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full transition-all",
                    state === "done" ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : state === "active" ? (
                    <span className="size-2 animate-pulse rounded-full bg-primary" />
                  ) : null}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    state === "idle" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-7">
          <ProgressBar value={(done / analysisSteps.length) * 100} delay={0} className="h-1" />
          {demorando && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Está levando um pouco mais que o normal. Se demorar, sua rota abre mesmo assim e a
              versão personalizada entra sozinha quando ficar pronta.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- ready ---------- */

function ReadyScreen({ profile, onGo }: { profile: OnboardingProfile; onGo: () => void }) {
  const milestones = routePreview(profile);

  return (
    <div className="grid min-h-screen place-items-center px-5 py-12">
      <div className="animate-[pop_0.5s_cubic-bezier(0.34,1.56,0.64,1)_both] w-full max-w-md">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-md bg-primary">
            <TrendingUp className="size-6 text-primary-foreground" />
          </span>
          <h1 className="mt-6 font-display text-3xl font-semibold">Sua rota está pronta.</h1>
          <p className="mt-2.5 text-sm text-muted-foreground">
            {milestones.length} marcos entre onde você está hoje e o seu objetivo.
          </p>
        </div>

        <div className="mt-9 space-y-1">
          {milestones.map((m, i) => (
            <div key={m.id}>
              <div
                style={{ animationDelay: `${i * 130}ms` }}
                className={cn(
                  "animate-[fade-up_0.4s_cubic-bezier(0.16,1,0.3,1)_both] flex items-center justify-between gap-3 rounded-md border px-4 py-4",
                  i === milestones.length - 1
                    ? "border-primary/45 bg-primary/10"
                    : "border-border bg-surface/50",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.caption}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-display text-lg font-semibold",
                    i === milestones.length - 1 && "text-primary",
                  )}
                >
                  {brl(m.income)}
                </span>
              </div>
              {i < milestones.length - 1 && <div className="ml-7 h-4 w-px bg-border" />}
            </div>
          ))}
        </div>

        <Btn size="lg" className="mt-8 w-full" onClick={onGo}>
          Ver minha rota
          <ArrowRight className="size-4" />
        </Btn>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Suas respostas ficaram salvas no seu perfil.
        </p>
      </div>
    </div>
  );
}
