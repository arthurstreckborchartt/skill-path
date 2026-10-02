import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronRight, FolderKanban, Menu, MessagesSquare, Plus, X } from "lucide-react";
import { Logo } from "./ui";
import { Copilot } from "./copilot";
import { FundoAnimado } from "./fundo-animado";
import { AvatarConta } from "./avatar-conta";
import { cn } from "@/lib/utils";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
import { useContagens } from "@/lib/blueprint/usar-contagem";
import { LearningSystemProvider } from "@/lib/learning-context";
import { RouteProgressProvider } from "@/lib/route-progress-context";
import { PARTES, estadoDasPartes } from "./partes";

/**
 * A casca do app.
 *
 * ## O que ela deixou de ser
 *
 * Era uma navegação de quatro seções — Criar, Projetos, Integrações, Perfil — e a pessoa escolhia
 * entre elas antes de chegar ao trabalho. Com vinte e cinco rotas por baixo, a pergunta "onde fica
 * aquilo?" acontecia o tempo todo.
 *
 * Agora a lista da esquerda é a lista de projetos, como a lista de conversas de um chat. "Criar"
 * virou o botão no topo dela, e Integrações desceu para Configurações, onde já morava de verdade.
 * Restou uma coluna e um centro.
 *
 * No pé fica Perfil, com o avatar da conta — e Configurações a um clique de lá.
 *
 * ## A busca falsa saiu
 *
 * Havia uma barra de busca no topo que era uma `<div>` — não recebia foco, não abria nada, e o
 * `⌘K` desenhado ao lado dela não existia. Prometer busca e não ter é pior que não ter.
 */

