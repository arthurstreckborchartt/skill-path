import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AcaoDaSessao, DevelopmentSession, Passo } from "./contrato";
import { podeIr, terminou } from "./contrato";
import type { ResultadoDaSessao } from "./resultado";
import type { ExecutionBrief } from "./brief";

/**
 * A sessão de desenvolvimento, na tela.
 *
 * ## O que este hook nunca faz
 *
 * Não avança sozinho. Nenhum passo acontece sem alguém clicar — nem os que parecem inofensivos,
 * como `gerar-tarefa`. O Pathly é orquestrador, não piloto: ele sabe qual é o próximo passo e
 * fica esperando.
 *
 * Isso custa cliques e vale a pena. Uma sessão que avança sozinha até `executar` coloca a pessoa
 * na posição de quem precisa **interromper** o produto em vez de conduzi-lo — e é assim que
 * alguém autoriza sem querer.
 *
 * ## `steps` é do gatilho
 *
 * Este hook nunca escreve `steps`. O banco anexa a entrada no mesmo UPDATE que muda
 * `current_step`, então a linha do tempo não consegue discordar do estado. Se este arquivo um dia
 * passar a escrever `steps`, essa garantia acaba.
 */

const AUSENTE = "PGRST205";

type Erro = { code?: string; message?: string } | null;
type Resposta<L> = { data: L[] | null; error: Erro };

type Consulta<L> = {
  eq(coluna: string, valor: unknown): Consulta<L>;
  in(coluna: string, valores: readonly unknown[]): Consulta<L>;
  not(coluna: string, op: string, valor: unknown): Consulta<L>;
  order(coluna: string, opcoes: { ascending: boolean }): Consulta<L>;
  limit(n: number): Promise<Resposta<L>>;
};

type Tabela = {
  select<L>(colunas: string): Consulta<L> & Promise<Resposta<L>>;
  insert(linhas: Record<string, unknown>[]): {
    select(colunas: string): { limit(n: number): Promise<Resposta<LinhaSessao>> };
  };
  update(campos: Record<string, unknown>): {
    eq(
      c: string,
      v: unknown,
    ): { select(colunas: string): { limit(n: number): Promise<Resposta<LinhaSessao>> } };
  };
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

const COLUNAS =
  "id,project_id,integration_id,provider,task_id,current_step,context_snapshot," +
  "requested_actions,approved_actions,executed_actions,result,errors,technical_decisions," +
  "started_at,completed_at,steps";

type LinhaSessao = {
  id: string;
  project_id: string;
  integration_id: string | null;
  provider: string | null;
  task_id: string;
  current_step: string;
  context_snapshot: unknown | null;
  requested_actions: AcaoDaSessao[] | null;
  approved_actions: AcaoDaSessao[] | null;
  executed_actions: AcaoDaSessao[] | null;
  result: unknown | null;
  errors: string[] | null;
  technical_decisions: string[] | null;
  started_at: string;
  completed_at: string | null;
  steps: { passo: Passo; em: string }[] | null;
};

function daLinha(l: LinhaSessao): DevelopmentSession {
  return {
    id: l.id,
    projectId: l.project_id,
    integrationId: l.integration_id,
    provider: l.provider,
    taskId: l.task_id,
    currentStep: l.current_step as Passo,
    contextSnapshot: l.context_snapshot,
    requestedActions: l.requested_actions ?? [],
    approvedActions: l.approved_actions ?? [],
    executedActions: l.executed_actions ?? [],
    result: l.result,
    errors: l.errors ?? [],
    technicalDecisions: l.technical_decisions ?? [],
    startedAt: l.started_at,
    completedAt: l.completed_at,
    steps: l.steps ?? [],
  };
}

const VIVOS = [
  "planejar",
  "gerar-tarefa",
  "preparar-contexto",
  "escolher-ferramenta",
  "solicitar-execucao",
  "autorizar",
  "executar",
  "receber-resultado",
  "testar",
  "validar",
  "atualizar-blueprint",
];

export type EstadoSessao =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      /** `false` quando `pathly_hub_sessoes.sql` ainda não foi executado. */
      instalado: boolean;
      /** A sessão viva desta tarefa. `null` quando não há nenhuma aberta. */
      sessao: DevelopmentSession | null;
      /** As sessões já encerradas desta tarefa, da mais recente para a mais antiga. */
      anteriores: DevelopmentSession[];
    }
  | { estado: "erro"; mensagem: string };

