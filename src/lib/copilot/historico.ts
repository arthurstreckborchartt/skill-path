import { supabase } from "@/integrations/supabase/client";
import type { Decisao, StatusProposta, TipoProposta } from "./contrato";
import { lerHistoricoDaChave } from "./memoria";

/**
 * A trilha de auditoria: o que mudou no plano, quando, por quê e a mando de quem.
 *
 * ## O que este módulo NÃO faz
 *
 * Não guarda versões do Blueprint inteiro. Um snapshot por mudança daria um histórico perfeito e
 * um banco que cresce com o tamanho do plano vezes o número de edições — para responder perguntas
 * que a pessoa faz sobre um campo de cada vez.
 *
 * Em vez disso, cada proposta aprovada já carrega `valor_atual` e `valor_proposto` do campo que
 * ela tocou. A história de um campo é a sequência das propostas que mexeram nele, e é reconstruída
 * na leitura. É o "rastreabilidade suficiente e simples" em vez de event sourcing.
 *
 * ## O limite honesto disto
 *
 * Só enxerga mudanças que passaram pelo Copilot. Se a pessoa regerar o bloco Técnico pelo módulo
 * de Blueprint, o banco do plano muda sem proposta nenhuma, e essa mudança não aparece aqui. A
 * trilha é da conversa, não do Blueprint — e apresentá-la como histórico completo do projeto seria
 * mentir por omissão.
 */

export type MudancaRegistrada = {
  propostaId: string;
  decisaoId: string | null;
  tipo: TipoProposta;
  titulo: string;
  /** O caminho no Blueprint. `null` quando a mudança foi só de decisão. */
  campoAfetado: string | null;
  valorAnterior: unknown;
  valorNovo: unknown;
  motivo: string;
  impactos: string[];
  /** Quem aprovou. Pela RLS, sempre o dono do projeto. */
  aprovadoPor: string;
  aprovadoEm: string | null;
  propostaEm: string;
};

type LinhaHistorico = {
  id: string;
  tipo: string;
  titulo: string;
  campo_afetado: string | null;
  valor_atual: unknown;
  valor_proposto: unknown;
  motivo: string;
  impactos: string[] | null;
  decisao_id: string | null;
  user_id: string;
  criado_em: string;
  confirmado_em: string | null;
};

/**
 * As mudanças que de fato aconteceram, da mais recente para a mais antiga.
 *
 * Só `aprovada`: proposta rejeitada não mudou nada, e misturar as duas num "histórico de
 * mudanças" faria alguém ler uma troca de banco que nunca aconteceu como se tivesse acontecido.
 * O que foi recusado tem sua própria leitura, em `lerRecusadas`.
 */
export async function lerMudancas(projetoId: string, limite = 50): Promise<MudancaRegistrada[]> {
  const { data, error } = await supabase
    .from("pathly_copilot_propostas")
    .select(
      "id,tipo,titulo,campo_afetado,valor_atual,valor_proposto,motivo,impactos,decisao_id,user_id,criado_em,confirmado_em",
    )
    .eq("projeto_id", projetoId)
    .eq("status", "aprovada")
    .order("confirmado_em", { ascending: false })
    .limit(limite);

  if (error || !data) return [];

  return (data as LinhaHistorico[]).map((l) => ({
    propostaId: l.id,
    decisaoId: l.decisao_id,
    tipo: l.tipo as TipoProposta,
    titulo: l.titulo,
    campoAfetado: l.campo_afetado,
    valorAnterior: l.valor_atual,
    valorNovo: l.valor_proposto,
    motivo: l.motivo,
    impactos: Array.isArray(l.impactos) ? l.impactos : [],
    aprovadoPor: l.user_id,
    aprovadoEm: l.confirmado_em,
    propostaEm: l.criado_em,
  }));
}

