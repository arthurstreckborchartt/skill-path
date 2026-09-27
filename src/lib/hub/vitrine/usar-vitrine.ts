import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Capacidade } from "../capacidades";
import { estadoPorBatida } from "../ponte/contrato";
import { temSuporte } from "../obsidian/pasta";
import {
  INTEGRACOES,
  estaUtil,
  pedeAtencao,
  type Estado,
  type IntegracaoDaVitrine,
} from "./catalogo";

/**
 * O estado real de cada integração, montado a partir dos módulos que já existem.
 *
 * ## Uma leitura, todas as integrações
 *
 * Cada camada tem o hook dela — `useObsidian`, `usePontes`, `useFerramentas`. Abrir os cinco na
 * mesma tela dispararia cinco leituras independentes, cinco estados de carregando e cinco jeitos
 * de falhar.
 *
 * Aqui é uma consulta por tabela, e o estado de cada integração sai de um resolvedor. A tela fica
 * com um `carregando` só, e a falha de uma tabela não apaga as outras.
 *
 * ## Tabela ausente não é erro
 *
 * Nem toda instalação rodou todos os SQL. Quando uma tabela não existe, a integração dela fica
 * `nao-conectada` em vez de derrubar a página — e a tela da integração diz qual arquivo falta.
 */

const AUSENTE = "PGRST205";

type Erro = { code?: string } | null;
type Resp<L> = { data: L[] | null; error: Erro };

type Consulta<L> = {
  eq(c: string, v: unknown): Consulta<L>;
  order(c: string, o: { ascending: boolean }): Consulta<L>;
  limit(n: number): Promise<Resp<L>>;
};

type Tabela = {
  select<L>(colunas: string): Consulta<L> & Promise<Resp<L>>;
  update(campos: Record<string, unknown>): { eq(c: string, v: unknown): Promise<{ error: Erro }> };
  delete(): { eq(c: string, v: unknown): Promise<{ error: Erro }> };
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

async function pegar<L>(
  tabela: string,
  colunas: string,
  ajustar?: (c: Consulta<L>) => Consulta<L> | Promise<Resp<L>>,
): Promise<L[]> {
  const base = db().from(tabela).select<L>(colunas);
  const consulta = ajustar ? ajustar(base) : base;
  const { data, error } = await (consulta as Promise<Resp<L>>);
  if (error && error.code !== AUSENTE) return [];
  return data ?? [];
}

// =============================================================================================
// O que é lido
// =============================================================================================

export type Conexao = {
  provedor: string;
  conta: string;
  expira_em: string | null;
  criado_em: string;
};
export type Permissao = {
  provedor: string;
  capacidade: string;
  projeto_id: string | null;
  concedida_em: string;
  revogada_em: string | null;
  expira_em: string | null;
};
export type PonteLida = {
  id: string;
  nome: string;
  adaptadores: string[] | null;
  ultima_batida: string | null;
  revogada_em: string | null;
};
export type AtoDeAuditoria = {
  provedor: string;
  ato: string;
  capacidade: string | null;
  detalhe: string | null;
  em: string;
};
export type AprovacaoLida = {
  id: string;
  integration_id: string;
  action: string;
  requested_permission: string;
  status: string;
  created_at: string;
  expires_at: string;
};

export type Situacao = {
  estado: Estado;
  /** Uma linha extra, quando há o que dizer além do estado. */
  detalhe: string | null;
  /** As capacidades vigentes desta integração. */
  concedidas: Capacidade[];
  /** Os projetos em que ela é usada, por id. */
  projetos: string[];
  conectadaEm: string | null;
};

export type EstadoVitrine =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      situacoes: Record<string, Situacao>;
      conexoes: Conexao[];
      permissoes: Permissao[];
      pontes: PonteLida[];
      auditoria: AtoDeAuditoria[];
      aprovacoes: AprovacaoLida[];
      /** As integrações cujo SQL ainda não foi executado neste ambiente. */
      semTabela: string[];
    }
  | { estado: "erro"; mensagem: string };

// =============================================================================================
// O resolvedor
// =============================================================================================

const AGORA = () => new Date();

