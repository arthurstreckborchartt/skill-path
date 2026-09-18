import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validarMapa, type MapaApi } from "./contrato";
import { conceitosDoProjeto, conceitosForaComMotivo } from "./conceitos";
import {
  gerarChecklistTestes,
  gerarCurl,
  gerarDocumentacao,
  gerarOpenApi,
  gerarPrompts,
  gerarRespostaExemplo,
} from "./derivados";
import type { Respostas } from "@/lib/blueprint/respostas";

/**
 * O mapa de APIs na tela.
 *
 * Mesma forma do módulo de banco: só o mapa é guardado, e OpenAPI, `curl`, documentação, prompts
 * e checklist são derivados na hora. Guardar os derivados criaria seis cópias da mesma verdade,
 * que saem de sincronia na primeira regeração.
 */

export type EstadoApi =
  | { estado: "carregando" }
  | { estado: "pronto"; mapa: MapaApi; testesFeitos: number[]; erroPersistencia?: string }
  | { estado: "vazio" }
  | { estado: "erro"; mensagem: string; motivo?: string };

export function useMapaApi(projetoId: string) {
  const [estado, setEstado] = useState<EstadoApi>({ estado: "carregando" });
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("pathly_apis")
      .select("mapa,testes_feitos")
      .eq("projeto_id", projetoId)
      .maybeSingle();

    if (error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar o mapa de APIs." });
      return;
    }
    if (!data) {
      setEstado({ estado: "vazio" });
      return;
    }

    const mapa = validarMapa(data.mapa);
    // Mapa gravado que não passa mais no validador: o contrato mudou. "Vazio" faz a tela oferecer
    // gerar de novo, que é a saída certa.
    if (!mapa) {
      setEstado({ estado: "vazio" });
      return;
    }

    setEstado({
      estado: "pronto",
      mapa,
      testesFeitos: Array.isArray(data.testes_feitos) ? data.testes_feitos : [],
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gerar = useCallback(
    async (refazer = false) => {
      if (gerando) return;
      setGerando(true);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setEstado({ estado: "erro", mensagem: "Sua sessão expirou. Entre de novo." });
          return;
        }

        const r = await fetch("/api/apis", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ projetoId, refazer }),
        });
        const corpo = (await r.json()) as { mapa?: unknown; erro?: string; motivo?: string };

        if (!r.ok || !corpo.mapa) {
          setEstado({
            estado: "erro",
            mensagem:
              r.status === 503
                ? "Os serviços de IA estão congestionados. Toque em tentar de novo."
                : (corpo.erro ?? "Não consegui projetar a API agora."),
            ...(corpo.motivo ? { motivo: corpo.motivo } : {}),
          });
          return;
        }

        const mapa = validarMapa(corpo.mapa);
        if (!mapa) {
          setEstado({ estado: "erro", mensagem: "O mapa veio incompleto. Tente de novo." });
          return;
        }

        setEstado({
          estado: "pronto",
          mapa,
          // Regerar não apaga o que já foi testado: o progresso é da pessoa.
          testesFeitos: estado.estado === "pronto" ? estado.testesFeitos : [],
        });
      } catch {
        setEstado({ estado: "erro", mensagem: "Sem conexão. Tente de novo." });
      } finally {
        setGerando(false);
      }
    },
    [projetoId, gerando, estado],
  );

  const alternarTeste = useCallback(
    async (indice: number) => {
      if (estado.estado !== "pronto") return;
      const feitos = estado.testesFeitos;
      const novo = feitos.includes(indice)
        ? feitos.filter((x) => x !== indice)
        : [...feitos, indice];

      const anterior = estado.testesFeitos;
      const { erroPersistencia: _erroPersistencia, ...estadoSemErro } = estado;
      setEstado({ ...estadoSemErro, testesFeitos: novo });
      const { error } = await supabase
        .from("pathly_apis")
        .update({ testes_feitos: novo })
        .eq("projeto_id", projetoId);
      if (error) {
        setEstado((atual) =>
          atual.estado === "pronto"
            ? {
                ...atual,
                testesFeitos: anterior,
                erroPersistencia: "Não consegui salvar este teste. Tente de novo.",
              }
            : atual,
        );
      }
    },
    [estado, projetoId],
  );

  return { estado, gerando, gerar, alternarTeste, recarregar: carregar };
}

/** Tudo o que se deriva do mapa, recalculado só quando ele muda. */
export function useDerivadosApi(
  mapa: MapaApi | null,
  respostas: Respostas,
  nomeProjeto: string,
  stack: string,
) {
  return useMemo(() => {
    if (!mapa) return null;

    return {
      openapi: gerarOpenApi(mapa, nomeProjeto),
      documentacao: gerarDocumentacao(mapa, nomeProjeto),
      prompts: gerarPrompts(mapa, nomeProjeto, stack),
      checklist: gerarChecklistTestes(mapa),
      conceitos: conceitosDoProjeto(respostas, mapa),
      conceitosFora: conceitosForaComMotivo(respostas, mapa),
      /** Indexado por id para a tela não recalcular a cada render de endpoint. */
      exemplos: new Map(
        mapa.endpoints.map((e) => [
          e.id,
          { curl: gerarCurl(e), resposta: gerarRespostaExemplo(e) },
        ]),
      ),
    };
  }, [mapa, respostas, nomeProjeto, stack]);
}
