import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Papel, PreferenciasDoProjeto } from "./contrato";
import { PREFERENCIAS_VAZIAS } from "./contrato";
import type { RegistroDeTrabalho, TipoDeRegistro, Origem } from "./retorno";

/**
 * As ferramentas de IA na tela.
 *
 * ## Por que o acesso é destipado aqui
 *
 * `src/integrations/supabase/types.ts` é gerado pelo Lovable a partir do banco dele, e as tabelas
 * `pathly_hub_*` nasceram neste repositório — não estão lá. Editar o arquivo gerado para que
 * estivessem é justamente o que faz o app compilar como se a tabela existisse, que é a armadilha
 * descrita no `CLAUDE.md`.
 *
 * Então: contrato mínimo, explícito, igual ao que `cloud-sync.ts` e `revisao.ts` já fazem. O
 * typecheck para de mentir nos dois sentidos — não afirma que a tabela existe, e não quebra
 * quando o arquivo gerado for regerado.
 *
 * ## Tabela ausente é um estado, não um erro
 *
 * `pathly_hub_ferramentas.sql` está **gerado**, não executado. Enquanto ninguém o rodar, a
 * consulta volta `PGRST205` e a tela diz exatamente isso, com o nome do arquivo. Uma lista vazia
 * no lugar leria como "você ainda não configurou nada" — que é falso, e manda a pessoa procurar o
 * problema no lugar errado.
 */

const AUSENTE = "PGRST205";

type Erro = { code?: string } | null;
type Resposta<L> = { data: L[] | null; error: Erro };

/*
 * `L` é a forma da linha que cada consulta espera. Declarar por consulta, e não uma vez para a
 * tabela toda, mantém o tipo colado ao `select` que está logo ali — se a lista de colunas mudar e
 * o tipo não, o erro aparece na mesma linha.
 */
type Consulta<L> = {
  eq(coluna: string, valor: unknown): Consulta<L>;
  order(coluna: string, opcoes: { ascending: boolean }): Consulta<L>;
  limit(n: number): Promise<Resposta<L>>;
};

type Tabela = {
  select<L>(colunas: string): Consulta<L> & Promise<Resposta<L>>;
  insert(linhas: Record<string, unknown>[]): Promise<{ error: Erro }>;
  upsert(linha: Record<string, unknown>, opcoes: { onConflict: string }): Promise<{ error: Erro }>;
  delete(): { eq(c: string, v: unknown): { eq(c: string, v: unknown): Promise<{ error: Erro }> } };
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

// =============================================================================================
// A visão geral — o que a tela de configurações mostra
// =============================================================================================

/** O que o Pathly sabe sobre uma ferramenta, do lado do banco. */
export type SituacaoDaFerramenta = {
  /** Há credencial guardada? Só faz sentido para quem o Pathly chama. */
  conectado: boolean;
  /** Uma dica da conta, nunca a credencial. Vem de `pathly_conexoes.conta`. */
  conta: string | null;
  conectadoEm: string | null;
  /** Quando esta ferramenta apareceu pela última vez num registro de trabalho. */
  ultimoUso: string | null;
};

export type EstadoFerramentas =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      /** `false` quando `pathly_hub_ferramentas.sql` ainda não foi executado. */
      instalado: boolean;
      situacao: Record<string, SituacaoDaFerramenta>;
    }
  | { estado: "erro"; mensagem: string };

function vazia(): SituacaoDaFerramenta {
  return { conectado: false, conta: null, conectadoEm: null, ultimoUso: null };
}

