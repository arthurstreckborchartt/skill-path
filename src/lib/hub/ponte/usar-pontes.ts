import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Capacidade } from "../capacidades";
import type { Plano, Ponte } from "./contrato";
import { VALIDADE_PLANO_MIN, estadoPorBatida } from "./contrato";
import { acharAcao, exigeSimulacao } from "./acoes";

/**
 * As pontes locais, na tela.
 *
 * ## Duas coisas que este hook nunca faz
 *
 * **Não cria ponte.** Quem cria é `/api/ponte` no pareamento, porque é lá que o token nasce — e o
 * token não deve passar pelo navegador. A tela gera o código de seis letras e a pessoa digita na
 * ponte; o segredo fica entre a ponte e o servidor.
 *
 * **Não executa nada que altere sem plano.** `pedirExecucao` recusa, aqui mesmo, criar uma tarefa
 * de execução para uma ação que altera sem `planoId`. A ponte recusaria de novo e o banco também
 * — três recusas para a mesma regra, e nenhuma delas confia nas outras.
 */

const AUSENTE = "PGRST205";

type Erro = { code?: string; message?: string } | null;
type Resp<L> = { data: L[] | null; error: Erro };

type Consulta<L> = {
  eq(c: string, v: unknown): Consulta<L>;
  order(c: string, o: { ascending: boolean }): Consulta<L>;
  limit(n: number): Promise<Resp<L>>;
};

type Tabela = {
  select<L>(colunas: string): Consulta<L> & Promise<Resp<L>>;
  insert(linhas: Record<string, unknown>[]): {
    select(colunas: string): { limit(n: number): Promise<Resp<{ id: string }>> };
  };
  update(campos: Record<string, unknown>): { eq(c: string, v: unknown): Promise<{ error: Erro }> };
  delete(): { eq(c: string, v: unknown): Promise<{ error: Erro }> };
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

type LinhaPonte = {
  id: string;
  nome: string;
  plataforma: string;
  versao: string;
  adaptadores: string[] | null;
  ultima_batida: string | null;
  criada_em: string;
  revogada_em: string | null;
};

export type TarefaNaTela = {
  id: string;
  ponteId: string;
  acaoId: string;
  parametros: Record<string, unknown>;
  modo: "simulacao" | "execucao";
  estado: string;
  resultado: {
    tipo?: string;
    plano?: Plano;
    dados?: unknown;
    detalhe?: string;
    mensagem?: string;
  } | null;
  recusa: string | null;
  criadaEm: string;
};

export type EstadoPontes =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      /** `false` quando `supabase/pathly_pontes.sql` ainda não foi executado. */
      instalado: boolean;
      pontes: Ponte[];
      tarefas: TarefaNaTela[];
      /** As capacidades concedidas, por ponte. */
      permissoes: Record<string, Capacidade[]>;
    }
  | { estado: "erro"; mensagem: string };

