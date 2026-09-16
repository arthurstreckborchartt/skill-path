import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import {
  BlocoExecucao,
  BlocoFundacao,
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
  type Produto,
  type Tecnico,
} from "@/lib/blueprint/contrato";
import { gerarBloco, useProjeto } from "@/lib/blueprint/usar-projetos";

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
  execucao: "Execução",
};

const RESUMO: Record<Bloco, string> = {
  fundacao: "Que problema, para quem, e por que pagariam",
  produto: "O que ele faz — e o que fica para depois",
  tecnico: "Stack, arquitetura, dados e segurança",
  execucao: "A ordem de construir, etapa por etapa",
};

/**
 * Medido em produção local: fundação em ~10s, produto passou de 30s numa das tentativas.
 *
 * As faixas são propositalmente largas e pessimistas. Prometer "20 segundos" e levar 35 faz a
 * pessoa achar que travou — aconteceu no primeiro teste desta tela.
 */
const ESPERA: Record<Bloco, string> = {
  fundacao: "de 10 a 30 segundos",
  produto: "de 20 a 40 segundos",
  tecnico: "até um minuto",
  execucao: "até um minuto",
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
  execucao:
    "A ordem de construir sai do modelo de dados. Sem ele, a trilha vira uma lista de tarefas soltas que não encaixam.",
};

function TelaBlueprint() {
  const { id } = Route.useParams();
  const { estado, aplicar } = useProjeto(id);
  const [gerando, setGerando] = useState<Bloco | null>(null);
  const [erro, setErro] = useState<string | null>(null);

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
