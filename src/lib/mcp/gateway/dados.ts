import { lerEnv } from "@/lib/server-env";
import type { Capacidade } from "@/lib/hub/capacidades";
import type { PermissaoConcedida } from "./portao";

/**
 * O acesso a dados do MCP Gateway.
 *
 * ## Sempre como a pessoa, nunca como o serviço
 *
 * Toda chamada daqui leva o **token do usuário**, verificado pelo JWT do MCP. A RLS do Supabase
 * continua valendo por baixo de cada consulta.
 *
 * Isso é deliberado e é a segunda parede: se a verificação de permissão em `portao.ts` tivesse um
 * defeito, a RLS ainda limitaria o alcance ao que aquele usuário já podia ver. `service_role` não
 * aparece neste arquivo, e não deve aparecer — com ele, a parede de baixo some e a de cima passa
 * a ser a única.
 *
 * ## Por que PostgREST direto, e não o cliente do Supabase
 *
 * Porque o cliente do navegador guarda sessão em `localStorage`, e aqui não há navegador: o
 * handler roda no servidor, com um token por requisição. `fetch` com `Authorization` é o caminho
 * honesto — o mesmo que as rotas `api.*.ts` já usam.
 */

type Resposta<T> = { ok: true; dados: T } | { ok: false; motivo: string };

function base(): { url: string; anon: string } | null {
  const url = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
  const anon = lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  return url && anon ? { url: url.replace(/\/+$/, ""), anon } : null;
}

