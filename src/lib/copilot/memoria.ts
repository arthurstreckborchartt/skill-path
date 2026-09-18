import { supabase } from "@/integrations/supabase/client";
import {
  validarResposta,
  type Decisao,
  type MensagemCopilot,
  type OrigemDecisao,
  type Papel,
  type Proposta,
  type StatusDecisao,
  type StatusProposta,
  type TipoProposta,
} from "./contrato";

/**
 * A memória do Copilot: mensagens, decisões e propostas.
 *
 * Só acesso a dados. A lógica de proposta vive em `propostas.ts`; a montagem de contexto, em
 * `contexto.ts`. Aqui fica o que fala com o banco, e nada mais.
 *
 * ## Por que nenhuma função apaga nada
 *
 * Mensagens e decisões são append-only, e isso é garantido no banco: mensagens não têm `grant
 * update`, decisões têm um gatilho que recusa mudança de conteúdo. Este arquivo não tenta
 * contornar nem compensar isso — se uma função aqui precisasse de `delete`, o desenho estaria
 * errado, não a permissão.
 */

// ---------------------------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------------------------

/** Quantas mensagens por página. Cabe numa tela sem rolagem infinita e sem N consultas. */
export const PAGINA_MENSAGENS = 30;

type LinhaMensagem = {
  id: string;
  papel: string;
  conteudo: unknown;
  criado_em: string;
};

function daLinhaMensagem(l: LinhaMensagem): MensagemCopilot {
  const conteudo = (l.conteudo ?? {}) as { texto?: unknown; resposta?: unknown };
  const papel: Papel = l.papel === "copilot" ? "copilot" : "usuario";

  return {
    id: l.id,
    papel,
    texto: typeof conteudo.texto === "string" ? conteudo.texto : "",
    // Resposta gravada que não passa mais no validador: o contrato mudou desde que ela foi
    // escrita. Vira `null` e a tela mostra só o texto — melhor que sumir com a mensagem.
    resposta: papel === "copilot" ? validarResposta(conteudo.resposta) : null,
    criadoEm: l.criado_em,
  };
}

export type PaginaMensagens = {
  mensagens: MensagemCopilot[];
  /** Cursor para a página anterior (mensagens mais antigas). `null` quando chegou ao começo. */
  anteriorA: string | null;
};

/**
 * Lê uma página de mensagens, da mais nova para a mais velha.
 *
 * O índice é `(projeto_id, criado_em desc)`, então esta é a ordem em que ele já está — paginar ao
 * contrário faria o Postgres ordenar na mão a cada página.
 *
 * Devolve em ordem cronológica, que é como a tela desenha.
 */
export async function lerMensagens(
  projetoId: string,
  anteriorA?: string,
): Promise<PaginaMensagens> {
  let consulta = supabase
    .from("pathly_copilot_mensagens")
    .select("id,papel,conteudo,criado_em")
    .eq("projeto_id", projetoId)
    .order("criado_em", { ascending: false })
    // Uma a mais que a página: é assim que se sabe se existe página seguinte sem um `count`.
    .limit(PAGINA_MENSAGENS + 1);

  if (anteriorA) consulta = consulta.lt("criado_em", anteriorA);

  const { data, error } = await consulta;
  if (error || !data) return { mensagens: [], anteriorA: null };

  const temMais = data.length > PAGINA_MENSAGENS;
  const pagina = temMais ? data.slice(0, PAGINA_MENSAGENS) : data;
  const mensagens = pagina.map((l) => daLinhaMensagem(l as LinhaMensagem)).reverse();

  return {
    mensagens,
    anteriorA: temMais ? (pagina[pagina.length - 1]?.criado_em ?? null) : null,
  };
}

export async function gravarMensagem(
  projetoId: string,
  userId: string,
  papel: Papel,
  conteudo: { texto: string; resposta?: unknown },
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pathly_copilot_mensagens")
    .insert({
      projeto_id: projetoId,
      user_id: userId,
      papel,
      conteudo: conteudo as never,
      metadata: metadata as never,
    })
    .select("id")
    .single();

  return error || !data ? null : data.id;
}

// ---------------------------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------------------------

type LinhaDecisao = {
  id: string;
  chave: string;
  titulo: string;
  valor: string;
  motivo: string;
  status: string;
  substitui_decisao_id: string | null;
  origem: string;
  confirmado_em: string | null;
  criado_em: string;
};

