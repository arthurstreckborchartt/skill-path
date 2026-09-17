import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validarModelo, type ModeloDeDados } from "@/lib/banco/contrato";
import { validarMapa, type MapaApi } from "@/lib/api/contrato";
import { analisar, limitesDaAnalise, type ContextoSeguranca } from "./riscos";
import { contarRiscos, gerarChecklist, gerarRelatorio, type ItemSeguranca } from "./checklist";
import type { RiscoExtra } from "./extras";

/**
 * A análise de segurança na tela.
 *
 * A diferença para os outros módulos está aqui: o relatório **não depende da rota**. O catálogo e
 * a detecção rodam neste arquivo, com os artefatos que a pessoa já tem. A chamada ao servidor
 * busca só os extras — o que a IA encontra de específico deste projeto.
 *
 * É de propósito. Quem abre uma análise de segurança geralmente abriu porque algo está errado, e
 * um relatório que fica em branco quando um provedor de IA cai é um relatório que falta na hora
 * em que ele é necessário.
 */

export type EstadoSeguranca =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      /** Os artefatos que dão contexto à análise. Ausentes é normal: a análise diz o que ficou fora. */
      modelo: ModeloDeDados | null;
      api: MapaApi | null;
      extras: RiscoExtra[];
      /** Chaves de item marcadas. Ver `chaveDoItem`. */
      itensFeitos: string[];
      /** `null` enquanto esta sessão não pediu extras; a análise não espera por isso. */
      extrasVieram: boolean | null;
    }
  | { estado: "erro"; mensagem: string; motivo?: string };

/**
 * A identidade de uma linha do checklist.
 *
 * Não é o `riscoId` sozinho: um risco confirmado gera **um item por evidência**, e marcar
 * "senha em texto" na tabela `usuarios` não pode marcar junto a mesma falha na tabela `admins`.
 * A evidência entra na chave porque é ela que distingue as duas linhas.
 */
export function chaveDoItem(item: ItemSeguranca): string {
  return `${item.riscoId}|${item.evidencia ?? ""}`;
}

export function useSeguranca(projetoId: string) {
  const [estado, setEstado] = useState<EstadoSeguranca>({ estado: "carregando" });
  const [buscando, setBuscando] = useState(false);

  const carregar = useCallback(async () => {
    const [salvo, doBanco, daApi] = await Promise.all([
      supabase
        .from("pathly_seguranca")
        .select("extras,itens_feitos")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase
        .from("pathly_modelos_dados")
        .select("modelo")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase.from("pathly_apis").select("mapa").eq("projeto_id", projetoId).maybeSingle(),
    ]);

    if (salvo.error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar a análise de segurança." });
      return;
    }

    /**
     * Erro ao ler banco ou API não derruba a tela.
     *
     * São artefatos opcionais: sem eles a análise roda com menos alcance e diz isso em voz alta,
     * em `limitesDaAnalise`. Derrubar tudo porque o mapa de APIs não veio esconderia os riscos
     * que não dependem dele.
     */
    const feitos = salvo.data?.itens_feitos;

    setEstado({
      estado: "pronto",
      modelo: doBanco.error ? null : validarModelo(doBanco.data?.modelo),
      api: daApi.error ? null : validarMapa(daApi.data?.mapa),
      extras: lerExtras(salvo.data?.extras),
      itensFeitos: Array.isArray(feitos) ? feitos : [],
      extrasVieram: null,
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Busca os riscos específicos deste projeto. Só isso passa pela IA. */
  const buscarExtras = useCallback(async () => {
    if (buscando) return;
    setBuscando(true);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setEstado({ estado: "erro", mensagem: "Sua sessão expirou. Entre de novo." });
        return;
      }

      const r = await fetch("/api/seguranca", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ projetoId }),
      });
      const corpo = (await r.json()) as {
        extras?: unknown;
        extrasVieram?: boolean;
        erro?: string;
        motivo?: string;
      };

      if (!r.ok) {
        setEstado({
          estado: "erro",
          mensagem: corpo.erro ?? "Não consegui analisar os riscos específicos agora.",
          ...(corpo.motivo ? { motivo: corpo.motivo } : {}),
        });
        return;
      }

      setEstado((atual) =>
        atual.estado === "pronto"
          ? {
              ...atual,
              extras: lerExtras(corpo.extras),
              extrasVieram: corpo.extrasVieram !== false,
            }
          : atual,
      );
    } catch {
      setEstado({ estado: "erro", mensagem: "Sem conexão. Tente de novo." });
    } finally {
      setBuscando(false);
    }
  }, [projetoId, buscando]);

  const alternarItem = useCallback(
    async (chave: string) => {
      if (estado.estado !== "pronto") return;

      const novo = estado.itensFeitos.includes(chave)
        ? estado.itensFeitos.filter((x) => x !== chave)
        : [...estado.itensFeitos, chave];

      setEstado({ ...estado, itensFeitos: novo });

      /**
       * `upsert`, não `update`: a linha só existe depois que alguém buscou os extras, e marcar um
       * item do catálogo — que não precisa de IA nenhuma — tem de funcionar antes disso.
       */
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) return;

      await supabase.from("pathly_seguranca").upsert(
        {
          projeto_id: projetoId,
          user_id: userId,
          itens_feitos: novo,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "projeto_id" },
      );
    },
    [estado, projetoId],
  );

  return { estado, buscando, buscarExtras, alternarItem, recarregar: carregar };
}

/** Tudo o que se deriva do contexto e dos extras, recalculado só quando um dos dois muda. */
export function useDerivadosSeguranca(
  contexto: ContextoSeguranca | null,
  extras: RiscoExtra[],
  nomeProjeto: string,
) {
  return useMemo(() => {
    if (!contexto) return null;

    const analise = analisar(contexto);
    const limites = limitesDaAnalise(contexto);

    return {
      analise,
      limites,
      contagem: contarRiscos(analise, extras),
      checklist: gerarChecklist(analise, extras, contexto),
      relatorio: gerarRelatorio(analise, extras, nomeProjeto, limites),
    };
  }, [contexto, extras, nomeProjeto]);
}

/** O que voltou do banco é `Json`: só passa adiante o que tem a forma de um risco. */
function lerExtras(valor: unknown): RiscoExtra[] {
  if (!Array.isArray(valor)) return [];
  return valor.filter(
    (x): x is RiscoExtra =>
      typeof x === "object" &&
      x !== null &&
      typeof (x as RiscoExtra).titulo === "string" &&
      Array.isArray((x as RiscoExtra).comoPrevenir),
  );
}
