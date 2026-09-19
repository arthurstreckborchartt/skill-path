import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Check, ChevronUp, FileCode, MessageSquare, X, type LucideIcon } from "lucide-react";
import { Btn, Chip } from "./ui";
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
import { BlocoCopiavel } from "./banco-vistas";
import { GeradorDePrompt } from "./gerador-de-prompt";
import { cn } from "@/lib/utils";
import { useCopilot } from "@/lib/copilot/usar-copilot";
import {
  MODO_ROTULO,
  ROTULO_TIPO_PROPOSTA,
  type Modo,
  type Proposta,
} from "@/lib/copilot/contrato";
import type { Faceta } from "@/lib/copilot/roteador";

/**
 * O Copilot: botão flutuante e painel lateral.
 *
 * ## Por que ele mora fora do `<main>`
 *
 * O `<main>` do app roda uma animação de entrada com `transform`. Enquanto ela corre, qualquer
 * `position: fixed` lá dentro passa a se posicionar em relação ao `<main>`, não à janela — o
 * botão flutuante "pularia" a cada troca de rota. Montar como irmão resolve sem depender de a
 * animação já ter terminado.
 *
 * ## Por que ele sabe onde você está
 *
 * A rota diz o projeto e o assunto. É isso que faz "não entendi essa parte" funcionar: a fatia da
 * tela atual entra no contexto mesmo quando a pergunta não menciona o assunto.
 */

/** Das rotas de projeto para o assunto. O que não estiver aqui não mostra o Copilot. */
const FACETA_POR_ROTA: { prefixo: string; faceta: Faceta; onde: string }[] = [
  { prefixo: "/app/banco/", faceta: "banco", onde: "Banco de dados" },
  { prefixo: "/app/api/", faceta: "api", onde: "API" },
  { prefixo: "/app/seguranca/", faceta: "seguranca", onde: "Segurança" },
  { prefixo: "/app/arquitetura-ia/", faceta: "ia", onde: "Arquitetura de IA" },
  { prefixo: "/app/roadmap/", faceta: "roadmap", onde: "Roadmap" },
  { prefixo: "/app/blueprint/", faceta: "produto", onde: "Plano do projeto" },
];

