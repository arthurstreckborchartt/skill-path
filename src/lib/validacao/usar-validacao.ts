import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { validarModelo } from "@/lib/banco/contrato";
import { validarMapa } from "@/lib/api/contrato";
import { validarPlano } from "@/lib/arquitetura-ia/contrato";
import { lerRespostas } from "@/lib/blueprint/respostas";
import { conferirTabelasPlanejadas, type EstadoTabelaPlanejada } from "@/lib/copilot/estado-banco";
import { podeConcluir, validar } from "./motor";
import type { Confirmacoes, ContextoValidacao } from "./contrato";

/**
 * A validação na tela.
 *
 * O relatório é derivado, nunca guardado: rodar o catálogo contra os artefatos custa menos que
 * uma consulta, e guardar o resultado criaria uma cópia que envelhece — a pessoa corrigiria o
 * plano e continuaria vendo o bloqueio antigo.
 *
 * O que persiste é só o que o app não consegue derivar: as confirmações dela.
 */

export type EstadoValidacao =
  | { estado: "carregando" }
  | {
      estado: "pronto";
      contexto: ContextoValidacao;
      confirmacoes: Confirmacoes;
      nomeProjeto: string;
      /** `false` enquanto ninguém sondou o banco nesta sessão. */
      sondaFeita: boolean;
      /**
       * O que deu errado ao gravar a última confirmação, se deu.
       *
       * Existe porque a alternativa é pior: sem isto, uma gravação recusada deixava a caixinha
       * marcada na tela e nada no banco. A pessoa fecharia a aba achando que registrou, e o
       * recurso cujo propósito inteiro é separar "conferido" de "declarado" estaria mentindo
       * sobre o próprio registro.
       *
       * Guarda o `id` junto da mensagem para o aviso sair ao lado do botão que falhou. Num
       * relatório de trinta itens, um aviso no topo da página é um aviso que quem está lá embaixo
       * não vê: a marca sumiria sozinha, sem explicação nenhuma.
       */
      erroConfirmacao?: { id: string; mensagem: string };
      /** O que deu errado na última sonda ao banco, se deu. */
      erroSonda?: string;
    }
  | { estado: "erro"; mensagem: string };

