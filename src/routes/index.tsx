import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Compass,
  FolderKanban,
  LineChart,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import {
  AnimatedNumber,
  Btn,
  Chip,
  Logo,
  Panel,
  ProgressBar,
  Reveal,
  SectionLabel,
} from "@/components/pathly/ui";
import { steps } from "@/lib/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pathly — Aprenda o que realmente importa para ganhar mais" },
      {
        name: "description",
        content:
          "Conte onde você está e onde quer chegar. A Pathly cria sua rota personalizada de habilidades, projetos e oportunidades.",
      },
      { property: "og:title", content: "Pathly — sua rota até a renda que você quer" },
      {
        property: "og:description",
        content:
          "Pare de aprender coisas aleatórias. Descubra exatamente o que aprender para chegar na renda que você quer.",
      },
    ],
  }),
  component: Landing,
});

const transformation = [
  { label: "R$ 2.600", note: "hoje", tone: "muted" as const },
  { label: "Habilidades", note: "o que aprender, na ordem certa" },
  { label: "Projetos", note: "prova real de capacidade" },
  { label: "Experiência", note: "freelas e entregas" },
  { label: "Oportunidades", note: "vagas compatíveis" },
  { label: "R$ 8.000", note: "objetivo", tone: "primary" as const },
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
          <a href="#rota" className="transition-colors hover:text-foreground">
            Exemplo de rota
          </a>
          <a href="#beneficios" className="transition-colors hover:text-foreground">
            Benefícios
          </a>
          <a href="#quem" className="transition-colors hover:text-foreground">
            Para quem é
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:block">
            <Btn variant="ghost" size="sm">
              Entrar
            </Btn>
          </Link>
          <Link to="/cadastro">
            <Btn size="sm">Criar minha rota</Btn>
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="halo relative overflow-hidden px-5 pt-16 pb-10 sm:px-8 sm:pt-24">
      <div
        aria-hidden
        className="animate-[drift_18s_ease-in-out_infinite_alternate] pointer-events-none absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]"
      />
      <div className="mx-auto w-full max-w-4xl text-center">
        <Reveal>
          <Chip tone="primary" className="mb-6">
            <Sparkles className="size-3.5" /> Rota gerada para o seu ponto de partida
          </Chip>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="font-display text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Pare de aprender <span className="text-muted-foreground">coisas aleatórias.</span>
            <br />
            Descubra exatamente o que aprender para{" "}
            <span className="text-gradient">chegar na renda que você quer.</span>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Conte onde você está e onde quer chegar. A Pathly cria sua rota personalizada de
            habilidades, projetos e oportunidades.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link to="/onboarding" className="w-full sm:w-auto">
              <Btn size="lg" className="w-full sm:w-auto">
                Criar minha rota <ArrowRight className="size-4" />
              </Btn>
            </Link>
            <a href="#rota" className="w-full sm:w-auto">
              <Btn variant="outline" size="lg" className="w-full sm:w-auto">
                Ver exemplo de rota
              </Btn>
            </a>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            10 perguntas · 2 minutos · sem cartão de crédito
          </p>
        </Reveal>
      </div>

      {/* Transformation */}
      <Reveal delay={320} className="mx-auto mt-16 w-full max-w-3xl">
        <div className="panel p-5 sm:p-8">
          <div className="flex flex-col items-stretch gap-2">
            {transformation.map((item, i) => (
              <div key={item.label} className="flex flex-col items-center gap-2">
                <div
                  className={[
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition-colors sm:px-6",
                    item.tone === "primary"
                      ? "bg-primary/12"
                      : item.tone === "muted"
                        ? "bg-surface-2"
                        : "bg-surface-2/50 hover:bg-surface-2",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "font-display text-lg font-semibold sm:text-2xl",
                      item.tone === "primary" ? "text-primary" : "",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                  <span className="ml-4 text-right text-xs text-muted-foreground sm:text-sm">
                    {item.note}
                  </span>
                </div>
                {i < transformation.length - 1 && (
                  <div className="h-4 w-px bg-gradient-to-b from-primary/60 to-accent/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

const howItWorks = [
  {
    icon: Compass,
    title: "Você conta o cenário",
    body: "Renda atual, meta, profissão, habilidades, tempo livre e prazo. Nada de formulário infinito.",
  },
  {
    icon: Sparkles,
    title: "A Pathly monta a rota",
    body: "Uma sequência de etapas ligadas ao seu objetivo financeiro, com prazo, dificuldade e impacto.",
  },
  {
    icon: LineChart,
    title: "Você avança e mede",
    body: "Checklists, XP, projetos e progresso de renda projetada em cada etapa concluída.",
  },
];

const benefits = [
  {
    icon: Target,
    title: "Foco no que paga",
    body: "Cada habilidade da rota existe porque aumenta sua chance de renda — não porque está na moda.",
  },
  {
    icon: FolderKanban,
    title: "Projetos que provam",
    body: "Você termina com portfólio, não com certificados guardados na gaveta.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Oportunidades reais",
    body: "Vagas e freelas com percentual de compatibilidade e o que falta para você aplicar.",
  },
  {
    icon: Zap,
    title: "Progresso viciante",
    body: "Sequências, XP e níveis com estética adulta e minimalista. Nada infantil.",
  },
];

function Landing() {
  const sample = steps.slice(0, 5);

  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />

      {/* Como funciona */}
      <section id="como-funciona" className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <SectionLabel>Como funciona</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
              Três passos entre onde você está e onde quer chegar
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {howItWorks.map((item, i) => (
              <Reveal key={item.title} delay={i * 90}>
                <Panel hover className="h-full">
                  <span className="grid size-11 place-items-center rounded-2xl bg-primary/12 text-primary">
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </Panel>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Exemplo de rota */}
      <section id="rota" className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <Reveal>
              <SectionLabel>Exemplo de rota</SectionLabel>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                De R$ 2.600 a R$ 8.000 em 10 meses
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Este é um exemplo real de rota gerada para alguém em trabalho administrativo com 12
                horas livres por semana. A sua será diferente — ela nasce do seu cenário.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-3">
                {[
                  { k: "Etapas", v: 9 },
                  { k: "Semanas", v: 41 },
                  { k: "Projetos", v: 5 },
                  { k: "XP total", v: 4840 },
                ].map((m) => (
                  <div key={m.k} className="rounded-2xl bg-surface p-4">
                    <div className="font-display text-2xl font-semibold">
                      <AnimatedNumber value={m.v} />
                    </div>
                    <div className="text-xs text-muted-foreground">{m.k}</div>
                  </div>
                ))}
              </div>
            </Reveal>

            <div className="space-y-3">
              {sample.map((step, i) => (
                <Reveal key={step.id} delay={i * 70}>
                  <Panel tilt className="p-4 sm:p-5">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 font-display text-sm font-semibold text-primary">
                        {step.order}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{step.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {step.eta} · {step.difficulty} · +{step.xp} XP
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-sm text-primary">
                        R$ {step.incomeAfter.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </Panel>
                </Reveal>
              ))}
              <Reveal delay={400}>
                <p className="px-2 pt-2 text-sm text-muted-foreground">
                  + 4 etapas até a especialização final
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section id="beneficios" className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <SectionLabel>Benefícios</SectionLabel>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
              Aprender sem direção é caro. A Pathly resolve a direção.
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {benefits.map((b, i) => (
              <Reveal key={b.title} delay={i * 80}>
                <Panel hover className="flex h-full gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">
                    <b.icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{b.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                  </div>
                </Panel>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Progresso + IA */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-2">
          <Reveal>
            <Panel className="h-full">
              <SectionLabel>Progresso</SectionLabel>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                Você vê a renda projetada subir
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Cada etapa concluída atualiza a projeção do que seu perfil vale no mercado.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  { k: "Habilidades da rota", v: 38 },
                  { k: "Projetos no portfólio", v: 45 },
                  { k: "Prontidão para vagas", v: 62 },
                ].map((row, i) => (
                  <div key={row.k}>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-muted-foreground">{row.k}</span>
                      <span className="font-medium">{row.v}%</span>
                    </div>
                    <ProgressBar value={row.v} delay={300 + i * 160} />
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={120}>
            <Panel className="h-full">
              <SectionLabel>IA personalizada</SectionLabel>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                A rota se ajusta ao seu ritmo
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Mudou o tempo disponível, o objetivo ou o interesse? A rota é recalculada mantendo o
                que você já conquistou.
              </p>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  "Etapas reordenadas conforme seu progresso real",
                  "Sugestões de projeto ligadas às vagas que você quer",
                  "Alertas quando uma habilidade destrava uma oportunidade",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                      <Check className="size-3" />
                    </span>
                    <span className="text-muted-foreground">{t}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>
        </div>
      </section>

      {/* Quem pode usar */}
      <section id="quem" className="px-5 py-20 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <Reveal>
            <SectionLabel>Para quem é</SectionLabel>
            <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
              Se você quer ganhar mais, existe uma rota
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Quem está começando do zero",
              "Quem quer migrar de área",
              "Quem trava na hora de escolher o que estudar",
              "Quem quer sair do estágio para efetivação",
              "Quem quer complementar renda com freelas",
              "Quem quer chegar a nível pleno ou remoto",
            ].map((t, i) => (
              <Reveal key={t} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-2xl bg-surface px-4 py-4 text-sm transition-colors hover:bg-surface-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{t}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-5 pt-10 pb-24 sm:px-8">
        <Reveal>
          <div className="halo relative mx-auto w-full max-w-4xl overflow-hidden rounded-4xl bg-surface p-10 text-center sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-32 left-1/2 -z-10 size-[30rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[110px]"
            />
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold sm:text-5xl">
              Sua rota até <span className="text-gradient">R$ 8.000</span> começa com 10 perguntas
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
              Sem promessa mágica. Só clareza sobre a próxima coisa certa a fazer.
            </p>
            <Link to="/onboarding" className="mt-8 inline-block">
              <Btn size="lg">
                Criar minha rota <ArrowRight className="size-4" />
              </Btn>
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <Logo />
          <span>Pathly · Aprenda o que realmente importa para ganhar mais.</span>
          <div className="flex items-center gap-4">
            <Link to="/termos" className="transition-colors hover:text-foreground">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="transition-colors hover:text-foreground">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
