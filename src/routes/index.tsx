import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Braces, Check, Database, Plug, ShieldCheck, Workflow } from "lucide-react";
import { Btn, Chip, Logo, Panel, Reveal, SectionLabel } from "@/components/pathly/ui";
import { HighlightedText } from "@/components/ui/highlighted-text";
import { PathlyMark } from "@/components/pathly/project-chat";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pathly — Da ideia ao SaaS" },
      {
        name: "description",
        content:
          "Descreva o SaaS que quer criar. A Pathly organiza produto, arquitetura, segurança e execução.",
      },
      { property: "og:title", content: "Pathly — Da ideia ao SaaS" },
      {
        property: "og:description",
        content: "Um workspace para planejar, decidir e coordenar a criação do seu SaaS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const stages = [
  { title: "Produto", note: "problema, público e MVP" },
  { title: "Arquitetura", note: "stack, dados, API e segurança" },
  { title: "Execução", note: "roadmap, prompts e validação" },
  { title: "Ferramentas", note: "conexões com aprovação" },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">
              Como funciona
            </a>
            <a href="#workspace" className="hover:text-foreground">
              Workspace
            </a>
            <a href="#controle" className="hover:text-foreground">
              Controle
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden sm:block">
              <Btn variant="ghost" size="sm">
                Entrar
              </Btn>
            </Link>
            <Link to="/cadastro">
              <Btn size="sm">Começar</Btn>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-border px-5 pt-16 pb-14 sm:px-8 sm:pt-24">
          <div className="mx-auto max-w-5xl text-center">
            <Chip tone="primary">
              <Workflow className="size-3.5" /> Seu SaaS, do pedido à execução
            </Chip>
            {/*
              O destaque desliza por trás de "construir" e o texto vira negativo por
              `mix-blend-difference` — preto e branco, sem cor nenhuma. É a única palavra marcada
              da página: marcar duas seria não marcar nenhuma.
            */}
            <h1 className="mx-auto mt-5 max-w-4xl font-display text-4xl leading-[1.04] font-semibold text-balance sm:text-6xl">
              Diga o que quer <HighlightedText delay={0.45}>construir</HighlightedText>.{" "}
              <span className="text-foreground/55">O Pathly organiza o resto.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              Transforme uma ideia em produto, arquitetura e plano de execução. Conecte suas
              ferramentas e aprove cada ação antes que ela aconteça.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/cadastro">
                <Btn size="lg" className="w-full sm:w-auto">
                  Criar meu SaaS <ArrowRight className="size-4" />
                </Btn>
              </Link>
              <Link to="/login">
                <Btn variant="outline" size="lg" className="w-full sm:w-auto">
                  Abrir meus projetos
                </Btn>
              </Link>
            </div>

            {/*
              A vitrine da landing imita o compositor, mas não é um `PromptInput` — não tem
              `data-slot="input-group"`, então o raio interno é escrito aqui à mão. Sai do mesmo
              `--composer-radius` para não descolar do anel se ele mudar.
            */}
            <div className="chat-composer-frame mx-auto mt-10 max-w-3xl p-px text-left">
              <div className="rounded-[calc(var(--composer-radius)-1px)] bg-surface p-4 shadow-[var(--shadow-lift)] sm:p-5">
                <div className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-background">
                    <PathlyMark className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-muted-foreground">
                      Quero construir um ERP simples para uma pequena indústria gerenciar estoque,
                      produção e pedidos.
                    </p>
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">
                        Produto · tecnologia · execução
                      </span>
                      <span className="grid size-8 place-items-center rounded-md bg-foreground text-background">
                        <ArrowRight className="size-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionLabel>Como funciona</SectionLabel>
              <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold sm:text-4xl">
                Uma conversa vira um plano que dá para executar
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: PathlyMark,
                  title: "Você descreve",
                  body: "Explique a ideia com suas palavras. O Pathly pergunta apenas o que faltar para tomar boas decisões.",
                },
                {
                  icon: Braces,
                  title: "O plano toma forma",
                  body: "Produto, dados, API, autenticação, segurança, operação e roadmap ficam conectados no mesmo projeto.",
                },
                {
                  icon: Plug,
                  title: "As ferramentas executam",
                  body: "Quando uma conexão estiver disponível, o Pathly prepara a ação e só envia depois da sua aprovação.",
                },
              ].map((item, index) => (
                <Reveal key={item.title} delay={index * 80}>
                  <Panel className="h-full">
                    <span className="grid size-10 place-items-center rounded-md border border-border bg-surface-2">
                      <item.icon className="size-5" />
                    </span>
                    <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </Panel>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="workspace" className="border-y border-border px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <Reveal>
              <SectionLabel>Workspace do projeto</SectionLabel>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
                Tudo o que define seu SaaS fica no mesmo contexto
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                A conversa não começa do zero a cada mensagem. O Pathly usa o plano, as decisões
                aprovadas e o estado de cada parte do projeto.
              </p>
            </Reveal>
            <div className="grid gap-3 sm:grid-cols-2">
              {stages.map((stage, index) => (
                <Reveal key={stage.title} delay={index * 60}>
                  <div className="rounded-md border border-border bg-surface p-5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      0{index + 1}
                    </span>
                    <h3 className="mt-3 font-display text-xl font-semibold">{stage.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{stage.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="controle" className="px-5 py-20 sm:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
            <Reveal>
              <Panel className="h-full border-foreground/20 bg-foreground text-background">
                <ShieldCheck className="size-6" />
                <h2 className="mt-5 font-display text-2xl font-semibold">
                  Você aprova antes de executar
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-background/70">
                  Mudanças no plano e ações em serviços externos mostram destino, impacto e conteúdo
                  antes da confirmação.
                </p>
              </Panel>
            </Reveal>
            <Reveal delay={100}>
              <Panel className="h-full">
                <Database className="size-6" />
                <h2 className="mt-5 font-display text-2xl font-semibold">Histórico por projeto</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Conversas, decisões e artefatos ficam salvos na sua conta e separados entre os
                  seus SaaS.
                </p>
                <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                  {[
                    "Contexto próprio por projeto",
                    "Decisões rastreáveis",
                    "Nenhuma execução silenciosa",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-foreground" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          </div>
        </section>

        <section className="px-5 pb-24 sm:px-8">
          <Reveal>
            <div className="mx-auto max-w-4xl rounded-lg border border-border bg-surface p-10 text-center sm:p-16">
              <h2 className="font-display text-3xl font-semibold sm:text-5xl">
                Comece pela ideia. O plano vem depois.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
                Crie um espaço para o seu SaaS e avance com contexto, controle e decisões claras.
              </p>
              <Link to="/cadastro" className="mt-8 inline-block">
                <Btn size="lg">
                  Criar meu primeiro projeto <ArrowRight className="size-4" />
                </Btn>
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <Logo />
          <span>Pathly · Da ideia ao SaaS.</span>
          <div className="flex gap-4">
            <Link to="/termos">Termos de Uso</Link>
            <Link to="/privacidade">Política de Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