export function useFerramentas() {
  const [estado, setEstado] = useState<EstadoFerramentas>({ estado: "carregando" });

  const carregar = useCallback(async () => {
    /*
     * Duas fontes, de propósito diferentes. `pathly_conexoes` guarda credencial e é a mesma
     * tabela do GitHub — nunca pedimos `token_cifrado`, e nem adiantaria: o privilégio é por
     * coluna e o token não está na lista.
     */
    const [conex, registros] = await Promise.all([
      supabase.from("pathly_conexoes").select("provedor,conta,criado_em"),
      db()
        .from("pathly_hub_registros")
        .select<{ provedor_id: string; criado_em: string }>("provedor_id,criado_em")
        .order("criado_em", { ascending: false })
        .limit(200),
    ]);

    if (conex.error && conex.error.code !== AUSENTE) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar suas ferramentas." });
      return;
    }

    const situacao: Record<string, SituacaoDaFerramenta> = {};

    for (const c of conex.data ?? []) {
      situacao[c.provedor] = {
        conectado: true,
        conta: c.conta || null,
        conectadoEm: c.criado_em,
        ultimoUso: null,
      };
    }

    const instalado = registros.error?.code !== AUSENTE;

    /*
     * A lista já vem do mais recente para o mais antigo, então o primeiro de cada provedor é o
     * último uso. Dá para fazer isso no banco com `distinct on`, mas PostgREST não expõe — e
     * duzentas linhas em memória custam menos que uma função no banco para manter.
     */
    for (const r of registros.data ?? []) {
      const id = r.provedor_id;
      situacao[id] ??= vazia();
      situacao[id].ultimoUso ??= r.criado_em;
    }

    setEstado({ estado: "pronto", instalado, situacao });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return { ...estado, recarregar: carregar };
}

// =============================================================================================
// A ferramenta de um projeto
// =============================================================================================

export type EstadoPreferencias =
  | { estado: "carregando" }
  | { estado: "pronto"; instalado: boolean; preferencias: PreferenciasDoProjeto }
  | { estado: "erro"; mensagem: string };

export function useFerramentaDoProjeto(projetoId: string | null) {
  const [estado, setEstado] = useState<EstadoPreferencias>({ estado: "carregando" });
  const [salvando, setSalvando] = useState<Papel | null>(null);

  const carregar = useCallback(async () => {
    if (!projetoId) {
      setEstado({ estado: "pronto", instalado: true, preferencias: { ...PREFERENCIAS_VAZIAS } });
      return;
    }

    const { data, error } = await db()
      .from("pathly_hub_ferramentas_projeto")
      .select<{ papel: string; provedor_id: string }>("papel,provedor_id")
      .eq("project_id", projetoId)
      .limit(8);

    if (error?.code === AUSENTE) {
      setEstado({ estado: "pronto", instalado: false, preferencias: { ...PREFERENCIAS_VAZIAS } });
      return;
    }
    if (error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar a escolha deste projeto." });
      return;
    }

    const preferencias = { ...PREFERENCIAS_VAZIAS };
    for (const l of data ?? []) {
      preferencias[l.papel as Papel] = l.provedor_id;
    }
    setEstado({ estado: "pronto", instalado: true, preferencias });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Escolher uma ferramenta para um papel. `null` desfaz a escolha.
   *
   * A tela atualiza antes da resposta do banco, e volta atrás se falhar. Trocar a ferramenta
   * principal é uma preferência, não uma ação externa: nada sai do Pathly, então não há o que
   * aprovar nem o que registrar em auditoria.
   */
  const escolher = useCallback(
    async (papel: Papel, provedorId: string | null): Promise<boolean> => {
      if (!projetoId) return false;
      setSalvando(papel);

      const anterior = estado.estado === "pronto" ? estado.preferencias[papel] : null;

      setEstado((e) =>
        e.estado === "pronto"
          ? { ...e, preferencias: { ...e.preferencias, [papel]: provedorId } }
          : e,
      );

      const { data: sessao } = await supabase.auth.getSession();
      const userId = sessao.session?.user.id;
      if (!userId) {
        setSalvando(null);
        return false;
      }

      const { error } = provedorId
        ? await db().from("pathly_hub_ferramentas_projeto").upsert(
            {
              user_id: userId,
              project_id: projetoId,
              papel,
              provedor_id: provedorId,
              atualizado_em: new Date().toISOString(),
            },
            { onConflict: "user_id,project_id,papel" },
          )
        : await db()
            .from("pathly_hub_ferramentas_projeto")
            .delete()
            .eq("project_id", projetoId)
            .eq("papel", papel);

      setSalvando(null);

      if (error) {
        setEstado((e) =>
          e.estado === "pronto"
            ? { ...e, preferencias: { ...e.preferencias, [papel]: anterior } }
            : e,
        );
        return false;
      }
      return true;
    },
    [projetoId, estado],
  );

  return { ...estado, escolher, salvando, recarregar: carregar };
}

// =============================================================================================
// Gravar o trabalho
// =============================================================================================

/**
 * Grava os registros produzidos por `registrosDaResposta` ou `registrosDoRetorno`.
 *
 * `origem` vai como o registro trouxe, e não pode ser corrigida depois: a tabela não concede
 * `update`. Gravar errado se resolve apagando e gravando de novo — o que some da tela some do
 * banco, em vez de virar outra afirmação.
 */
export async function gravarRegistros(
  registros: readonly RegistroDeTrabalho[],
  projetoId: string,
  etapaOrdem: number | null,
): Promise<boolean> {
  if (registros.length === 0) return true;

  const { data: sessao } = await supabase.auth.getSession();
  const userId = sessao.session?.user.id;
  if (!userId) return false;

  const { error } = await db()
    .from("pathly_hub_registros")
    .insert(
      registros.map((r) => ({
        id: r.id,
        user_id: userId,
        project_id: projetoId,
        etapa_ordem: etapaOrdem,
        provedor_id: r.provedorId,
        tipo: r.tipo,
        origem: r.origem,
        texto: r.texto,
        itens: r.itens,
        criado_em: r.em,
      })),
    );

  return !error;
}

type LinhaRegistro = {
  id: string;
  provedor_id: string;
  tipo: string;
  origem: string;
  texto: string;
  itens: string[] | null;
  criado_em: string;
};

/** Os registros de um projeto, do mais recente para o mais antigo. */
export async function lerRegistros(
  projetoId: string,
  limite = 50,
): Promise<RegistroDeTrabalho[] | null> {
  const { data, error } = await db()
    .from("pathly_hub_registros")
    .select<LinhaRegistro>("id,provedor_id,tipo,origem,texto,itens,criado_em")
    .eq("project_id", projetoId)
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) return null;

  return (data ?? []).map((l) => ({
    id: l.id,
    tipo: l.tipo as TipoDeRegistro,
    origem: l.origem as Origem,
    provedorId: l.provedor_id,
    texto: l.texto,
    itens: l.itens ?? [],
    em: l.criado_em,
  }));
}