function daLinhaDecisao(l: LinhaDecisao): Decisao {
  return {
    id: l.id,
    chave: l.chave,
    titulo: l.titulo,
    valor: l.valor,
    motivo: l.motivo,
    status: l.status as StatusDecisao,
    substituiDecisaoId: l.substitui_decisao_id,
    origem: l.origem as OrigemDecisao,
    confirmadoEm: l.confirmado_em,
    criadoEm: l.criado_em,
  };
}

const COLUNAS_DECISAO =
  "id,chave,titulo,valor,motivo,status,substitui_decisao_id,origem,confirmado_em,criado_em";

/**
 * As decisões que valem hoje.
 *
 * Entra no contexto de TODA mensagem, por isso lê pelo índice `(projeto_id, status)` e traz só o
 * que está ativo. Decisão substituída nunca sai daqui — usar uma decisão aposentada como se fosse
 * a atual é o jeito mais rápido de o Copilot dar conselho sobre um projeto que não existe mais.
 */
export async function lerDecisoesAtivas(projetoId: string): Promise<Decisao[]> {
  const { data, error } = await supabase
    .from("pathly_copilot_decisoes")
    .select(COLUNAS_DECISAO)
    .eq("projeto_id", projetoId)
    .eq("status", "ativa")
    .order("criado_em", { ascending: false });

  if (error || !data) return [];

  const decisoes = data.map((l) => daLinhaDecisao(l as LinhaDecisao));

  /**
   * Duas decisões ativas para a mesma chave: a mais nova ganha.
   *
   * Não deveria acontecer, mas pode: a supersedência são duas escritas sem transação (o PostgREST
   * não expõe uma), e se a segunda falhar sobra a antiga ativa junto com a nova. Escolher pela
   * data aqui faz a leitura ficar certa mesmo assim — e é por isso que a ordem da escrita é
   * inserir a nova primeiro.
   */
  const porChave = new Map<string, Decisao>();
  for (const d of decisoes) {
    if (!porChave.has(d.chave)) porChave.set(d.chave, d);
  }

  return [...porChave.values()];
}

/** O histórico completo de um assunto, do mais novo ao mais antigo. A trilha de auditoria. */
export async function lerHistoricoDaChave(projetoId: string, chave: string): Promise<Decisao[]> {
  const { data, error } = await supabase
    .from("pathly_copilot_decisoes")
    .select(COLUNAS_DECISAO)
    .eq("projeto_id", projetoId)
    .eq("chave", chave)
    .order("criado_em", { ascending: false });

  return error || !data ? [] : data.map((l) => daLinhaDecisao(l as LinhaDecisao));
}

export type NovaDecisao = {
  chave: string;
  titulo: string;
  valor: string;
  motivo: string;
  origem: OrigemDecisao;
  /** Já nasce confirmada quando veio de uma aprovação explícita. */
  confirmada: boolean;
};

/**
 * Registra uma decisão, aposentando a anterior da mesma chave.
 *
 * ## A ordem das duas escritas importa
 *
 * Insere a nova ANTES de marcar a velha. Sem transação, uma das duas pode falhar, e as duas
 * falhas possíveis não são igualmente ruins:
 *
 * - Inserir e não marcar deixa duas ativas — feio, e `lerDecisoesAtivas` corrige na leitura.
 * - Marcar e não inserir deixa o projeto SEM decisão sobre aquele assunto, e a antiga perdida.
 *
 * A primeira é recuperável; a segunda apaga informação. Por isso esta ordem.
 */
export async function registrarDecisao(
  projetoId: string,
  userId: string,
  nova: NovaDecisao,
): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const { data: ativas } = await supabase
    .from("pathly_copilot_decisoes")
    .select("id")
    .eq("projeto_id", projetoId)
    .eq("chave", nova.chave)
    .eq("status", "ativa");

  const anterior = ativas?.[0]?.id ?? null;
  const agora = new Date().toISOString();

  const { data, error } = await supabase
    .from("pathly_copilot_decisoes")
    .insert({
      projeto_id: projetoId,
      user_id: userId,
      chave: nova.chave,
      titulo: nova.titulo,
      valor: nova.valor,
      motivo: nova.motivo,
      status: "ativa",
      substitui_decisao_id: anterior,
      origem: nova.origem,
      confirmado_em: nova.confirmada ? agora : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, erro: error?.message ?? "Não consegui registrar a decisão." };
  }

  // Todas as ativas da chave, não só a primeira: se o banco já estava com duas, isto conserta.
  if (ativas && ativas.length > 0) {
    await supabase
      .from("pathly_copilot_decisoes")
      .update({ status: "substituida" })
      .eq("projeto_id", projetoId)
      .eq("chave", nova.chave)
      .eq("status", "ativa")
      .neq("id", data.id);
  }

  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------------------------------------