export function useSessao(projetoId: string, taskId: string) {
  const [estado, setEstado] = useState<EstadoSessao>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await db()
      .from("pathly_hub_sessoes")
      .select<LinhaSessao>(COLUNAS)
      .eq("project_id", projetoId)
      .eq("task_id", taskId)
      .order("started_at", { ascending: false })
      .limit(20);

    if (error?.code === AUSENTE) {
      setEstado({ estado: "pronto", instalado: false, sessao: null, anteriores: [] });
      return;
    }
    if (error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar a sessão desta etapa." });
      return;
    }

    const todas = (data ?? []).map(daLinha);
    setEstado({
      estado: "pronto",
      instalado: true,
      sessao: todas.find((s) => !terminou(s.currentStep)) ?? null,
      anteriores: todas.filter((s) => terminou(s.currentStep)),
    });
  }, [projetoId, taskId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const sessao = estado.estado === "pronto" ? estado.sessao : null;

  /** Abre uma sessão. O índice parcial no banco recusa a segunda viva para a mesma tarefa. */
  const abrir = useCallback(async (): Promise<boolean> => {
    setOcupado(true);
    setAviso(null);

    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) {
      setOcupado(false);
      setAviso("Sessão expirada. Entre de novo.");
      return false;
    }

    const { error } = await db()
      .from("pathly_hub_sessoes")
      .insert([
        { user_id: userId, project_id: projetoId, task_id: taskId, current_step: "planejar" },
      ])
      .select(COLUNAS)
      .limit(1);

    setOcupado(false);

    if (error) {
      setAviso(
        error.code === "23505"
          ? "Já existe uma sessão aberta para esta etapa."
          : "Não consegui abrir a sessão.",
      );
      return false;
    }

    await carregar();
    return true;
  }, [projetoId, taskId, carregar]);

  /**
   * Grava uma mudança na sessão. `passo` é opcional: dá para preencher campos sem avançar.
   *
   * A transição é conferida aqui **e** no gatilho. A daqui existe para a tela dar um motivo em vez
   * de um erro do Postgres; a do banco existe porque é a que não dá para contornar.
   */
  const gravar = useCallback(
    async (campos: Record<string, unknown>, passo?: Passo): Promise<boolean> => {
      if (!sessao) return false;

      if (passo) {
        if (!podeIr(sessao.currentStep, passo)) {
          setAviso(`Não dá para ir de "${sessao.currentStep}" para "${passo}".`);
          return false;
        }
        campos["current_step"] = passo;
        /*
         * O `check` no banco exige que terminar e ter `completed_at` andem juntos. Escrever os
         * dois aqui, no mesmo UPDATE, é o que impede uma sessão encerrada sem data de fim — que
         * sumiria dos relatórios sem ninguém perceber.
         */
        if (terminou(passo)) campos["completed_at"] = new Date().toISOString();
      }

      setOcupado(true);
      setAviso(null);

      const { error } = await db()
        .from("pathly_hub_sessoes")
        .update(campos)
        .eq("id", sessao.id)
        .select(COLUNAS)
        .limit(1);

      setOcupado(false);

      if (error) {
        setAviso(
          error.message?.includes("transicao de sessao invalida")
            ? "O banco recusou essa transição. Recarregue: a sessão pode ter avançado em outra aba."
            : "Não consegui gravar a sessão.",
        );
        return false;
      }

      await carregar();
      return true;
    },
    [sessao, carregar],
  );

  /** Avança um passo sem mexer em mais nada. */
  const avancar = useCallback((passo: Passo) => gravar({}, passo), [gravar]);

  const escolherFerramenta = useCallback(
    (provedorId: string, integrationId: string | null) =>
      gravar({ provider: provedorId, integration_id: integrationId }),
    [gravar],
  );

  /**
   * Congela o brief e avança.
   *
   * Os dois no mesmo UPDATE de propósito: o gatilho recusa reescrever um snapshot já preenchido,
   * então gravar e avançar separado deixaria uma janela em que a sessão passou de
   * `preparar-contexto` sem contexto nenhum.
   */
  const congelarContexto = useCallback(
    (brief: ExecutionBrief) =>
      gravar(
        { context_snapshot: brief as unknown as Record<string, unknown> },
        "escolher-ferramenta",
      ),
    [gravar],
  );

  /** O resultado, e para onde ele leva. Quem decide o passo é o status, não a boa vontade. */
  const registrarResultado = useCallback(
    (r: ResultadoDaSessao, proximo: Passo) =>
      gravar(
        {
          result: r as unknown as Record<string, unknown>,
          errors: r.errors,
          technical_decisions: r.decisions,
        },
        proximo,
      ),
    [gravar],
  );

  const cancelar = useCallback(() => gravar({}, "cancelada"), [gravar]);

  const falhar = useCallback(
    (motivo: string) => gravar({ errors: [...(sessao?.errors ?? []), motivo] }, "falhou"),
    [gravar, sessao],
  );

  return {
    ...estado,
    ocupado,
    aviso,
    limparAviso: () => setAviso(null),
    abrir,
    avancar,
    gravar,
    escolherFerramenta,
    congelarContexto,
    registrarResultado,
    cancelar,
    falhar,
    recarregar: carregar,
  };
}

/**
 * As aprovações desta sessão, para a linha do tempo.
 *
 * Só as do Hub que levam a `action` da tarefa. Quando `pathly_hub_aprovacoes` não existe, devolve
 * vazio sem barulho: a linha do tempo fica mais curta e o resto continua funcionando.
 */
export async function lerAprovacoesDaTarefa(
  taskId: string,
): Promise<{ id: string; action: string; status: string; approved_at: string | null }[]> {
  const { data, error } = await db()
    .from("pathly_hub_aprovacoes")
    .select<{ id: string; action: string; status: string; approved_at: string | null }>(
      "id,action,status,approved_at",
    )
    .eq("action", taskId)
    .order("created_at", { ascending: true })
    .limit(20);

  return error ? [] : (data ?? []);
}

/** As sessões de um projeto inteiro, para a tela de histórico. */
export async function lerSessoesDoProjeto(
  projetoId: string,
  limite = 30,
): Promise<DevelopmentSession[] | null> {
  const { data, error } = await db()
    .from("pathly_hub_sessoes")
    .select<LinhaSessao>(COLUNAS)
    .eq("project_id", projetoId)
    .order("started_at", { ascending: false })
    .limit(limite);

  return error ? null : (data ?? []).map(daLinha);
}

/** Quantas sessões vivas o projeto tem. Mais de uma é trabalho espalhado, e a tela avisa. */
export async function contarSessoesVivas(projetoId: string): Promise<number> {
  const { data, error } = await db()
    .from("pathly_hub_sessoes")
    .select<{ id: string }>("id")
    .eq("project_id", projetoId)
    .in("current_step", VIVOS)
    .limit(50);

  return error ? 0 : (data ?? []).length;
}