function ItemDeProjeto({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  return (
    <Link
      to="/app/projeto/$id"
      params={{ id }}
      className={cn(
        "tap block truncate rounded-md px-3 py-2 text-sm transition-colors",
        ativo
          ? "bg-sidebar-accent font-medium text-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
      title={nome}
    >
      {nome}
    </Link>
  );
}

/**
 * A coluna da esquerda. Uma só, usada no desktop fixa e no celular como gaveta.
 *
 * Escrever duas versões produziria duas listas de projetos que um dia discordariam — foi o que
 * aconteceu com a navegação antiga, que tinha `primaryNav` e `mobileNav` copiados um do outro.
 */
function Coluna({ aoNavegar }: { aoNavegar?: () => void }) {
  const projetos = useProjetos();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const busca = useRouterState({ select: (s) => s.location.search }) as { parte?: string };
  const idAberto = pathname.match(/^\/app\/[a-z-]+\/([0-9a-f-]{36})/i)?.[1] ?? null;

  const aberto =
    projetos.estado === "pronta"
      ? (projetos.projetos.find((p) => p.id === idAberto) ?? null)
      : null;

  /*
   * Os contadores saem da linha do projeto que a lista já trouxe — nenhuma consulta a mais.
   * "Etapas 7/18" ao lado do nome é o que responde "como está isto?" sem abrir nada.
   */
  // A contagem de etapas vem do roadmap derivado, nao das colunas da linha — ver estadoDasPartes.
  const contagem = useContagens(aberto ? [aberto] : [])?.get(aberto?.id ?? "") ?? null;
  const contagens = aberto ? estadoDasPartes(aberto, contagem) : {};

  return (
    <div className="flex h-full flex-col gap-1 p-3" onClick={aoNavegar}>
      {/*
        Dentro do app a logo leva ao app, não à landing.

        Esta casca só é montada com sessão — quem clica aqui já entrou, e mandá-lo para a página
        de venda é devolvê-lo à porta de um lugar onde ele já está.
      */}
      <Link to="/app" className="tap mb-4 px-2 pt-1">
        <Logo />
      </Link>

      <Link
        to="/app"
        className="tap mb-2 flex items-center gap-2 rounded-md border border-sidebar-border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent"
      >
        <Plus className="size-4 shrink-0" />
        Novo projeto
      </Link>

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {/*
          A coluna tem dois rostos, e o que decide é onde a pessoa está.

          Dentro de um projeto, ela mostra **aquele** projeto: o nome e as partes dele. Fora, a
          lista de projetos. A lista inteira sempre visível competiria com o contexto do trabalho
          em curso — e trocar de projeto é raro comparado a andar dentro de um.
        */}
        {aberto ? (
          <div className="flex flex-col gap-0.5">
            <p className="px-3 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Projeto
            </p>
            <p className="truncate px-3 pb-2 text-sm font-medium" title={aberto.nome}>
              {aberto.nome}
            </p>

            <Link
              to="/app/projeto/$id"
              params={{ id: aberto.id }}
              search={{}}
              className={cn(
                "tap flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                !busca.parte
                  ? "bg-sidebar-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <MessagesSquare className="size-4 shrink-0" />
              Conversa
            </Link>

            {PARTES.map(({ slug, rotulo, icone: Icone }) => (
              <Link
                key={slug}
                to="/app/projeto/$id"
                params={{ id: aberto.id }}
                search={{ parte: slug }}
                className={cn(
                  "tap flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  busca.parte === slug
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                )}
              >
                <Icone className="size-4 shrink-0" />
                <span className="truncate">{rotulo}</span>
                {contagens[slug] && (
                  // Contagem, não alarme — num produto monocromático não haveria cor para isso.
                  <span className="ml-auto shrink-0 font-mono text-xs tabular-nums opacity-70">
                    {contagens[slug]}
                  </span>
                )}
              </Link>
            ))}

            <Link
              to="/app/blueprints"
              className="tap mt-3 flex items-center gap-2.5 border-t border-sidebar-border px-3 pt-3 pb-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <FolderKanban className="size-4 shrink-0" />
              Todos os projetos
            </Link>
          </div>
        ) : (
          <>
            {projetos.estado === "pronta" && projetos.projetos.length > 0 && (
              <nav className="flex flex-col gap-0.5">
                {projetos.projetos.map((p) => (
                  <ItemDeProjeto key={p.id} id={p.id} nome={p.nome} ativo={false} />
                ))}
              </nav>
            )}

            {/*
              O vazio não se desculpa e não repete o botão que já está logo acima: diz o que a
              lista vai guardar, e só.
            */}
            {projetos.estado === "pronta" && projetos.projetos.length === 0 && (
              <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Seus projetos aparecem aqui.
              </p>
            )}

            {projetos.estado === "carregando" && (
              <div className="space-y-1.5 px-3 py-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3.5 animate-pulse rounded bg-sidebar-accent" />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/*
        "Perfil", e o destino acompanha o rótulo.

        A linha mostra o avatar da pessoa, então "Perfil" é o que ela lê ali. Trocar só a palavra
        e continuar abrindo Configurações faria o rótulo mentir — e o ícone de engrenagem, que
        prometia ajustes, sai junto pelo mesmo motivo.

        Configurações não fica órfã: a tela de Perfil tem o atalho para ela, e Configurações tem
        "Perfil e plano" de volta. Antes era um clique e agora são dois, para quem vai mexer em
        integrações e aparência — que não é o caminho de todo dia.
      */}
      <Link
        to="/app/perfil"
        className="tap mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <AvatarConta size={20} />
        <span className="truncate">Perfil</span>
        <ChevronRight className="ml-auto size-4 shrink-0" />
      </Link>
    </div>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const paginaEducacionalAntiga =
    pathname === "/app/rota" ||
    pathname === "/app/habilidades" ||
    pathname === "/app/projetos" ||
    pathname === "/app/revisar" ||
    pathname.startsWith("/app/aprender/");

  if (!paginaEducacionalAntiga) return <AppShellInner />;

  return (
    <RouteProgressProvider>
      <LearningSystemProvider>
        <AppShellInner />
      </LearningSystemProvider>
    </RouteProgressProvider>
  );
}

function AppShellInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const busca = useRouterState({ select: (s) => s.location.search }) as { parte?: string };
  const projetos = useProjetos();
  const [gaveta, setGaveta] = useState(false);

  /*
   * Qual projeto está aberto, para a barra do celular dizer.
   *
   * Numa tela estreita a barra é a única coisa fixa, e gastá-la com o logo — que não muda nunca e
   * não informa nada — desperdiça a linha mais valiosa do aparelho. Quem está no celular precisa
   * saber em que projeto está e em que parte dele.
   */
  const idAberto = pathname.match(/^\/app\/[a-z-]+\/([0-9a-f-]{36})/i)?.[1] ?? null;
  const projetoAberto =
    projetos.estado === "pronta"
      ? (projetos.projetos.find((p) => p.id === idAberto) ?? null)
      : null;
  const parteAberta = PARTES.find((p) => p.slug === busca.parte);

  // A gaveta fecha ao trocar de rota. Sem isto ela ficaria aberta por cima da tela que acabou de
  // abrir, e a pessoa teria que fechá-la para ver o que pediu.
  useEffect(() => setGaveta(false), [pathname]);

  return (
    /*
      `isolate` continua sendo o que mantém o gradiente do fundo entre o <body> e o conteúdo: o
      shader usa `z-index: -1`, e sem um contexto de empilhamento próprio aqui esse -1 sobe até a
      raiz da página e some atrás do fundo do <body>.
    */
    /*
      A casca é uma coluna da altura da tela, e quem rola é o <main> — não a página.

      Antes a raiz era `min-h-screen` e cada tela adivinhava quanto espaço sobrava. A conversa
      chutava `calc(100svh - 8rem)`, e o chute errava: medido em 1440×900, sobravam 815px úteis e
      ela pedia 764 — 51px de vazio embaixo, que é exatamente o `pb-12` do <main> contado duas
      vezes. Como `html` tem `font-size: 17px`, cada `rem` vale 17 e não 16, então a conta de
      cabeça erra ainda mais fácil.

      Com a coluna, ninguém mais calcula: `flex-1` dá ao <main> o que sobrou depois da barra do
      celular, e `h-full` lá dentro vale a altura certa em qualquer tela. É o mesmo arranjo do
      ChatGPT e do Claude — a janela não rola, a conversa rola por dentro.
    */
    <div className="relative isolate flex h-svh flex-col">
      <FundoAnimado />

      <aside className="fixed top-0 left-0 z-30 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Coluna />
      </aside>

      {/* ---------- Celular: barra e gaveta ---------- */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:hidden">
        <button
          type="button"
          onClick={() => setGaveta(true)}
          aria-label="Abrir projetos"
          /* size-11 = 44px. Medido em 375px: com `size-10` ficava em 40px, e é o único jeito de
             chegar à lista de projetos num aparelho. */
          className="tap grid size-11 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        {projetoAberto ? (
          <button
            type="button"
            onClick={() => setGaveta(true)}
            /* min-h-11 = 44px. Medido em 375px: sem isto o botão fica com 37px, e ele é o alvo
               mais usado da barra — é por ele que se abre a gaveta com as partes. */
            className="tap flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center"
          >
            <span className="w-full truncate text-sm font-medium">{projetoAberto.nome}</span>
            {parteAberta && (
              <span className="text-[11px] text-muted-foreground">{parteAberta.rotulo}</span>
            )}
          </button>
        ) : (
          /* Mesmo motivo da logo da sidebar: com sessão, a logo é atalho para o app. */
          <Link to="/app" className="tap">
            <Logo compact />
          </Link>
        )}
        <Link to="/app/configuracoes" className="tap ml-auto grid size-10 place-items-center">
          <AvatarConta size={22} />
        </Link>
      </header>

      {gaveta && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setGaveta(false)}
            className="absolute inset-0 bg-foreground/20"
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border bg-sidebar">
            <button
              type="button"
              onClick={() => setGaveta(false)}
              aria-label="Fechar projetos"
              className="tap absolute top-3 right-3 z-10 grid size-9 place-items-center rounded-md text-muted-foreground"
            >
              <X className="size-4" />
            </button>
            <Coluna aoNavegar={() => setGaveta(false)} />
          </div>
        </div>
      )}

      <main
        key={pathname}
        /*
          `backwards` e não `both`: com `both` o transform da animação fica aplicado para sempre, e
          um transform aqui faz o <main> virar o containing block de todo `position: fixed` que
          estiver dentro dele.
        */
        /*
          No celular a margem lateral cai de 16px para 12px, e a de cima de 20px para 12px.

          Medido num aparelho de 375px: a largura útil vai de 343px para 351px. São 8px, e não é
          uma revolução — mas numa tela onde a conversa deve ocupar quase tudo, margem é a última
          coisa que merece espaço. No desktop a folga volta, porque lá sobra e a linha de texto
          precisa de limite.
        */
        className="sem-barra min-h-0 flex-1 animate-[fade-up_0.35s_cubic-bezier(0.16,1,0.3,1)_backwards] overflow-y-auto px-3 pt-3 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-5 lg:ml-64 lg:px-8 lg:pt-8 lg:pb-12"
      >
        {/*
          `h-full` para que as telas que querem ocupar a altura toda — a conversa — tenham uma
          altura definida para medir. Quem é mais alto que isso transborda e rola no <main>, que é
          o comportamento de antes.
        */}
        <div className="mx-auto h-full w-full max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/*
        Irmão do <main>, e não filho: a animação de entrada aplica um transform, e qualquer
        `position: fixed` lá dentro passaria a se posicionar em relação a ele durante a animação.
      */}
      <Copilot />
    </div>
  );
}
