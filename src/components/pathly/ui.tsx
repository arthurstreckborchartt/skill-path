import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------- Brand ---------- */

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-signal shadow-[var(--shadow-glow)]">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          <path
            d="M5 19c0-5 4-5 6-7s1-6-1-7"
            stroke="oklch(0.19 0.04 170)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="18" cy="6.5" r="2.6" fill="oklch(0.19 0.04 170)" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">Pathly</span>
      )}
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
  "tap inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

export const btnStyles = {
  primary:
    "bg-signal text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110 font-semibold",
  soft: "bg-surface-2 text-foreground hover:bg-surface-2/70",
  outline: "border border-border text-foreground hover:border-primary/40 hover:bg-surface/60",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-surface/60",
};

const btnSizes = {
  sm: "h-9 px-4 text-sm",
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
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(900px) rotateX(${-y * 3}deg) rotateY(${x * 4}deg) translateY(-3px)`;
  }
  function onLeave() {
    if (ref.current) ref.current.style.transform = "";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn("panel p-5 sm:p-6", (hover || tilt) && "panel-hover", className)}
    >
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
    neutral: "bg-surface-2 text-foreground/80",
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
    xp: "bg-xp/15 text-xp",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
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
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
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
      if (!entry.isIntersecting || started.current) return;
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
          "h-full rounded-full transition-[width] duration-1000 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]",
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
          stroke="url(#ringGrad)"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.86 0.16 172)" />
            <stop offset="100%" stopColor="oklch(0.72 0.13 245)" />
          </linearGradient>
        </defs>
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
    <span className="animate-[xp-float_1.1s_cubic-bezier(0.16,1,0.3,1)_forwards] pointer-events-none absolute -top-1 right-2 rounded-full bg-xp/20 px-2 py-0.5 text-xs font-semibold text-xp">
      +{amount} XP
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
      {children}
    </span>
  );
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
        <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
