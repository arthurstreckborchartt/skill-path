import type { Capacidade } from "../capacidades";

/**
 * A ponte local — o agente que roda na máquina de quem usa.
 *
 * ## O problema que ela resolve
 *
 * Há três tarefas neste repositório em que eu disse a mesma frase: *a nuvem não alcança
 * `localhost`*. Cursor, Codex, Claude Code, o plugin do Obsidian — todos rodam na máquina da
 * pessoa, e nenhum servidor do Pathly consegue falar com eles.
 *
 * A ponte inverte a direção. Ela roda **na máquina** e **conecta para fora**: é a ponte que
 * procura o Pathly, não o contrário. Não abre porta, não precisa de IP fixo, atravessa NAT e
 * firewall corporativo, e a pessoa fecha o programa quando quiser.
 *
 * ## Por que polling, e não WebSocket
 *
 * WebSocket seria mais elegante e daria latência menor. Ele exige um servidor que mantenha
 * conexão aberta — e este app roda em Cloudflare Workers, onde isso significa Durable Objects,
 * que não estão configurados aqui. Montar essa infraestrutura para ganhar dois segundos de
 * latência numa tarefa que leva minutos seria a escolha errada.
 *
 * Então a ponte pergunta a cada poucos segundos se há tarefa. É simples, é depurável com `curl`,
 * e funciona em qualquer rede. O custo está declarado: a tarefa espera, no pior caso, um
 * intervalo inteiro.
 *
 * ## A regra que nada pode violar
 *
 * **A ponte nunca executa comando recebido do servidor.**
 *
 * O servidor manda um `acaoId` e parâmetros. A ponte procura esse id no catálogo **dela** —
 * compilado dentro dela, não recebido — e se não achar, recusa. Nenhuma mensagem do servidor
 * consegue introduzir uma ação nova, porque a lista não vem do servidor.
 *
 * É a diferença entre "execute isto" e "faça aquela coisa que você já sabe fazer". A primeira é
 * um shell remoto com outro nome; a segunda é o que este protocolo é.
 */

// =============================================================================================
// A ponte
// =============================================================================================

export const ESTADOS_PONTE = ["online", "ocioso", "offline", "revogada"] as const;
export type EstadoPonte = (typeof ESTADOS_PONTE)[number];

export const ROTULO_ESTADO: Record<EstadoPonte, string> = {
  online: "Online",
  ocioso: "Sem responder",
  offline: "Offline",
  revogada: "Revogada",
};

/**
 * Quanto tempo sem batida até a ponte deixar de ser considerada online.
 *
 * Três intervalos de folga, e não um: uma rede ruim perde uma batida sem a ponte ter caído, e
 * marcar offline na primeira falha produziria um indicador que pisca e que ninguém acredita.
 */
export const INTERVALO_BATIDA_S = 10;
export const TOLERANCIA_ONLINE_S = INTERVALO_BATIDA_S * 3;
export const TOLERANCIA_OCIOSO_S = INTERVALO_BATIDA_S * 18;

export function estadoPorBatida(
  ultimaBatida: string | null,
  revogadaEm: string | null,
  agora = new Date(),
): EstadoPonte {
  if (revogadaEm) return "revogada";
  if (!ultimaBatida) return "offline";

  const segundos = (agora.getTime() - new Date(ultimaBatida).getTime()) / 1000;
  if (segundos <= TOLERANCIA_ONLINE_S) return "online";
  if (segundos <= TOLERANCIA_OCIOSO_S) return "ocioso";
  return "offline";
}

export type Ponte = {
  /** O id único da ponte. Vem do servidor no pareamento, e a ponte guarda no disco dela. */
  id: string;
  /** O nome que a pessoa deu: "Notebook do escritório", "PC do Revit". */
  nome: string;
  /** Windows, macOS, Linux — informado pela ponte, e é dado, não prova. */
  plataforma: string;
  versao: string;
  /** As capacidades autorizadas a esta ponte. Nenhuma vem por padrão. */
  capacidades: Capacidade[];
  /** Os adaptadores que a ponte declarou ter: `revit`, `vscode`. */
  adaptadores: string[];
  ultimaBatida: string | null;
  criadaEm: string;
  revogadaEm: string | null;
};

