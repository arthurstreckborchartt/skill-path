import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { PathlyMark } from "@/components/pathly/project-chat";
import { ProgressBar, Skeleton } from "@/components/pathly/ui";
import { useDigitando } from "@/components/pathly/usar-digitando";
import { criarProjeto, useProjetos, type Projeto } from "@/lib/blueprint/usar-projetos";
import { useContagens, type Contagem } from "@/lib/blueprint/usar-contagem";
import { RESPOSTAS_VAZIAS } from "@/lib/blueprint/respostas";

export const Route = createFileRoute("/app/")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Criar — Pathly" },
      {
        name: "description",
        content: "Conte sua ideia. O Pathly conversa com você e transforma em um projeto real.",
      },
    ],
  }),
  component: TelaInicial,
});

/**
 * A tela inicial: uma pergunta, um campo, e o que você já começou.
 *
 * ## O que ela deixou de ser
 *
 * Era um painel com projetos em chips, projeto atual, progresso, fase, riscos, decisões
 * pendentes, um bloco de IA e um gerador de prompt — 534 linhas. Quem abria o Pathly recebia um
 * relatório e tinha que procurar, dentro dele, por onde começar.
 *
 * Agora a resposta para "o que faço agora?" é a mesma tanto para quem nunca criou nada quanto
 * para quem tem seis projetos: escreva. O que muda é só o que aparece **abaixo** do campo.
 *
 * ## Por que um campo só, e não três
 *
 * A versão anterior pedia ideia, público e problema antes de deixar a pessoa entrar. Três campos
 * em branco na primeira tela é um formulário, e quem chega com uma ideia na cabeça não tem as
 * três respostas prontas — tem a primeira.
 *
 * As outras duas a conversa pergunta, que é o lugar onde elas realmente aparecem. O projeto nasce
 * incompleto de propósito: ele fica completo conversando.
 */
function TelaInicial() {
  const navigate = useNavigate();
  const projetos = useProjetos();
  const [ideia, setIdeia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const { ref: moldura, aoDigitar } = useDigitando();

  useEffect(() => {
    campo.current?.focus();
  }, []);

  async function criar(texto: string) {
    const oQue = texto.trim();
    if (oQue.length < 15 || ocupado) return;
    setOcupado(true);
    setErro(null);

    const r = await criarProjeto({ ...RESPOSTAS_VAZIAS, oQue });
    if ("erro" in r) {
      setErro(r.erro);
      setOcupado(false);
      return;
    }

    /*
     * A frase viaja pelo `sessionStorage` e o chat a envia sozinho ao abrir.
     *
     * Sem isso a pessoa escreveria a ideia aqui e encontraria uma conversa vazia do outro lado,
     * tendo que repetir o que acabou de dizer. A chave é apagada só depois do envio confirmado —
     * foi um bug real em 2026-09-19.
     */
    window.sessionStorage.setItem(`pathly.project.prompt.${r.id}`, oQue);
    void navigate({ to: "/app/projeto/$id", params: { id: r.id } });
  }

  const recentes = projetos.estado === "pronta" ? projetos.projetos.slice(0, 6) : [];
  // Uma consulta para todos os recentes, em vez de uma por cartao.
  const contagens = useContagens(recentes);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-14rem)] max-w-2xl flex-col justify-center py-6">
      <section className="text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-border bg-foreground text-background">
          <PathlyMark className="size-5" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-balance sm:text-4xl">
          O que vamos criar?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Site, aplicação web, app de celular ou de computador. Conte a ideia — o resto a gente
          descobre conversando.
        </p>

        <div
          ref={moldura}
          className="chat-composer-frame mt-7 text-left shadow-[var(--shadow-lift)]"
          data-processing={ocupado ? "true" : undefined}
        >
          <PromptInput onSubmit={({ text }) => void criar(text)}>
            <PromptInputTextarea
              ref={campo}
              value={ideia}
              onChange={(e) => {
                setIdeia(e.target.value);
                aoDigitar();
              }}
              placeholder="Um app para donos de food truck controlarem estoque e vendas do dia…"
              className="min-h-24 text-base"
              disabled={ocupado}
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                status={ocupado ? "submitted" : "ready"}
                disabled={ideia.trim().length < 15 || ocupado}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>

        {erro && (
          <p role="alert" className="mt-3 text-sm font-medium">
            {erro}
          </p>
        )}
      </section>

      {/*
        Os projetos vêm abaixo e só quando existem. A tela de quem nunca criou nada não tem uma
        seção vazia dizendo "nenhum projeto" — ela tem só a pergunta, que é a resposta certa.
      */}
      {projetos.estado === "carregando" && (
        <div className="mt-12 space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {recentes.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Continuar
            </p>
            {projetos.estado === "pronta" && projetos.projetos.length > recentes.length && (
              <Link
                to="/app/blueprints"
                className="tap text-xs text-muted-foreground hover:text-foreground"
              >
                ver todos ({projetos.projetos.length})
              </Link>
            )}
          </div>
          <div className="mt-3 space-y-1.5">
            {recentes.map((p) => (
              <CartaoDeProjeto key={p.id} projeto={p} contagem={contagens?.get(p.id) ?? null} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Um projeto na lista: nome, progresso e quando foi mexido pela última vez.
 *
 * Três informações, e nenhuma métrica além delas. A pergunta que esta lista responde é "qual
 * deles eu continuo?" — e para isso basta saber em qual você estava e quanto falta.
 */
function CartaoDeProjeto({
  projeto,
  contagem,
}: {
  projeto: Projeto;
  /**
   * `null` enquanto a contagem não chegou.
   *
   * A barra some nesse intervalo em vez de mostrar 0%. Um zero antes do dado é uma resposta
   * errada — a pessoa lê "não fiz nada" quando a verdade é "ainda não sei".
   *
   * Não uso `projeto.etapasConcluidas`: a coluna do banco não é atualizada quando alguém conclui
   * uma etapa, e num projeto real ela dizia 0 com duas etapas feitas. Ver `useContagens`.
   */
  contagem: Contagem | null;
}) {
  return (
    <Link
      to="/app/projeto/$id"
      params={{ id: projeto.id }}
      className="tap block rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-foreground/25 hover:bg-surface-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm font-medium">{projeto.nome}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {quando(projeto.atualizadoEm)}
        </span>
      </div>
      {contagem && contagem.total > 0 && (
        <div className="mt-2 flex items-center gap-2.5">
          <ProgressBar value={contagem.pct} className="h-1" />
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {contagem.feitas}/{contagem.total}
          </span>
        </div>
      )}
    </Link>
  );
}

/**
 * "hoje", "ontem", "há 3 dias" — e a data quando passa de uma semana.
 *
 * Distância no tempo, e não carimbo: quem olha esta lista quer saber o que estava fazendo
 * recentemente, não em que dia do mês foi.
 */
function quando(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
