import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  ConexaoObsidian,
  Direcao,
  PastaAutorizada,
  RegistroDeEvento,
  TipoDeSincronia,
} from "./contrato";
import { conexaoVazia } from "./contrato";
import { mapeamentoPadrao, type Mapeamento } from "./estrutura";
import * as pasta from "./pasta";
import type { HandlePasta } from "./pasta";
import {
  planejar,
  prontasParaEscrever,
  eventoDe,
  type AcaoDeEscrita,
  type DadosDoProjeto,
} from "./sincronizacao";

/**
 * A conexão com o Obsidian, na tela.
 *
 * ## O handle não é persistido no servidor, e não poderia ser
 *
 * O `FileSystemDirectoryHandle` é um objeto do navegador, não um caminho. Dá para guardá-lo em
 * IndexedDB e reusar entre visitas, mas o navegador ainda pede a permissão de novo — ele não
 * mantém acesso silencioso ao disco de ninguém entre sessões. Isso é chato e é o desenho certo.
 *
 * O que o servidor guarda é a **configuração**: qual vault, quais pastas, quais tipos, e a
 * impressão digital de cada nota. Reconectar é um clique, e nada do conteúdo jamais sobe.
 *
 * ## A sincronização nunca acontece sozinha por padrão
 *
 * `automatica` nasce `false`. Quando é ligada, a tela precisa dizer exatamente o que será
 * sincronizado — é por isso que `CONTEUDO_SINCRONIA` existe, com uma frase por tipo.
 */

const AUSENTE = "PGRST205";

type Erro = { code?: string; message?: string } | null;
type Resp<L> = { data: L[] | null; error: Erro };

type Consulta<L> = {
  eq(c: string, v: unknown): Consulta<L>;
  order(c: string, o: { ascending: boolean }): Consulta<L>;
  limit(n: number): Promise<Resp<L>>;
  maybeSingle(): Promise<{ data: L | null; error: Erro }>;
};

type Tabela = {
  select<L>(colunas: string): Consulta<L> & Promise<Resp<L>>;
  insert(linhas: Record<string, unknown>[]): Promise<{ error: Erro }>;
  upsert(linha: Record<string, unknown>, o: { onConflict: string }): Promise<{ error: Erro }>;
  delete(): { eq(c: string, v: unknown): Promise<{ error: Erro }> };
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

type LinhaConexao = {
  mecanismo: string;
  vault: string;
  pastas: PastaAutorizada[] | null;
  tipos: Record<string, boolean> | null;
  mapeamento: Partial<Mapeamento> | null;
  direcao: string;
  automatica: boolean;
  criado_em: string;
};

export type EstadoObsidian =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      /** `false` quando `supabase/pathly_obsidian.sql` ainda não foi executado. */
      instalado: boolean;
      /** `false` em Firefox e Safari: não há seletor de pasta lá. */
      suportado: boolean;
      /** A configuração guardada. `null` quando nunca houve conexão. */
      conexao: ConexaoObsidian | null;
      mapeamento: Mapeamento;
      /** A pasta está aberta **nesta aba**? O navegador esquece ao fechar. */
      aberto: boolean;
    }
  | { estado: "erro"; mensagem: string };