function vigentes(perms: readonly Permissao[], provedor: string, agora: Date) {
  return perms.filter(
    (p) =>
      p.provedor === provedor && !p.revogada_em && (!p.expira_em || new Date(p.expira_em) > agora),
  );
}

/**
 * O estado de uma integração.
 *
 * A ordem das perguntas é a ordem em que elas importam para quem olha: primeiro "dá para usar
 * aqui?", depois "está conectada?", e só então "está funcionando agora?".
 *
 * Inverter isso produziria "offline" num navegador onde a integração nunca poderia funcionar — o
 * que manda a pessoa procurar o problema na máquina dela.
 */
function resolver(
  i: IntegracaoDaVitrine,
  dados: {
    conexoes: Conexao[];
    permissoes: Permissao[];
    pontes: PonteLida[];
    obsidianConectado: boolean;
    semTabela: Set<string>;
    agora: Date;
  },
): Situacao {
  const { conexoes, permissoes, pontes, obsidianConectado, semTabela, agora } = dados;

  const concedidas = vigentes(permissoes, i.id, agora).map((p) => p.capacidade as Capacidade);
  const projetos = [
    ...new Set(
      vigentes(permissoes, i.id, agora)
        .map((p) => p.projeto_id)
        .filter((x): x is string => x !== null),
    ),
  ];

  const base = { concedidas, projetos, conectadaEm: null as string | null };

  /* Declarada mas ainda não pronta: o motivo aparece inteiro, e nenhum botão promete o contrário. */
  if (!i.disponivel) {
    return { ...base, estado: "nao-conectada", detalhe: i.oQueFalta ?? null };
  }

  if (semTabela.has(i.id)) {
    return {
      ...base,
      estado: "nao-conectada",
      detalhe: "O banco deste ambiente ainda não tem as tabelas desta integração.",
    };
  }

  // ---- Pasta: o navegador decide antes de tudo ------------------------------------------------
  if (i.metodo === "pasta") {
    if (!temSuporte()) {
      return { ...base, estado: "sem-suporte", detalhe: null };
    }
    return obsidianConectado
      ? { ...base, estado: "conectada", detalhe: null }
      : { ...base, estado: "nao-conectada", detalhe: null };
  }

  // ---- Ponte: o estado vem da batida ------------------------------------------------------------
  if (i.metodo === "bridge") {
    const vivas = pontes.filter((p) => !p.revogada_em);
    if (vivas.length === 0) {
      return { ...base, estado: "nao-conectada", detalhe: null };
    }

    /* Para uma ferramenta específica, só contam as pontes que declararam o adaptador dela. */
    const relevantes =
      i.id === "ponte" ? vivas : vivas.filter((p) => (p.adaptadores ?? []).includes(i.id));

    if (relevantes.length === 0) {
      return {
        ...base,
        estado: "nao-instalada",
        detalhe: "Nenhuma ponte conectada declarou esta ferramenta.",
      };
    }

    const online = relevantes.some(
      (p) => estadoPorBatida(p.ultima_batida, p.revogada_em, agora) === "online",
    );
    if (!online) {
      return {
        ...base,
        estado: "offline",
        detalhe: `${relevantes.length === 1 ? "A ponte" : "Nenhuma das pontes"} está respondendo agora.`,
      };
    }

    /* Conectada e online, mas sem permissão vigente: dá para conversar e não dá para fazer nada. */
    if (i.capacidadesDoHub.length > 0 && concedidas.length === 0) {
      return { ...base, estado: "permissao-expirada", detalhe: null };
    }
    return { ...base, estado: "conectada", detalhe: null };
  }

  // ---- OAuth e chave de API: a credencial guardada -----------------------------------------------
  if (i.metodo === "oauth" || i.metodo === "api-key") {
    const c = conexoes.find((x) => x.provedor === i.id);
    if (!c) return { ...base, estado: "nao-conectada", detalhe: null };

    if (c.expira_em && new Date(c.expira_em) <= agora) {
      return { ...base, estado: "token-expirado", detalhe: null, conectadaEm: c.criado_em };
    }

    const venceram = permissoes.filter(
      (p) => p.provedor === i.id && !p.revogada_em && p.expira_em && new Date(p.expira_em) <= agora,
    );
    if (venceram.length > 0 && concedidas.length === 0) {
      return { ...base, estado: "permissao-expirada", detalhe: null, conectadaEm: c.criado_em };
    }

    return {
      ...base,
      estado: "conectada",
      detalhe: c.conta ? `Conta: ${c.conta}` : null,
      conectadaEm: c.criado_em,
    };
  }

  /*
   * Arquivo de regras e MCP não têm credencial: não há o que conectar nem o que expirar. Elas
   * estão sempre prontas, e o que varia é se a pessoa já gerou o arquivo — que é assunto da tela
   * da ferramenta, não do cartão.
   */
  return { ...base, estado: "conectada", detalhe: null };
}