export function useValidacao(projetoId: string) {
  const [estado, setEstado] = useState<EstadoValidacao>({ estado: "carregando" });
  const [sondando, setSondando] = useState(false);

  const carregar = useCallback(async () => {
    const [proj, banco, api, ia, val] = await Promise.all([
      supabase
        .from("pathly_projetos")
        .select("nome,conteudo,respostas")
        .eq("id", projetoId)
        .maybeSingle(),
      supabase
        .from("pathly_modelos_dados")
        .select("modelo")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase.from("pathly_apis").select("mapa").eq("projeto_id", projetoId).maybeSingle(),
      supabase
        .from("pathly_arquitetura_ia")
        .select("plano")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
      supabase
        .from("pathly_validacoes")
        .select("confirmacoes")
        .eq("projeto_id", projetoId)
        .maybeSingle(),
    ]);

    if (proj.error || !proj.data) {
      setEstado({ estado: "erro", mensagem: "Não consegui carregar este projeto." });
      return;
    }

    setEstado({
      estado: "pronto",
      nomeProjeto: proj.data.nome,
      contexto: {
        respostas: lerRespostas(proj.data.respostas),
        blueprint: completarBlueprint((proj.data.conteudo ?? {}) as Blueprint),
        modelo: banco.error ? null : validarModelo(banco.data?.modelo),
        api: api.error ? null : validarMapa(api.data?.mapa),
        planoIa: ia.error ? null : validarPlano(ia.data?.plano),
        tabelasNoBanco: [],
      },
      // Tabela ausente não é erro: o projeto simplesmente ainda não tem confirmação nenhuma.
      confirmacoes: lerConfirmacoes(val.data?.confirmacoes),
      sondaFeita: false,
    });
  }, [projetoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  /**
   * A sonda ao banco real.
   *
   * Não roda sozinha ao abrir a tela: são N consultas, uma por tabela planejada, e a maior parte
   * das visitas é para ler o relatório, não para conferir o banco. Fica num botão, e o resultado
   * aparece como evidência de verdade — a única que não depende do plano nem da palavra de
   * ninguém.
   */
  const sondarBanco = useCallback(async () => {
    if (estado.estado !== "pronto" || sondando) return;
    const nomes = (estado.contexto.modelo?.entidades ?? []).map((e) => e.nome);
    if (nomes.length === 0) return;

    setSondando(true);
    try {
      const tabelas: EstadoTabelaPlanejada[] = await conferirTabelasPlanejadas(nomes);
      setEstado((a) =>
        a.estado === "pronto"
          ? {
              ...semErroSonda(a),
              contexto: { ...a.contexto, tabelasNoBanco: tabelas },
              sondaFeita: true,
            }
          : a,
      );
    } catch {
      /**
       * A sonda não escreve nada, então falhar nela é inofensivo — desde que apareça. Engolir o
       * erro deixaria o botão parecendo que rodou e o relatório repetindo "ninguém sondou ainda",
       * sem ninguém entender por quê.
       */
      setEstado((a) =>
        a.estado === "pronto"
          ? { ...a, erroSonda: "Não consegui falar com o banco agora. Tente de novo." }
          : a,
      );
    } finally {
      setSondando(false);
    }
  }, [estado, sondando]);

  /**
   * Marca ou desmarca uma confirmação.
   *
   * `upsert` porque a linha só nasce na primeira confirmação — e a pessoa pode passar pela tela
   * várias vezes só lendo, sem nunca confirmar nada.
   *
   * A marca aparece na hora e volta atrás se o banco recusar. Otimismo sem rollback seria o pior
   * desenho possível justamente aqui: a tela inteira existe para não deixar ninguém achar que
   * conferiu o que não conferiu.
   */
  const alternarConfirmacao = useCallback(
    async (idVerificacao: string) => {
      if (estado.estado !== "pronto") return;

      const anteriores = estado.confirmacoes;
      const novas: Confirmacoes = { ...anteriores };
      if (novas[idVerificacao]) delete novas[idVerificacao];
      else novas[idVerificacao] = { em: new Date().toISOString() };

      setEstado((a) =>
        a.estado === "pronto" ? { ...semErroConfirmacao(a), confirmacoes: novas } : a,
      );

      const desfazer = (mensagem: string) =>
        setEstado((a) =>
          a.estado === "pronto"
            ? {
                ...a,
                confirmacoes: anteriores,
                erroConfirmacao: { id: idVerificacao, mensagem },
              }
            : a,
        );

      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId) {
        desfazer("Sua sessão expirou. Entre de novo para registrar.");
        return;
      }

      const { error } = await supabase.from("pathly_validacoes").upsert(
        {
          projeto_id: projetoId,
          user_id: userId,
          confirmacoes: novas as never,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "projeto_id" },
      );

      if (error) {
        /**
         * `PGRST205` é a tabela não existir, e é um recado para quem mantém o Pathly, não para
         * quem usa. Vale distinguir: "tente de novo" manda a pessoa repetir um gesto que vai
         * falhar igual até alguém rodar o SQL.
         */
        desfazer(
          error.code === "PGRST205"
            ? "O registro de confirmações ainda não existe neste ambiente. Nada foi salvo."
            : "Não consegui registrar sua confirmação. Tente de novo.",
        );
      }
    },
    [estado, projetoId],
  );

  return { estado, sondando, sondarBanco, alternarConfirmacao, recarregar: carregar };
}

/** O relatório, recalculado quando o contexto ou as confirmações mudam. */
export function useRelatorio(estado: EstadoValidacao) {
  return useMemo(() => {
    if (estado.estado !== "pronto") return null;
    const relatorio = validar(estado.contexto, estado.confirmacoes);
    return { relatorio, veredito: podeConcluir(relatorio) };
  }, [estado]);
}

/**
 * Tira o erro anterior do estado.
 *
 * Existe para o erro não sobreviver ao gesto que o resolveu: sem isto, quem viu "não consegui
 * registrar", corrigiu e marcou de novo com sucesso continuaria lendo a mensagem antiga.
 */
type Pronto = Extract<EstadoValidacao, { estado: "pronto" }>;

function semErroConfirmacao(a: Pronto): Pronto {
  const { erroConfirmacao: _, ...resto } = a;
  return resto;
}

function semErroSonda(a: Pronto): Pronto {
  const { erroSonda: _, ...resto } = a;
  return resto;
}

/** O que voltou do banco é `Json`: só passa adiante o que tem a forma de confirmação. */
function lerConfirmacoes(valor: unknown): Confirmacoes {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};

  const saida: Confirmacoes = {};
  for (const [id, v] of Object.entries(valor as Record<string, unknown>)) {
    const em = (v as { em?: unknown })?.em;
    if (typeof em === "string") saida[id] = { em };
  }
  return saida;
}