export function useObsidian() {
  const [estado, setEstado] = useState<EstadoObsidian>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  /*
   * O handle vive em `ref`, não em `state`. Ele não é serializável, não deve disparar render, e
   * — principalmente — não pode acabar dentro de nenhum payload que saia daqui.
   */
  const raiz = useRef<HandlePasta | null>(null);

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession();
    const userId = sessao.session?.user.id;
    if (!userId) {
      setEstado({ estado: "erro", mensagem: "Faça login para conectar o Obsidian." });
      return;
    }

    const { data, error } = await db()
      .from("pathly_obsidian_conexao")
      .select<LinhaConexao>("mecanismo,vault,pastas,tipos,mapeamento,direcao,automatica,criado_em")
      .eq("user_id", userId)
      .maybeSingle();

    const suportado = pasta.temSuporte();

    if (error?.code === AUSENTE) {
      setEstado({
        estado: "pronto",
        instalado: false,
        suportado,
        conexao: null,
        mapeamento: mapeamentoPadrao(),
        aberto: false,
      });
      return;
    }
    if (error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar a conexão com o Obsidian." });
      return;
    }

    const padrao = mapeamentoPadrao();
    setEstado({
      estado: "pronto",
      instalado: true,
      suportado,
      conexao: data
        ? {
            mecanismo: data.mecanismo as ConexaoObsidian["mecanismo"],
            vault: data.vault,
            pastas: data.pastas ?? [],
            tipos: {
              ...conexaoVazia("").tipos,
              ...(data.tipos ?? {}),
            } as ConexaoObsidian["tipos"],
            direcao: data.direcao as Direcao,
            automatica: data.automatica,
            conectadoEm: data.criado_em,
          }
        : null,
      mapeamento: {
        raiz: data?.mapeamento?.raiz ?? padrao.raiz,
        caminhos: { ...padrao.caminhos, ...(data?.mapeamento?.caminhos ?? {}) },
      },
      aberto: raiz.current !== null,
    });
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const conexao = estado.estado === "pronto" ? estado.conexao : null;
  const mapeamento = estado.estado === "pronto" ? estado.mapeamento : mapeamentoPadrao();

  const gravar = useCallback(
    async (campos: Record<string, unknown>): Promise<boolean> => {
      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return false;

      const { error } = await db()
        .from("pathly_obsidian_conexao")
        .upsert(
          { user_id: userId, ...campos, atualizado_em: new Date().toISOString() },
          { onConflict: "user_id" },
        );

      if (error) {
        setAviso("Não consegui salvar a configuração.");
        return false;
      }
      await carregar();
      return true;
    },
    [carregar],
  );

  // ---- Conectar ------------------------------------------------------------------------------

  /**
   * Abre o seletor de pasta e confere que aquilo parece um vault.
   *
   * O teste acontece **antes** de gravar qualquer coisa: conectar a uma pasta que não é vault e
   * descobrir depois faria a pessoa procurar o problema no lugar errado.
   */
  const conectar = useCallback(async (): Promise<
    { ok: true; vault: string; aviso: string | null } | { ok: false; motivo: string }
  > => {
    setOcupado(true);
    setAviso(null);

    const escolha = await pasta.escolherVault();
    if (!escolha.ok) {
      setOcupado(false);
      return { ok: false, motivo: escolha.detalhe };
    }

    const conferencia = await pasta.pareceVault(escolha.valor);
    raiz.current = escolha.valor;

    /* Conexão nova nasce sem pasta autorizada e com todos os tipos desligados. */
    const nova = conexaoVazia(escolha.valor.name);
    const gravou = await gravar({
      mecanismo: nova.mecanismo,
      vault: nova.vault,
      pastas: [],
      tipos: nova.tipos,
      direcao: nova.direcao,
      automatica: false,
    });

    setOcupado(false);
    if (!gravou) return { ok: false, motivo: "Não consegui salvar a conexão." };
    return { ok: true, vault: escolha.valor.name, aviso: conferencia.aviso };
  }, [gravar]);

  /** Reabre a pasta numa sessão nova. O navegador pede a permissão de novo, e isso é o certo. */
  const reabrir = useCallback(async (): Promise<boolean> => {
    const escolha = await pasta.escolherVault();
    if (!escolha.ok) {
      setAviso(escolha.detalhe);
      return false;
    }
    raiz.current = escolha.valor;
    await carregar();
    return true;
  }, [carregar]);

  const desconectar = useCallback(async (): Promise<boolean> => {
    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) return false;

    raiz.current = null;
    const { error } = await db().from("pathly_obsidian_conexao").delete().eq("user_id", userId);
    /*
     * As impressões das notas ficam. Se a pessoa reconectar o mesmo vault, o Pathly volta sabendo
     * o que já tinha escrito — e apagar isso transformaria toda nota existente num conflito.
     */
    if (error) return false;
    await carregar();
    return true;
  }, [carregar]);

  // ---- Configurar ----------------------------------------------------------------------------

  const definirPastas = useCallback((pastas: PastaAutorizada[]) => gravar({ pastas }), [gravar]);

  const alternarTipo = useCallback(
    (tipo: TipoDeSincronia, ligado: boolean) => {
      if (!conexao) return Promise.resolve(false);
      return gravar({ tipos: { ...conexao.tipos, [tipo]: ligado } });
    },
    [conexao, gravar],
  );

  const definirDirecao = useCallback((direcao: Direcao) => gravar({ direcao }), [gravar]);

  /**
   * Liga ou desliga a sincronização automática.
   *
   * Sempre desligável, a qualquer momento, sem nenhuma condição. É o interruptor que a pessoa
   * precisa encontrar rápido quando algo parecer errado — e que nunca deve depender de outra
   * escolha para funcionar.
   */
  const definirAutomatica = useCallback((automatica: boolean) => gravar({ automatica }), [gravar]);

  const definirMapeamento = useCallback(
    (m: Mapeamento) => gravar({ mapeamento: m as unknown as Record<string, unknown> }),
    [gravar],
  );

  // ---- Sincronizar ---------------------------------------------------------------------------

  /**
   * Monta o plano: lê o que está no vault, compara e diz o que mudaria.
   *
   * **Não escreve nada.** A tela mostra o plano e a pessoa decide — inclusive porque é aqui que
   * um conflito aparece, e conflito não se resolve sozinho.
   */
  const planejarSincronia = useCallback(
    async (
      dados: DadosDoProjeto,
      projetoId: string,
    ): Promise<{ ok: true; acoes: AcaoDeEscrita[] } | { ok: false; motivo: string }> => {
      if (!conexao) return { ok: false, motivo: "Nenhum vault conectado." };
      if (!raiz.current) {
        return { ok: false, motivo: "A pasta não está aberta nesta aba. Reabra o vault." };
      }

      const permissao = await pasta.garantirPermissao(raiz.current, true);
      if (!permissao.ok) return { ok: false, motivo: permissao.detalhe };

      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return { ok: false, motivo: "Sessão expirada." };

      const { data: guardadas } = await db()
        .from("pathly_obsidian_notas")
        .select<{ caminho: string; impressao: string }>("caminho,impressao")
        .eq("user_id", userId)
        .limit(500);

      const impressoes: Record<string, string | null> = {};
      for (const n of guardadas ?? []) impressoes[n.caminho] = n.impressao;

      /* Lê só as notas que este plano toca. Varrer o vault seria ler o que ninguém autorizou. */
      const plano = planejar({
        dados,
        mapeamento,
        conexao,
        noDisco: {},
        impressoes,
      });

      const noDisco: Record<string, string | null> = {};
      for (const a of plano) {
        const lido = await pasta.ler(raiz.current, a.caminho);
        noDisco[a.caminho] = lido.ok ? lido.valor : null;
      }

      void projetoId;
      return { ok: true, acoes: planejar({ dados, mapeamento, conexao, noDisco, impressoes }) };
    },
    [conexao, mapeamento],
  );

  /** Escreve as ações que a pessoa aprovou. Conflito não entra aqui — ele é decidido antes. */
  const aplicar = useCallback(
    async (
      acoes: readonly AcaoDeEscrita[],
      projetoId: string,
    ): Promise<{ escritas: number; falhas: string[] }> => {
      if (!raiz.current) return { escritas: 0, falhas: ["A pasta não está aberta nesta aba."] };

      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (!userId) return { escritas: 0, falhas: ["Sessão expirada."] };

      const falhas: string[] = [];
      const eventos: RegistroDeEvento[] = [];
      let escritas = 0;

      for (const a of acoes) {
        if (a.texto === null || a.impressaoNova === null) continue;

        const r = await pasta.escrever(raiz.current, a.caminho, a.texto);
        if (!r.ok) {
          falhas.push(`${a.caminho}: ${r.detalhe}`);
          continue;
        }
        escritas++;

        /*
         * A impressão é gravada **logo depois de escrever**. É ela que corta o laço: na próxima
         * leitura, o Pathly reconhece a própria escrita e não reage a ela.
         */
        await db().from("pathly_obsidian_notas").upsert(
          {
            user_id: userId,
            project_id: projetoId,
            caminho: a.caminho,
            tipo: a.tipo,
            impressao: a.impressaoNova,
            sincronizado_em: new Date().toISOString(),
          },
          { onConflict: "user_id,caminho" },
        );

        const ev = eventoDe(a, "pathly");
        if (ev) eventos.push(ev);
      }

      if (eventos.length > 0) {
        await db()
          .from("pathly_obsidian_eventos")
          .insert(
            eventos.map((e) => ({
              user_id: userId,
              project_id: projetoId,
              evento: e.evento,
              caminho: e.caminho,
              origem: e.origem,
              detalhe: e.detalhe ?? null,
            })),
          );
      }

      return { escritas, falhas };
    },
    [],
  );

  /**
   * Apaga uma nota. Sempre uma, sempre com confirmação daquela nota.
   *
   * `DELETE_NOTE` é o único nível isolado desta integração: uma autorização de apagar nunca vale
   * para a próxima, e não existe caminho em lote nem por acidente — este é o único lugar do
   * módulo que chama `pasta.apagar`.
   */
  const apagarNota = useCallback(
    async (
      caminho: string,
      projetoId: string | null,
    ): Promise<{ ok: boolean; motivo?: string }> => {
      if (!raiz.current) return { ok: false, motivo: "A pasta não está aberta nesta aba." };

      const r = await pasta.apagar(raiz.current, caminho);
      if (!r.ok) return { ok: false, motivo: r.detalhe };

      const { data: s } = await supabase.auth.getSession();
      const userId = s.session?.user.id;
      if (userId) {
        await db()
          .from("pathly_obsidian_eventos")
          .insert([
            {
              user_id: userId,
              project_id: projetoId,
              evento: "NOTE_DELETED",
              caminho,
              origem: "pathly",
            },
          ]);
      }
      return { ok: true };
    },
    [],
  );

  /** Lê uma nota do vault. Usado para comparar no conflito e para trazer contexto. */
  const lerNota = useCallback(async (caminho: string): Promise<string | null> => {
    if (!raiz.current) return null;
    const r = await pasta.ler(raiz.current, caminho);
    return r.ok ? r.valor : null;
  }, []);

  /** Lista uma pasta, um nível. A tela desce conforme a pessoa abre. */
  const listar = useCallback(async (caminho = ""): Promise<pasta.Entrada[]> => {
    if (!raiz.current) return [];
    const r = await pasta.listar(raiz.current, caminho);
    return r.ok ? r.valor : [];
  }, []);

  /** Busca nas pastas autorizadas, devolvendo trechos — nunca notas inteiras. */
  const buscar = useCallback(
    async (termo: string): Promise<pasta.Achado[]> => {
      if (!raiz.current || !conexao) return [];
      const permitidas = conexao.pastas.filter((p) => p.ler).map((p) => p.caminho);
      if (permitidas.length === 0) return [];
      const r = await pasta.buscar(raiz.current, termo, permitidas);
      return r.ok ? r.valor : [];
    },
    [conexao],
  );

  return {
    ...estado,
    ocupado,
    aviso,
    limparAviso: () => setAviso(null),
    conectar,
    reabrir,
    desconectar,
    definirPastas,
    alternarTipo,
    definirDirecao,
    definirAutomatica,
    definirMapeamento,
    planejarSincronia,
    aplicar,
    apagarNota,
    lerNota,
    listar,
    buscar,
    recarregar: carregar,
  };
}

/** Os eventos recentes, para a tela mostrar o que o Pathly andou fazendo no vault. */
export async function lerEventos(limite = 30): Promise<RegistroDeEvento[]> {
  const { data, error } = await db()
    .from("pathly_obsidian_eventos")
    .select<{
      evento: string;
      caminho: string;
      origem: string;
      detalhe: string | null;
      criado_em: string;
    }>("evento,caminho,origem,detalhe,criado_em")
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error) return [];
  return (data ?? []).map((e) => ({
    evento: e.evento as RegistroDeEvento["evento"],
    caminho: e.caminho,
    origem: e.origem as "pathly" | "obsidian",
    em: e.criado_em,
    ...(e.detalhe ? { detalhe: e.detalhe } : {}),
  }));
}
