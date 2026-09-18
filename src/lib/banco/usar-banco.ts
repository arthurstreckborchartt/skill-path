import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { validarModelo, type ModeloDeDados } from "./contrato";
import { DIALETOS, gerarSql, gerarSqlDesfazer, nomeDaMigration, type Dialeto } from "./dialetos";
import { gerarDocumentacao, gerarErd } from "./erd";
import { diagnosticar } from "./diagnostico";
import { gerarChecklist, gerarPrompts } from "./prompts";
import type { Respostas } from "@/lib/blueprint/respostas";

/**
 * O modelo de dados na tela.
 *
 * Tudo o que não é o modelo em si — SQL, ERD, documentação, prompts, checklist, diagnóstico —
 * é derivado aqui, na hora. Isso é o que faz trocar de dialeto ser instantâneo: não há nada
 * guardado por dialeto, só o modelo lógico.
 */

export type Modo = "aprender" | "gerar";

export type EstadoBanco =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      modelo: ModeloDeDados;
      dialeto: Dialeto;
      checklistFeito: number[];
      erroPersistencia?: string;
    }
  | { estado: "vazio" }
  | { estado: "erro"; mensagem: string; motivo?: string };

export function useModeloDeDados(projetoId: string) {
  const [estado, setEstado] = useState<EstadoBanco>({ estado: "carregando" });
  const [gerando, setGerando] = useState(false);

  /** Leitura direta do banco: a RLS decide a posse, e não custa geração. */
  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("pathly_modelos_dados")
      .select("modelo,dialeto,checklist_feito")
      .eq("projeto_id", projetoId)
      .maybeSingle();

    if (error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar o modelo de dados." });
      return;
    }
    if (!data) {
      setEstado({ estado: "vazio" });
      return;
    }

    const modelo = validarModelo(data.modelo);
    if (!modelo) {
      // Modelo gravado que não passa mais no validador: o contrato mudou desde a geração. Dizer
      // "vazio" faz a tela oferecer gerar de novo, que é a saída certa.
      setEstado({ estado: "vazio" });
      return;
    }

    setEstado({
      estado: "pronto",
      modelo,
      dialeto: (DIALETOS as readonly string[]).includes(data.dialeto)
        ? (data.dialeto as Dialeto)
        : "postgres",
      checklistFeito: Array.isArray(data.checklist_feito) ? data.checklist_feito : [],
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /** Pede ao servidor. `refazer` só quando a pessoa clica em regerar. */
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

        const r = await fetch("/api/banco", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ projetoId, refazer }),
        });
        const corpo = (await r.json()) as {
          modelo?: unknown;
          dialeto?: string;
          erro?: string;
          motivo?: string;
        };

        if (!r.ok || !corpo.modelo) {
          setEstado({
            estado: "erro",
            mensagem:
              r.status === 503
                ? "Os serviços de IA estão congestionados. Toque em tentar de novo."
                : (corpo.erro ?? "Não consegui projetar o banco agora."),
            ...(corpo.motivo ? { motivo: corpo.motivo } : {}),
          });
          return;
        }

        const modelo = validarModelo(corpo.modelo);
        if (!modelo) {
          setEstado({ estado: "erro", mensagem: "O modelo veio incompleto. Tente de novo." });
          return;
        }

        setEstado({
          estado: "pronto",
          modelo,
          dialeto: (DIALETOS as readonly string[]).includes(corpo.dialeto ?? "")
            ? (corpo.dialeto as Dialeto)
            : estado.estado === "pronto"
              ? estado.dialeto
              : "postgres",
          // Regerar não apaga o que já foi validado: os itens do checklist são da pessoa.
          checklistFeito: estado.estado === "pronto" ? estado.checklistFeito : [],
        });
      } catch {
        setEstado({ estado: "erro", mensagem: "Sem conexão. Tente de novo." });
      } finally {
        setGerando(false);
      }
    },
    [projetoId, gerando, estado],
  );

  /** Troca de dialeto é escolha da pessoa e não custa geração — só muda como o SQL é renderizado. */
  const trocarDialeto = useCallback(
    async (d: Dialeto) => {
      if (estado.estado !== "pronto") return;
      const anterior = estado.dialeto;
      const { erroPersistencia: _erroPersistencia, ...estadoSemErro } = estado;
      setEstado({ ...estadoSemErro, dialeto: d });
      const { error } = await supabase
        .from("pathly_modelos_dados")
        .update({ dialeto: d })
        .eq("projeto_id", projetoId);
      if (error) {
        setEstado((atual) =>
          atual.estado === "pronto"
            ? {
                ...atual,
                dialeto: anterior,
                erroPersistencia: "Não consegui salvar o banco escolhido. Tente de novo.",
              }
            : atual,
        );
      }
    },
    [estado, projetoId],
  );

  const alternarChecklist = useCallback(
    async (indice: number) => {
      if (estado.estado !== "pronto") return;
      const feitos = estado.checklistFeito;
      const novo = feitos.includes(indice)
        ? feitos.filter((x) => x !== indice)
        : [...feitos, indice];

      const anterior = estado.checklistFeito;
      const { erroPersistencia: _erroPersistencia, ...estadoSemErro } = estado;
      setEstado({ ...estadoSemErro, checklistFeito: novo });
      const { error } = await supabase
        .from("pathly_modelos_dados")
        .update({ checklist_feito: novo })
        .eq("projeto_id", projetoId);
      if (error) {
        setEstado((atual) =>
          atual.estado === "pronto"
            ? {
                ...atual,
                checklistFeito: anterior,
                erroPersistencia: "Não consegui salvar esta validação. Tente de novo.",
              }
            : atual,
        );
      }
    },
    [estado, projetoId],
  );

  return { estado, gerando, gerar, trocarDialeto, alternarChecklist, recarregar: carregar };
}

/** Tudo o que se deriva do modelo, recalculado só quando ele ou o dialeto mudam. */
export function useDerivados(
  modelo: ModeloDeDados | null,
  dialeto: Dialeto,
  respostas: Respostas,
  nomeProjeto: string,
) {
  return useMemo(() => {
    if (!modelo) return null;

    const achados = diagnosticar(modelo, respostas);
    const { sql, avisos } = gerarSql(modelo, dialeto);

    return {
      sql,
      avisos,
      desfazer: gerarSqlDesfazer(modelo, dialeto),
      nomeMigration: nomeDaMigration(nomeProjeto),
      erd: gerarErd(modelo),
      documentacao: gerarDocumentacao(modelo, nomeProjeto),
      achados,
      prompts: gerarPrompts(modelo, dialeto, nomeProjeto, achados),
      checklist: gerarChecklist(modelo, dialeto, achados),
    };
  }, [modelo, dialeto, respostas, nomeProjeto]);
}
