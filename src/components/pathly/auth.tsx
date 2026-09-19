import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "./ui";

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
    <div className="relative grid min-h-screen bg-[var(--gradient-page)] lg:grid-cols-[0.9fr_1.1fr]">
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
      <aside className="relative hidden overflow-hidden border-l border-border bg-[var(--gradient-panel-strong)] text-foreground lg:block">
        <div className="relative flex h-full flex-col justify-center gap-0 p-14">
          {[
            { label: "Ideia", note: "o que você quer construir" },
            { label: "Produto", note: "público, problema e MVP" },
            { label: "Arquitetura", note: "dados, API e segurança" },
            { label: "Execução", note: "roadmap e prompts" },
            { label: "Integrações", note: "ações sempre aprovadas" },
          ].map((row, i) => (
            <div
              key={row.label}
              className="animate-[fade-up_0.7s_cubic-bezier(0.16,1,0.3,1)_both] flex items-center justify-between border-b border-foreground/10 px-1 py-6"
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="font-display text-xl font-semibold text-foreground">
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
        // text-base no celular: abaixo de 16px o Safari do iPhone dá zoom ao focar o campo.
        className="h-12 w-full rounded-md border border-input bg-surface-2 px-4 text-base outline-hidden transition-colors placeholder:text-muted-foreground focus:border-foreground/35 focus:ring-2 focus:ring-ring disabled:opacity-60 sm:text-sm"
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
