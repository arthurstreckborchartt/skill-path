import { podeIr, type ApprovalRequest, type Estado } from "./aprovacao";

/**
 * As proteções do sistema de aprovações.
 *
 * Cada função aqui responde a um ataque específico. O comentário de cada uma diz qual — sem isso,
 * daqui a um ano alguém remove "a verificação redundante" e descobre qual era pelo incidente.
 *
 * ## O que NÃO está aqui
 *
 * Autenticação e RLS. Chamada não autenticada morre antes, na rota, que confere o `Bearer` contra
 * o Supabase; e acesso a linha alheia morre no banco, na RLS. Reimplementar isso aqui criaria uma
 * segunda regra para divergir da primeira.
 */

// =============================================================================================
// Impressão digital — contra ação duplicada
// =============================================================================================

/**
 * A impressão digital de uma ação: o que ela faz, onde, e com qual conteúdo.
 *
 * Duas ações com a mesma impressão **são a mesma ação**, pedida duas vezes. Acontece o tempo todo
 * sem má intenção — clique duplo, aba reaberta, retry de rede — e sem isto viram dois commits,
 * dois deploys, dois arquivos apagados.
 *
 * A chave é ordenada antes de serializar: `{a:1,b:2}` e `{b:2,a:1}` são o mesmo pedido, e um
 * `JSON.stringify` ingênuo diria que não.
 */
