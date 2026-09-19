import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FolderKanban, Home, Plug, Search, Settings, User } from "lucide-react";
import { Btn, Logo } from "./ui";
import { Copilot } from "./copilot";
import { cn } from "@/lib/utils";

// Oportunidades (vagas) fica fora da navegação por enquanto: a tela ainda usa dados de
// exemplo (mock), e mostrar vaga fictícia pra usuário real derruba confiança. A rota
// continua existindo (não foi apagada), só não aparece nos menus até ter dado real.
//
// "Projetos" aponta para /app/blueprints, a tela nova. A antiga (/app/projetos) segue
// existindo e funcionando, só saiu do menu — mesmo tratamento dado a oportunidades. Ela
// lista projetos de portfólio derivados das etapas da rota, e será removida junto com o
// restante do workspace, não antes.
const primaryNav = [
  { to: "/app", label: "Criar", icon: Home, exact: true },
  { to: "/app/blueprints", label: "Projetos", icon: FolderKanban },
  { to: "/app/integracoes", label: "Integrações", icon: Plug },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

const mobileNav = [
  { to: "/app", label: "Criar", icon: Home, exact: true },
  { to: "/app/blueprints", label: "Projetos", icon: FolderKanban },
  { to: "/app/integracoes", label: "Integrações", icon: Plug },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

function SideItem({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact === true }}
      className="tap group flex items-center gap-3 rounded-md border border-transparent px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:border-sidebar-border data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-foreground"
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell() {
  return <AppShellInner />;
}

function AppShellInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 left-0 z-30 hidden h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/" className="tap mb-8 px-2 pt-1">
          <Logo />
        </Link>

        <nav className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <SideItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="mt-auto" />
        <Link
          to="/app/configuracoes"
          className="tap mt-2 flex items-center gap-3 rounded-md px-2 py-2.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Settings className="size-4" /> Configurações
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 lg:hidden">
        <Link to="/" className="tap">
          <Logo />
        </Link>
        <Link to="/app/configuracoes">
          <Btn variant="ghost" size="sm">
            <Settings className="size-4" />
          </Btn>
        </Link>
      </header>

      <div className="fixed top-0 right-0 left-60 z-20 hidden h-16 items-center border-b border-border bg-background px-8 lg:flex">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-5">
          <div className="flex h-9 w-full max-w-lg items-center gap-2 rounded-md border border-border bg-surface px-3 text-xs text-muted-foreground">
            <Search className="size-3.5 shrink-0" />
            <span className="truncate">Buscar projetos, decisões ou artefatos…</span>
            <kbd className="ml-auto shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[10px]">
              ⌘K
            </kbd>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">Pathly Workspace</span>
        </div>
      </div>

      <main
        key={pathname}
        // 8rem + área segura: a barra inferior (56px) nunca cobre o fim do conteúdo no iPhone.
        // `backwards` e não `both`: o `both` deixa o transform da animação aplicado para sempre,
        // e um transform aqui faz o <main> virar o containing block de todo `position: fixed`
        // que estiver dentro dele. Com `backwards` o preenchimento vale só antes de começar, o
        // visual da entrada é idêntico, e o transform some quando a animação termina.
        className="animate-[fade-up_0.35s_cubic-bezier(0.16,1,0.3,1)_backwards] px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-60 lg:px-8 lg:pt-24 lg:pb-12"
      >
        <div className="mx-auto w-full max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/*
        Irmão do <main>, e não filho: a animação de entrada do <main> aplica um transform, e
        qualquer position:fixed lá dentro passaria a se posicionar em relação a ele durante a
        animação — o botão flutuante pularia a cada troca de rota.
      */}
      <Copilot />

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background lg:hidden">
        <ul className="grid grid-cols-4">
          {mobileNav.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: exact === true }}
                className={cn(
                  "tap group flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] text-muted-foreground",
                  "data-[status=active]:text-primary",
                )}
              >
                <Icon className="size-5 transition-transform group-active:scale-90" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