async function consultar<T>(caminho: string, token: string): Promise<Resposta<T>> {
  const b = base();
  if (!b) return { ok: false, motivo: "Supabase não está configurado neste ambiente." };

  try {
    const r = await fetch(`${b.url}/rest/v1/${caminho}`, {
      headers: { apikey: b.anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      /*
       * `42501` aqui é a RLS ou o privilégio agindo — e é uma resposta correta, não uma falha do
       * Gateway. Repassar o código deixa quem chamou distinguir "não existe" de "não é seu".
       */
      const corpo = (await r.json().catch(() => null)) as { code?: string } | null;
      return {
        ok: false,
        motivo: `O banco recusou a leitura${corpo?.code ? ` (${corpo.code})` : ""}.`,
      };
    }
    return { ok: true, dados: (await r.json()) as T };
  } catch {
    return { ok: false, motivo: "Não consegui falar com o banco agora." };
  }
}

async function escrever(
  caminho: string,
  token: string,
  metodo: "POST" | "PATCH",
  corpo: unknown,
): Promise<Resposta<unknown>> {
  const b = base();
  if (!b) return { ok: false, motivo: "Supabase não está configurado neste ambiente." };

  try {
    const r = await fetch(`${b.url}/rest/v1/${caminho}`, {
      method: metodo,
      headers: {
        apikey: b.anon,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(corpo),
    });
    if (!r.ok) {
      const c = (await r.json().catch(() => null)) as { code?: string; message?: string } | null;
      return { ok: false, motivo: c?.message ?? `O banco recusou a escrita (${r.status}).` };
    }
    return { ok: true, dados: await r.json() };
  } catch {
    return { ok: false, motivo: "Não consegui falar com o banco agora." };
  }
}

// =============================================================================================
// O que o portão precisa antes de decidir
// =============================================================================================

type LinhaPermissao = {
  capacidade: string;
  projeto_id: string | null;
  revogada_em: string | null;
  expira_em: string | null;
};

/** As permissões desta integração, para esta pessoa. É o que o portão consulta. */
export async function lerPermissoes(
  token: string,
  integrationId: string,
): Promise<PermissaoConcedida[]> {
  const r = await consultar<LinhaPermissao[]>(
    `pathly_hub_permissoes?select=capacidade,projeto_id,revogada_em,expira_em&provedor=eq.${encodeURIComponent(integrationId)}`,
    token,
  );
  if (!r.ok) return [];
  return r.dados.map((l) => ({
    capacidade: l.capacidade as Capacidade,
    projetoId: l.projeto_id,
    revogadaEm: l.revogada_em,
    expiraEm: l.expira_em,
  }));
}

/** Os pedidos vivos, para detectar réplica. O `nonce` não é pedido: o navegador não o lê. */
export async function lerPedidosVivos(
  token: string,
): Promise<{ id: string; fingerprint: string }[]> {
  const r = await consultar<{ id: string; fingerprint: string }[]>(
    `pathly_hub_aprovacoes?select=id,fingerprint&status=in.(PENDING,APPROVED,EXECUTING)`,
    token,
  );
  return r.ok ? r.dados : [];
}

/** Grava o pedido. A camada de cima já decidiu que ele existe; aqui ele só é persistido. */
export async function gravarPedido(
  token: string,
  p: {
    user_id: string;
    project_id: string | null;
    integration_id: string;
    tool: string;
    arguments: Record<string, unknown>;
    requested_scope: string;
    capability: string;
    expires_at: string;
    fingerprint: string;
    nonce: string;
  },
): Promise<{ ok: true; requestId: string } | { ok: false; motivo: string }> {
  const r = await escrever("pathly_hub_aprovacoes", token, "POST", {
    user_id: p.user_id,
    project_id: p.project_id,
    integration_id: p.integration_id,
    action: p.tool,
    requested_permission: p.requested_scope,
    capability: p.capability,
    /* `uma-vez` sempre: um pedido criado por MCP nunca nasce com escopo de sessão nem permanente. */
    scope: "uma-vez",
    status: "PENDING",
    metadata: p.arguments,
    expires_at: p.expires_at,
    fingerprint: p.fingerprint,
    nonce: p.nonce,
  });

  if (!r.ok) return r;
  const linha = (r.dados as { id: string }[])[0];
  return linha
    ? { ok: true, requestId: linha.id }
    : { ok: false, motivo: "O banco não devolveu o pedido." };
}

/**
 * Registra na trilha de auditoria.
 *
 * **Toda** chamada passa por aqui, inclusive as recusadas — `acesso-negado` é um ato como
 * qualquer outro. Auditar só o que deu certo produz uma trilha que não responde a pergunta mais
 * útil: "o que essa integração tentou fazer?".
 *
 * Nunca lança. Uma falha ao auditar não pode derrubar a chamada; ela vira silêncio na trilha, que
 * é ruim, enquanto derrubar seria pior.
 */
export async function auditar(
  token: string,
  a: {
    provedor: string;
    ato: string;
    capacidade: string | null;
    projetoId: string | null;
    detalhe: string;
  },
): Promise<void> {
  await escrever("pathly_hub_auditoria", token, "POST", {
    provedor: a.provedor,
    ato: a.ato,
    capacidade: a.capacidade,
    projeto_id: a.projetoId,
    detalhe: a.detalhe.slice(0, 500),
  }).catch(() => undefined);
}

// =============================================================================================
// As leituras das ferramentas
// =============================================================================================

const COLUNAS_PROJETO =
  "id,nome,ideia,status,conteudo,etapa_atual,etapas_concluidas,etapas_total,atualizado_em";

export type ProjetoLido = {
  id: string;
  nome: string;
  ideia: string;
  status: string;
  conteudo: Record<string, unknown> | null;
  etapa_atual: number;
  etapas_concluidas: number;
  etapas_total: number;
  atualizado_em: string;
};

/**
 * O projeto. Quando `projetoId` é nulo, devolve o mais recente.
 *
 * O padrão existe porque um agente MCP quase nunca sabe o id: ele sabe "o projeto em que estou
 * trabalhando". Exigir o id em toda chamada faria a primeira ser sempre um erro.
 */
export async function lerProjeto(
  token: string,
  projetoId: string | null,
): Promise<Resposta<ProjetoLido>> {
  const filtro = projetoId
    ? `id=eq.${encodeURIComponent(projetoId)}`
    : "order=atualizado_em.desc&limit=1";
  const r = await consultar<ProjetoLido[]>(
    `pathly_projetos?select=${COLUNAS_PROJETO}&${filtro}`,
    token,
  );
  if (!r.ok) return r;
  const p = r.dados[0];
  return p
    ? { ok: true, dados: p }
    : {
        ok: false,
        motivo: projetoId ? "Projeto não encontrado, ou não é seu." : "Você ainda não tem projeto.",
      };
}

export type RegistroLido = {
  tipo: string;
  origem: string;
  texto: string;
  itens: string[] | null;
  etapa_ordem: number | null;
  criado_em: string;
};

export async function lerRegistrosDoProjeto(
  token: string,
  projetoId: string,
  limite = 40,
): Promise<RegistroLido[]> {
  const r = await consultar<RegistroLido[]>(
    `pathly_hub_registros?select=tipo,origem,texto,itens,etapa_ordem,criado_em&project_id=eq.${encodeURIComponent(projetoId)}&order=criado_em.desc&limit=${limite}`,
    token,
  );
  return r.ok ? r.dados : [];
}

export type DecisaoLida = {
  chave: string;
  titulo: string;
  valor: string;
  motivo: string;
  status: string;
  criado_em: string;
};

export async function lerDecisoes(token: string, projetoId: string): Promise<DecisaoLida[]> {
  const r = await consultar<DecisaoLida[]>(
    `pathly_copilot_decisoes?select=chave,titulo,valor,motivo,status,criado_em&projeto_id=eq.${encodeURIComponent(projetoId)}&order=criado_em.desc&limit=100`,
    token,
  );
  return r.ok ? r.dados : [];
}

export async function lerEtapas(
  token: string,
  projetoId: string,
): Promise<{ ordem: number; status: string }[]> {
  const r = await consultar<{ ordem: number; status: string }[]>(
    `pathly_etapas?select=ordem,status&projeto_id=eq.${encodeURIComponent(projetoId)}`,
    token,
  );
  return r.ok ? r.dados : [];
}

// =============================================================================================
// As escritas das ferramentas
// =============================================================================================

export async function gravarRegistro(
  token: string,
  r: {
    user_id: string;
    project_id: string;
    etapa_ordem: number | null;
    provedor_id: string;
    tipo: string;
    texto: string;
    itens: string[];
  },
): Promise<Resposta<unknown>> {
  return escrever("pathly_hub_registros", token, "POST", {
    ...r,
    /*
     * `ferramenta`: veio por um canal que o Pathly leu sozinho — o próprio MCP, autenticado. É o
     * único lugar do produto onde essa origem é a verdadeira, e não uma promessa.
     */
    origem: "ferramenta",
  });
}

export async function gravarDecisao(
  token: string,
  d: {
    projeto_id: string;
    user_id: string;
    chave: string;
    titulo: string;
    valor: string;
    motivo: string;
  },
): Promise<Resposta<unknown>> {
  return escrever("pathly_copilot_decisoes", token, "POST", {
    ...d,
    status: "ativa",
    origem: "sistema",
    /* Não nasce confirmada: quem decidiu foi uma ferramenta, não a pessoa. */
    confirmada: false,
  });
}

export async function atualizarEtapa(
  token: string,
  projetoId: string,
  ordem: number,
  status: string,
): Promise<Resposta<unknown>> {
  const alvo = `pathly_etapas?projeto_id=eq.${encodeURIComponent(projetoId)}&ordem=eq.${ordem}`;
  const r = await escrever(alvo, token, "PATCH", { status });
  if (!r.ok) return r;

  /*
   * PostgREST devolve `[]` quando o filtro não casou — e aí a chamada "deu certo" sem ter mudado
   * nada. Para quem chamou, "atualizei" e "não achei a etapa" são respostas muito diferentes.
   */
  return Array.isArray(r.dados) && r.dados.length === 0
    ? { ok: false, motivo: `Não existe etapa ${ordem} neste projeto.` }
    : r;
}
