/**
 * Chamada externa com prazo.
 *
 * Vive em módulo próprio para quebrar um ciclo: o executor precisa do provedor para executar, e o
 * provedor precisa disto para chamar. Com os dois importando daqui, ninguém importa o outro.
 *
 * O prazo não é detalhe: sem ele, uma ponta lenta segura o Worker até o limite dele, e o limite
 * do Worker é compartilhado com todo o resto do app.
 */
const TIMEOUT_MS = 10_000;

export function buscarComPrazo(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}
