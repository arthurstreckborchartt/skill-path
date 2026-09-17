import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ConteudoEtapa } from "./etapa-contrato";
import type { Blueprint, Etapa } from "./contrato";
import { fasesDoProjeto, fasesForaComMotivo, type Fase } from "./fases";
import type { Respostas } from "./respostas";

/**
 * O roadmap na tela: progresso, checklist e o conteúdo de cada etapa.
 *
 * Progresso e conteúdo vivem na mesma linha do banco mas têm donos diferentes — o texto é da IA,
 * o status e o checklist são da pessoa. As funções aqui nunca escrevem os dois de uma vez, para
 * regerar um texto não apagar o que ela marcou como feito.
 */

export type StatusEtapa = "pendente" | "fazendo" | "concluida" | "pulada";

export type ProgressoEtapa = {
  ordem: number;
  status: StatusEtapa;
  checklistFeito: number[];
  anotacoes: string;
  temConteudo: boolean;
};

type LinhaEtapa = {
  ordem: number;
  status: string;
  checklist_feito: number[] | null;
  anotacoes: string | null;
  conteudo: unknown;
};

function daLinha(l: LinhaEtapa): ProgressoEtapa {
  const status: StatusEtapa = (["pendente", "fazendo", "concluida", "pulada"] as const).includes(
    l.status as StatusEtapa,
  )
    ? (l.status as StatusEtapa)
    : "pendente";

  return {
    ordem: l.ordem,
    status,
    checklistFeito: Array.isArray(l.checklist_feito) ? l.checklist_feito : [],
    anotacoes: l.anotacoes ?? "",
    temConteudo: Boolean(l.conteudo),
  };
}

export function useProgresso(projetoId: string) {
  const [porOrdem, setPorOrdem] = useState<Map<number, ProgressoEtapa>>(new Map());
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("pathly_etapas")
      .select("ordem,status,checklist_feito,anotacoes,conteudo")
      .eq("projeto_id", projetoId);

    const mapa = new Map<number, ProgressoEtapa>();
    for (const linha of (data ?? []) as LinhaEtapa[]) {
      const p = daLinha(linha);
      mapa.set(p.ordem, p);
    }
    setPorOrdem(mapa);
    setCarregando(false);
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Escreve o progresso de uma etapa, criando a linha se ela ainda não existir.
   *
   * `upsert` com `onConflict` na chave (projeto, ordem) resolve a corrida de duas abas abertas na
   * mesma etapa, que sem isso quebraria no índice único.
   */
  const salvar = useCallback(
    async (ordem: number, mudanca: Partial<Omit<ProgressoEtapa, "ordem" | "temConteudo">>) => {
      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user.id;
      if (!userId) return false;

      const atual = porOrdem.get(ordem);
      const novo: ProgressoEtapa = {
        ordem,
        status: mudanca.status ?? atual?.status ?? "pendente",
        checklistFeito: mudanca.checklistFeito ?? atual?.checklistFeito ?? [],
        anotacoes: mudanca.anotacoes ?? atual?.anotacoes ?? "",
        temConteudo: atual?.temConteudo ?? false,
      };

      // Otimista: marcar um item de checklist precisa responder na hora, e a escrita é pequena.
      setPorOrdem((m) => new Map(m).set(ordem, novo));

      const agora = new Date().toISOString();
      const { error } = await supabase.from("pathly_etapas").upsert(
        {
          projeto_id: projetoId,
          user_id: userId,
          ordem,
          status: novo.status,
          checklist_feito: novo.checklistFeito,
          anotacoes: novo.anotacoes,
          atualizado_em: agora,
          ...(novo.status === "fazendo" && !atual?.status ? { iniciada_em: agora } : {}),
          ...(novo.status === "concluida" ? { concluida_em: agora } : {}),
        },
        { onConflict: "projeto_id,ordem" },
      );

      if (error) {
        // Desfaz o otimismo: mostrar marcado o que não gravou é pior que não marcar.
        await carregar();
        return false;
      }
      return true;
    },
    [porOrdem, projetoId, carregar],
  );

  return { porOrdem, carregando, salvar, recarregar: carregar };
}

/** Uma etapa do roadmap com o progresso dela junto — o que a tela realmente precisa. */
export type EtapaNoRoadmap = Etapa & {
  status: StatusEtapa;
  checklistFeito: number[];
  /** Todas as etapas de que ela depende já estão concluídas? */
  liberada: boolean;
  /** As que faltam, para a tela explicar o bloqueio em vez de só desabilitar. */
  bloqueadaPor: number[];
};

export type FaseNoRoadmap = {
  fase: Fase;
  etapas: EtapaNoRoadmap[];
  concluidas: number;
};

/**
 * Monta o roadmap: fases ativas, etapas dentro delas, e o que está liberado.
 *
 * "Liberada" olha só as dependências declaradas, não a ordem. Uma etapa 7 que não depende de
 * nada pode ser feita antes da 5 — e impedir isso seria inventar uma regra que o plano não tem.
 */
