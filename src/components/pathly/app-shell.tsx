import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Compass,
  FolderKanban,
  Home,
  Settings,
  User,
  Zap,
} from "lucide-react";
import { Btn, Logo } from "./ui";
import { levelFromXp } from "@/lib/route-map";
import { RouteProgressProvider, useRouteProgressContext } from "@/lib/route-progress-context";
import { LearningSystemProvider } from "@/lib/learning-context";
import { useLearningSystem } from "@/lib/learning-context";
import { cn } from "@/lib/utils";

// Oportunidades (vagas) fica fora da navegação por enquanto: a tela ainda usa dados de
// exemplo (mock), e mostrar vaga fictícia pra usuário real derruba confiança. A rota
// continua existindo (não foi apagada), só não aparece nos menus até ter dado real.
const primaryNav = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/rota", label: "Caminhos", icon: Compass },
  { to: "/app/habilidades", label: "Aprender", icon: BookOpen },
  { to: "/app/projetos", label: "Projetos", icon: FolderKanban },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

const mobileNav = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/rota", label: "Caminhos", icon: Compass },
  { to: "/app/habilidades", label: "Aprender", icon: BookOpen },
  { to: "/app/projetos", label: "Projetos", icon: FolderKanban },
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
      className="tap group flex items-center gap-3 rounded-lg border border-transparent px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground data-[status=active]:border-sidebar-border data-[status=active]:bg-surface data-[status=active]:font-semibold data-[status=active]:text-foreground"
    >
      <Icon className="size-4.5 shrink-0 transition-transform group-hover:scale-110 group-data-[status=active]:text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AppShell() {
  return (
    <RouteProgressProvider>
      <LearningSystemProvider>
        <AppShellInner />
      </LearningSystemProvider>
    </RouteProgressProvider>
  );
}

/** A rota só é lida do localStorage depois que o componente monta (ver route-map.ts). */
function RouteLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="skeleton h-8 w-2/3" />
      <div className="skeleton h-36 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}

/**
 * Sem onboarding concluído não existe rota pessoal — e o fallback do hook é a rota de exemplo,
 * de outra pessoa. Mostrar aquilo para quem acabou de criar conta faz parecer que o app veio
 * preenchido com dados alheios, então aqui a tela pede o onboarding em vez do Outlet.
 */
function OnboardingGate() {
  return (
    <div className="mx-auto max-w-lg py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Compass className="size-6" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-semibold">Falta montar a sua rota</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        São até 14 perguntas sobre onde você está e onde quer chegar, em uns 2 minutos. Sem elas não
        há o que mostrar aqui — e a rota de exemplo da página inicial é de outra pessoa, não sua.
      </p>
      <Link to="/onboarding" className="mt-6 inline-block">
        <Btn size="lg">
          Montar minha rota <ArrowRight className="size-4" />
        </Btn>
      </Link>
    </div>
  );
}

function AppShellInner() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { stats, profile, hydrated } = useRouteProgressContext();
  const learning = useLearningSystem();
  const totalXp = stats.totalXp + learning.xpTotal;
  const level = levelFromXp(totalXp);
  // Configurações continua acessível sem rota: é de onde se sai da conta e se manda feedback.
  const needsOnboarding = hydrated && !profile.isPersonalized && pathname !== "/app/configuracoes";

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed top-0 left-0 hidden h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 lg:flex">
        <Link to="/" className="tap mb-10 px-2 pt-1">
          <Logo />
        </Link>

        <nav className="flex flex-col gap-1">
          {primaryNav.map((item) => (
            <SideItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-sidebar-border bg-surface p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-xp" />
            Nível {level.level} · {level.name}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-signal"
              style={{ width: `${level.progressPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {level.maxed ? `${level.xp} XP` : `${level.xp} / ${level.xpToNext} XP`}
          </p>
        </div>
        <Link
          to="/app/configuracoes"
          className="tap mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Settings className="size-4" /> Configurações
        </Link>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl lg:hidden">
        <Link to="/" className="tap">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-md bg-xp/15 px-2.5 py-1 text-xs font-semibold text-xp">
            <Zap className="size-3.5" />
            {totalXp}
          </span>
        </div>
      </header>

      <main
        key={pathname}
        // 8rem + área segura: a barra inferior (56px) nunca cobre o fim do conteúdo no iPhone.
        // `backwards` e não `both`: o `both` deixa o transform da animação aplicado para sempre,
        // e um transform aqui faz o <main> virar o containing block de todo `position: fixed`
        // que estiver dentro dele. Com `backwards` o preenchimento vale só antes de começar, o
        // visual da entrada é idêntico, e o transform some quando a animação termina.
        className="animate-[fade-up_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] px-4 pt-6 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:px-6 lg:ml-64 lg:px-12 lg:pt-9 lg:pb-16"
      >
        <div className="mx-auto w-full max-w-6xl">
          {!hydrated ? <RouteLoading /> : needsOnboarding ? <OnboardingGate /> : <Outlet />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl lg:hidden">
        <ul className="grid grid-cols-5">
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
