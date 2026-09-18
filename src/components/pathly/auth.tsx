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
    <div className="relative grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
      {/* Form side */}
      <div className="flex flex-col px-5 pt-[calc(2rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-10">
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
      <aside className="relative hidden overflow-hidden border-l border-border bg-foreground text-background lg:block">
        <div className="relative flex h-full flex-col justify-center gap-0 p-14">
          {[
            { label: "R$ 2.600", note: "onde você está" },
            { label: "Habilidades certas", note: "na ordem que faz sentido" },
            { label: "Projetos reais", note: "portfólio que prova" },
            { label: "Freelas e candidaturas", note: "as últimas etapas da rota" },
            { label: "R$ 8.000", note: "onde você quer chegar", highlight: true },
          ].map((row, i) => (
            <div
              key={row.label}
              className="animate-[fade-up_0.7s_cubic-bezier(0.16,1,0.3,1)_both] flex items-center justify-between border-b border-background/10 px-1 py-6"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span
                className={cn(
                  "font-display text-xl font-semibold text-background",
                   row.highlight && "underline decoration-background/40 underline-offset-8",
                )}
              >
                {row.label}
              </span>
              <span className="text-xs text-background/50">{row.note}</span>
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
        // text-base no celular: abaixo de 16px o Safari do iPhone dá zoom ao focar o campo.
        className="h-12 w-full rounded-md border border-input bg-surface px-4 text-base outline-hidden transition-colors placeholder:text-muted-foreground focus:border-foreground/35 focus:ring-2 focus:ring-ring disabled:opacity-60 sm:text-sm"
      />
    </label>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-md border border-foreground/30 bg-surface-2 px-4 py-3 text-sm text-foreground"
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
        className="tap mt-4 h-11 w-full rounded-md border border-border bg-surface text-sm text-foreground transition-colors hover:border-foreground/30 hover:bg-surface-2 disabled:opacity-60"
      >
        Google
      </button>
    </div>
  );
}
