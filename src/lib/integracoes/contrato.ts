/**
 * Integrações externas: conexões da pessoa e ações que o Pathly quer executar por ela.
 *
 * ## A regra que o módulo inteiro existe para sustentar
 *
 * Nenhuma ação sai para fora sem uma aprovação **registrada antes**. Não é uma checagem na tela,
 * é uma linha no banco: o executor recusa qualquer ação que não esteja `aprovada`, e a transição
 * para `executada` é condicional, então uma aprovação vale uma execução só.
 *
 * ## Por que a ação guarda o que vai enviar
 *
 * `payload` é o corpo exato da chamada, gravado no momento em que a pessoa aprova. Sem isso, o
 * que ela aprovou seria um resumo em texto e o que sairia seria montado depois — dois objetos
 * diferentes, e a aprovação passaria a valer para algo que ela não viu.
 */

export const PROVEDORES = ["demo", "github"] as const;
export type Provedor = (typeof PROVEDORES)[number];

export const ROTULO_PROVEDOR: Record<Provedor, string> = {
  demo: "Provedor de demonstração",
  github: "GitHub",
};

/**
 * Uma conexão da pessoa com um provedor.
 *
 * Note o que **não** está aqui: o token. Este tipo é o que o navegador recebe, e o token nunca
 * chega nele — nem cifrado. A coluna existe no banco e só o `service_role` a lê.
 */
export type Conexao = {
  provedor: Provedor;
  escopos: string[];
  /** `null` quando o provedor não expira token. */
  expiraEm: string | null;
  criadoEm: string;
  /** Nome ou login da conta conectada, para a pessoa reconhecer qual é. */
  conta: string;
};

// ---------------------------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------------------------

/**
 * Os estados de uma ação externa.
 *
 * O desenho é o mesmo já validado nas decisões do Copilot: nada é apagado, o que muda é o estado.
 * Uma ação recusada continua visível — saber o que o Pathly quis fazer e foi barrado é tão útil
 * quanto saber o que ele fez.
 */
export const ESTADOS_ACAO = ["pendente", "aprovada", "executada", "recusada", "falhou"] as const;
export type EstadoAcao = (typeof ESTADOS_ACAO)[number];

export const ROTULO_ESTADO_ACAO: Record<EstadoAcao, string> = {
  pendente: "Esperando sua aprovação",
  aprovada: "Aprovada, aguardando execução",
  executada: "Executada",
  recusada: "Recusada por você",
  falhou: "Falhou na execução",
};

/**
 * O risco de uma ação, que decide como ela aparece na tela.
 *
 * `leitura` não muda nada do outro lado. `escrita` cria ou altera. `destrutiva` apaga ou é
 * irreversível — e mesmo essa passa pelo mesmo portão, só com mais peso visual.
 */
export const IMPACTOS = ["leitura", "escrita", "destrutiva"] as const;
export type Impacto = (typeof IMPACTOS)[number];

export const ROTULO_IMPACTO: Record<Impacto, string> = {
  leitura: "Só leitura",
  escrita: "Escreve",
  destrutiva: "Destrutiva",
};

export type AcaoExterna = {
  id: string;
  provedor: Provedor;
  /** `null` para ação que não pertence a um projeto. */
  projetoId: string | null;
  /** Uma frase, em português, do que vai acontecer. É o que a pessoa lê antes de aprovar. */
  resumo: string;
  /** Para onde vai, legível: `GET /user/repos`. Sem isso, "aprovar" é aprovar às cegas. */
  destino: string;
  impacto: Impacto;
  /** O corpo exato que será enviado. Gravado antes da aprovação, nunca remontado depois. */
  payload: Record<string, unknown>;
  estado: EstadoAcao;
  criadoEm: string;
  decididoEm: string | null;
  executadoEm: string | null;
  /** O que voltou, resumido. Nunca contém token nem cabeçalho de autorização. */
  resultado: string | null;
  erro: string | null;
};

/**
 * As transições permitidas.
 *
 * Escritas como dado, e não espalhadas em `if`, porque é a regra de segurança do módulo: se
 * alguém acrescentar um caminho de `pendente` direto para `executada`, tem que ser aqui, à vista.
 */
export const TRANSICOES: Record<EstadoAcao, readonly EstadoAcao[]> = {
  pendente: ["aprovada", "recusada"],
  aprovada: ["executada", "falhou", "recusada"],
  executada: [],
  recusada: [],
  falhou: [],
};

export function podeIr(de: EstadoAcao, para: EstadoAcao): boolean {
  return TRANSICOES[de].includes(para);
}

/**
 * Se a ação pode ser executada agora.
 *
 * Uma função, e não uma comparação solta no executor, para existir um lugar só a ser lido em
 * qualquer auditoria futura de "o que permite uma chamada externa sair daqui".
 */
export function liberadaParaExecutar(acao: Pick<AcaoExterna, "estado">): boolean {
  return acao.estado === "aprovada";
}

/** O que voltou do banco é `Json`: só passa adiante o que tem a forma de uma ação. */
export function validarAcao(valor: unknown): AcaoExterna | null {
  if (!valor || typeof valor !== "object") return null;
  const a = valor as Partial<AcaoExterna>;

  if (typeof a.id !== "string" || !a.id) return null;
  if (!PROVEDORES.includes(a.provedor as Provedor)) return null;
  if (!ESTADOS_ACAO.includes(a.estado as EstadoAcao)) return null;
  if (typeof a.resumo !== "string" || !a.resumo) return null;
  if (typeof a.destino !== "string" || !a.destino) return null;

  return {
    id: a.id,
    provedor: a.provedor as Provedor,
    projetoId: typeof a.projetoId === "string" ? a.projetoId : null,
    resumo: a.resumo,
    destino: a.destino,
    impacto: IMPACTOS.includes(a.impacto as Impacto) ? (a.impacto as Impacto) : "escrita",
    payload:
      a.payload && typeof a.payload === "object" && !Array.isArray(a.payload) ? a.payload : {},
    estado: a.estado as EstadoAcao,
    criadoEm: typeof a.criadoEm === "string" ? a.criadoEm : new Date().toISOString(),
    decididoEm: typeof a.decididoEm === "string" ? a.decididoEm : null,
    executadoEm: typeof a.executadoEm === "string" ? a.executadoEm : null,
    resultado: typeof a.resultado === "string" ? a.resultado : null,
    erro: typeof a.erro === "string" ? a.erro : null,
  };
}
