import { useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option, SkillEntry, SkillLevel } from "@/lib/onboarding";
import { skillLevels } from "@/lib/onboarding";

/* ---------- card selection ---------- */

export function CardSelect<T extends string>({
  options,
  value,
  onChange,
  multi,
  columns = 2,
}: {
  options: Option<T>[];
  value: T[] | T | null;
  onChange: (next: T) => void;
  multi?: boolean;
  columns?: 1 | 2;
}) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];

  return (
    <div className={cn("grid gap-2.5", columns === 2 && "sm:grid-cols-2")}>
      {options.map((option, i) => {
        const active = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.id)}
            style={{ animationDelay: `${i * 28}ms` }}
            className={cn(
              "tap animate-[fade-up_0.45s_cubic-bezier(0.16,1,0.3,1)_both] group flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all",
              active
                ? "border-primary/50 bg-primary/10 text-foreground shadow-[var(--shadow-glow)]"
                : "border-border bg-surface/50 hover:border-primary/30 hover:bg-surface",
            )}
          >
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{option.label}</span>
              {option.hint && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {option.hint}
                </span>
              )}
            </span>
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center transition-all",
                multi ? "rounded-md" : "rounded-full",
                active ? "bg-primary text-primary-foreground scale-100" : "bg-muted scale-90",
              )}
            >
              {active && <Check className="size-3" strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- money ---------- */

export function MoneyField({
  value,
  onChange,
  placeholder,
  quick,
  disabled,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
  quick?: number[];
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-3", disabled && "pointer-events-none opacity-40")}>
      <div className="relative">
        <span className="absolute top-1/2 left-5 -translate-y-1/2 font-display text-xl text-muted-foreground">
          R$
        </span>
        <input
          inputMode="numeric"
          value={value === null ? "" : value.toLocaleString("pt-BR")}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? Number(digits) : null);
          }}
          placeholder={placeholder}
          className="h-16 w-full rounded-2xl border border-input bg-surface/60 pr-5 pl-14 font-display text-2xl outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
      </div>
      {quick && (
        <div className="flex flex-wrap gap-2">
          {quick.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => onChange(amount)}
              className={cn(
                "tap rounded-full border px-3.5 py-2 text-xs transition-all",
                value === amount
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              R$ {amount.toLocaleString("pt-BR")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToggleRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "tap flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm transition-all",
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border bg-surface/40 text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md transition-colors",
          active ? "bg-primary text-primary-foreground" : "bg-muted",
        )}
      >
        {active && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

/* ---------- searchable field ---------- */

export function SearchField({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? suggestions.filter((s) => s.toLowerCase().includes(q)) : suggestions;
    return list.slice(0, 6);
  }, [query, suggestions]);

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="absolute top-1/2 left-5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="h-14 w-full rounded-2xl border border-input bg-surface/60 pr-5 pl-12 text-base outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="animate-[fade-up_0.3s_ease_both] grid gap-1.5">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setQuery(s);
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "tap rounded-xl px-4 py-2.5 text-left text-sm transition-colors",
                value === s
                  ? "bg-primary/12 text-primary"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- skills ---------- */

export function SkillPicker({
  selected,
  onToggle,
  onAdd,
  catalog,
}: {
  selected: SkillEntry[];
  onToggle: (name: string) => void;
  onAdd: (name: string) => void;
  catalog: { group: string; items: string[] }[];
}) {
  const [custom, setCustom] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const names = selected.map((s) => s.name.toLowerCase());
  const catalogNames = catalog.flatMap((g) => g.items.map((i) => i.toLowerCase()));

  function submitCustom() {
    const name = custom.trim();
    if (!name) return;
    if (!names.includes(name.toLowerCase())) onAdd(name);
    setCustom("");
    inputRef.current?.focus();
  }

  const extras = selected.filter((s) => !catalogNames.includes(s.name.toLowerCase()));

  return (
    <div className="space-y-6">
      {catalog.map((group) => (
        <div key={group.group}>
          <p className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {group.group}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => {
              const active = names.includes(item.toLowerCase());
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onToggle(item)}
                  className={cn(
                    "tap rounded-full border px-3.5 py-2 text-sm transition-all",
                    active
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border bg-surface/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <p className="mb-2.5 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Adicionar outra
        </p>
        <div className="flex flex-wrap gap-2">
          {extras.map((s) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 bg-primary/12 px-3.5 py-2 text-sm text-primary"
            >
              {s.name}
              <button
                type="button"
                aria-label={`Remover ${s.name}`}
                onClick={() => onToggle(s.name)}
                className="tap"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2.5 flex gap-2">
          <input
            ref={inputRef}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitCustom();
              }
            }}
            placeholder="Ex: AutoCAD"
            className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-surface/60 px-4 text-base outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10 sm:text-sm"
          />
          <button
            type="button"
            onClick={submitCustom}
            className="tap grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-foreground transition-colors hover:bg-surface-2/70"
            aria-label="Adicionar habilidade"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillLevelList({
  skills,
  onLevel,
}: {
  skills: SkillEntry[];
  onLevel: (name: string, level: SkillLevel) => void;
}) {
  return (
    <div className="space-y-2.5">
      {skills.map((skill, i) => (
        <div
          key={skill.name}
          style={{ animationDelay: `${i * 30}ms` }}
          className="animate-[fade-up_0.4s_cubic-bezier(0.16,1,0.3,1)_both] grid gap-3 rounded-2xl border border-border bg-surface/40 p-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <span className="min-w-0 truncate text-sm font-medium">{skill.name}</span>
          <div className="flex gap-1.5 rounded-full bg-surface-2 p-1">
            {skillLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onLevel(skill.name, level)}
                className={cn(
                  "tap flex-1 rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors sm:flex-none",
                  skill.level === level
                    ? "bg-signal text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- slider ---------- */

export function HoursSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const pct = ((value - 1) / (30 - 1)) * 100;
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-5">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-3xl font-semibold">
          {value % 1 === 0 ? value : value.toFixed(1)}h
        </span>
        <span className="text-xs text-muted-foreground">por semana</span>
      </div>
      <input
        type="range"
        min={1}
        max={30}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Horas de estudo por semana"
        className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[var(--shadow-glow)]"
        style={{
          background: `linear-gradient(to right, var(--primary) ${pct}%, var(--muted) ${pct}%)`,
        }}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Cerca de {(value / 7).toFixed(1)}h por dia — usamos isso para dimensionar cada etapa.
      </p>
    </div>
  );
}

/* ---------- layout ---------- */

export function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}
