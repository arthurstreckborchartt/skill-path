import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------- Brand ---------- */

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    // coarse:min-h-11 — a logo costuma ser link de volta para o início; em tela de toque
    // precisa dos 44px mesmo sendo visualmente menor.
    <span className={cn("flex items-center gap-2.5 coarse:min-h-11", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center text-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          {/* A marca fica sobre o gradiente de ação nos dois temas, então segue o token que
              já é o "texto sobre a cor primária" — sem cor fixa. */}
          <path
            d="M5 19c0-5 4-5 6-7s1-6-1-7"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="18" cy="6.5" r="2.6" fill="currentColor" />
        </svg>
      </span>
      {!compact && <span className="font-display text-lg font-semibold">Pathly</span>}
    </span>
  );
}

/* ---------- Button ---------- */

type BtnProps = {
  variant?: "primary" | "ghost" | "outline" | "soft";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const btnBase =
  "tap inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50";

/** Interno: só o `Btn` abaixo usa. Era exportado sem ninguém importar. */
const btnStyles = {
  primary: "border border-primary bg-primary text-primary-foreground hover:opacity-85",
  soft: "border border-transparent bg-surface-2 text-foreground hover:border-border hover:bg-muted",
  outline:
    "border border-border bg-surface text-foreground hover:border-foreground/25 hover:bg-surface-2",
  ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
};

// Em tela de toque nenhum botão fica abaixo de 44px de altura (md e lg já passam).
const btnSizes = {
  sm: "h-9 coarse:h-11 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function Btn({ variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button className={cn(btnBase, btnStyles[variant], btnSizes[size], className)} {...props} />
  );
}

/* ---------- Surfaces ---------- */

export function Panel({
  className,
  children,
  hover,
  tilt,
}: {
  className?: string;
  children: ReactNode;
  hover?: boolean;
  tilt?: boolean;
}) {
  return (
    <div className={cn("panel p-5 sm:p-6", (hover || tilt) && "panel-hover", className)}>
      {children}
    </div>
  );
}

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "accent" | "xp" | "muted";
  className?: string;
}) {
  const tones = {
    neutral: "border border-border bg-surface text-foreground/80",
    primary: "border border-foreground/15 bg-foreground text-background",
    accent: "border border-border bg-surface-2 text-foreground",
    xp: "border border-border bg-surface-2 text-foreground",
    muted: "border border-border bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Motion helpers ---------- */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // O conteúdo começa invisível: se o observer não existir ou a pessoa pedir menos movimento,
    // aparece direto. Nunca deixar o texto preso em opacidade zero.
    const reduzMovimento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (typeof IntersectionObserver === "undefined" || reduzMovimento) {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    // Rede de segurança: se o observer não disparar (layout estranho, aba em segundo plano),
    // o conteúdo aparece mesmo assim em vez de sumir da página.
    const fallback = window.setTimeout(() => setShown(true), 1500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 1100,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(value * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display.toLocaleString("pt-BR")}
      {suffix}
    </span>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  className,
  delay = 150,
}: {
  value: number;
  tone?: "primary" | "accent" | "xp";
  className?: string;
  delay?: number;
}) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  const tones = {
    primary: "bg-signal",
    accent: "bg-accent",
    xp: "bg-xp",
  };

  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
          tones[tone],
        )}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function Ring({
  value,
  size = 112,
  label,
  sub,
}: {
  value: number;
  size?: number;
  label: string;
  sub?: string;
}) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value), 200);
    return () => clearTimeout(t);
  }, [value]);
  const r = size / 2 - 7;
  const c = 2 * Math.PI * r;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={7}
          className="stroke-muted"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={7}
          fill="none"
          className="stroke-foreground"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-xl font-semibold">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

export function XpBurst({ amount, show }: { amount: number; show: boolean }) {
  if (!show) return null;
  return (
    <span className="animate-[xp-float_1.1s_cubic-bezier(0.16,1,0.3,1)_forwards] pointer-events-none absolute -top-1 right-2 rounded-md border border-border bg-foreground px-2 py-0.5 text-xs font-semibold text-background">
      +{amount} XP
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs font-semibold text-muted-foreground uppercase">{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate font-display text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
