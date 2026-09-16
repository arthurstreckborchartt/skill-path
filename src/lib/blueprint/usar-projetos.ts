import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BLOCOS, completarBlueprint, type Bloco, type Blueprint } from "./contrato";
import { lerRespostas, type Respostas } from "./respostas";

/**
 * Acesso do cliente aos projetos.
 *
 * Criar e listar vão direto ao Supabase, sem passar por endpoint próprio: a RLS de
 * `pathly_projetos` já decide quem vê e quem escreve o quê, e um endpoint no meio só repetiria
 * essa regra em outro lugar — com o risco de repetir errado.
 *
 * Gerar bloco é o contrário: precisa das chaves de IA, que nunca podem chegar ao navegador. Por
 * isso `gerarBloco` fala com `/api/blueprint`.
 */

export type Projeto = {
  id: string;
  nome: string;
  ideia: string;
  status: string;
  conteudo: Blueprint;
  respostas: Respostas;
  etapaAtual: number;
  etapasConcluidas: number;
  etapasTotal: number;
  atualizadoEm: string;
};

type LinhaProjeto = {
  id: string;
  nome: string;
  ideia: string;
  status: string;
  conteudo: Blueprint | null;
  respostas: unknown;
  etapa_atual: number;
  etapas_concluidas: number;
  etapas_total: number;
  atualizado_em: string;
};

function daLinha(l: LinhaProjeto): Projeto {
  return {
    id: l.id,
    nome: l.nome,
    ideia: l.ideia,
    status: l.status,
    conteudo: completarBlueprint(l.conteudo ?? {}),
    respostas: lerRespostas(l.respostas),
    etapaAtual: l.etapa_atual,
    etapasConcluidas: l.etapas_concluidas,
    etapasTotal: l.etapas_total,
    atualizadoEm: l.atualizado_em,
  };
}

const COLUNAS =
  "id,nome,ideia,status,conteudo,respostas,etapa_atual,etapas_concluidas,etapas_total,atualizado_em";

/**
 * Nome provisório, até a IA batizar o produto no bloco de fundação.
 *
 * Existe para a lista nunca mostrar "Projeto sem nome": se a geração falhar ou a pessoa sair no
 * meio, ela ainda reconhece o que escreveu.
 */
function nomeProvisorio(ideia: string): string {
  const limpo = ideia.trim().replace(/\s+/g, " ");
  return limpo.length <= 48 ? limpo : `${limpo.slice(0, 45)}…`;
}

export async function criarProjeto(
  respostas: Respostas,
): Promise<{ id: string } | { erro: string }> {
  const { data: sessao } = await supabase.auth.getSession();
  const userId = sessao.session?.user.id;
  if (!userId) return { erro: "Faça login para criar um projeto." };

  const { data, error } = await supabase
    .from("pathly_projetos")
    .insert({
      user_id: userId,
      nome: nomeProvisorio(respostas.oQue),
      // `ideia` continua sendo a frase solta. Duplica `respostas.oQue` de propósito: é a coluna
      // que a lista e o endpoint leem, e deixá-la dentro do jsonb obrigaria a desempacotar o
      // questionário inteiro só para escrever um título.
      ideia: respostas.oQue,
      respostas,
    })
    .select("id")
    .single();

  if (error || !data) return { erro: error?.message ?? "Não consegui criar o projeto." };
  return { id: data.id as string };
}

/**
 * Atualiza o questionário de um projeto que já existe.
 *
 * Não apaga o blueprint: mudar uma resposta não invalida sozinha o que já foi escrito, e jogar
 * fora um plano inteiro porque a pessoa marcou uma caixa seria hostil. A tela avisa quais blocos
 * ficaram desatualizados e ela decide o que regerar.
 */
export async function salvarRespostas(id: string, respostas: Respostas): Promise<boolean> {
  const { error } = await supabase
    .from("pathly_projetos")
    .update({ respostas, ideia: respostas.oQue, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function apagarProjeto(id: string): Promise<boolean> {
  const { error } = await supabase.from("pathly_projetos").delete().eq("id", id);
  return !error;
}

export type EstadoLista =
  | { estado: "carregando" }
  | { estado: "pronta"; projetos: Projeto[] }
  | { estado: "erro"; motivo: string };

export function useProjetos(): EstadoLista & { recarregar: () => void } {
  const [estado, setEstado] = useState<EstadoLista>({ estado: "carregando" });
  const [gatilho, setGatilho] = useState(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data, error } = await supabase
        .from("pathly_projetos")
        .select(COLUNAS)
        .order("atualizado_em", { ascending: false });

      if (!vivo) return;
      if (error) {
        setEstado({ estado: "erro", motivo: error.message });
        return;
      }
      setEstado({ estado: "pronta", projetos: (data as LinhaProjeto[]).map(daLinha) });
    })();
    return () => {
      vivo = false;
    };
  }, [gatilho]);

  const recarregar = useCallback(() => setGatilho((n) => n + 1), []);
  return { ...estado, recarregar };
}

