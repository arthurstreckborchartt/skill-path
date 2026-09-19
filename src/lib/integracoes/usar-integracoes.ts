import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  validarAcao,
  type AcaoExterna,
  type Conexao,
  type EstadoAcao,
  type Provedor,
} from "./contrato";
import { acharAcao, acharProvedor } from "./provedores";

/**
 * As integrações na tela.
 *
 * ## O que este hook nunca vê
 *
 * O token. A consulta pede colunas nomeadas e `token_cifrado` não está entre elas — e mesmo que
 * estivesse, o privilégio recusaria: `authenticated` recebe `select` **por coluna**, sem o token
 * na lista. As duas defesas existem de propósito: a primeira é intenção, a segunda é garantia.
 *
 * Consequência que morde quem não souber: `select("*")` nesta tabela devolve `42501`, porque o
 * `*` expande para a coluna negada. Aqui as colunas são nomeadas por necessidade, não por estilo.
 *
 * ## Por que aprovar não executa
 *
 * `aprovar` só muda o estado da linha. Quem executa é `/api/integracoes/executar`, no servidor,
 * que é o único lugar com acesso ao token. Se aprovar e executar fossem o mesmo gesto, a execução
 * dependeria de o navegador ter chegado até o fim — e uma aba fechada no meio deixaria uma ação
 * aprovada que ninguém sabe se saiu.
 */

const AUSENTE = "PGRST205";

export type EstadoIntegracoes =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      conexoes: Conexao[];
      acoes: AcaoExterna[];
      /** `false` quando as tabelas ainda não existem neste ambiente. */
      instalado: boolean;
      erro?: string;
    }
  | { estado: "erro"; mensagem: string };

