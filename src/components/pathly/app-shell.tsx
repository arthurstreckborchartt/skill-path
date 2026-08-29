import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Compass,
  FolderKanban,
  Home,
  Settings,
  Sparkles,
  Target,
  User,
  Zap,
} from "lucide-react";
import { Logo } from "./ui";
import { user } from "@/lib/mock";
import { cn } from "@/lib/utils";

const primaryNav = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/rota", label: "Minha rota", icon: Compass },
  { to: "/app/habilidades", label: "Habilidades", icon: Zap },
  { to: "/app/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/app/oportunidades", label: "Oportunidades", icon: Target },
];

const secondaryNav = [
  { to: "/app/perfil", label: "Perfil", icon: User },
  { to: "/app/configuracoes", label: "Configurações", icon: Settings },
];

const mobileNav = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/rota", label: "Rota", icon: Compass },
  { to: "/app/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/app/oportunidades", label: "Vagas", icon: Target },
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
      activeOptions={{ exact }}
      className="tap group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-foreground"
    >
      <Icon className="size-4.5 shrink-0 transition-transform group-hover:scale-110 group-data-[status=active]:text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 left-0 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Link to="/" className="tap mb-8 px-2 pt-2">
          <Logo />
        </Link>

        <nav className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <SideItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="my-4 h-px bg-sidebar-border" />

        <nav className="flex flex-col gap-1">
          {secondaryNav.map((item) => (
            <SideItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Nível {user.level} · {user.levelName}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${(user.xp / user.xpToNext) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {user.xp} / {user.xpToNext} XP
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link to="/" className="tap">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp">
            <Zap className="size-3.5" />
            {user.xp}
          </span>
          <button
            aria-label="Notificações"
            className="tap grid size-9 place-items-center rounded-full bg-surface text-muted-foreground"
          >
            <Bell className="size-4" />
          </button>
        </div>
      </header>

      <main
        key={pathname}
        className="animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_both] px-4 pt-6 pb-28 sm:px-6 lg:ml-64 lg:px-10 lg:pt-10 lg:pb-16"
      >
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5">
          {mobileNav.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact }}
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
