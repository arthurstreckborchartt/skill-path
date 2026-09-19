import { useEffect, useRef, useState } from "react";
import { Check, ChevronUp, FileCode, ShieldCheck } from "lucide-react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { BlocoCopiavel } from "@/components/pathly/banco-vistas";
import { Btn, Chip } from "@/components/pathly/ui";
import { useCopilot } from "@/lib/copilot/usar-copilot";
import {
  MODO_ROTULO,
  ROTULO_TIPO_PROPOSTA,
  type Modo,
  type Proposta,
  type RespostaCopilot,
} from "@/lib/copilot/contrato";
import { cn } from "@/lib/utils";

export function PathlyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M5 19c0-5 4-5 6-7s1-6-1-7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="18" cy="6.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

export function ProjectChat({ projetoId }: { projetoId: string }) {
  const { estado, perguntar, aprovar, rejeitar, carregarMais } = useCopilot(projetoId, "produto");
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<Modo | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!estado.respondendo) inputRef.current?.focus();
  }, [estado.respondendo]);

  useEffect(() => {
    if (estado.carregando || estado.respondendo || estado.mensagens.length > 0) return;
    const key = `pathly.project.prompt.${projetoId}`;
    const pending = window.sessionStorage.getItem(key);
    if (!pending) return;
    window.sessionStorage.removeItem(key);
    void perguntar(pending, "guiar");
  }, [estado.carregando, estado.mensagens.length, estado.respondendo, perguntar, projetoId]);

  function enviar(pergunta: string, comModo?: Modo) {
    const limpa = pergunta.trim();
    if (!limpa || estado.respondendo) return;
    setTexto("");
    void perguntar(limpa, comModo ?? modo);
  }

  return (
    <section className="flex min-h-[calc(100svh-9rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-soft)] lg:min-h-[calc(100svh-8rem)]">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-foreground text-background">
            <PathlyMark className="size-4" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{estado.nomeProjeto || "Projeto"}</h1>
            <p className="truncate text-xs text-muted-foreground">
              Planejamento e execução do seu SaaS
            </p>
          </div>
        </div>
        <Chip tone="muted">
          <ShieldCheck className="size-3" /> Ações exigem aprovação
        </Chip>
      </header>

      <div className="min-h-0 flex-1">
        {estado.carregando ? (
          <div className="p-6">
            <Shimmer>Carregando o contexto do projeto…</Shimmer>
          </div>
        ) : (
          <Conversation>
            <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-4 py-8 sm:px-6">
              {estado.anteriorA && (
                <Btn
                  variant="ghost"
                  size="sm"
                  className="mx-auto"
                  onClick={() => void carregarMais()}
                >
                  <ChevronUp className="size-3.5" /> Mensagens anteriores
                </Btn>
              )}

              {estado.mensagens.length === 0 && (
                <div className="py-10 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-surface-2">
                    <PathlyMark className="size-5" />
                  </span>
                  <h2 className="mt-4 font-display text-2xl font-semibold">
                    Vamos construir este SaaS
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                    Conte o que precisa existir, o que já decidiu ou onde travou. O Pathly organiza
                    o plano e pede sua confirmação antes de qualquer mudança.
                  </p>
                </div>
              )}

              {estado.propostas.map((proposta) => (
                <ProposalCard
                  key={proposta.id}
                  proposta={proposta}
                  onApprove={() => void aprovar(proposta)}
                  onReject={() => void rejeitar(proposta)}
                />
              ))}

              {estado.mensagens.map((mensagem) => (
                <ChatMessage key={mensagem.id} mensagem={mensagem} />
              ))}

              {estado.respondendo && (
                <Shimmer className="text-sm">Organizando o próximo passo…</Shimmer>
              )}
              {estado.erro && (
                <p role="alert" className="text-sm text-destructive">
                  {estado.erro}
                </p>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}
      </div>

      <footer className="border-t border-border bg-background/70 p-3 sm:p-4">
        <div className="chat-composer-frame mx-auto max-w-3xl rounded-lg p-px">
          <PromptInput
            onSubmit={({ text }) => enviar(text)}
            className="border-0 bg-surface shadow-none"
          >
            <PromptInputTextarea
              ref={inputRef}
              autoFocus
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              maxLength={2000}
              placeholder="Descreva o que quer criar ou mudar…"
              className="min-h-24"
            />
            <PromptInputFooter>
              <PromptInputTools>
                {(["explicar", "guiar", "gerar"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setModo(modo === item ? undefined : item)}
                    className={cn(
                      "tap rounded-md px-2 py-1 text-[11px] transition-colors",
                      modo === item
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {MODO_ROTULO[item]}
                  </button>
                ))}
              </PromptInputTools>
              <PromptInputSubmit
                status={estado.respondendo ? "submitted" : "ready"}
                disabled={estado.respondendo || !texto.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </footer>
    </section>
  );
}

function ChatMessage({
  mensagem,
}: {
  mensagem: { papel: string; texto: string; resposta: RespostaCopilot | null };
}) {
  if (mensagem.papel === "usuario") {
    return (
      <Message from="user">
        <MessageContent className="bg-foreground text-background">{mensagem.texto}</MessageContent>
      </Message>
    );
  }

  const resposta = mensagem.resposta;
  if (!resposta)
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{mensagem.texto}</MessageResponse>
        </MessageContent>
      </Message>
    );

  return (
    <Message from="assistant">
      <MessageContent className="w-full space-y-4">
        {resposta.blocos.map((bloco, index) => (
          <MessageResponse key={index}>{bloco}</MessageResponse>
        ))}
        {resposta.passos.length > 0 && (
          <ol className="space-y-2">
            {resposta.passos.map((passo, index) => (
              <li
                key={`${passo.titulo}-${index}`}
                className="rounded-md border border-border bg-surface-2/50 p-3"
              >
                <p className="text-sm font-medium">
                  {index + 1}. {passo.titulo}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {passo.detalhe}
                </p>
                <p className="mt-2 flex gap-1.5 text-xs text-foreground/75">
                  <Check className="mt-0.5 size-3 shrink-0" />
                  {passo.comoValidar}
                </p>
              </li>
            ))}
          </ol>
        )}
        {resposta.artefato && (
          <BlocoCopiavel texto={resposta.artefato.conteudo} rotulo={resposta.artefato.titulo} />
        )}
        {resposta.proximoPasso && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Próximo passo:</span>{" "}
            {resposta.proximoPasso}
          </p>
        )}
      </MessageContent>
    </Message>
  );
}

function ProposalCard({
  proposta,
  onApprove,
  onReject,
}: {
  proposta: Proposta;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border border-foreground/20 bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="primary">{ROTULO_TIPO_PROPOSTA[proposta.tipo]}</Chip>
        <p className="text-sm font-semibold">{proposta.titulo}</p>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{proposta.motivo}</p>
      {proposta.impactos.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Impacta: {proposta.impactos.join(" · ")}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Btn
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onApprove();
          }}
        >
          Aprovar mudança
        </Btn>
        <Btn
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            onReject();
          }}
        >
          Rejeitar
        </Btn>
      </div>
    </div>
  );
}