/** O que foi proposto e recusado, com o motivo. Recusa também é decisão, e vale reler. */
export async function lerRecusadas(
  projetoId: string,
  limite = 20,
): Promise<{ titulo: string; motivo: string; status: StatusProposta; em: string }[]> {
  const { data, error } = await supabase
    .from("pathly_copilot_propostas")
    .select("titulo,motivo,status,criado_em")
    .eq("projeto_id", projetoId)
    .in("status", ["rejeitada", "cancelada"])
    .order("criado_em", { ascending: false })
    .limit(limite);

  if (error || !data) return [];

  return data.map((l) => ({
    titulo: l.titulo,
    motivo: l.motivo,
    status: l.status as StatusProposta,
    em: l.criado_em,
  }));
}

/**
 * A linha do tempo de um assunto, da decisão mais nova para a mais antiga.
 *
 * Segue a corrente de `substituiDecisaoId` em vez de confiar só na data: duas decisões criadas no
 * mesmo segundo teriam ordem indefinida por data, e a corrente diz exatamente quem aposentou quem.
 *
 * Decisão que a corrente não alcança entra no fim, ordenada por data — é o caso das primeiras
 * decisões de assuntos diferentes que compartilham a mesma chave por engano, e sumir com elas
 * seria esconder informação para deixar a função mais bonita.
 */
export async function linhaDoTempo(projetoId: string, chave: string): Promise<Decisao[]> {
  const todas = await lerHistoricoDaChave(projetoId, chave);
  if (todas.length === 0) return [];

  const porId = new Map(todas.map((d) => [d.id, d]));
  const ativa = todas.find((d) => d.status === "ativa") ?? todas[0];

  const corrente: Decisao[] = [];
  const vistos = new Set<string>();
  let atual: Decisao | undefined = ativa;

  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    corrente.push(atual);
    atual = atual.substituiDecisaoId ? porId.get(atual.substituiDecisaoId) : undefined;
  }

  const fora = todas.filter((d) => !vistos.has(d.id));
  return [...corrente, ...fora];
}

/**
 * As sete perguntas que uma mudança importante precisa responder.
 *
 * Existe como função, e não como texto montado na tela, porque as mesmas respostas vão para três
 * lugares: o painel do Copilot, o contexto das próximas mensagens e o relatório. Montar em três
 * lugares é garantir que um deles vai divergir.
 */
export function explicarMudanca(m: MudancaRegistrada): {
  pergunta: string;
  resposta: string;
}[] {
  return [
    { pergunta: "O que mudou", resposta: m.campoAfetado ?? `${m.titulo} (sem campo do plano)` },
    { pergunta: "Valor anterior", resposta: emTexto(m.valorAnterior) },
    { pergunta: "Novo valor", resposta: emTexto(m.valorNovo) },
    { pergunta: "Por quê", resposta: m.motivo },
    { pergunta: "Quem aprovou", resposta: m.aprovadoPor },
    { pergunta: "Quando", resposta: m.aprovadoEm ?? "—" },
    { pergunta: "Proposta que originou", resposta: m.propostaId },
    { pergunta: "Decisão criada", resposta: m.decisaoId ?? "nenhuma" },
  ];
}

function emTexto(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "—";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const json = JSON.stringify(v);
  return json.length > 160 ? `${json.slice(0, 157)}…` : json;
}

/**
 * O resumo do histórico para o contexto das mensagens.
 *
 * Curto de propósito: o Copilot precisa saber o que já foi decidido e o que já mudou, não reler o
 * projeto inteiro a cada pergunta. Uma linha por mudança, as mais recentes primeiro.
 */
export function resumirParaContexto(mudancas: MudancaRegistrada[], limite = 5): string[] {
  return mudancas.slice(0, limite).map((m) => {
    const onde = m.campoAfetado ? `${m.campoAfetado}: ` : "";
    return `${onde}${emTexto(m.valorAnterior)} → ${emTexto(m.valorNovo)} (${m.motivo})`;
  });
}