export function montarRoadmap(
  blueprint: Blueprint,
  respostas: Respostas,
  progresso: Map<number, ProgressoEtapa>,
): { fases: FaseNoRoadmap[]; foraDoProjeto: { fase: Fase; porque: string }[] } {
  const etapas = blueprint.execucao?.etapas ?? [];
  const ativas = fasesDoProjeto(respostas, blueprint);

  const concluidas = new Set(
    etapas.filter((e) => progresso.get(e.ordem)?.status === "concluida").map((e) => e.ordem),
  );

  const enriquecidas: EtapaNoRoadmap[] = etapas.map((e) => {
    const p = progresso.get(e.ordem);
    const bloqueadaPor = e.dependeDe.filter((d) => !concluidas.has(d));
    return {
      ...e,
      status: p?.status ?? "pendente",
      checklistFeito: p?.checklistFeito ?? [],
      liberada: bloqueadaPor.length === 0,
      bloqueadaPor,
    };
  });

  const fases: FaseNoRoadmap[] = ativas
    .map((fase) => {
      const daFase = enriquecidas.filter((e) => e.fase === fase.nome);
      return {
        fase,
        etapas: daFase,
        concluidas: daFase.filter((e) => e.status === "concluida").length,
      };
    })
    // Fase sem etapa nenhuma não aparece: o plano não colocou trabalho lá.
    .filter((f) => f.etapas.length > 0);

  return { fases, foraDoProjeto: fasesForaComMotivo(respostas, blueprint) };
}

/**
 * "Onde estou?" — a etapa que a pessoa deve olhar agora.
 *
 * A que estiver marcada como "fazendo" ganha, porque foi escolha dela. Sem nenhuma, a primeira
 * pendente e liberada. Se nada estiver liberado, devolve a primeira pendente mesmo assim: uma
 * tela sem próximo passo é pior que uma que mostra o passo bloqueado e diz por quê.
 */
export function ondeEstou(fases: FaseNoRoadmap[]): EtapaNoRoadmap | null {
  const todas = fases.flatMap((f) => f.etapas);
  return (
    todas.find((e) => e.status === "fazendo") ??
    todas.find((e) => e.status === "pendente" && e.liberada) ??
    todas.find((e) => e.status === "pendente") ??
    null
  );
}

export function contarProgresso(fases: FaseNoRoadmap[]) {
  const todas = fases.flatMap((f) => f.etapas);
  const feitas = todas.filter((e) => e.status === "concluida").length;
  const puladas = todas.filter((e) => e.status === "pulada").length;
  const horasRestantes = todas
    .filter((e) => e.status === "pendente" || e.status === "fazendo")
    .reduce((soma, e) => soma + e.estimativaHoras, 0);

  return {
    total: todas.length,
    feitas,
    puladas,
    horasRestantes,
    // Puladas contam como resolvidas: a pessoa decidiu que aquilo não é trabalho dela.
    pct: todas.length === 0 ? 0 : Math.round(((feitas + puladas) / todas.length) * 100),
  };
}

export type EstadoEtapa =
  | { estado: "carregando" }
  | { estado: "pronta"; conteudo: ConteudoEtapa }
  | { estado: "erro"; mensagem: string };

/** Busca (ou gera) o conteúdo de uma etapa. */
export function useConteudoEtapa(projetoId: string, ordem: number | null): EstadoEtapa {
  const [estado, setEstado] = useState<EstadoEtapa>({ estado: "carregando" });

  useEffect(() => {
    if (ordem === null) return;
    let vivo = true;
    setEstado({ estado: "carregando" });

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (vivo) setEstado({ estado: "erro", mensagem: "Sua sessão expirou. Entre de novo." });
          return;
        }

        const r = await fetch("/api/etapa", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ projetoId, ordem }),
        });
        const corpo = (await r.json()) as { conteudo?: ConteudoEtapa; erro?: string };
        if (!vivo) return;

        if (!r.ok || !corpo.conteudo) {
          setEstado({
            estado: "erro",
            mensagem:
              r.status === 503
                ? "Os serviços de IA estão congestionados. Tente de novo em instantes."
                : (corpo.erro ?? "Não consegui abrir esta etapa agora."),
          });
          return;
        }
        setEstado({ estado: "pronta", conteudo: corpo.conteudo });
      } catch {
        if (vivo) setEstado({ estado: "erro", mensagem: "Sem conexão. Tente de novo." });
      }
    })();

    return () => {
      vivo = false;
    };
  }, [projetoId, ordem]);

  return estado;
}

/** Usado pela tela para não recalcular o roadmap a cada render. */
export function useRoadmap(
  blueprint: Blueprint,
  respostas: Respostas,
  progresso: Map<number, ProgressoEtapa>,
) {
  return useMemo(
    () => montarRoadmap(blueprint, respostas, progresso),
    [blueprint, respostas, progresso],
  );
}
