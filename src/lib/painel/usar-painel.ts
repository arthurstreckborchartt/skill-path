import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos, type Projeto } from "@/lib/blueprint/usar-projetos";
import { validarModelo, type ModeloDeDados } from "@/lib/banco/contrato";
import { validarMapa, type MapaApi } from "@/lib/api/contrato";
import { lerPropostasPendentes } from "@/lib/copilot/memoria";
import type { Proposta } from "@/lib/copilot/contrato";
import {
  calcularProgresso,
  calcularProximoPasso,
  type EstadoDoProjeto,
  type ProximoPasso,
} from "@/lib/copilot/proximo-passo";
import { analisar, type Achado } from "@/lib/seguranca/riscos";
import { respostasSuficientes } from "@/lib/blueprint/respostas";
import { faseDoPasso, type Fase } from "./fases";

/**
 * O painel: o estado do projeto atual, reunido num lugar só.
 *
 * ## O que este módulo NÃO faz
 *
 * Ele não calcula nada de novo. Progresso e próximo passo saem de `proximo-passo.ts`, os riscos
 * de `seguranca/riscos.ts`, as decisões pendentes da memória do Copilot. Tudo isso já existia e
 * já era usado — só estava espalhado por cinco telas, cada uma mostrando um pedaço.
 *
 * O trabalho aqui é **reunir**, e a razão é a pergunta que o produto não pode deixar acontecer:
 * "o que eu faço agora?". Ela só surge quando a resposta está a dois cliques de distância.
 *
 * ## Por que o projeto atual é o mais recente
 *
 * `useProjetos` já ordena por `atualizado_em` decrescente. Quem volta ao Pathly quase sempre volta
 * para onde estava — e quando não é o caso, a lista inteira está logo ali. Perguntar "qual
 * projeto?" a cada visita seria cobrar uma decisão de quem veio justamente buscar a próxima.
 */

export type ResumoProjeto = {
  progresso: number;
  fase: Fase;
  proximoPasso: ProximoPasso;
  /** Riscos com evidência nos artefatos, já ordenados por gravidade. */
  riscos: Achado[];
  /** Propostas do Copilot esperando aprovação. Cada uma é uma decisão travando o projeto. */
  decisoesPendentes: Proposta[];
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
};

export type EstadoPainel =
  | { estado: "carregando" }
  /** Nenhum projeto ainda. A resposta para "o que faço agora?" é criar o primeiro. */
  | { estado: "vazio" }
  | {
      estado: "pronto";
      projetos: Projeto[];
      atual: Projeto;
      resumo: ResumoProjeto;
      /**
       * `true` quando as consultas de apoio falharam. A tela monta assim mesmo, com o que o
       * projeto já traz, e diz que riscos e decisões podem estar incompletos — some-los em
       * silêncio seria mostrar "nenhum risco" para um projeto que não foi analisado.
       */
      extrasIncompletos: boolean;
    }
  | { estado: "erro"; mensagem: string };

type Extras = {
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  temArquiteturaIa: boolean;
  temSeguranca: boolean;
  decisoesPendentes: Proposta[];
};

const SEM_EXTRAS: Extras = {
  modelo: null,
  api: null,
  temArquiteturaIa: false,
  temSeguranca: false,
  decisoesPendentes: [],
};

export function usePainel(): EstadoPainel & { recarregar: () => void } {
  const lista = useProjetos();
  const [extras, setExtras] = useState<Extras | null>(null);
  const [falhouExtras, setFalhouExtras] = useState(false);

  const atual = lista.estado === "pronta" ? (lista.projetos[0] ?? null) : null;
  const atualId = atual?.id ?? null;

  const carregarExtras = useCallback(async (projetoId: string) => {
    const [banco, api, ia, seg, propostas] = await Promise.all([
      supabase
        .from("pathly_modelos_dados")
        .select("modelo")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase.from("pathly_apis").select("mapa").eq("projeto_id", projetoId).maybeSingle(),
      supabase
        .from("pathly_arquitetura_ia")
        .select("projeto_id")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase
        .from("pathly_seguranca")
        .select("projeto_id")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      lerPropostasPendentes(projetoId),
    ]);

    setExtras({
      modelo: banco.error ? null : validarModelo(banco.data?.modelo),
      api: api.error ? null : validarMapa(api.data?.mapa),
      temArquiteturaIa: Boolean(ia.data),
      temSeguranca: Boolean(seg.data),
      decisoesPendentes: propostas,
    });
  }, []);

  useEffect(() => {
    if (!atualId) {
      setExtras(null);
      return;
    }
    setExtras(null);
    setFalhouExtras(false);
    carregarExtras(atualId).catch(() => setFalhouExtras(true));
  }, [atualId, carregarExtras]);

  const resumo = useMemo<ResumoProjeto | null>(() => {
    if (!atual) return null;

    /*
     * Sem os extras, o painel ainda monta — com o que o projeto já traz. É de propósito: a tela
     * inteira existe para responder "o que faço agora?", e ficar em branco enquanto quatro
     * consultas voltam é a própria pergunta sem resposta.
     *
     * O custo é que o próximo passo pode, por um instante, apontar para "projetar o banco" num
     * projeto que já tem banco. Ele se corrige sozinho quando os extras chegam, e errar por um
     * passo cedo demais é menos ruim que não dizer nada.
     */
    const e = extras ?? SEM_EXTRAS;

    const estado: EstadoDoProjeto = {
      blueprint: atual.conteudo,
      temModelo: e.modelo !== null,
      temApi: e.api !== null,
      temSeguranca: e.temSeguranca,
      temArquiteturaIa: e.temArquiteturaIa,
      etapasConcluidas: atual.etapasConcluidas,
      etapasTotal: atual.etapasTotal,
      questionarioCompleto: respostasSuficientes(atual.respostas),
    };

    const proximoPasso = calcularProximoPasso(atual.id, estado);

    const analise = analisar({
      respostas: atual.respostas,
      blueprint: atual.conteudo,
      modelo: e.modelo,
      api: e.api,
    });

    return {
      progresso: calcularProgresso(estado),
      fase: faseDoPasso(proximoPasso.id) ?? "plano",
      proximoPasso,
      riscos: analise.confirmados,
      decisoesPendentes: e.decisoesPendentes,
      modelo: e.modelo,
      api: e.api,
    };
  }, [atual, extras]);

  const recarregarLista = lista.recarregar;
  const recarregar = useCallback(() => {
    recarregarLista();
    if (atualId) carregarExtras(atualId).catch(() => setFalhouExtras(true));
  }, [recarregarLista, atualId, carregarExtras]);

  if (lista.estado === "carregando") return { estado: "carregando", recarregar };
  if (lista.estado === "erro") {
    return { estado: "erro", mensagem: "Não consegui carregar seus projetos.", recarregar };
  }
  if (!atual || !resumo) return { estado: "vazio", recarregar };

  return {
    estado: "pronto",
    projetos: lista.projetos,
    atual,
    resumo,
    extrasIncompletos: falhouExtras,
    recarregar,
  };
}
