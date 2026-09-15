import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Licao } from "@/lib/ia/licao-contrato";

/**
 * Busca a aula de uma tarefa. Sob demanda, quando a pessoa abre a sessão.
 *
 * O conteúdo é o mesmo para todo mundo com aquela tarefa, então a primeira pessoa paga a geração
 * e as seguintes leem do cache — ver `/api/licao`.
 */

export type EstadoLicao =
  | { estado: "carregando" }
  | { estado: "pronta"; licao: Licao }
  | { estado: "indisponivel"; motivo: string };

export type ContextoDaTarefa = {
  tarefa: string;
  etapa: string;
  objetivoEtapa: string;
  habilidades: string[];
  area: string;
};

export function useLicao(contexto: ContextoDaTarefa | null): EstadoLicao {
  const [estado, setEstado] = useState<EstadoLicao>({ estado: "carregando" });

  const assinatura = contexto
    ? `${contexto.tarefa}|${contexto.etapa}|${contexto.habilidades.join(",")}`
    : "";

  useEffect(() => {
    if (!contexto) return;
    let vivo = true;
    setEstado({ estado: "carregando" });

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          if (vivo) setEstado({ estado: "indisponivel", motivo: "sem-sessao" });
          return;
        }
        const r = await fetch("/api/licao", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(contexto),
        });
        const corpo = (await r.json()) as { licao?: Licao; motivo?: string };
        if (!vivo) return;
        if (!r.ok || !corpo.licao) {
          setEstado({ estado: "indisponivel", motivo: corpo.motivo ?? `http-${r.status}` });
          return;
        }
        setEstado({ estado: "pronta", licao: corpo.licao });
      } catch {
        if (vivo) setEstado({ estado: "indisponivel", motivo: "rede" });
      }
    })();

    return () => {
      vivo = false;
    };
    // `assinatura` no lugar do objeto: quem chama monta o contexto a cada render, e comparar a
    // referência refaria a requisição para sempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura]);

  return estado;
}