// Propostas
// ---------------------------------------------------------------------------------------------

type LinhaProposta = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  campo_afetado: string | null;
  valor_atual: unknown;
  valor_proposto: unknown;
  motivo: string;
  impactos: string[] | null;
  status: string;
  decisao_id: string | null;
  criado_em: string;
  confirmado_em: string | null;
};

function daLinhaProposta(l: LinhaProposta): Proposta {
  return {
    id: l.id,
    tipo: l.tipo as TipoProposta,
    titulo: l.titulo,
    descricao: l.descricao,
    campoAfetado: l.campo_afetado,
    valorAtual: l.valor_atual,
    valorProposto: l.valor_proposto,
    motivo: l.motivo,
    impactos: Array.isArray(l.impactos) ? l.impactos : [],
    status: l.status as StatusProposta,
    decisaoId: l.decisao_id,
    criadoEm: l.criado_em,
    confirmadoEm: l.confirmado_em,
  };
}

const COLUNAS_PROPOSTA =
  "id,tipo,titulo,descricao,campo_afetado,valor_atual,valor_proposto,motivo,impactos,status,decisao_id,criado_em,confirmado_em";

/** As propostas esperando resposta. Entram no contexto e viram cartão na tela. */
export async function lerPropostasPendentes(projetoId: string): Promise<Proposta[]> {
  const { data, error } = await supabase
    .from("pathly_copilot_propostas")
    .select(COLUNAS_PROPOSTA)
    .eq("projeto_id", projetoId)
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  return error || !data ? [] : data.map((l) => daLinhaProposta(l as LinhaProposta));
}

export async function lerProposta(id: string): Promise<Proposta | null> {
  const { data, error } = await supabase
    .from("pathly_copilot_propostas")
    .select(COLUNAS_PROPOSTA)
    .eq("id", id)
    .maybeSingle();

  return error || !data ? null : daLinhaProposta(data as LinhaProposta);
}

export type NovaProposta = {
  tipo: TipoProposta;
  titulo: string;
  descricao: string;
  campoAfetado: string | null;
  valorAtual: unknown;
  valorProposto: unknown;
  motivo: string;
  impactos: string[];
};

export async function gravarProposta(
  projetoId: string,
  userId: string,
  nova: NovaProposta,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("pathly_copilot_propostas")
    .insert({
      projeto_id: projetoId,
      user_id: userId,
      tipo: nova.tipo,
      titulo: nova.titulo,
      descricao: nova.descricao,
      campo_afetado: nova.campoAfetado,
      valor_atual: (nova.valorAtual ?? null) as never,
      valor_proposto: (nova.valorProposto ?? null) as never,
      motivo: nova.motivo,
      impactos: nova.impactos,
      status: "pendente",
    })
    .select("id")
    .single();

  return error || !data ? null : data.id;
}

/**
 * Muda o status de uma proposta.
 *
 * `decisaoId` só é passado na aprovação, e é ele que fecha a rastreabilidade: dado um Blueprint
 * alterado, dá para chegar na proposta que originou a mudança e na decisão que ela gerou.
 */
export async function mudarStatusProposta(
  id: string,
  status: Exclude<StatusProposta, "pendente">,
  decisaoId?: string,
): Promise<boolean> {
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("pathly_copilot_propostas")
    .update({
      status,
      atualizado_em: agora,
      // Só aprovação carimba confirmação: rejeitar não é confirmar nada.
      ...(status === "aprovada" ? { confirmado_em: agora } : {}),
      ...(decisaoId ? { decisao_id: decisaoId } : {}),
    })
    .eq("id", id)
    // Redundante com a RLS, e de propósito: uma proposta só sai de pendente uma vez, e este
    // filtro impede que dois cliques rápidos apliquem a mesma mudança duas vezes.
    .eq("status", "pendente");

  return !error;
}
