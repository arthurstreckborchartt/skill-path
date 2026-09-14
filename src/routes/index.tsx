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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pathly — Aprenda o que realmente importa para ganhar mais" },
      {
        name: "description",
        content:
          "Conte onde você está e onde quer chegar. A Pathly monta sua sequência de habilidades e projetos de portfólio, com progresso etapa a etapa.",
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
  { label: "Habilidades", note: "o que aprender, na ordem certa" },
  { label: "Projetos", note: "portfólio que prova o que você sabe" },
  { label: "Freelas", note: "primeiras entregas pagas" },
  { label: "Candidaturas", note: "currículo e portfólio prontos" },
];

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
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

/**
 * Primeira dobra. Usa animação de CSS (`fade-up`) em vez do <Reveal>, que só revela o conteúdo
 * depois que o JS hidrata e o IntersectionObserver dispara — no HTML do servidor o texto sai com
 * opacidade zero, e numa conexão ruim a dobra mais importante do site aparece em branco.
 */
const fadeUp = "animate-[fade-up_0.6s_cubic-bezier(0.16,1,0.3,1)_both]";

function Hero() {
  return (
    <section className="halo relative overflow-hidden px-5 pt-8 pb-10 sm:px-8 sm:pt-10">
      <div
        aria-hidden
        className="animate-[drift_18s_ease-in-out_infinite_alternate] pointer-events-none absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]"
      />
      <div className="mx-auto w-full max-w-4xl text-center">
        <div className={fadeUp}>
          <Chip tone="primary" className="mb-4">
            <Sparkles className="size-3.5" /> Rota gerada para o seu ponto de partida
          </Chip>
        </div>
        <h1
          className={cn(fadeUp, "font-display text-4xl leading-[1.05] font-semibold sm:text-5xl")}
          style={{ animationDelay: "80ms" }}
        >
          Pare de aprender <span className="text-foreground/60">coisas aleatórias.</span>
          <br />
          Descubra exatamente o que aprender para{" "}
          <span className="text-gradient">chegar na renda que você quer.</span>
        </h1>
        {/* text-foreground/85 e não text-muted-foreground: sob o halo do hero o secundário cai
            para 4,6:1 de contraste, no limite do AA. Aqui fica acima de 9:1. */}
        <p
          className={cn(fadeUp, "mx-auto mt-4 max-w-2xl text-base text-foreground/85")}
          style={{ animationDelay: "160ms" }}
        >
          Você responde onde está e onde quer chegar. A Pathly monta a sequência de habilidades e os
          projetos de portfólio que levam até lá, e acompanha seu progresso etapa a etapa.
        </p>
        <div className={cn(fadeUp, "mt-6")} style={{ animationDelay: "240ms" }}>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
          <p className="mt-3.5 text-xs text-foreground/70">
            Até 14 perguntas · 2 minutos · sem cartão de crédito
          </p>
        </div>
      </div>

      {/* Prévia compacta da rota — precisa caber na primeira dobra, junto do CTA. */}
      <div
        className={cn(fadeUp, "mx-auto mt-6 w-full max-w-3xl")}
        style={{ animationDelay: "320ms" }}
      >
        <div className="panel p-3 sm:p-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {transformation.map((item, i) => (
              <div
                key={item.label}
                className="rounded-2xl bg-surface-2/50 px-3 py-2.5 text-left sm:text-center"
              >
                <span className="text-[10px] font-semibold tracking-[0.14em] text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-display text-base font-semibold">{item.label}</p>
                <p className="mt-0.5 text-xs text-foreground/70">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    body: "Checklists, XP e projetos entregues em cada etapa concluída — dá para ver o quanto já andou.",
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
    title: "Ordem que faz sentido",
    body: "Cada etapa só abre depois da anterior, com o pré-requisito explícito. Você nunca fica sem saber o próximo passo.",
  },
  {
    icon: Zap,
    title: "Progresso viciante",
    body: "Sequências, XP e níveis com estética adulta e minimalista. Nada infantil.",
  },
];

/**
 * No celular a landing longa dá lugar a uma entrada de app: logo, promessa em uma linha e as
 * duas ações. A landing continua inteira no desktop — as duas convivem por CSS, sem redirecionar
 * nem detectar aparelho no servidor, o que evitaria cache errado e piscada na hidratação.
 */
function MobileHome() {
  return (
    <div className="halo flex min-h-svh flex-col px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] lg:hidden">
      <Logo />

      <div className="flex flex-1 flex-col justify-center py-10">
        <h1 className="font-display text-4xl leading-[1.08] font-semibold text-balance">
          Descubra exatamente o que aprender para{" "}
          <span className="text-gradient">chegar na renda que você quer.</span>
        </h1>
        <p className="mt-4 text-base text-foreground/85">
          Responda onde você está e onde quer chegar. A Pathly monta a sequência de habilidades e os
          projetos de portfólio que levam até lá.
        </p>

        <ul className="mt-8 space-y-3">
          {transformation.map((item) => (
            <li key={item.label} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <Link to="/onboarding" className="block">
          <Btn size="lg" className="w-full">
            Criar minha rota <ArrowRight className="size-4" />
          </Btn>
        </Link>
        <Link to="/login" className="block">
          <Btn variant="outline" size="lg" className="w-full">
            Já tenho conta
          </Btn>
        </Link>
        <p className="pt-1 text-center text-xs text-muted-foreground">
          Até 14 perguntas · 2 minutos · sem cartão de crédito
        </p>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <>
      <MobileHome />
      <DesktopLanding />
    </>
  );
}

function DesktopLanding() {
  const sample = steps.slice(0, 5);

  return (
    <div className="hidden min-h-screen lg:block">
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
                      <span className="shrink-0 text-right">
                        <span className="block text-[10px] text-muted-foreground">
                          meta parcial
                        </span>
                        <span className="font-display text-sm text-primary">
                          R$ {step.incomeAfter.toLocaleString("pt-BR")}
                        </span>
                      </span>
                    </div>
                  </Panel>
                </Reveal>
              ))}
              <Reveal delay={400}>
                <p className="px-2 pt-2 text-sm text-muted-foreground">
                  + 4 etapas até a especialização final
                </p>
                <p className="px-2 pt-2 text-xs text-muted-foreground">
                  Exemplo de rota para quem quer migrar para back-end. A meta parcial divide a
                  distância entre a renda que você informa hoje e a meta que você mesmo define — é
                  um marco do seu objetivo, não previsão de salário.
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
                Você vê o quanto já andou
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Cada tarefa marcada atualiza o progresso da etapa, as horas estudadas e o XP.
              </p>
              <div className="mt-7 space-y-4">
                {[
                  { k: "Habilidades da rota", v: 38 },
                  { k: "Projetos no portfólio", v: 45 },
                  { k: "Etapas concluídas", v: 62 },
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
              <SectionLabel>Como a rota é montada</SectionLabel>
              <h3 className="mt-3 font-display text-2xl font-semibold">
                Regras claras, não caixa-preta
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                A rota sai da área que você escolhe, da sua experiência e das horas que você tem por
                semana. Mesma resposta, mesma rota — sem sorteio e sem IA opinando.
              </p>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  "A área escolhida define o conteúdo das etapas",
                  "Quem já tem experiência começa adiante, sem repetir fundamento",
                  "Suas horas por semana definem o ritmo e o prazo estimado",
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