export type EstadoProjeto =
  | { estado: "carregando" }
  | { estado: "pronto"; projeto: Projeto }
  | { estado: "erro"; motivo: string };

export function useProjeto(id: string): {
  estado: EstadoProjeto;
  /** Atualiza o projeto em memória sem reconsultar — quem gera um bloco já tem o dado na mão. */
  aplicar: (bloco: Bloco, dados: unknown) => void;
} {
  const [estado, setEstado] = useState<EstadoProjeto>({ estado: "carregando" });

  useEffect(() => {
    let vivo = true;
    setEstado({ estado: "carregando" });
    void (async () => {
      const { data, error } = await supabase
        .from("pathly_projetos")
        .select(COLUNAS)
        .eq("id", id)
        .maybeSingle();

      if (!vivo) return;
      if (error) {
        setEstado({ estado: "erro", motivo: error.message });
        return;
      }
      // Sem linha significa "não é seu ou não existe" — a RLS não distingue os dois casos, e a
      // tela também não deve: dizer "existe, mas não é seu" já é contar algo sobre o projeto.
      if (!data) {
        setEstado({ estado: "erro", motivo: "nao-encontrado" });
        return;
      }
      setEstado({ estado: "pronto", projeto: daLinha(data as LinhaProjeto) });
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  const aplicar = useCallback((bloco: Bloco, dados: unknown) => {
    setEstado((atual) => {
      if (atual.estado !== "pronto") return atual;
      const conteudo = { ...atual.projeto.conteudo, [bloco]: dados };
      const etapasTotal =
        bloco === "execucao"
          ? ((dados as { etapas?: unknown[] }).etapas?.length ?? atual.projeto.etapasTotal)
          : atual.projeto.etapasTotal;
      const nome =
        bloco === "fundacao"
          ? ((dados as { nome?: string }).nome ?? atual.projeto.nome)
          : atual.projeto.nome;
      return { estado: "pronto", projeto: { ...atual.projeto, conteudo, nome, etapasTotal } };
    });
  }, []);

  return { estado, aplicar };
}

export type RespostaBloco =
  | { ok: true; bloco: Bloco; dados: unknown; modelo: string; proximo: Bloco | null }
  | { ok: false; mensagem: string };

/**
 * Traduz a falha para algo que diga o que fazer a seguir.
 *
 * A primeira versão devolvia sempre "Não consegui montar esta parte agora", e isso escondia a
 * diferença que mais importa: congestionamento passa com uma nova tentativa, limite de uso não.
 * Medido em 16/09/2026, uma geração em três falhou por 503 dos provedores gratuitos e a
 * retentativa imediata funcionou — sem a mensagem certa, a pessoa desiste em vez de tentar.
 */
function mensagemDeErro(status: number, corpo: { erro?: string; motivo?: string }): string {
  if (status === 429) {
    return corpo.erro ?? "Você gerou muitos planos em pouco tempo. Tente de novo mais tarde.";
  }
  if (status === 401) return "Sua sessão expirou. Entre de novo.";
  if (corpo.motivo === "sem-chave") {
    return "A geração de planos não está configurada neste ambiente.";
  }
  if (status === 503) {
    return "Os serviços de IA estão congestionados agora. Toque em gerar de novo — costuma funcionar na segunda tentativa.";
  }
  return corpo.erro ?? "Não consegui montar esta parte agora.";
}

/**
 * Pede um bloco ao servidor.
 *
 * Sem teto de tempo do lado do cliente: o servidor já corre contra o próprio orçamento e devolve
 * erro quando estoura. Um `AbortSignal` aqui só jogaria fora um conteúdo que talvez estivesse a
 * um segundo de chegar — e a geração já foi paga nesse ponto.
 */
export async function gerarBloco(projetoId: string, bloco: Bloco): Promise<RespostaBloco> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, mensagem: "Sua sessão expirou. Entre de novo." };

    const r = await fetch("/api/blueprint", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ projetoId, bloco }),
    });

    const corpo = (await r.json()) as {
      bloco?: Bloco;
      dados?: unknown;
      modelo?: string;
      proximo?: Bloco | null;
      erro?: string;
      motivo?: string;
      detalhe?: string;
    };

    if (!r.ok || !corpo.dados) {
      return { ok: false, mensagem: mensagemDeErro(r.status, corpo) };
    }
    return {
      ok: true,
      bloco: corpo.bloco ?? bloco,
      dados: corpo.dados,
      modelo: corpo.modelo ?? "",
      proximo: corpo.proximo ?? null,
    };
  } catch {
    return { ok: false, mensagem: "Sem conexão. Tente de novo." };
  }
}

/** O primeiro bloco que ainda falta, ou `null` se o blueprint está completo. */
export function proximoBloco(conteudo: Blueprint): Bloco | null {
  return BLOCOS.find((b) => !conteudo[b]) ?? null;
}