export async function impressaoDigital(params: {
  integrationId: string;
  action: string;
  projectId: string | null;
  metadata: Record<string, unknown>;
}): Promise<string> {
  /*
   * A lista vira JSON em vez de ser unida por um separador, e a razão é prática: um separador
   * exige escolher um caractere que não apareça no conteúdo. Escolhi o caractere nulo, e o
   * formatador o gravou como byte de controle literal dentro do fonte — coisa que nenhuma
   * ferramenta espera encontrar num `.ts`.
   *
   * JSON delimita sozinho, e sem caractere especial nenhum: `["a b","c"]` e `["a","b c"]` são
   * strings diferentes, que é exatamente a propriedade que a impressão digital precisa ter.
   */
  const base = JSON.stringify([
    params.integrationId,
    params.action,
    params.projectId ?? null,
    estavel(params.metadata),
  ]);

  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function estavel(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  const chaves = Object.keys(v as Record<string, unknown>).sort();
  return `{${chaves.map((k) => `${JSON.stringify(k)}:${estavel((v as Record<string, unknown>)[k])}`).join(",")}}`;
}

/** Os estados em que um pedido ainda "ocupa lugar": outro igual seria duplicata. */
const OCUPAM_LUGAR: readonly Estado[] = ["PENDING", "APPROVED", "EXECUTING"];

/**
 * Já existe um pedido vivo para exatamente esta ação?
 *
 * Terminais não ocupam lugar: depois de `SUCCESS` ou `FAILED`, pedir de novo é uma decisão nova e
 * legítima — repetir um deploy que falhou é normal.
 */
export function acharDuplicata(
  fingerprint: string,
  existentes: readonly ApprovalRequest[],
): ApprovalRequest | null {
  return (
    existentes.find((a) => a.fingerprint === fingerprint && OCUPAM_LUGAR.includes(a.status)) ?? null
  );
}

// =============================================================================================
// Nonce — contra replay
// =============================================================================================

/**
 * O nonce de uma aprovação: um segredo curto que vale uma execução.
 *
 * **Contra replay.** Sem ele, quem capturasse a requisição de execução — de um log, de um proxy,
 * do histórico — poderia reenviá-la e disparar a ação de novo, com a aprovação ainda válida.
 *
 * Ele é gerado na aprovação, exigido na execução, e a execução o consome. Só serve uma vez porque
 * `APPROVED → EXECUTING` só acontece uma vez.
 */
export function novoNonce(): string {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/**
 * Comparação em tempo constante.
 *
 * `===` vaza, pelo tempo, quantos caracteres iniciais bateram — o suficiente para descobrir um
 * nonce por tentativa em muitos cenários. O ganho de fazer certo é pequeno; o custo também.
 */
export function mesmoSegredo(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

// =============================================================================================
// A reserva — contra execução dupla
// =============================================================================================

export type ResultadoReserva =
  { ok: true; proximoEstado: "EXECUTING" } | { ok: false; motivo: string };

/**
 * Pode reservar esta aprovação para executar agora?
 *
 * **Contra execução dupla.** Entre conferir "está aprovada" e rodar cabe outra requisição — duas
 * abas, dois cliques, dois workers. A trava é a transição `APPROVED → EXECUTING`, que só acontece
 * a partir de `APPROVED`: quem chegar depois encontra `EXECUTING` e para.
 *
 * Esta função é a decisão; a atomicidade é do banco, num `update ... where status = 'APPROVED'`
 * que afeta zero linhas na segunda tentativa. As duas juntas — uma sem a outra não protege.
 */
export function podeReservar(
  a: ApprovalRequest,
  nonceApresentado: string,
  agora: Date = new Date(),
): ResultadoReserva {
  if (a.status !== "APPROVED") {
    return {
      ok: false,
      motivo:
        a.status === "EXECUTING"
          ? "Esta ação já está sendo executada."
          : `Esta ação está em ${a.status}, e só executa a partir de APPROVED.`,
    };
  }

  if (!podeIr(a.status, "EXECUTING")) {
    return { ok: false, motivo: "Transição não permitida." };
  }

  if (new Date(a.expires_at).getTime() <= agora.getTime()) {
    return { ok: false, motivo: "A aprovação venceu antes de ser usada." };
  }

  if (!mesmoSegredo(nonceApresentado, a.nonce)) {
    return { ok: false, motivo: "Esta execução não corresponde à aprovação." };
  }

  return { ok: true, proximoEstado: "EXECUTING" };
}

// =============================================================================================
// Vínculo — contra requisição forjada e permissão escalada
// =============================================================================================

export type Vinculo = {
  user_id: string;
  integration_id: string;
  action: string;
  project_id: string | null;
};

/**
 * A aprovação apresentada é mesmo desta pessoa, desta integração e desta ação?
 *
 * **Contra requisição forjada e escalada de permissão.** Sem isto, alguém aprovaria uma leitura
 * barata e apresentaria aquela aprovação na hora de executar um deploy: o id existe, está
 * `APPROVED`, e a execução passaria.
 *
 * A conferência é campo a campo de propósito. Comparar só o `id` da aprovação é o mesmo que não
 * comparar: o id é justamente o que o atacante tem.
 */
export function confereVinculo(a: ApprovalRequest, v: Vinculo): { ok: boolean; motivo: string } {
  if (a.user_id !== v.user_id) {
    return { ok: false, motivo: "Esta aprovação não é sua." };
  }
  if (a.integration_id !== v.integration_id) {
    return { ok: false, motivo: "Esta aprovação é de outra integração." };
  }
  if (a.action !== v.action) {
    return { ok: false, motivo: "Esta aprovação é de outra ação." };
  }
  if (a.project_id !== v.project_id) {
    return { ok: false, motivo: "Esta aprovação é de outro projeto." };
  }
  return { ok: true, motivo: "" };
}

/**
 * O que foi aprovado é o que vai acontecer?
 *
 * **Contra troca de conteúdo depois da aprovação.** A pessoa leu "modificar Dashboard.tsx" e
 * aprovou; se o payload pudesse mudar entre a aprovação e a execução, ela teria aprovado um texto
 * e outra coisa aconteceria.
 *
 * A impressão digital é recalculada na execução e comparada com a gravada. Divergiu, não roda.
 */
export function confereConteudo(
  a: ApprovalRequest,
  impressaoAgora: string,
): { ok: boolean; motivo: string } {
  return mesmoSegredo(a.fingerprint, impressaoAgora)
    ? { ok: true, motivo: "" }
    : {
        ok: false,
        motivo: "O que seria executado não é o que foi aprovado.",
      };
}

// =============================================================================================
// CSRF
// =============================================================================================

/**
 * Aprovar é sempre POST, com o token de sessão no cabeçalho.
 *
 * **Contra CSRF.** Um `GET /aprovar?id=...` seria disparável por uma imagem num site qualquer, e
 * a aprovação aconteceria com a sessão da pessoa sem ela tocar em nada.
 *
 * O Pathly autentica por `Authorization: Bearer`, não por cookie de sessão — o que já bloqueia
 * CSRF, porque outro site não consegue ler o token do `localStorage` para montar o cabeçalho.
 * Esta função existe para que essa propriedade seja **verificada**, e não herdada por acaso:
 * o dia em que alguém trocar a autenticação para cookie, o teste que chama isto quebra.
 */
export function requisicaoDeAprovacaoValida(req: {
  metodo: string;
  temAuthorizationBearer: boolean;
  origem: string | null;
  origemEsperada: string;
}): { ok: boolean; motivo: string } {
  if (req.metodo !== "POST") {
    return { ok: false, motivo: "Aprovação só por POST." };
  }
  if (!req.temAuthorizationBearer) {
    return { ok: false, motivo: "Aprovação exige a sessão no cabeçalho, não em cookie." };
  }
  /*
   * `Origin` é defesa em profundidade: com `Bearer` a requisição já não sai de outro site. Mas
   * quando o cabeçalho vem e diz outra origem, é sinal de algo que ninguém desenhou.
   */
  if (req.origem !== null && req.origem !== req.origemEsperada) {
    return { ok: false, motivo: "Requisição veio de outra origem." };
  }
  return { ok: true, motivo: "" };
}