function PathlyMark({ className }: { className?: string }) {
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

function lerRota(pathname: string): { projetoId: string; faceta: Faceta; onde: string } | null {
  for (const r of FACETA_POR_ROTA) {
    if (!pathname.startsWith(r.prefixo)) continue;
    const id = pathname.slice(r.prefixo.length).split("/")[0];
    if (id) return { projetoId: id, faceta: r.faceta, onde: r.onde };
  }
  return null;
}

export function Copilot() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const rota = lerRota(pathname);
  const [aberto, setAberto] = useState(false);

  // Trocar de projeto com o painel aberto mostraria a conversa de um projeto no cabeçalho de
  // outro pelo tempo do carregamento. Fechar é mais honesto que mostrar o errado.
  useEffect(() => {
    setAberto(false);
  }, [rota?.projetoId]);

  if (!rota) return null;

  return (
    <>
      {!aberto && (
        <button
          onClick={() => setAberto(true)}
          aria-label="Abrir o copiloto"
          className="tap fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex size-12 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-[var(--shadow-lift)] lg:right-6 lg:bottom-6"
        >
          <PathlyMark className="size-5" />
        </button>
      )}

      {aberto && <Painel rota={rota} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function Painel({
  rota,
  aoFechar,
}: {
  rota: { projetoId: string; faceta: Faceta; onde: string };
  aoFechar: () => void;
}) {
  const { estado, perguntar, aprovar, rejeitar, carregarMais } = useCopilot(
    rota.projetoId,
    rota.faceta,
  );
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<Modo | undefined>(undefined);
  const [vista, setVista] = useState<"conversa" | "prompt">("conversa");
  function enviar(pergunta: string, comModo?: Modo) {
    const t = pergunta.trim();
    if (!t) return;
    setTexto("");
    void perguntar(t, comModo ?? modo);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar o copiloto"
        onClick={aoFechar}
        className="absolute inset-0 bg-foreground/20"
      />

      <aside className="relative flex h-full w-full max-w-[30rem] flex-col border-l border-border bg-background shadow-[var(--shadow-lift)]">
        <header className="border-b border-border px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <PathlyMark className="size-4 text-foreground" />
                Copilot · {estado.nomeProjeto || "carregando…"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Você está em: {rota.onde} · Progresso: {estado.progresso}%
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {/*
                Acesso permanente ao gerador. Antes ele só aparecia na tela de conversa vazia, e
                bastava mandar uma mensagem para o recurso sumir — justamente o recurso que a
                pessoa mais vai querer depois de conversar sobre o que fazer.
              */}
              <button
                onClick={() => setVista(vista === "prompt" ? "conversa" : "prompt")}
                aria-label="Gerar prompt de implementação"
                title="Gerar prompt de implementação"
                className={cn(
                  "tap rounded-lg p-1.5 transition-colors",
                  vista === "prompt" ? "bg-surface-2 text-foreground" : "text-muted-foreground",
                )}
              >
                <FileCode className="size-4.5" />
              </button>
              <button onClick={aoFechar} aria-label="Fechar" className="tap -mr-1 p-1">
                <X className="size-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {estado.proximoPasso && !estado.proximoPasso.concluido && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/80">Próximo passo:</span>{" "}
              {estado.proximoPasso.titulo}
            </p>
          )}
        </header>

        <div className="min-h-0 flex flex-1 flex-col">
          {vista === "prompt" && estado.blueprint ? (
            <GeradorDePrompt
              fontes={{
                nomeProjeto: estado.nomeProjeto,
                blueprint: estado.blueprint,
                modelo: estado.modelo,
                api: estado.api,
                decisoes: estado.decisoes,
                estadoBanco: null,
                jaExiste: estado.jaExiste,
                etapaAtual: estado.etapaAtual,
                qtdEtapasConcluidas: estado.etapasConcluidas,
                progresso: estado.progresso,
              }}
              aoVoltar={() => setVista("conversa")}
            />
          ) : estado.carregando ? (
            <div className="p-4 text-sm">
              <Shimmer>Carregando o contexto…</Shimmer>
            </div>
          ) : (
            <Conversation>
              <ConversationContent className="gap-5 p-4">
                {estado.anteriorA && (
                  <button
                    onClick={() => void carregarMais()}
                    className="tap mx-auto mb-4 flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-muted-foreground"
                  >
                    <ChevronUp className="size-3" /> Mensagens anteriores
                  </button>
                )}

                {estado.mensagens.length === 0 && (
                  <Abertura
                    passo={estado.proximoPasso}
                    aoPedir={enviar}
                    aoGerarPrompt={() => setVista("prompt")}
                  />
                )}

                {estado.propostas.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {estado.propostas.map((p) => (
                      <CartaoProposta
                        key={p.id}
                        proposta={p}
                        aoAprovar={() => void aprovar(p)}
                        aoRejeitar={() => void rejeitar(p)}
                      />
                    ))}
                  </div>
                )}

                {estado.mensagens.map((m) => (
                  <Mensagem key={m.id} mensagem={m} />
                ))}

                {estado.respondendo && (
                  <Shimmer className="text-sm">Pensando sobre o seu projeto…</Shimmer>
                )}

                {estado.erro && <p className="mt-4 text-sm text-destructive">{estado.erro}</p>}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          )}
        </div>

        <footer className="border-t border-border px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <PromptInput
            onSubmit={({ text }) => enviar(text)}
            className="[&_[data-slot=input-group]]:bg-surface"
          >
            <PromptInputTextarea
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              maxLength={2000}
              placeholder="Pergunte sobre o seu projeto…"
              className="min-h-20"
            />
            <PromptInputFooter>
              <PromptInputTools>
                {(["explicar", "guiar", "gerar"] as const).map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => setModo(modo === x ? undefined : x)}
                    className={cn(
                      "tap rounded-md px-2 py-1 text-[11px] transition-colors",
                      modo === x
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    {MODO_ROTULO[x]}
                  </button>
                ))}
              </PromptInputTools>
              <PromptInputSubmit
                status={estado.respondendo ? "submitted" : "ready"}
                disabled={estado.respondendo || !texto.trim()}
              />
            </PromptInputFooter>
          </PromptInput>
        </footer>
      </aside>
    </div>
  );
}

/** A tela vazia não pergunta "como posso ajudar?": ela oferece o passo que o app já calculou. */
function Abertura({
  passo,
  aoPedir,
  aoGerarPrompt,
}: {
  passo: { titulo: string; porque: string; concluido: boolean } | null;
  aoPedir: (p: string, modo?: Modo) => void;
  aoGerarPrompt: () => void;
}) {
  if (!passo) return null;

  const atalhos: { rotulo: string; icone: LucideIcon; modo: Modo; pergunta: string }[] = [
    {
      rotulo: "Entender",
      icone: MessageSquare,
      modo: "explicar",
      pergunta: `Me explique, no contexto do meu projeto: ${passo.titulo}`,
    },
    {
      rotulo: "Começar",
      icone: Check,
      modo: "guiar",
      pergunta: `Quero fazer isto agora: ${passo.titulo}. Me mostre os passos.`,
    },
  ];

  return (
    <div className="mb-4 rounded-xl border border-border bg-surface/50 p-4">
      <p className="text-sm font-medium">{passo.titulo}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{passo.porque}</p>

      {!passo.concluido && (
        <div className="mt-3 flex flex-wrap gap-2">
          {atalhos.map((a) => (
            <button
              key={a.rotulo}
              onClick={() => aoPedir(a.pergunta, a.modo)}
              className="tap flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30"
            >
              <a.icone className="size-3" /> {a.rotulo}
            </button>
          ))}
          {/* Gerar prompt nao passa por IA: e uma tela, montada por codigo. */}
          <button
            onClick={aoGerarPrompt}
            className="tap flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/30"
          >
            <FileCode className="size-3" /> Gerar prompt
          </button>
        </div>
      )}
    </div>
  );
}

