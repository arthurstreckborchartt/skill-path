import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./ui";
import { cn } from "@/lib/utils";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div
        aria-hidden
        className="animate-[drift_20s_ease-in-out_infinite_alternate] pointer-events-none absolute -top-40 -left-32 size-[38rem] rounded-full bg-primary/10 blur-[130px]"
      />

      {/* Form side */}
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Link to="/" className="tap">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="animate-[fade-up_0.6s_cubic-bezier(0.16,1,0.3,1)_both]">
            <h1 className="font-display text-3xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            <div className="mt-8 space-y-6">{children}</div>
          </div>
        </div>
      </div>

      {/* Visual side */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-surface/40 lg:block">
        <div
          aria-hidden
          className="animate-[drift_22s_ease-in-out_infinite_alternate] absolute top-1/4 left-1/3 size-[32rem] rounded-full bg-accent/12 blur-[120px]"
        />
        <div className="relative flex h-full flex-col justify-center gap-4 p-14">
          {[
            { label: "R$ 2.600", note: "onde você está" },
            { label: "Habilidades certas", note: "na ordem que faz sentido" },
            { label: "Projetos reais", note: "portfólio que prova" },
            { label: "Oportunidades", note: "vagas compatíveis" },
            { label: "R$ 8.000", note: "onde você quer chegar", highlight: true },
          ].map((row, i) => (
            <div
              key={row.label}
              className="animate-[fade-up_0.7s_cubic-bezier(0.16,1,0.3,1)_both] flex items-center justify-between rounded-2xl bg-surface/70 px-6 py-5"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span
                className={cn(
                  "font-display text-xl font-semibold",
                  row.highlight && "text-primary",
                )}
              >
                {row.label}
              </span>
              <span className="text-xs text-muted-foreground">{row.note}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function AuthField({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
  disabled,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        className="h-12 w-full rounded-xl border border-input bg-surface/60 px-4 text-sm outline-none transition-all placeholder:text-muted-foreground/70 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:opacity-60"
      />
    </label>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

export function AuthSocial({ onGoogle, disabled }: { onGoogle: () => void; disabled?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou continue com
        <span className="h-px flex-1 bg-border" />
      </div>
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        className="tap mt-4 h-11 w-full rounded-xl border border-border text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-surface/60 disabled:opacity-60"
      >
        Google
      </button>
    </div>
  );
}