export function usePontes() {
  const [estado, setEstado] = useState<EstadoPontes>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [ps, ts, perms] = await Promise.all([
      db()
        .from("pathly_pontes")
        .select<LinhaPonte>(
          "id,nome,plataforma,versao,adaptadores,ultima_batida,criada_em,revogada_em",
        )
        .order("criada_em", { ascending: false })
        .limit(20),
      db()
        .from("pathly_ponte_tarefas")
        .select<{
          id: string;
          ponte_id: string;
          acao_id: string;
          parametros: Record<string, unknown>;
          modo: string;
          estado: string;
          resultado: TarefaNaTela["resultado"];
          recusa: string | null;
          criada_em: string;
        }>("id,ponte_id,acao_id,parametros,modo,estado,resultado,recusa,criada_em")
        .order("criada_em", { ascending: false })
        .limit(40),
      db()
        .from("pathly_hub_permissoes")
        .select<{ provedor: string; capacidade: string; revogada_em: string | null }>(
          "provedor,capacidade,revogada_em",
        )
        .limit(400),
    ]);

    if (ps.error?.code === AUSENTE) {
      setEstado({ estado: "pronto", instalado: false, pontes: [], tarefas: [], permissoes: {} });
      return;
    }
    if (ps.error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar as pontes." });
      return;
    }

    const permissoes: Record<string, Capacidade[]> = {};
    for (const p of perms.data ?? []) {
      if (p.revogada_em || !p.provedor.startsWith("ponte:")) continue;
      const id = p.provedor.slice("ponte:".length);
      (permissoes[id] ??= []).push(p.capacidade as Capacidade);
    }

    setEstado({
      estado: "pronto",
      instalado: true,
      permissoes,
      pontes: (ps.data ?? []).map((l) => ({
        id: l.id,
        nome: l.nome,
        plataforma: l.plataforma,
        versao: l.versao,
        adaptadores: l.adaptadores ?? [],
        capacidades: permissoes[l.id] ?? [],
        ultimaBatida: l.ultima_batida,
        criadaEm: l.criada_em,
        revogadaEm: l.revogada_em,
      })),
      tarefas: (ts.data ?? []).map((t) => ({
        id: t.id,
        ponteId: t.ponte_id,
        acaoId: t.acao_id,
        parametros: t.parametros ?? {},
        modo: t.modo as "simulacao" | "execucao",
        estado: t.estado,
        resultado: t.resultado,
        recusa: t.recusa,
        criadaEm: t.criada_em,
      })),
    });
  }, []);

  useEffect(() => {
    void carregar();
    /*
     * Recarrega no intervalo da batida. É o que faz o indicador de online/offline valer alguma
     * coisa — um estado que só muda quando a pessoa recarrega a página não é um estado, é uma
     * foto antiga.
     */
    const t = window.setInterval(() => void carregar(), 10_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  // ---- Pareamento ----------------------------------------------------------------------------

  /**
   * Gera o código de seis letras.
   *
   * Quem gera é o servidor, porque ele guarda só o hash — a tela recebe o código em claro uma vez
   * e o mostra; ninguém consegue recuperá-lo depois, nem o Pathly.
   */
  const gerarCodigo = useCallback(async (): Promise<
    { ok: true; codigo: string; expiraEm: string } | { ok: false; motivo: string }
  > => {
    setOcupado(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setOcupado(false);
      return { ok: false, motivo: "Sessão expirada." };
    }

    const r = await fetch("/api/ponte/codigo", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    const corpo = (await r.json()) as { codigo?: string; expiraEm?: string; erro?: string };
    setOcupado(false);

    return corpo.codigo && corpo.expiraEm
      ? { ok: true, codigo: corpo.codigo, expiraEm: corpo.expiraEm }
      : { ok: false, motivo: corpo.erro ?? "Não consegui gerar o código." };
  }, []);

  // ---- Permissões ------------------------------------------------------------------------------

  /**
   * Concede ou revoga uma capacidade para uma ponte.
   *
   * Revogar não apaga a linha: marca `revogada_em`. O histórico de que aquilo já foi autorizado é
   * exatamente o que alguém procura depois de um susto.
   */
  const alternarPermissao = useCallback(
    async (ponteId: string, capacidade: Capacidade, conceder: boolean): Promise<boolean> => {
      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return false;

      const provedor = `ponte:${ponteId}`;
      if (conceder) {
        const { error } = await db()
          .from("pathly_hub_permissoes")
          .insert([{ user_id: userId, provedor, capacidade, projeto_id: null }])
          .select("id")
          .limit(1);
        if (error) {
          setAviso("Não consegui conceder a permissão.");
          return false;
        }
      } else {
        const { error } = await db()
          .from("pathly_hub_permissoes")
          .update({ revogada_em: new Date().toISOString() })
          .eq("provedor", provedor);
        if (error) {
          setAviso("Não consegui revogar.");
          return false;
        }
      }
      await carregar();
      return true;
    },
    [carregar],
  );

  /**
   * Revoga a ponte inteira.
   *
   * A ponte descobre no próximo `buscar`: o servidor responde 403 e ela sai sozinha. Não há como
   * o Pathly matar um processo na máquina de alguém — o que ele pode é parar de responder, e é o
   * que acontece.
   */
  const revogarPonte = useCallback(
    async (ponteId: string): Promise<boolean> => {
      const { error } = await db()
        .from("pathly_pontes")
        .update({ revogada_em: new Date().toISOString() })
        .eq("id", ponteId);
      if (error) {
        setAviso("Não consegui revogar a ponte.");
        return false;
      }
      await carregar();
      return true;
    },
    [carregar],
  );

  // ---- Tarefas ----------------------------------------------------------------------------------

  /** Pede uma simulação. É sempre o primeiro passo de qualquer coisa que altere. */
  const pedirSimulacao = useCallback(
    async (
      ponteId: string,
      acaoId: string,
      parametros: Record<string, unknown>,
      projetoId: string | null,
    ): Promise<string | null> => {
      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return null;

      const { data, error } = await db()
        .from("pathly_ponte_tarefas")
        .insert([
          {
            user_id: userId,
            ponte_id: ponteId,
            project_id: projetoId,
            acao_id: acaoId,
            parametros,
            modo: "simulacao",
            expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
          },
        ])
        .select("id")
        .limit(1);

      if (error) {
        setAviso("Não consegui enfileirar a simulação.");
        return null;
      }
      await carregar();
      return data?.[0]?.id ?? null;
    },
    [carregar],
  );

  /**
   * Autoriza um plano e enfileira a execução.
   *
   * A recusa daqui é a primeira das três: o navegador não cria execução de ação que altera sem
   * plano. A ponte recusaria de novo e o `check` do banco também — e nenhuma das três confia nas
   * outras, porque é o tipo de regra em que uma brecha custa o modelo de alguém.
   */
  const autorizarPlano = useCallback(
    async (
      ponteId: string,
      acaoId: string,
      parametros: Record<string, unknown>,
      plano: Plano,
      tarefaDaSimulacao: string,
      projetoId: string | null,
    ): Promise<boolean> => {
      if (exigeSimulacao(acaoId) && !plano.planoId) {
        setAviso("Esta ação exige uma simulação antes.");
        return false;
      }
      if (new Date(plano.expiraEm) <= new Date()) {
        setAviso(`A simulação venceu (valia ${VALIDADE_PLANO_MIN} minutos). Simule de novo.`);
        return false;
      }

      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return false;

      const { error } = await db()
        .from("pathly_ponte_tarefas")
        .insert([
          {
            user_id: userId,
            ponte_id: ponteId,
            project_id: projetoId,
            acao_id: acaoId,
            parametros,
            modo: "execucao",
            plano_id: tarefaDaSimulacao,
            impressao_plano: plano.impressao,
            expira_em: new Date(Date.now() + 10 * 60_000).toISOString(),
          },
        ])
        .select("id")
        .limit(1);

      if (error) {
        setAviso("Não consegui enfileirar a execução.");
        return false;
      }
      await carregar();
      return true;
    },
    [carregar],
  );

  /** Cancela uma tarefa que ainda não foi buscada. */
  const cancelarTarefa = useCallback(
    async (id: string): Promise<boolean> => {
      const { error } = await db()
        .from("pathly_ponte_tarefas")
        .update({ estado: "cancelada", concluida_em: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        setAviso("Essa tarefa já saiu para a ponte — não dá mais para cancelar daqui.");
        return false;
      }
      await carregar();
      return true;
    },
    [carregar],
  );

  return {
    ...estado,
    ocupado,
    aviso,
    limparAviso: () => setAviso(null),
    gerarCodigo,
    alternarPermissao,
    revogarPonte,
    pedirSimulacao,
    autorizarPlano,
    cancelarTarefa,
    recarregar: carregar,
  };
}

/** O estado de uma ponte agora. Recalculado a cada render, porque ele depende do relógio. */
export function estadoDe(p: Ponte, agora = new Date()) {
  return estadoPorBatida(p.ultimaBatida, p.revogadaEm, agora);
}

/** As simulações que voltaram e ainda esperam decisão. */
export function planosPendentes(tarefas: readonly TarefaNaTela[]): TarefaNaTela[] {
  return tarefas.filter(
    (t) =>
      t.modo === "simulacao" &&
      t.estado === "concluida" &&
      t.resultado?.tipo === "plano" &&
      t.resultado.plano &&
      new Date(t.resultado.plano.expiraEm) > new Date(),
  );
}

/** O título legível de uma ação, para a tela não mostrar o id cru. */
export function tituloDaAcao(id: string): string {
  return acharAcao(id)?.titulo ?? id;
}
