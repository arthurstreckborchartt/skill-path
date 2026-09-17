import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Loader2,
  Map as MapIcon,
  Pencil,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import { Questionario, ResumoRespostas } from "@/components/pathly/questionario";
import { respostasSuficientes, type Respostas } from "@/lib/blueprint/respostas";
import {
  BlocoExecucao,
  BlocoFundacao,
  BlocoOperacao,
  BlocoProduto,
  BlocoTecnico,
  BlocoTrancado,
} from "@/components/pathly/blueprint-blocos";
import {
  BLOCOS,
  podeGerar,
  type Bloco,
  type Execucao,
  type Fundacao,
  type Operacao,
  type Produto,
  type Tecnico,
} from "@/lib/blueprint/contrato";
import { gerarBloco, salvarRespostas, useProjeto } from "@/lib/blueprint/usar-projetos";

export const Route = createFileRoute("/app/blueprint/$id")({
  staticData: { sitemap: false },
  // Título fixo: o nome do projeto só existe depois da consulta, que é do cliente. Sem isto a
  // aba herdava o título da raiz, que fala de estudo e não tem nada a ver com esta tela.
  head: () => ({ meta: [{ title: "Plano do projeto — Pathly" }] }),
  component: TelaBlueprint,
});

const TITULO: Record<Bloco, string> = {
  fundacao: "Fundação",
  produto: "Produto",
  tecnico: "Técnico",
  operacao: "Operação",
  execucao: "Execução",
};

const RESUMO: Record<Bloco, string> = {
  fundacao: "Que problema, para quem, e por que pagariam",
  produto: "O que ele faz — e o que fica para depois",
  tecnico: "Stack, arquitetura, dados, autenticação e segurança",
  operacao: "Requisitos, infraestrutura, deploy e testes",
  execucao: "A ordem de construir, etapa por etapa",
};

/**
 * Medido em produção local: fundação em ~10s, produto passou de 30s numa das tentativas.
 *
 * As faixas são propositalmente largas e pessimistas. Prometer "20 segundos" e levar 35 faz a
 * pessoa achar que travou — aconteceu no primeiro teste desta tela.
 */
const ESPERA: Record<Bloco, string> = {
  fundacao: "de 10 a 40 segundos",
  produto: "de 20 a 60 segundos",
  tecnico: "até um minuto e meio",
  operacao: "até um minuto",
  execucao: "até um minuto e meio",
};

/**
 * Por que cada bloco depende dos anteriores.
 *
 * Um texto por bloco, e não um genérico: a primeira versão mostrava a explicação sobre escolher
 * tecnologia cedo demais também no bloco de Produto, onde ela não tem nada a ver com o assunto.
 */
const PORQUE_TRANCADO: Record<Bloco, string> = {
  fundacao: "",
  produto:
    "Listar funcionalidades antes de saber quem usa e que dor resolve produz uma lista de desejos, não um produto.",
  tecnico:
    "Escolher tecnologia antes de saber que dados existem é o erro mais caro de um projeto — e o mais difícil de desfazer depois.",
  operacao:
    "Não dá para dimensionar infraestrutura nem escrever testes sem saber o que o sistema faz e como ele é montado.",
  execucao:
    "A ordem de construir sai do modelo de dados. Sem ele, a trilha vira uma lista de tarefas soltas que não encaixam.",
};

