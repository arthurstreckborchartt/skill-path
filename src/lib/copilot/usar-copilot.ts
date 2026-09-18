import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import type { MensagemCopilot, Modo, Proposta, RespostaCopilot } from "./contrato";
import { lerMensagens, lerPropostasPendentes, PAGINA_MENSAGENS } from "./memoria";
import { aprovarProposta } from "./aplicar";
import { rejeitarProposta } from "./propostas";
import { calcularProgresso, calcularProximoPasso, type ProximoPasso } from "./proximo-passo";
import type { Faceta } from "./roteador";

/**
 * O Copilot na tela.
 *
 * ## O que este hook NÃO faz
 *
 * Não grava mensagem. Quem grava é o endpoint, no servidor, porque uma aba fechada no meio da
 * resposta perderia a pergunta e a resposta — que já foram pagas. Aqui a mensagem da pessoa
 * aparece na hora de forma otimista e é substituída pelo que voltou do banco na recarga.
 */

export type EstadoCopilot = {
  mensagens: MensagemCopilot[];
  propostas: Proposta[];
  carregando: boolean;
  /** Cursor para carregar mensagens mais antigas. `null` quando chegou ao começo. */
  anteriorA: string | null;
  respondendo: boolean;
  erro: string | null;
  proximoPasso: ProximoPasso | null;
  progresso: number;
  nomeProjeto: string;
  blueprint: Blueprint | null;
};

const INICIAL: EstadoCopilot = {
  mensagens: [],
  propostas: [],
  carregando: true,
  anteriorA: null,
  respondendo: false,
  erro: null,
  proximoPasso: null,
  progresso: 0,
  nomeProjeto: "",
  blueprint: null,
};

export function useCopilot(projetoId: string | null, faceta: Faceta | null) {
  const [e, setE] = useState<EstadoCopilot>(INICIAL);

  const carregar = useCallback(async () => {
    if (!projetoId) {
      setE({ ...INICIAL, carregando: false });
      return;
    }

    const [proj, pagina, propostas, banco, api, ia] = await Promise.all([
      supabase
        .from("pathly_projetos")
        .select("nome,conteudo,etapas_concluidas,etapas_total")
        .eq("id", projetoId)
        .maybeSingle(),
      lerMensagens(projetoId),
      lerPropostasPendentes(projetoId),
      supabase
        .from("pathly_modelos_dados")
        .select("projeto_id")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase.from("pathly_apis").select("projeto_id").eq("projeto_id", projetoId).maybeSingle(),
      supabase
        .from("pathly_arquitetura_ia")
        .select("projeto_id")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
    ]);

    if (proj.error || !proj.data) {
      setE({ ...INICIAL, carregando: false, erro: "Não consegui carregar este projeto." });
      return;
    }

    const blueprint = completarBlueprint((proj.data.conteudo ?? {}) as Blueprint);
    const estado = {
      blueprint,
      temModelo: Boolean(banco.data),
      temApi: Boolean(api.data),
      // Segurança não guarda "existe": a análise roda no cliente. Tratada como pendente aqui,
      // o que só afeta a ordem do próximo passo, nunca a resposta do Copilot.
      temSeguranca: false,
      temArquiteturaIa: Boolean(ia.data),
      etapasConcluidas: proj.data.etapas_concluidas,
      etapasTotal: proj.data.etapas_total,
      questionarioCompleto: true,
    };

    setE({
      mensagens: pagina.mensagens,
      propostas,
      carregando: false,
      anteriorA: pagina.anteriorA,
      respondendo: false,
      erro: null,
      proximoPasso: calcularProximoPasso(projetoId, estado),
      progresso: calcularProgresso(estado),
      nomeProjeto: proj.data.nome,
      blueprint,
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Carrega a página anterior, mantendo a rolagem no que já estava na tela. */
  const carregarMais = useCallback(async () => {
    if (!projetoId || !e.anteriorA) return;
    const pagina = await lerMensagens(projetoId, e.anteriorA);
    setE((a) => ({
      ...a,
      mensagens: [...pagina.mensagens, ...a.mensagens],
      anteriorA: pagina.anteriorA,
    }));
  }, [projetoId, e.anteriorA]);

  const perguntar = useCallback(
    async (pergunta: string, modo?: Modo) => {
      if (!projetoId || e.respondendo || !pergunta.trim()) return;

      // Otimista: a pergunta aparece antes da resposta chegar. O id provisório nunca vai para o
      // banco — ele existe só para a chave de lista do React até a recarga.
      const provisoria: MensagemCopilot = {
        id: `provisoria-${Date.now()}`,
        papel: "usuario",
        texto: pergunta,
        resposta: null,
        criadoEm: new Date().toISOString(),
      };

      setE((a) => ({
        ...a,
        mensagens: [...a.mensagens, provisoria],
        respondendo: true,
        erro: null,
      }));

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setE((a) => ({ ...a, respondendo: false, erro: "Sua sessão expirou. Entre de novo." }));
          return;
        }

        const r = await fetch("/api/copilot", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ projetoId, pergunta, facetaDaTela: faceta, modo }),
        });
        const corpo = (await r.json()) as { resposta?: RespostaCopilot; erro?: string };

        if (!r.ok || !corpo.resposta) {
          setE((a) => ({
            ...a,
            respondendo: false,
            erro: corpo.erro ?? "Não consegui responder agora.",
          }));
          return;
        }

        const resposta = corpo.resposta;
        setE((a) => ({
          ...a,
          respondendo: false,
          mensagens: [
            ...a.mensagens,
            {
              id: `resposta-${Date.now()}`,
              papel: "copilot",
              texto: resposta.blocos[0] ?? "",
              resposta,
              criadoEm: new Date().toISOString(),
            },
          ],
        }));

        // Proposta nova chega junto da resposta: recarrega só a lista, sem mexer na conversa.
        if (resposta.propostas.length > 0) {
          const propostas = await lerPropostasPendentes(projetoId);
          setE((a) => ({ ...a, propostas }));
        }
      } catch {
        setE((a) => ({ ...a, respondendo: false, erro: "Sem conexão. Tente de novo." }));
      }
    },
    [projetoId, faceta, e.respondendo],
  );

  /**
   * Aprovar recarrega tudo, e não só a lista de propostas.
   *
   * A aprovação muda o Blueprint, cria uma decisão e pode mudar o próximo passo. Atualizar só o
   * cartão que sumiu deixaria o cabeçalho dizendo que o próximo passo é algo que acabou de ser
   * resolvido.
   */
  const aprovar = useCallback(
    async (proposta: Proposta) => {
      if (!projetoId || !e.blueprint) return;
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      const r = await aprovarProposta(projetoId, userId, proposta, e.blueprint);
      if (!r.ok) {
        setE((a) => ({ ...a, erro: r.motivo }));
        return;
      }
      await carregar();
    },
    [projetoId, e.blueprint, carregar],
  );

  const rejeitar = useCallback(async (proposta: Proposta) => {
    await rejeitarProposta(proposta.id);
    setE((a) => ({ ...a, propostas: a.propostas.filter((p) => p.id !== proposta.id) }));
  }, []);

  return {
    estado: e,
    perguntar,
    aprovar,
    rejeitar,
    carregarMais,
    recarregar: carregar,
    PAGINA_MENSAGENS,
  };
}
