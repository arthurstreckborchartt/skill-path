import type { Capacidade } from "./capacidades";
import type { IntegrationAction, IntegrationEvent, IntegrationProvider } from "./contrato";

/**
 * `IntegrationAdapter` — o único lugar onde código específico de ferramenta pode existir.
 *
 * ## O contrato, em uma frase
 *
 * O núcleo entrega **uma ação aprovada e um token**, e recebe de volta **um resumo em português**.
 * Tudo entre as duas pontas — endpoint, formato, paginação, erro do fornecedor — é problema do
 * adaptador e não vaza para fora dele.
 *
 * ## O que o adaptador NÃO decide
 *
 * Não decide se pode executar. Quando `executar` é chamado, a permissão já foi conferida pelo
 * Hub, a ação já está `aprovada` e já foi reservada. Um adaptador que reconfere seria uma segunda
 * regra de autorização para divergir da primeira — e a pior hora de descobrir a divergência é
 * depois de uma delas ter deixado passar.
 *
 * Também não decide o que gravar. Ele devolve o resultado; quem registra estado e auditoria é o
 * Hub, num lugar só.
 *
 * ## Por que tudo é opcional menos `executar`
 *
 * Um provedor de leitura por API Key não tem OAuth. Um bridge local não tem webhook. Obrigar a
 * implementar o que não existe produz funções que lançam "não suportado" — ruído que o
 * `IntegrationProvider` já declara honestamente em `transportes`.
 */

export type ResultadoAcao =
  | { ok: true; resumo: string }
  | {
      ok: false;
      motivo: string;
      /** `true` quando repetir não adianta. A tela usa para escolher entre "tente de novo" e não. */
      permanente: boolean;
    };

export type ContextoExecucao = {
  /** O token em claro do provedor. `null` quando o método de auth não usa token. */
  token: string | null;
  /**
   * As capacidades concedidas nesta conexão, já resolvidas.
   *
   * Vêm para o adaptador **só para ele montar a chamada certa** — por exemplo, pedir o escopo de
   * leitura quando escrita não foi concedida. Não para reconferir autorização.
   */
  concedidas: readonly Capacidade[];
  projetoId: string | null;
};

export type ResultadoConexao =
  | { ok: true; token: string; conta: string; escopos: string[]; expiraEm: string | null }
  | { ok: false; motivo: string };

export type IntegrationAdapter = {
  /** A declaração. O núcleo lê isto; nunca lê o código do adaptador. */
  provedor: IntegrationProvider;

  /**
   * Executa uma ação já aprovada.
   *
   * A única função obrigatória. Recebe a ação **como foi gravada** — nunca remontada — e devolve
   * um resumo curto. Token, cabeçalho e corpo bruto do fornecedor não entram no retorno: ele vai
   * para o banco e para a tela.
   */
  executar: (acao: IntegrationAction, contexto: ContextoExecucao) => Promise<ResultadoAcao>;

  /** Monta a URL de autorização. Só para provedor com `transportes.oauth`. */
  urlDeAutorizacao?: (params: {
    redirectUri: string;
    estado: string;
    desafioPkce: string;
  }) => string;

  /** Troca o código pelo token. Roda no servidor, com o segredo. */
  concluirConexao?: (params: {
    codigo: string;
    redirectUri: string;
    verificadorPkce: string;
  }) => Promise<ResultadoConexao>;

  /** Renova o token quando vence. Sem isto, a conexão simplesmente expira. */
  renovar?: (refresh: string) => Promise<ResultadoConexao>;

  /**
   * Normaliza um webhook recebido.
   *
   * Devolve `null` quando o corpo não interessa — a maioria dos webhooks de um fornecedor não
   * interessa, e descartar cedo é melhor que guardar tudo.
   *
   * **Nunca** devolve uma ação: evento que vira ação executável sem passar por aprovação é o
   * caminho pelo qual quem descobre a URL do webhook passa a comandar o Pathly.
   */
  interpretarEvento?: (
    corpo: unknown,
    cabecalhos: Headers,
  ) => Omit<IntegrationEvent, "id" | "recebidoEm" | "processado"> | null;

  /**
   * Confere se o webhook veio mesmo do fornecedor (assinatura HMAC, normalmente).
   *
   * Separado de `interpretarEvento` de propósito: interpretar sem verificar é aceitar qualquer
   * corpo que chegue no endereço certo, e o Hub recusa o evento quando esta função existe e
   * devolve `false`.
   */
  verificarAssinatura?: (corpoBruto: string, cabecalhos: Headers) => Promise<boolean>;
};