function TelaBlueprint() {
  const { id } = Route.useParams();
  const { estado, aplicar } = useProjeto(id);
  const [gerando, setGerando] = useState<Bloco | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState<Respostas | null>(null);
  const [salvando, setSalvando] = useState(false);

  const projetoPronto = estado.estado === "pronto" ? estado.projeto : null;
  const respostas = projetoPronto?.respostas ?? null;
  const faltaQuestionario = respostas ? !respostasSuficientes(respostas) : false;

  /**
   * Projeto criado antes do questionário existir cai aqui com respostas vazias. Em vez de deixar
   * a pessoa bater num 409 ao clicar em gerar, o formulário já abre — e ela entende por quê.
   */
  useEffect(() => {
    if (faltaQuestionario && !editando) {
      setEditando(true);
      setRascunho(respostas);
    }
  }, [faltaQuestionario, editando, respostas]);

  async function salvar() {
    if (!rascunho || salvando) return;
    setSalvando(true);
    const ok = await salvarRespostas(id, rascunho);
    setSalvando(false);
    if (!ok) {
      setErro("Não consegui salvar suas respostas.");
      return;
    }
    // Recarrega para a tela passar a ler as respostas novas em todo lugar.
    window.location.reload();
  }

  async function gerar(bloco: Bloco) {
    if (gerando) return;
    setGerando(bloco);
    setErro(null);

    const r = await gerarBloco(id, bloco);
    if (r.ok) aplicar(r.bloco, r.dados);
    else setErro(r.mensagem);

    setGerando(null);
  }

  if (estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (estado.estado === "erro") {
    return (
      <Panel className="text-center">
        <p className="text-sm text-muted-foreground">
          {estado.motivo === "nao-encontrado"
            ? "Este projeto não existe ou não é seu."
            : "Não consegui carregar este projeto agora."}
        </p>
        <Link
          to="/app/blueprints"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Voltar para seus projetos
        </Link>
      </Panel>
    );
  }

  const { projeto } = estado;
  const conteudo = projeto.conteudo;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/app/blueprints"
          className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Seus projetos
        </Link>
        <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">{projeto.nome}</h1>
        {conteudo.fundacao && (
          <p className="mt-1.5 text-sm text-foreground/90">{conteudo.fundacao.descricao}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground/70">Sua ideia:</span> {projeto.ideia}
        </p>
      </div>

      {erro && (
        <Panel>
          <p className="text-sm text-destructive">{erro}</p>
        </Panel>
      )}

      {/*
        O roadmap só aparece depois da execução existir: é dela que as etapas saem. Antes disso o
        atalho levaria a uma tela vazia, que é pior que não ter atalho.
      */}
      {conteudo.execucao && (
        <Reveal>
          <Link
            to="/app/roadmap/$id"
            params={{ id }}
            className="tap group flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-surface to-surface p-5"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MapIcon className="size-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Seu roadmap</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {conteudo.execucao.etapas.length} etapas em {conteudo.execucao.fases.length} fases.
                Comece pela primeira.
              </p>
            </div>
            <span className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-transform group-hover:translate-x-0.5">
              Abrir
            </span>
          </Link>
        </Reveal>
      )}

      <Reveal>
        <Panel>
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">O que você respondeu</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {faltaQuestionario
                  ? "Este projeto ainda não tem questionário. Responda para poder montar o plano."
                  : "Estas respostas definem o que o plano inclui — e o que ele deixa de fora."}
              </p>
            </div>
            {!editando && (
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRascunho(projeto.respostas);
                  setEditando(true);
                }}
                title="Editar respostas"
              >
                <Pencil className="size-4" />
              </Btn>
            )}
          </header>

          <div className="mt-4">
            {editando && rascunho ? (
              <>
                <Questionario respostas={rascunho} aoMudar={setRascunho} />
                <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  <Btn
                    disabled={!respostasSuficientes(rascunho) || salvando}
                    onClick={() => void salvar()}
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Salvando…
                      </>
                    ) : (
                      <>
                        <Check className="size-4" /> Salvar respostas
                      </>
                    )}
                  </Btn>
                  {!faltaQuestionario && (
                    <Btn variant="ghost" onClick={() => setEditando(false)}>
                      Cancelar
                    </Btn>
                  )}
                </div>
                {/* Mudar resposta nao apaga o que ja foi escrito: a pessoa decide o que refazer. */}
                {!faltaQuestionario && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Salvar não apaga o plano já gerado. Use o botão de refazer em cada parte que
                    você quiser atualizar com as respostas novas.
                  </p>
                )}
              </>
            ) : (
              <ResumoRespostas respostas={projeto.respostas} />
            )}
          </div>
        </Panel>
      </Reveal>

      {BLOCOS.map((bloco, i) => {
        const dados = conteudo[bloco];
        const permissao = podeGerar(conteudo, bloco);
        const estaGerando = gerando === bloco;

        return (
          <Reveal key={bloco} delay={i * 60}>
            <Panel>
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-semibold">{TITULO[bloco]}</h2>
                    {dados && <Chip tone="primary">pronto</Chip>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{RESUMO[bloco]}</p>
                </div>

                {/* Refazer fica discreto de propósito: é útil, mas gasta uma geração. */}
                {dados && !estaGerando && (
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => void gerar(bloco)}
                    disabled={gerando !== null}
                    title="Gerar outra versão desta parte"
                  >
                    <RefreshCw className="size-4" />
                  </Btn>
                )}
              </header>

              <div className="mt-4">
                {estaGerando && (
                  <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Montando esta parte — leva {ESPERA[bloco]}.
                  </div>
                )}

                {!estaGerando && dados && bloco === "fundacao" && (
                  <BlocoFundacao dados={dados as Fundacao} />
                )}
                {!estaGerando && dados && bloco === "produto" && (
                  <BlocoProduto dados={dados as Produto} />
                )}
                {!estaGerando && dados && bloco === "tecnico" && (
                  <BlocoTecnico dados={dados as Tecnico} />
                )}
                {!estaGerando && dados && bloco === "operacao" && (
                  <BlocoOperacao dados={dados as Operacao} />
                )}
                {!estaGerando && dados && bloco === "execucao" && (
                  <BlocoExecucao dados={dados as Execucao} />
                )}

                {!estaGerando && !dados && !permissao.pode && (
                  <BlocoTrancado
                    falta={permissao.falta.map((b) => TITULO[b].toLowerCase())}
                    porque={PORQUE_TRANCADO[bloco]}
                  />
                )}

                {!estaGerando && !dados && permissao.pode && (
                  <Btn onClick={() => void gerar(bloco)} disabled={gerando !== null}>
                    <Sparkles className="size-4" /> Gerar {TITULO[bloco].toLowerCase()}
                  </Btn>
                )}
              </div>
            </Panel>
          </Reveal>
        );
      })}
    </div>
  );
}
