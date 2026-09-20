import type { Capacidade } from "./capacidades";

/**
 * Integration Hub — a camada estrutural das integrações.
 *
 * ## A regra que o Hub existe para sustentar
 *
 * **Nenhum código específico de ferramenta vive no núcleo do Pathly.** Claude, Cursor, GitHub,
 * Obsidian, Revit — cada um entra como um `IntegrationProvider` declarado mais um
 * `IntegrationAdapter` que sabe falar com ele. O núcleo conhece capacidades, permissões e ações;
 * não conhece nomes de fornecedor.
 *
 * O teste da arquitetura é este: **acrescentar um provedor não deve tocar em arquivo nenhum
 * fora do próprio provedor**, exceto uma linha de registro.
 *
 * ## Os nomes estão em inglês, e o resto do repositório não
 *
 * Foi escolha sua ao nomear os oito conceitos, e mantive porque é o vocabulário com que você vai
 * pensar nesta camada. O corpo, os comentários e as mensagens seguem em português como o resto do
 * Pathly. Se preferir traduzir os tipos, é uma renomeação mecânica e eu faço.
 *
 * ## O que já existia, e como o Hub se encaixa
 *
 * Este repositório **já tem** uma camada de integrações funcionando, validada no banco:
 *
 * - `pathly_conexoes` — uma linha por pessoa × provedor, com o token cifrado e protegido por
 *   privilégio de coluna. É o `IntegrationConnection`.
 * - `pathly_acoes_externas` — append-only, com gatilho de transição no banco. É o
 *   `IntegrationAction`.
 *
 * O Hub **não recria nem substitui** essas duas. Ele generaliza o que estava fraco em volta
 * delas: o catálogo de provedores (que declarava cinco campos), o executor (que era um `switch`),
 * e acrescenta o que não existia — permissão granular, evento e trilha de auditoria.
 *
 * Isso mantém intacto o que foi validado por sonda hoje, e o custo de adoção é aditivo.
 */

// =============================================================================================
// 1. IntegrationProvider — o que uma ferramenta é
// =============================================================================================

export const TIPOS_PROVEDOR = [
  "agente-de-codigo",
  "editor",
  "controle-de-versao",
  "base-de-conhecimento",
  "projeto-tecnico",
  "outro",
] as const;
export type TipoProvedor = (typeof TIPOS_PROVEDOR)[number];

export const STATUS_PROVEDOR = ["disponivel", "beta", "planejado", "indisponivel"] as const;
export type StatusProvedor = (typeof STATUS_PROVEDOR)[number];

export const METODOS_AUTH = ["oauth", "api-key", "cli-local", "bridge", "nenhum"] as const;
export type MetodoAuth = (typeof METODOS_AUTH)[number];

/**
 * Onde a ferramenta roda.
 *
 * Isto não é detalhe de implementação: decide se o Pathly **consegue** alcançar a ferramenta
 * sozinho. Cursor e Claude Code rodam na máquina da pessoa, e nuvem nenhuma fala com localhost —
 * por isso existe `bridge`.
 */
export const EXECUCOES = ["nuvem", "local", "hibrido"] as const;
export type Execucao = (typeof EXECUCOES)[number];

/**
 * As formas de transporte que um provedor declara suportar.
 *
 * São fatos sobre a ferramenta, não desejos. `suportaMcp: true` significa que ela fala MCP —
 * não que o Pathly já use.
 */
export type Transportes = {
  mcp: boolean;
  oauth: boolean;
  apiKey: boolean;
  webhook: boolean;
  cli: boolean;
};

/**
 * O que o provedor sabe fazer, em grosso. Existe além das capacidades porque responde a uma
 * pergunta diferente: capacidade é o que a PESSOA autoriza; isto é o que a FERRAMENTA suporta.
 * Uma ferramenta pode suportar escrita e a pessoa nunca conceder.
 */
export type Suporte = {
  leitura: boolean;
  escrita: boolean;
  execucao: boolean;
  sincronizacao: boolean;
};

export type IntegrationProvider = {
  id: string;
  nome: string;
  tipo: TipoProvedor;
  /** Versão da **declaração**, não da ferramenta. Muda quando capacidades ou ações mudam. */
  versao: string;
  status: StatusProvedor;
  descricao: string;
  metodoAuth: MetodoAuth;
  execucao: Execucao;
  /** `true` quando o Pathly não alcança a ferramenta sem um processo local intermediando. */
  precisaBridge: boolean;
  transportes: Transportes;
  suporte: Suporte;
  /** Tudo que este provedor pode oferecer. A pessoa concede um subconjunto — nunca isto inteiro. */
  capacidades: readonly Capacidade[];
  /**
   * As permissões do lado do fornecedor que a conexão vai pedir (escopos OAuth, por exemplo).
   *
   * Ficam aqui em vez de dentro do adaptador porque a pessoa tem o direito de ler, antes de
   * autorizar, o que o Pathly vai pedir em nome dela.
   */
  permissoesExternas: readonly string[];
  acoes: readonly IntegrationActionDefinition[];
  /** O que esta integração **não** faz, em português. Aparece na tela, e evita promessa falsa. */
  limitacoes: readonly string[];
};

// =============================================================================================
// 2. IntegrationAction — o que se pode pedir, e o que foi pedido
// =============================================================================================

export const IMPACTOS = ["leitura", "escrita", "destrutiva"] as const;
export type Impacto = (typeof IMPACTOS)[number];

