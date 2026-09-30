import { useEffect, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderKanban, Menu, MessagesSquare, Plus, Settings, X } from "lucide-react";
import { Logo } from "./ui";
import { Copilot } from "./copilot";
import { FundoAnimado } from "./fundo-animado";
import { AvatarConta } from "./avatar-conta";
import { cn } from "@/lib/utils";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
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
 * virou o botão no topo dela; Integrações e Perfil desceram para Ajustes, onde já moravam de
 * verdade. Restou uma coluna e um centro.
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
  const contagens = aberto ? estadoDasPartes(aberto) : {};

  return (
    <div className="flex h-full flex-col gap-1 p-3" onClick={aoNavegar}>
      <Link to="/" className="tap mb-4 px-2 pt-1">
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

      <Link
        to="/app/configuracoes"
        className="tap mt-1 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <AvatarConta size={20} />
        <span className="truncate">Ajustes</span>
        <Settings className="ml-auto size-4 shrink-0" />
      </Link>
    </div>
  );
}

export function AppShell() {
  return <AppShellInner />;
}

function AppShellInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [gaveta, setGaveta] = useState(false);

  // A gaveta fecha ao trocar de rota. Sem isto ela ficaria aberta por cima da tela que acabou de
  // abrir, e a pessoa teria que fechá-la para ver o que pediu.
  useEffect(() => setGaveta(false), [pathname]);

  return (
    /*
      `isolate` continua sendo o que mantém o gradiente do fundo entre o <body> e o conteúdo: o
      shader usa `z-index: -1`, e sem um contexto de empilhamento próprio aqui esse -1 sobe até a
      raiz da página e some atrás do fundo do <body>.
    */
    <div className="relative isolate min-h-screen">
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
          className="tap grid size-10 place-items-center rounded-md text-muted-foreground hover:text-foreground"
        >
          <Menu className="size-5" />
        </button>
        <Link to="/" className="tap">
          <Logo compact />
        </Link>
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
        className="animate-[fade-up_0.35s_cubic-bezier(0.16,1,0.3,1)_backwards] px-4 pt-5 pb-[calc(3rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-64 lg:px-8 lg:pt-8 lg:pb-12"
      >
        <div className="mx-auto w-full max-w-7xl">
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