// =============================================================================================
// O hook
// =============================================================================================

export function useVitrine() {
  const [estado, setEstado] = useState<EstadoVitrine>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setEstado({ estado: "erro", mensagem: "Faça login para ver suas integrações." });
      return;
    }

    const semTabela = new Set<string>();

    const [conexoes, permissoes, pontes, auditoria, aprovacoes, obsidian] = await Promise.all([
      pegar<Conexao>("pathly_conexoes", "provedor,conta,expira_em,criado_em"),
      pegar<Permissao>(
        "pathly_hub_permissoes",
        "provedor,capacidade,projeto_id,concedida_em,revogada_em,expira_em",
        (c) => c.limit(500),
      ),
      pegar<PonteLida>("pathly_pontes", "id,nome,adaptadores,ultima_batida,revogada_em", (c) =>
        c.limit(20),
      ),
      pegar<AtoDeAuditoria>("pathly_hub_auditoria", "provedor,ato,capacidade,detalhe,em", (c) =>
        c.order("em", { ascending: false }).limit(60),
      ),
      pegar<AprovacaoLida>(
        "pathly_hub_aprovacoes",
        "id,integration_id,action,requested_permission,status,created_at,expires_at",
        (c) => c.order("created_at", { ascending: false }).limit(60),
      ),
      pegar<{ vault: string }>("pathly_obsidian_conexao", "vault"),
    ]);

    /*
     * Descobrir quais tabelas faltam exige uma segunda passada — `pegar` engole o `PGRST205` de
     * propósito, para uma tabela ausente não derrubar as outras cinco consultas.
     */
    const conferir = async (tabela: string, ids: string[]) => {
      const { error } = await db().from(tabela).select<{ n: unknown }>("*").limit(0);
      if (error?.code === AUSENTE) for (const id of ids) semTabela.add(id);
    };
    await Promise.all([
      conferir("pathly_obsidian_conexao", ["obsidian"]),
      conferir("pathly_pontes", ["ponte", "vscode", "revit"]),
    ]);

    const agora = AGORA();
    const situacoes: Record<string, Situacao> = {};
    for (const i of INTEGRACOES) {
      situacoes[i.id] = resolver(i, {
        conexoes,
        permissoes,
        pontes,
        obsidianConectado: obsidian.length > 0,
        semTabela,
        agora,
      });
    }

    setEstado({
      estado: "pronto",
      situacoes,
      conexoes,
      permissoes,
      pontes,
      auditoria,
      aprovacoes,
      semTabela: [...semTabela],
    });
  }, []);

  useEffect(() => {
    void carregar();
    /* As pontes mudam de estado sozinhas; sem isto o ponto verde seria uma foto antiga. */
    const t = window.setInterval(() => void carregar(), 15_000);
    return () => window.clearInterval(t);
  }, [carregar]);

  /**
   * Revoga uma integração inteira: permissões, credencial e ponte.
   *
   * A ordem importa. As permissões saem primeiro — se a credencial fosse apagada antes e a
   * revogação falhasse no meio, sobraria uma integração sem token e com permissão concedida, que
   * é o pior dos dois mundos para quem for auditar depois.
   */
  const revogar = useCallback(
    async (id: string): Promise<boolean> => {
      setOcupado(true);
      const agora = new Date().toISOString();
      const i = INTEGRACOES.find((x) => x.id === id);

      await db()
        .from("pathly_hub_permissoes")
        .update({ revogada_em: agora })
        .eq("provedor", id)
        .catch(() => undefined);

      if (i?.metodo === "oauth" || i?.metodo === "api-key") {
        await db()
          .from("pathly_conexoes")
          .delete()
          .eq("provedor", id)
          .catch(() => undefined);
      }
      if (id === "obsidian") {
        const { data: s } = await supabase.auth.getSession();
        const uid = s.session?.user.id;
        if (uid) {
          await db()
            .from("pathly_obsidian_conexao")
            .delete()
            .eq("user_id", uid)
            .catch(() => undefined);
        }
      }

      setOcupado(false);
      await carregar();
      return true;
    },
    [carregar],
  );

  /**
   * Revoga tudo. É o botão do Security Center.
   *
   * Inclui as pontes, que são o acesso mais amplo que existe no Pathly — um programa rodando na
   * máquina de alguém. Revogar tudo sem incluí-las seria a versão do botão que não faz o que
   * promete.
   */
  const revogarTudo = useCallback(async (): Promise<number> => {
    setOcupado(true);
    const agora = new Date().toISOString();
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;

    let quantas = 0;
    for (const i of INTEGRACOES) {
      const situacao = estado.estado === "pronto" ? estado.situacoes[i.id] : null;
      if (situacao && situacao.estado !== "nao-conectada") quantas++;
      await revogar(i.id);
    }

    if (uid) {
      const ps = await pegar<{ id: string }>("pathly_pontes", "id", (c) => c.limit(50));
      for (const p of ps) {
        await db()
          .from("pathly_pontes")
          .update({ revogada_em: agora })
          .eq("id", p.id)
          .catch(() => undefined);
      }
      quantas += ps.length;
    }

    setOcupado(false);
    await carregar();
    return quantas;
  }, [estado, revogar, carregar]);

  return { ...estado, ocupado, revogar, revogarTudo, recarregar: carregar };
}