/** A definição de uma ação no catálogo do provedor. */
export type IntegrationActionDefinition = {
  id: string;
  rotulo: string;
  /** Uma frase do que vai acontecer. É o que a pessoa lê antes de aprovar. */
  resumo: string;
  /** Para onde vai, legível. Sem isso, aprovar é aprovar às cegas. */
  destino: string;
  impacto: Impacto;
  /** As capacidades que esta ação consome. O Hub recusa se alguma não estiver concedida. */
  exige: readonly Capacidade[];
};

export const ESTADOS_ACAO = ["pendente", "aprovada", "executada", "recusada", "falhou"] as const;
export type EstadoAcao = (typeof ESTADOS_ACAO)[number];

/**
 * Uma ação registrada — o que existe hoje em `pathly_acoes_externas`.
 *
 * Append-only por estado, com o gatilho de transição no banco. O `payload` é gravado **antes** da
 * aprovação e nunca muda: é o que faz a aprovação valer para o objeto que a pessoa leu.
 */
export type IntegrationAction = {
  id: string;
  provedor: string;
  acaoId: string;
  projetoId: string | null;
  resumo: string;
  destino: string;
  impacto: Impacto;
  payload: Record<string, unknown>;
  estado: EstadoAcao;
  criadoEm: string;
  decididoEm: string | null;
  executadoEm: string | null;
  resultado: string | null;
  erro: string | null;
};

// =============================================================================================
// 3. IntegrationConnection — a conta ligada
// =============================================================================================

export const ESTADOS_CONEXAO = ["ativa", "expirada", "revogada", "erro"] as const;
export type EstadoConexao = (typeof ESTADOS_CONEXAO)[number];

/**
 * Note o que **não** está aqui: o token.
 *
 * Este é o tipo que o navegador recebe. O token vive em `pathly_conexoes.token_cifrado`, cifrado,
 * e `authenticated` não tem privilégio para lê-lo — o `select` é concedido por coluna e essa
 * coluna fica de fora. Quem lê é o servidor, com `service_role`.
 */
export type IntegrationConnection = {
  provedor: string;
  /** Login ou nome da conta do outro lado, para a pessoa reconhecer qual é. */
  conta: string;
  estado: EstadoConexao;
  /** Os escopos que o fornecedor concedeu de fato — nem sempre os pedidos. */
  escopos: readonly string[];
  expiraEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

// =============================================================================================
// 4. IntegrationPermission — o que a pessoa autorizou, uma a uma
// =============================================================================================

/**
 * A concessão de **uma** capacidade, numa conexão.
 *
 * Uma linha por capacidade, e não um vetor numa coluna, por três razões práticas: dá para saber
 * **quando** cada uma foi concedida, dá para revogar uma sem reescrever as outras, e a trilha de
 * auditoria referencia a linha em vez de um índice dentro de um array.
 *
 * `concedidaPor` é sempre a pessoa. Não existe caminho no Hub em que o sistema conceda sozinho —
 * é a regra central deste módulo, e está imposta no banco: a linha só nasce por `insert` do dono.
 */
export type IntegrationPermission = {
  id: string;
  provedor: string;
  capacidade: Capacidade;
  /** `null` = vale para todos os projetos. Preenchido = vale só para aquele. */
  projetoId: string | null;
  concedidaEm: string;
  /** Preenchido quando revogada. A linha não é apagada: revogar é fato, e fato se guarda. */
  revogadaEm: string | null;
  /**
   * Validade opcional. Serve para "autorizar só por hoje", que é o padrão certo para
   * `EXECUTE_COMMAND` e para qualquer coisa destrutiva.
   */
  expiraEm: string | null;
};

// =============================================================================================
// 5. IntegrationEvent — o que chega de fora
// =============================================================================================

export const ORIGENS_EVENTO = ["webhook", "polling", "bridge", "manual"] as const;
export type OrigemEvento = (typeof ORIGENS_EVENTO)[number];

/**
 * Um fato que aconteceu do lado de lá e que o Pathly registrou.
 *
 * Evento é **dado**, nunca instrução. Um webhook do GitHub dizendo "rode os testes" não roda
 * nada: ele vira um evento, e no máximo produz uma ação `pendente` que a pessoa aprova. Sem essa
 * regra, qualquer um que descubra a URL do webhook comanda o Pathly.
 */
export type IntegrationEvent = {
  id: string;
  provedor: string;
  origem: OrigemEvento;
  /** O nome do evento no vocabulário do provedor (`push`, `pull_request`, `file_changed`). */
  tipo: string;
  projetoId: string | null;
  /** O corpo recebido, já normalizado pelo adaptador. Nunca contém credencial. */
  dados: Record<string, unknown>;
  recebidoEm: string;
  /** `true` quando o Hub já reagiu a ele. Evento não processado não some. */
  processado: boolean;
};

// =============================================================================================
// 6. IntegrationAuditLog — o que foi feito, e por quem
// =============================================================================================

export const ATOS = [
  "conexao-criada",
  "conexao-revogada",
  "permissao-concedida",
  "permissao-revogada",
  "acao-criada",
  "acao-aprovada",
  "acao-recusada",
  "acao-executada",
  "acao-falhou",
  "evento-recebido",
  "acesso-negado",
] as const;
export type Ato = (typeof ATOS)[number];

/**
 * A trilha. Append-only, e sem exceção.
 *
 * `acesso-negado` é o registro mais valioso da lista, e o mais fácil de esquecer: é ele que
 * mostra uma integração tentando repetidamente algo que ninguém autorizou. Uma trilha que só
 * guarda sucesso não serve para desconfiar de nada.
 */
export type IntegrationAuditLog = {
  id: string;
  provedor: string;
  ato: Ato;
  capacidade: Capacidade | null;
  acaoId: string | null;
  projetoId: string | null;
  /** Uma frase em português do que aconteceu. Nunca contém token nem cabeçalho. */
  detalhe: string;
  em: string;
};
