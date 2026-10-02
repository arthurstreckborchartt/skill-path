import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { BotaoEnviar } from "@/components/pathly/botao-enviar";
import { Pensando } from "@/components/pathly/pensando";
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

  /*
   * O foco automático é só no desktop.
   *
   * No celular, focar ao montar abre o teclado antes de a pessoa ter lido qualquer coisa: ele come
   * metade da tela, tapa a lista de projetos e transforma "o que vamos criar?" numa pergunta feita
   * para uma tela que já sumiu. Quem chegou para continuar um projeto tem que fechar o teclado
   * antes de conseguir enxergar a lista.
   *
   * No desktop não há esse custo — o cursor já piscando poupa um clique e não esconde nada.
   *
   * `1024px` é o mesmo ponto em que o layout troca (`lg:`), então foco e forma mudam juntos.
   */
  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) campo.current?.focus();
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

  /*
   * Três, e não seis.
   *
   * A lista deixou de ficar abaixo da dobra e passou a dividir a tela com a pergunta. Seis cartões
   * somam ~400px e espremeriam justamente o que a tela existe para fazer. Três respondem "qual eu
   * continuo?" — e quem quer os outros tem a coluna da esquerda, que lista todos, e o "ver todos".
   */
  const recentes = projetos.estado === "pronta" ? projetos.projetos.slice(0, 3) : [];
  // Uma consulta para todos os recentes, em vez de uma por cartao.
  const contagens = useContagens(recentes);

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center">
      {/*
        A primeira dobra: a pergunta no meio, o campo embaixo.

        No celular o campo encosta no fim da tela, onde o polegar alcança sem reposicionar a mão —
        e a pergunta ocupa o espaço que sobra em cima, em vez de os dois flutuarem juntos no meio
        com um terço da tela vazio embaixo. Medido antes: 331px de sobra sob o campo.

        No desktop o grupo volta ao centro (`lg:justify-center` com a saudação em altura natural):
        lá não existe polegar, o campo não ganha nada indo para baixo, e a leitura em tela larga
        prefere o centro óptico.

        `100svh` e não `100vh`: no navegador de celular o `vh` conta a barra de endereço que se
        esconde ao rolar, então o `vh` mede uma tela maior do que a que existe. O resto da casca já
        usava `svh` — aqui tinha ficado para trás.

        Sem `position: fixed`, de propósito: a animação de entrada do `<main>` aplica um transform,
        e um transform faz o `<main>` virar o containing block de todo `fixed` dentro dele. O campo
        fica no fim de uma coluna flex, que chega ao mesmo lugar sem brigar com a animação.
      */}
      {/*
        Não há mais dobra: a tela inteira cabe na tela.

        Aqui havia duas alturas calculadas à mão — `100svh - 113px` no celular, somando a barra, o
        `pt-3` e o `pb-2rem` com duas `env()`, e `100svh - 5rem` no desktop. A conta era correta e
        continuava sendo a coisa errada a fazer: ela reservava a tela inteira para a pergunta, e
        jogava os projetos recentes para baixo da dobra, onde ninguém os via sem rolar.

        Agora a casca entrega a altura e esta coluna a divide: a pergunta e o campo ficam no meio
        do que sobra, e os recentes encostam embaixo. Nada a calcular, e nada fora da tela.
      */}
      <div className="flex min-h-0 flex-col">
        <section className="flex flex-col text-center">
          <span className="mx-auto grid size-11 place-items-center rounded-xl border border-border bg-foreground text-background">
            <PathlyMark className="size-5" />
          </span>
          {/*
            Uma linha só, e nada abaixo dela.

            O subtítulo explicava o que cabia ali ("site, aplicação web, app de celular…") — mas
            quem chega já sabe o que quer construir, e a lista ocupava três linhas para responder
            uma pergunta que ninguém fez. O campo abaixo já mostra um exemplo no placeholder.
          */}
          <h1 className="mt-4 font-display text-3xl font-bold text-balance sm:text-4xl">
            O que vamos construir?
          </h1>
        </section>

        <div
          ref={moldura}
          className="chat-composer-frame mt-6 text-left"
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
              /* Mais baixo no celular: ali cada linha do campo é uma linha a menos de tela para o
                 resto, e o campo cresce sozinho conforme a pessoa escreve. */
              className="campo-elastico barra-discreta max-h-64 min-h-14 text-base"
              disabled={ocupado}
            />
            <PromptInputFooter className="justify-end">
              <BotaoEnviar
                carregando={ocupado}
                desabilitado={ideia.trim().length < 15 || ocupado}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>

        {/*
          A espera da criação, no mesmo lugar onde um erro apareceria.

          Criar o projeto leva alguns segundos — uma escrita no banco antes de a conversa abrir — e
          até aqui o único sinal era o botão de enviar girando no canto do campo, a 16px. Quem
          olhava para o texto que acabou de escrever não via nada acontecer.
        */}
        {ocupado && <Pensando className="mt-4 justify-center">Criando seu projeto…</Pensando>}
        {erro && (
          <p role="alert" className="mt-3 text-center text-sm font-medium">
            {erro}
          </p>
        )}
      </div>

      {/*
        Os projetos vêm abaixo e só quando existem. A tela de quem nunca criou nada não tem uma
        seção vazia dizendo "nenhum projeto" — ela tem só a pergunta, que é a resposta certa.
      */}
      {projetos.estado === "carregando" && (
        <div className="mt-10 shrink-0 space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      )}

      {recentes.length > 0 && (
        <section className="mt-10 shrink-0">
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
          <div className="mt-3 space-y-2">
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
