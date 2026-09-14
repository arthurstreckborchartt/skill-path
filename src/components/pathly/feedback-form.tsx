import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { Btn } from "./ui";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const KINDS = [
  { id: "bug", label: "Algo quebrou" },
  { id: "ideia", label: "Tenho uma ideia" },
  { id: "outro", label: "Outro" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

type FeedbackRow = {
  user_id: string | null;
  kind: Kind;
  message: string;
  page: string;
};

/**
 * `types.ts` é gerado pelo Lovable a partir do schema e pode ainda não conhecer a tabela
 * `feedback` (criada por `supabase/feedback.sql`, aplicada à mão no painel). Este contrato
 * mínimo descreve só o insert que a tela faz, sem depender do tipo gerado.
 */
type FeedbackClient = {
  from: (table: "feedback") => {
    insert: (row: FeedbackRow) => Promise<{ error: { message: string } | null }>;
  };
};

export function FeedbackForm() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    setStatus("sending");
    const { data } = await supabase.auth.getUser();
    const db = supabase as unknown as FeedbackClient;
    const { error } = await db.from("feedback").insert({
      user_id: data.user?.id ?? null,
      kind,
      message: text,
      page: pathname,
    });

    if (error) {
      setStatus("error");
      return;
    }
    setMessage("");
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="py-4">
        <p className="text-sm text-foreground">Recebido. Obrigado — isso ajuda de verdade.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-2 text-xs text-primary hover:underline"
        >
          Enviar outro
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-3 py-4" onSubmit={handleSubmit}>
      <div className="flex flex-wrap gap-2">
        {KINDS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setKind(option.id)}
            className={cn(
              "tap rounded-full border px-3 py-1.5 text-xs transition-colors",
              kind === option.id
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:border-primary/30",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
        rows={4}
        required
        disabled={status === "sending"}
        placeholder="O que aconteceu, ou o que você queria que existisse?"
        className="w-full resize-none rounded-xl border border-input bg-surface/60 px-4 py-3 text-base outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-4 focus:ring-primary/10 disabled:opacity-60 sm:text-sm"
      />

      {status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          Não deu para enviar agora. Tente de novo em instantes.
        </p>
      )}

      <Btn type="submit" size="sm" disabled={status === "sending" || !message.trim()}>
        <Send className="size-4" /> {status === "sending" ? "Enviando…" : "Enviar"}
      </Btn>
    </form>
  );
}