// =============================================================================================
// O pareamento
// =============================================================================================

/**
 * O código de pareamento.
 *
 * Curto, de vida curta e de uso único. A pessoa gera na tela do Pathly e digita na ponte; a ponte
 * troca o código por um token e o código morre.
 *
 * Seis caracteres de um alfabeto sem `0/O` e sem `1/I/L`: ele vai ser lido de uma tela e digitado
 * noutra, e confundir zero com ó é o erro mais comum que existe nesse gesto.
 */
export const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const TAMANHO_CODIGO = 6;
export const VALIDADE_CODIGO_MIN = 10;

export function codigoValido(c: string): boolean {
  const limpo = c.trim().toUpperCase();
  return limpo.length === TAMANHO_CODIGO && [...limpo].every((x) => ALFABETO_CODIGO.includes(x));
}

export function normalizarCodigo(c: string): string {
  return c.trim().toUpperCase().replace(/\s+/g, "");
}

// =============================================================================================
// O envelope
// =============================================================================================

/**
 * O que o servidor manda para a ponte.
 *
 * Note o que **não** existe aqui: nenhum campo de comando, script, caminho de executável ou
 * argumento livre. Só um id de ação e parâmetros nomeados, que a ponte valida contra o schema
 * dela. Um envelope não consegue descrever "rode isto" — não há onde escrever.
 */
export type Tarefa = {
  tarefaId: string;
  acaoId: string;
  parametros: Record<string, unknown>;
  /**
   * `simulacao` pede um plano sem efeito; `execucao` age.
   *
   * Uma ação que altera algo **precisa** de uma simulação aprovada antes — ver `planoId`.
   */
  modo: "simulacao" | "execucao";
  /**
   * O plano que autoriza esta execução. Obrigatório quando a ação altera algo.
   *
   * Carrega a impressão digital do que a simulação previu. A ponte recalcula antes de agir: se o
   * modelo mudou desde a simulação, o que a pessoa aprovou não é mais o que aconteceria, e a
   * execução para.
   */
  planoId?: string;
  impressaoDoPlano?: string;
  criadaEm: string;
  expiraEm: string;
};

export const RESULTADOS = ["ok", "plano", "recusado", "erro"] as const;
export type TipoDeResultado = (typeof RESULTADOS)[number];

/** Os motivos de recusa da ponte. Fechados: a ponte não inventa texto de erro para o servidor. */
export const RECUSAS_DA_PONTE = [
  "ACAO_DESCONHECIDA",
  "PARAMETRO_INVALIDO",
  "SEM_PERMISSAO",
  "ADAPTADOR_AUSENTE",
  "PLANO_AUSENTE",
  "PLANO_DIVERGENTE",
  "TAREFA_VENCIDA",
] as const;

export type RecusaDaPonte = (typeof RECUSAS_DA_PONTE)[number];

export const MOTIVO_RECUSA: Record<RecusaDaPonte, string> = {
  ACAO_DESCONHECIDA:
    "Esta ponte não conhece essa ação. O catálogo dela é compilado junto com ela — o servidor " +
    "não consegue acrescentar ações.",
  PARAMETRO_INVALIDO: "Os parâmetros não batem com o que a ação aceita.",
  SEM_PERMISSAO: "Esta ponte não recebeu a permissão que a ação exige.",
  ADAPTADOR_AUSENTE:
    "O adaptador dessa ferramenta não está instalado nesta ponte, ou o programa não está aberto.",
  PLANO_AUSENTE: "Esta ação altera algo e precisa de uma simulação aprovada antes.",
  PLANO_DIVERGENTE:
    "O que está aberto agora não é mais o que a simulação previu. Simule de novo e confira o que " +
    "mudou antes de autorizar.",
  TAREFA_VENCIDA: "Esta tarefa passou da validade. Peça de novo.",
};

