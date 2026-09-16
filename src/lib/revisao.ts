import { supabase } from "@/integrations/supabase/client";
import type { Pergunta } from "@/lib/ia/licao-contrato";

/**
 * Repetição espaçada baseada no que a pessoa errou de verdade.
 *
 * O que existia antes agendava revisão a partir de uma nota fabricada
 * (`Math.max(70, 100 - mistakes * 15)`), calculada em cima do quiz que tinha como alternativas
 * os objetivos das outras etapas. Ou seja: a data de revisão era derivada de um erro que não
 * media conhecimento nenhum.
 *
 * Agora cada PERGUNTA tem a sua própria escada. Errou, volta amanhã e a escada recomeça do zero.
 * Acertou, o intervalo cresce. É o item que a pessoa não sabe que precisa voltar, não a lição
 * inteira — revisar o que já se sabe é o desperdício clássico de quem estuda relendo.
 */

/**
 * A escada, em dias, indexada pela quantidade de acertos seguidos.
 *
 * Os saltos crescem rápido de propósito: o valor da repetição espaçada está em revisar pouco
 * antes de esquecer, e revisar cedo demais gasta o tempo da pessoa sem ganho de memória. Depois
 * do quinto acerto seguido, 90 dias — se ainda estiver lá, está aprendido.
 */
const ESCADA_DIAS = [3, 7, 16, 35, 90];

/** Errar joga para o dia seguinte. Perto o bastante para corrigir antes de virar hábito errado. */
const DIAS_APOS_ERRO = 1;

export function proximoIntervaloDias(acertosSeguidos: number, acertou: boolean): number {
  if (!acertou) return DIAS_APOS_ERRO;
  const i = Math.min(acertosSeguidos, ESCADA_DIAS.length - 1);
  return ESCADA_DIAS[i]!;
}

export function proximaData(acertosSeguidos: number, acertou: boolean, de = new Date()): Date {
  const d = new Date(de);
  d.setDate(d.getDate() + proximoIntervaloDias(acertosSeguidos, acertou));
  return d;
}

export type RevisaoDevida = {
  chaveLicao: string;
  indicePergunta: number;
  tarefa: string;
  totalErros: number;
  proximaEm: string;
};

type LinhaRevisao = {
  chave_licao: string;
  indice_pergunta: number;
  tarefa: string;
  acertos_seguidos: number;
  total_erros: number;
  proxima_em: string;
};

/** O cliente gerado não conhece estas tabelas; o contrato mínimo evita depender dos tipos. */
type Tabela = {
  select(colunas: string): Consulta;
  upsert(
    linha: Record<string, unknown>,
    opcoes: { onConflict: string },
  ): Promise<{ error: unknown }>;
};
type Consulta = {
  eq(coluna: string, valor: unknown): Consulta;
  lte(coluna: string, valor: string): Consulta;
  order(coluna: string, opcoes: { ascending: boolean }): Consulta;
  limit(n: number): Promise<{ data: LinhaRevisao[] | null; error: unknown }>;
  maybeSingle(): Promise<{ data: LinhaRevisao | null; error: unknown }>;
};

function db() {
  return supabase as unknown as { from(t: string): Tabela };
}

/**
 * Registra o resultado de uma pergunta e reagenda.
 *
 * Nunca lança: uma falha ao gravar revisão não pode derrubar a aula que a pessoa está fazendo.
 */
export async function registrarResposta(params: {
  chaveLicao: string;
  indicePergunta: number;
  tarefa: string;
  acertou: boolean;
}): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;

    const { data: atual } = await db()
      .from("pathly_revisoes")
      .select("acertos_seguidos,total_erros,chave_licao,indice_pergunta,tarefa,proxima_em")
      .eq("user_id", userId)
      .eq("chave_licao", params.chaveLicao)
      .eq("indice_pergunta", params.indicePergunta)
      .maybeSingle();

    const acertosAntes = atual?.acertos_seguidos ?? 0;
    const errosAntes = atual?.total_erros ?? 0;

    await db()
      .from("pathly_revisoes")
      .upsert(
        {
          user_id: userId,
          chave_licao: params.chaveLicao,
          indice_pergunta: params.indicePergunta,
          tarefa: params.tarefa,
          // Errar zera a sequência: a escada recomeça, não só pausa.
          acertos_seguidos: params.acertou ? acertosAntes + 1 : 0,
          total_erros: params.acertou ? errosAntes : errosAntes + 1,
          ultima_em: new Date().toISOString(),
          proxima_em: proximaData(acertosAntes, params.acertou).toISOString(),
        },
        { onConflict: "user_id,chave_licao,indice_pergunta" },
      );
  } catch {
    // Revisão é um extra; perder um registro não pode custar a sessão de estudo.
  }
}

/** As perguntas cuja data já chegou, mais erradas primeiro. */
export async function revisoesDevidas(limite = 20): Promise<RevisaoDevida[]> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return [];

    const { data: linhas } = await db()
      .from("pathly_revisoes")
      .select("chave_licao,indice_pergunta,tarefa,acertos_seguidos,total_erros,proxima_em")
      .eq("user_id", userId)
      .lte("proxima_em", new Date().toISOString())
      .order("total_erros", { ascending: false })
      .limit(limite);

    return (linhas ?? []).map((l) => ({
      chaveLicao: l.chave_licao,
      indicePergunta: l.indice_pergunta,
      tarefa: l.tarefa,
      totalErros: l.total_erros,
      proximaEm: l.proxima_em,
    }));
  } catch {
    return [];
  }
}

/** Busca as perguntas de uma lição já gerada, para remontar a revisão sem gerar de novo. */
export async function perguntasDaLicao(chaveLicao: string): Promise<Pergunta[]> {
  try {
    const tabela = supabase as unknown as {
      from(t: string): {
        select(c: string): {
          eq(
            c: string,
            v: string,
          ): {
            maybeSingle(): Promise<{ data: { conteudo?: { perguntas?: Pergunta[] } } | null }>;
          };
        };
      };
    };
    const { data } = await tabela
      .from("pathly_licoes")
      .select("conteudo")
      .eq("chave", chaveLicao)
      .maybeSingle();
    return data?.conteudo?.perguntas ?? [];
  } catch {
    return [];
  }
}
