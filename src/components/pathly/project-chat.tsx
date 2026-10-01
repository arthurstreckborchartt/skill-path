import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronUp, FileCode, ShieldCheck } from "lucide-react";
import { CartaoChamada } from "./cartao-chamada";
import { BotaoEnviar } from "./botao-enviar";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { BlocoCopiavel } from "@/components/pathly/banco-vistas";
import { Btn, Chip } from "@/components/pathly/ui";
import { useDigitando } from "@/components/pathly/usar-digitando";
import { WordsStagger } from "@/components/ui/words-stagger";
import { useCopilot } from "@/lib/copilot/usar-copilot";
import { rotear } from "@/lib/copilot/roteador";
import { PARTES, facetaDaParte, type SlugDeParte } from "./partes";
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

export function ProjectChat({
  projetoId,
  parteAberta,
  aoMudarAssunto,
}: {
  projetoId: string;
  /**
   * A parte que está aberta ao lado, quando há uma.
   *
   * Vira a `facetaDaTela` do roteador. Sem isso o chat mandava `"produto"` fixo, e uma pergunta
   * feita olhando o painel de Dados chegava ao modelo como se fosse sobre funcionalidades — o que
   * quebrava justamente as perguntas curtas que dependem do contexto, como "e isso aqui?".
   */
  parteAberta?: SlugDeParte | null;
  /**
   * A última coisa que a pessoa escreveu, avisada para fora.
   *
   * Existe para o painel de contexto da direita saber sobre o que a conversa está. A alternativa
   * seria a página chamar `useCopilot` também, e aí seriam duas leituras da mesma conversa — duas
   * requisições e duas verdades sobre qual é a última mensagem.
   */
  aoMudarAssunto?: (pergunta: string | null) => void;
}) {
  const { estado, perguntar, aprovar, rejeitar, carregarMais } = useCopilot(
    projetoId,
    facetaDaParte(parteAberta),
  );
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<Modo | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { ref: moldura, aoDigitar } = useDigitando();

  /*
   * Quais mensagens ja estavam na tela quando ela abriu.
   *
   * Sem isto, abrir um projeto com 22 mensagens anima as 22 de uma vez — o historico inteiro
   * subindo junto, somado a animacao de entrada da propria rota. O efeito e para o que acabou de
   * chegar, nao para o que ja estava la.
   *
   * Preenchido no primeiro render em que o carregamento terminou. Escrever num ref durante o
   * render e seguro aqui porque e idempotente: so acontece enquanto o valor for `null`.
   */
  const jaEstavam = useRef<Set<string> | null>(null);
  if (jaEstavam.current === null && !estado.carregando) {
    jaEstavam.current = new Set(estado.mensagens.map((m) => m.id));
  }
  const chegouAgora = (id: string) => jaEstavam.current !== null && !jaEstavam.current.has(id);

  useEffect(() => {
    if (!estado.respondendo) inputRef.current?.focus();
  }, [estado.respondendo]);

  /*
   * A última pergunta da pessoa, avisada para fora quando muda.
   *
   * A do usuário e não a resposta do Pathly: o assunto de uma conversa é o que **ela** trouxe. A
   * resposta fala do mesmo assunto por definição, e rotear por ela só acrescentaria as palavras
   * que o modelo escolheu.
   */
  const ultimaPergunta =
    [...estado.mensagens].reverse().find((m) => m.papel === "usuario")?.texto ?? null;

  useEffect(() => {
    aoMudarAssunto?.(ultimaPergunta);
  }, [ultimaPergunta, aoMudarAssunto]);

  /*
   * A primeira mensagem do projeto, vinda da tela de criação pelo `sessionStorage`.
   *
   * ## O que estava errado
   *
   * A versão anterior apagava a chave **antes** de enviar. Quando o envio não ia até o fim — e
   * isso acontecia: reproduzi a tela vazia com zero chamadas ao `/api/copilot` e a chave já
   * consumida — a ideia que a pessoa escreveu sumia para sempre, sem erro, sem aviso. Ela criava
   * o projeto, chegava no chat e encontrava a tela de boas-vindas como se nada tivesse digitado.
   *
   * Não fui atrás da causa exata da desistência no meio do caminho. Fui atrás da propriedade que
   * transformava um tropeço em perda definitiva: **consumir antes de confirmar**.
   *
   * ## O que vale agora
   *
   * A chave só sai do `sessionStorage` depois que `perguntar` confirma que respondeu. Se falhar, a
   * pergunta continua guardada e a próxima montagem tenta de novo — recarregar a página resolve,
   * em vez de perder. O `enviando` impede duas tentativas ao mesmo tempo, já que este efeito
   * reexecuta a cada mudança de estado.
   */
  const enviando = useRef(false);

  useEffect(() => {
    if (estado.carregando) return;

    const key = `pathly.project.prompt.${projetoId}`;
    const pending = window.sessionStorage.getItem(key);
    if (!pending) return;

    /*
     * Conversa já tem mensagem: a pergunta guardada chegou ao destino, então a chave sai.
     *
     * Isso acontece de verdade, e é o outro lado da moeda de só apagar depois de confirmar. A
     * instância que dispara o envio na criação do projeto costuma morrer na transição de rota —
     * a requisição vai até o fim e o servidor grava, mas o `.then` dela nunca roda. Quem monta
     * depois carrega a conversa pronta do banco e encontra a chave órfã aqui.
     *
     * Sem esta limpeza a chave ficaria para sempre, esperando uma conversa vazia que não volta.
     */
    if (estado.mensagens.length > 0) {
      window.sessionStorage.removeItem(key);
      return;
    }

    if (estado.respondendo || enviando.current) return;

    enviando.current = true;
    void perguntar(pending, "guiar")
      .then((enviou) => {
        if (enviou) window.sessionStorage.removeItem(key);
      })
      .finally(() => {
        enviando.current = false;
      });
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
              Planejamento e execução do seu produto
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
                  {/*
                    O texto se forma palavra a palavra. Aparece uma vez por projeto, na tela vazia
                    — não no histórico: o efeito é boas-vindas, e boas-vindas que se repetem a cada
                    rolagem viram tique.
                  */}
                  <WordsStagger
                    className="mt-4 justify-center font-display text-2xl font-semibold"
                    stagger={0.07}
                  >
                    Vamos construir isto
                  </WordsStagger>
                  <WordsStagger
                    className="mx-auto mt-2 max-w-lg justify-center text-sm leading-relaxed text-muted-foreground"
                    delay={0.35}
                    stagger={0.018}
                    speed={0.4}
                  >
                    Conte o que precisa existir, o que já decidiu ou onde travou. O Pathly organiza
                    o plano e pede sua confirmação antes de qualquer mudança.
                  </WordsStagger>
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
                <ChatMessage
                  key={mensagem.id}
                  mensagem={mensagem}
                  projetoId={projetoId}
                  animar={chegouAgora(mensagem.id)}
                />
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
        {/*
          O `rounded-lg` saiu: quem manda no arredondamento agora é `--composer-radius`, no CSS,
          para o anel e o campo nunca discordarem do raio.
        */}
        <div
          ref={moldura}
          className="chat-composer-frame mx-auto max-w-3xl"
          data-processing={estado.respondendo ? "true" : undefined}
        >
          {/* Sem `className`: quem estiliza a caixa e o CSS da moldura. A `className` do
              `PromptInput` vai para o <form>, que nao tem raio — pintar fundo ali cobria o anel
              nas quinas e deixava a caixa com cantos quadrados. */}
          <PromptInput onSubmit={({ text }) => enviar(text)}>
            <PromptInputTextarea
              ref={inputRef}
              autoFocus
              value={texto}
              onChange={(event) => {
                setTexto(event.target.value);
                aoDigitar();
              }}
              maxLength={2000}
              placeholder={
                parteAberta
                  ? `Pergunte sobre ${PARTES.find((p) => p.slug === parteAberta)?.rotulo.toLowerCase() ?? "este projeto"}…`
                  : "Pergunte qualquer coisa sobre seu projeto…"
              }
              className="min-h-24"
            />
            <PromptInputFooter>
              <PromptInputTools>
                {/*
                  O que a pergunta vai levar junto, dito em voz alta.

                  Com um painel aberto, o servidor já recebe aquela faceta como contexto — mas
                  isso acontecia em silêncio, e a pessoa não tinha como saber que "e isso aqui?"
                  ia ser entendido. A etiqueta transforma um comportamento invisível em promessa.

                  Sem painel aberto ela não aparece: não há o que prometer.
                */}
                {parteAberta && (
                  <span className="mr-1 rounded-md bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground">
                    sobre {PARTES.find((p) => p.slug === parteAberta)?.rotulo.toLowerCase()}
                  </span>
                )}
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
              <BotaoEnviar
                carregando={estado.respondendo}
                desabilitado={estado.respondendo || !texto.trim()}
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
  projetoId,
  animar,
}: {
  mensagem: { papel: string; texto: string; resposta: RespostaCopilot | null };
  projetoId: string;
  /** `false` para o que ja estava na tela quando ela abriu. */
  animar: boolean;
}) {
  const entrada = animar ? "entra-mensagem" : undefined;
  if (mensagem.papel === "usuario") {
    return (
      <Message from="user" className={entrada}>
        <MessageContent className="bg-foreground text-background">{mensagem.texto}</MessageContent>
      </Message>
    );
  }

  const resposta = mensagem.resposta;
  if (!resposta)
    return (
      <Message from="assistant" className={entrada}>
        <MessageContent>
          <MessageResponse>{mensagem.texto}</MessageResponse>
        </MessageContent>
      </Message>
    );

  return (
    /*
      A animacao roda uma vez, no nascimento do no. Como a chave do React e o `id` da mensagem, o
      historico nao reanima a cada render — so o que acabou de chegar se move.
    */
    <Message from="assistant" className={entrada}>
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
        {/*
          `?? []` e não `.length`: mensagens gravadas antes desta versão não têm o campo. A resposta
          inteira é persistida como JSON, então o histórico guarda o formato do dia em que foi
          escrito — e uma conversa antiga não pode quebrar a tela por isso.
        */}
        {(resposta.chamadasSugeridas ?? []).map((chamada, i) => (
          <CartaoChamada key={`${chamada.ferramenta}-${i}`} chamada={chamada} />
        ))}
        <AcoesDaResposta resposta={resposta} projetoId={projetoId} />
      </MessageContent>
    </Message>
  );
}

/**
 * Os atalhos no pé de uma resposta.
 *
 * ## De onde eles vêm, e por que não do modelo
 *
 * A tentação era pedir ao modelo uma lista de ações junto da resposta. Seria pior: um botão
 * inventado leva a lugar nenhum, e "[Adicionar ao roadmap]" que não adiciona nada é a forma mais
 * cara de perder confiança — pior que não ter botão.
 *
 * Então o atalho sai de `rotear()`, rodando sobre o que o Pathly acabou de escrever. Se a
 * resposta é sobre banco, o botão abre Dados. A faceta é calculada, não inventada, e por isso o
 * botão sempre vai para onde diz que vai.
 *
 * ## Um só
 *
 * Uma fileira de botões no pé de toda resposta viraria ruído na trigésima mensagem. Um atalho,
 * quando existe um assunto claro, e nada quando não existe.
 */
function AcoesDaResposta({
  resposta,
  projetoId,
}: {
  resposta: RespostaCopilot;
  projetoId: string;
}) {
  const texto = resposta.blocos.join(" ");
  if (texto.trim().length < 20) return null;

  const faceta = rotear(texto).facetas[0];
  const parte = faceta ? PARTES.find((p) => p.faceta === faceta) : undefined;
  if (!parte) return null;

  return (
    <Link
      to="/app/projeto/$id"
      params={{ id: projetoId }}
      search={{ parte: parte.slug }}
      className="tap inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
    >
      <parte.icone className="size-3.5" />
      Ver {parte.rotulo.toLowerCase()}
    </Link>
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
    <div className="entra-mensagem rounded-md border border-foreground/20 bg-surface-2 p-4">
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