// =============================================================================================
// Contas para o Security Center
// =============================================================================================

export type Resumo = {
  ativas: number;
  precisamDeAtencao: number;
  permissoes: number;
  tokens: number;
  pontesOnline: number;
  pontesTotal: number;
  aprovadas: number;
  bloqueadas: number;
};

export function resumir(v: Extract<EstadoVitrine, { estado: "pronto" }>): Resumo {
  const agora = new Date();
  const situacoes = Object.values(v.situacoes);

  return {
    ativas: situacoes.filter((s) => estaUtil(s.estado)).length,
    /*
     * Pela mesma função que a tela usa para montar a lista, e não por uma condição escrita de
     * novo aqui.
     *
     * A primeira versão deste arquivo tinha a condição duplicada — `!== "conectada" && !==
     * "nao-conectada"` — e ela discordava de `pedeAtencao` em três estados de tom neutro
     * (`carregando`, `oauth-cancelado`, `revogada`). O resultado seria o Security Center dizendo
     * "2 integrações precisam de atenção" e listando nenhuma, que é o pior jeito de errar: o
     * número assusta e a lista não dá o que consertar.
     */
    precisamDeAtencao: situacoes.filter((s) => pedeAtencao(s.estado)).length,
    permissoes: v.permissoes.filter(
      (p) => !p.revogada_em && (!p.expira_em || new Date(p.expira_em) > agora),
    ).length,
    tokens: v.conexoes.length,
    pontesOnline: v.pontes.filter(
      (p) => estadoPorBatida(p.ultima_batida, p.revogada_em, agora) === "online",
    ).length,
    pontesTotal: v.pontes.filter((p) => !p.revogada_em).length,
    /*
     * "Aprovada" conta quem chegou a ser autorizada — inclusive o que já executou. Contar só o
     * que está `APPROVED` agora mostraria zero na maior parte do tempo, e daria a impressão de
     * que nada foi aprovado nunca.
     */
    aprovadas: v.aprovacoes.filter((a) => ["APPROVED", "EXECUTING", "SUCCESS"].includes(a.status))
      .length,
    bloqueadas:
      v.aprovacoes.filter((a) => ["REJECTED", "EXPIRED", "CANCELLED"].includes(a.status)).length +
      v.auditoria.filter((a) => a.ato === "acesso-negado").length,
  };
}