function Mensagem({ mensagem }: { mensagem: { papel: string; texto: string; resposta: unknown } }) {
  if (mensagem.papel === "usuario") {
    return (
      <Message from="user">
        <MessageContent className="bg-foreground text-background">{mensagem.texto}</MessageContent>
      </Message>
    );
  }

  const r = mensagem.resposta as {
    blocos: string[];
    passos: { titulo: string; detalhe: string; comoValidar: string }[];
    artefato: { titulo: string; conteudo: string } | null;
    proximoPasso: string;
    alertaComplexidade: string | null;
  } | null;

  if (!r) {
    return (
      <Message from="assistant">
        <MessageContent>
          <MessageResponse>{mensagem.texto}</MessageResponse>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant">
      <MessageContent className="w-full space-y-3">
        {r.blocos.map((b, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground/90">
            {b}
          </p>
        ))}

        {/* `list-none` no <ol>: a numeração é desenhada por nós, no título. Com o marcador da lista
          ligado, saía "1. 1. Inserir a venda". */}
        {r.passos.length > 0 && (
          <ol className="list-none space-y-2.5">
            {r.passos.map((p, i) => (
              <li key={i} className="rounded-xl border border-border bg-surface/40 p-3">
                <p className="text-sm font-medium">
                  {i + 1}. {p.titulo}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/80">{p.detalhe}</p>
                <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-primary">
                  <Check className="mt-0.5 size-3 shrink-0" />
                  {p.comoValidar}
                </p>
              </li>
            ))}
          </ol>
        )}

        {r.artefato && <BlocoCopiavel texto={r.artefato.conteudo} rotulo={r.artefato.titulo} />}

        {r.alertaComplexidade && (
          <p className="rounded-lg border border-destructive/25 bg-destructive/[0.03] p-3 text-xs leading-relaxed text-foreground/85">
            {r.alertaComplexidade}
          </p>
        )}

        {r.proximoPasso && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/70">Depois disto:</span> {r.proximoPasso}
          </p>
        )}
      </MessageContent>
    </Message>
  );
}

/**
 * O cartão de proposta.
 *
 * Mostra o antes e o depois antes dos botões, de propósito: aprovar sem ver o que muda é o mesmo
 * que não confirmar nada, e o passo de confirmação existe justamente para não virar um clique
 * automático.
 */
function CartaoProposta({
  proposta,
  aoAprovar,
  aoRejeitar,
}: {
  proposta: Proposta;
  aoAprovar: () => void;
  aoRejeitar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  const emTexto = (v: unknown) =>
    typeof v === "string" ? v : v === null || v === undefined ? "—" : JSON.stringify(v);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="primary">{ROTULO_TIPO_PROPOSTA[proposta.tipo] ?? proposta.tipo}</Chip>
        <p className="text-sm font-medium">{proposta.titulo}</p>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-foreground/85">{proposta.motivo}</p>

      {proposta.campoAfetado && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-mono">{proposta.campoAfetado}</span>: {emTexto(proposta.valorAtual)}{" "}
          → <span className="text-primary">{emTexto(proposta.valorProposto)}</span>
        </p>
      )}

      {proposta.impactos.length > 0 && (
        <ul className="mt-2 space-y-1">
          {proposta.impactos.map((x, i) => (
            <li key={i} className="text-xs leading-relaxed text-muted-foreground">
              · {x}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex gap-2">
        <Btn
          size="sm"
          disabled={ocupado}
          onClick={() => {
            setOcupado(true);
            aoAprovar();
          }}
        >
          Aprovar
        </Btn>
        <Btn
          variant="ghost"
          size="sm"
          disabled={ocupado}
          onClick={() => {
            setOcupado(true);
            aoRejeitar();
          }}
        >
          Agora não
        </Btn>
      </div>
    </div>
  );
}