/** O que a ponte devolve. */
export type Resultado =
  | { tarefaId: string; tipo: "ok"; dados: unknown; arquivos: ArquivoGerado[] }
  | { tarefaId: string; tipo: "plano"; plano: Plano }
  | { tarefaId: string; tipo: "recusado"; recusa: RecusaDaPonte; detalhe: string }
  | { tarefaId: string; tipo: "erro"; mensagem: string };

/** Um arquivo que a ponte gerou. Caminho e tamanho — nunca o conteúdo. */
export type ArquivoGerado = {
  caminho: string;
  bytes: number;
  formato: string;
};

// =============================================================================================
// A simulação
// =============================================================================================

/**
 * O plano de uma simulação — o que aconteceria, sem ter acontecido.
 *
 * ## Por que ela é obrigatória, e não um botão a mais
 *
 * Porque "criar 14 elementos" e "criar 1400 elementos" chegam ao servidor como a mesma frase, e a
 * diferença só aparece quando alguém conta. A simulação conta antes.
 *
 * E ela não é um número solto: `mudancas` lista item a item, com o valor atual ao lado do novo
 * quando é alteração. Aprovar "14 elementos" sem ver quais é aprovar um número.
 */
export type Mudanca = {
  /** `criar` | `atualizar` | `exportar`. O que aconteceria com este item. */
  operacao: string;
  /** O que é, em texto que a pessoa reconheça: "Parede básica 200mm — Nível 2". */
  alvo: string;
  /** Preenchido em alteração: o que está lá hoje. */
  de?: string;
  /** Preenchido em alteração: o que passaria a estar. */
  para?: string;
};

export type Plano = {
  planoId: string;
  acaoId: string;
  /** A frase que a tela mostra: "Serão criados 14 elementos no modelo." */
  resumo: string;
  mudancas: Mudanca[];
  /**
   * Quantas mudanças o plano tem ao todo.
   *
   * Separado de `mudancas.length` de propósito: um plano de 3 mil itens não cabe numa resposta
   * nem numa tela, então `mudancas` traz uma amostra e este número traz a verdade.
   */
  total: number;
  /**
   * A impressão digital do estado que a ponte leu para montar o plano.
   *
   * É o que liga a simulação à execução. Na hora de agir, a ponte recalcula: diferente significa
   * que o modelo mudou no meio, e o que a pessoa aprovou deixou de existir.
   */
  impressao: string;
  criadoEm: string;
  expiraEm: string;
};

/** Uma simulação vence — o que ela previu envelhece junto com o modelo. */
export const VALIDADE_PLANO_MIN = 15;

export function planoVencido(p: { expiraEm: string }, agora = new Date()): boolean {
  return new Date(p.expiraEm) <= agora;
}

/** A frase do resumo, montada de um jeito só para não variar entre adaptadores. */
export function resumirPlano(operacao: string, total: number, onde: string): string {
  if (total === 0) return `Nada seria alterado ${onde}.`;
  const verbo = { criar: "criados", atualizar: "alterados", exportar: "exportados" }[operacao];
  const plural = total === 1 ? "" : "s";
  return `${total === 1 ? "Será" : "Serão"} ${verbo ?? operacao} ${total} elemento${plural} ${onde}.`;
}

// =============================================================================================
// As saídas da simulação, na tela
// =============================================================================================

export const SAIDAS_DA_SIMULACAO = ["cancelar", "visualizar", "autorizar"] as const;
export type SaidaDaSimulacao = (typeof SAIDAS_DA_SIMULACAO)[number];

export const ROTULO_SAIDA: Record<SaidaDaSimulacao, string> = {
  cancelar: "Cancelar",
  visualizar: "Visualizar alterações",
  autorizar: "Autorizar",
};

export const CONSEQUENCIA_SAIDA: Record<SaidaDaSimulacao, string> = {
  cancelar: "A tarefa é descartada e nada acontece no seu modelo.",
  visualizar: "Mostra item a item o que mudaria. Nada é escrito enquanto você olha.",
  autorizar:
    "A ponte executa exatamente este plano. Se o modelo tiver mudado desde a simulação, ela " +
    "para e avisa em vez de aplicar.",
};