export function useIntegracoes(projetoId?: string) {
  const [estado, setEstado] = useState<EstadoIntegracoes>({ estado: "carregando" });
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const consultaAcoes = supabase
      .from("pathly_acoes_externas")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(30);

    const [conex, acoes] = await Promise.all([
      supabase.from("pathly_conexoes").select("provedor,escopos,conta,expira_em,criado_em"),
      projetoId ? consultaAcoes.eq("projeto_id", projetoId) : consultaAcoes,
    ]);

    /*
     * Tabela ausente não é erro da pessoa: é ambiente sem o SQL rodado. A tela diz isso em voz
     * alta em vez de mostrar uma lista vazia que parece "você não tem nada conectado".
     */
    if (conex.error?.code === AUSENTE || acoes.error?.code === AUSENTE) {
      setEstado({ estado: "pronto", conexoes: [], acoes: [], instalado: false });
      return;
    }

    if (conex.error || acoes.error) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar suas integrações." });
      return;
    }

    setEstado({
      estado: "pronto",
      instalado: true,
      conexoes: (conex.data ?? []).map((c) => ({
        provedor: c.provedor as Provedor,
        escopos: Array.isArray(c.escopos) ? c.escopos : [],
        conta: c.conta ?? "",
        expiraEm: c.expira_em,
        criadoEm: c.criado_em,
      })),
      acoes: (acoes.data ?? [])
        .map((linha) =>
          validarAcao({
            ...linha,
            acaoId: linha.acao_id,
            projetoId: linha.projeto_id,
            criadoEm: linha.criado_em,
            decididoEm: linha.decidido_em,
            executadoEm: linha.executado_em,
          }),
        )
        .filter((a): a is AcaoExterna => a !== null),
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * Cria uma ação **pendente**. Nada sai para fora aqui.
   *
   * O `payload` é gravado agora, junto do resumo que a pessoa vai ler. É o que garante que o que
   * ela aprova e o que sai são o mesmo objeto — remontar o corpo na execução abriria a porta para
   * aprovar um texto e enviar outro.
   */
  const pedir = useCallback(
    async (provedor: Provedor, acaoId: string, payload: Record<string, unknown> = {}) => {
      const disponivel = acharAcao(provedor, acaoId);
      if (!disponivel || !acharProvedor(provedor)) return;

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        setEstado((a) =>
          a.estado === "pronto" ? { ...a, erro: "Sua sessão expirou. Entre de novo." } : a,
        );
        return;
      }

      const { error } = await supabase.from("pathly_acoes_externas").insert({
        user_id: userId,
        projeto_id: projetoId ?? null,
        provedor,
        acao_id: acaoId,
        resumo: disponivel.resumo,
        destino: disponivel.destino,
        impacto: disponivel.impacto,
        payload: payload as never,
        estado: "pendente",
      });

      if (error) {
        setEstado((a) =>
          a.estado === "pronto" ? { ...a, erro: "Não consegui registrar a ação." } : a,
        );
        return;
      }
      await carregar();
    },
    [carregar, projetoId],
  );

  /**
   * Aprova ou recusa.
   *
   * O `.eq("estado", "pendente")` não é otimização: é o que impede duas abas aprovarem a mesma
   * ação. A segunda encontra zero linhas e não faz nada. O gatilho no banco barra a mesma coisa
   * de novo, do outro lado — quem escreve daqui pode estar errado, quem escreve de lá não deveria
   * conseguir errar.
   */
  const decidir = useCallback(
    async (acao: AcaoExterna, para: Extract<EstadoAcao, "aprovada" | "recusada">) => {
      if (acao.estado !== "pendente" || ocupado) return;
      setOcupado(acao.id);

      try {
        const { error } = await supabase
          .from("pathly_acoes_externas")
          .update({ estado: para, decidido_em: new Date().toISOString() })
          .eq("id", acao.id)
          .eq("estado", "pendente");

        if (error) {
          setEstado((a) =>
            a.estado === "pronto" ? { ...a, erro: "Não consegui registrar sua decisão." } : a,
          );
          return;
        }
        await carregar();
      } finally {
        setOcupado(null);
      }
    },
    [carregar, ocupado],
  );

  /**
   * Manda executar uma ação já aprovada.
   *
   * O navegador só entrega o `id`. Quem lê destino e payload é o servidor, da linha gravada no
   * momento da aprovação — se o corpo desta chamada pudesse carregar o que enviar, aprovar algo
   * inofensivo e mandar outra coisa seria trivial.
   *
   * `207` é caso próprio: a ação saiu e o resultado não foi gravado. Dizer "falhou" ali seria
   * mentira, e uma mentira que convida a pessoa a tentar de novo — justamente o que o portão
   * existe para impedir.
   */
  const executar = useCallback(
    async (acao: AcaoExterna) => {
      if (acao.estado !== "aprovada" || ocupado) return;
      setOcupado(acao.id);

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setEstado((a) =>
            a.estado === "pronto" ? { ...a, erro: "Sua sessão expirou. Entre de novo." } : a,
          );
          return;
        }

        const resposta = await fetch("/api/integracoes/executar", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ acaoId: acao.id }),
        });

        const corpo = (await resposta.json().catch(() => ({}))) as {
          erro?: string;
          aviso?: string;
          motivo?: string;
        };

        if (resposta.status === 207) {
          setEstado((a) => (a.estado === "pronto" ? { ...a, erro: corpo.aviso ?? "" } : a));
        } else if (!resposta.ok) {
          setEstado((a) =>
            a.estado === "pronto"
              ? { ...a, erro: corpo.erro ?? "Não consegui executar a ação." }
              : a,
          );
        }

        // Recarrega nos dois casos: mesmo falhando, o estado da linha mudou para `falhou` e a
        // pessoa precisa ver isso na tela, e não continuar olhando "aprovada".
        await carregar();
      } finally {
        setOcupado(null);
      }
    },
    [carregar, ocupado],
  );

  /**
   * Começa a conexão com um provedor.
   *
   * Duas etapas de propósito: o servidor precisa do `Bearer` para saber quem está conectando — a
   * sessão do Supabase vive no `localStorage`, e uma navegação de topo não a carregaria. Então
   * pedimos a URL com a sessão na mão e só depois saímos do app.
   *
   * `location.href` e não `window.open`: bloqueador de pop-up mataria a janela, e o retorno
   * precisa cair na mesma aba para o cookie do fluxo chegar junto.
   */
  const conectar = useCallback(async (provedor: Provedor) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      setEstado((a) =>
        a.estado === "pronto" ? { ...a, erro: "Sua sessão expirou. Entre de novo." } : a,
      );
      return;
    }

    const resposta = await fetch("/api/integracoes/oauth/iniciar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ provedor }),
    });

    const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; erro?: string };
    if (!resposta.ok || !corpo.url) {
      setEstado((a) =>
        a.estado === "pronto" ? { ...a, erro: corpo.erro ?? "Não consegui começar a conexão." } : a,
      );
      return;
    }

    window.location.href = corpo.url;
  }, []);

  const desconectar = useCallback(
    async (provedor: Provedor) => {
      const { error } = await supabase.from("pathly_conexoes").delete().eq("provedor", provedor);
      if (error) {
        setEstado((a) => (a.estado === "pronto" ? { ...a, erro: "Não consegui desconectar." } : a));
        return;
      }
      await carregar();
    },
    [carregar],
  );

  return { estado, ocupado, pedir, decidir, executar, conectar, desconectar, recarregar: carregar };
}
