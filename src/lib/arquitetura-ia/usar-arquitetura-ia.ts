import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validarModelo, type ModeloDeDados } from "@/lib/banco/contrato";
import { validarMapa, type MapaApi } from "@/lib/api/contrato";
import { validarPlano, type PlanoIa } from "./contrato";
import { calcular, gerarRelatorio, resumir, type ContextoProjeto } from "./derivados";
import { conceitosDoPlano, conceitosForaComMotivo } from "./conceitos";

/**
 * O plano de IA na tela.
 *
 * Mesma forma dos outros módulos: só o plano é guardado. Custo, latência, observabilidade,
 * prompts e relatório são derivados na hora, porque guardá-los criaria cinco cópias da mesma
 * verdade — e a primeira mudança de preço no catálogo deixaria todas erradas de uma vez.
 */

export type EstadoArquiteturaIa =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      plano: PlanoIa;
      /** Os artefatos que dão contexto aos prompts de implementação. */
      modelo: ModeloDeDados | null;
      api: MapaApi | null;
    }
  | { estado: "vazio"; modelo: ModeloDeDados | null; api: MapaApi | null }
  | { estado: "erro"; mensagem: string; motivo?: string };

export function useArquiteturaIa(projetoId: string) {
  const [estado, setEstado] = useState<EstadoArquiteturaIa>({ estado: "carregando" });
  const [gerando, setGerando] = useState(false);

  const carregar = useCallback(async () => {
    const [salvo, doBanco, daApi] = await Promise.all([
      supabase
        .from("pathly_arquitetura_ia")
        .select("plano")
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
      setEstado({ estado: "erro", mensagem: "Não consegui carregar a arquitetura de IA." });
      return;
    }

    // Banco e API são opcionais: sem eles os prompts de implementação ficam mais genéricos, e a
    // tela avisa. Derrubar tudo por causa deles esconderia o veredito, que não depende de nenhum.
    const modelo = doBanco.error ? null : validarModelo(doBanco.data?.modelo);
    const api = daApi.error ? null : validarMapa(daApi.data?.mapa);

    const plano = validarPlano(salvo.data?.plano);
    // Plano gravado que não passa mais no validador: o contrato mudou. "Vazio" faz a tela
    // oferecer gerar de novo, que é a saída certa.
    setEstado(plano ? { estado: "pronto", plano, modelo, api } : { estado: "vazio", modelo, api });
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

        const r = await fetch("/api/arquitetura-ia", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ projetoId, refazer }),
        });
        const corpo = (await r.json()) as { plano?: unknown; erro?: string; motivo?: string };

        if (!r.ok || !corpo.plano) {
          setEstado({
            estado: "erro",
            mensagem:
              r.status === 503
                ? "Os serviços de IA estão congestionados. Toque em tentar de novo."
                : (corpo.erro ?? "Não consegui projetar a arquitetura de IA agora."),
            ...(corpo.motivo ? { motivo: corpo.motivo } : {}),
          });
          return;
        }

        const plano = validarPlano(corpo.plano);
        if (!plano) {
          setEstado({ estado: "erro", mensagem: "O plano veio incompleto. Tente de novo." });
          return;
        }

        setEstado((atual) => ({
          estado: "pronto",
          plano,
          modelo: atual.estado === "pronto" || atual.estado === "vazio" ? atual.modelo : null,
          api: atual.estado === "pronto" || atual.estado === "vazio" ? atual.api : null,
        }));
      } catch {
        setEstado({ estado: "erro", mensagem: "Sem conexão. Tente de novo." });
      } finally {
        setGerando(false);
      }
    },
    [projetoId, gerando],
  );

  return { estado, gerando, gerar, recarregar: carregar };
}

/** Tudo o que se deriva do plano, recalculado só quando ele ou o contexto mudam. */
export function useDerivadosIa(plano: PlanoIa | null, contexto: ContextoProjeto | null) {
  return useMemo(() => {
    if (!plano || !contexto) return null;

    const calculadas = plano.funcionalidades.map((f) => calcular(f, contexto));
    const resumo = resumir(calculadas);

    return {
      calculadas,
      resumo,
      conceitos: conceitosDoPlano(plano),
      conceitosFora: conceitosForaComMotivo(plano),
      relatorio: gerarRelatorio(plano, calculadas, resumo, contexto.nome),
    };
  }, [plano, contexto]);
}
