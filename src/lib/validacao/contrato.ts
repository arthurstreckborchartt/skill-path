/**
 * O Validation Engine: verificar se a pessoa construiu certo, não só ensinar a construir.
 *
 * ## A pergunta que decide o desenho
 *
 * O que conta como prova de que algo foi feito?
 *
 * O Pathly não lê o código de ninguém. Ele tem três fontes, e elas valem coisas diferentes —
 * misturá-las numa porcentagem única seria dar a mesma confiança a "o app conferiu" e a "a pessoa
 * marcou uma caixinha". É a mesma distinção que já vale para SQL neste projeto: gerado não é
 * executado, e executado não é validado.
 *
 * ## Por que não existe "marcar como concluído"
 *
 * Um checklist onde tudo é clicável vira uma lista que a pessoa percorre marcando. O que ela
 * aprende é a marcar. Aqui, o que o app consegue verificar **não é clicável** — passa ou falha
 * pela evidência. Só o que depende de olhar o código dela aceita confirmação, e mesmo isso fica
 * registrado como confirmação, nunca como verificação.
 */

export const DOMINIOS = [
  "arquitetura",
  "banco",
  "api",
  "autenticacao",
  "seguranca",
  "frontend",
  "ux",
  "ia",
  "pagamentos",
  "testes",
  "deploy",
] as const;

export type Dominio = (typeof DOMINIOS)[number];

export const ROTULO_DOMINIO: Record<Dominio, string> = {
  arquitetura: "Arquitetura",
  banco: "Banco de dados",
  api: "API",
  autenticacao: "Autenticação",
  seguranca: "Segurança",
  frontend: "Frontend",
  ux: "Experiência de uso",
  ia: "Inteligência artificial",
  pagamentos: "Pagamentos",
  testes: "Testes",
  deploy: "Deploy",
};

/** Os três estados de uma verificação. */
export const ESTADOS = ["passou", "atencao", "bloqueio"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ROTULO_ESTADO: Record<Estado, string> = {
  passou: "Passou",
  atencao: "Atenção",
  bloqueio: "Bloqueio",
};

/**
 * De onde veio a conclusão. É isto que separa evidência de palavra.
 *
 * - `automatica`: o app derivou dos artefatos do plano. Determinístico e repetível.
 * - `sonda`: o app perguntou ao banco real e obteve resposta. A evidência mais forte que existe aqui.
 * - `confirmacao`: a pessoa disse que fez. Vale, e vale menos — ela pode ter entendido errado.
 * - `pendente`: ninguém verificou nem confirmou ainda.
 */
export const FONTES = ["automatica", "sonda", "confirmacao", "pendente"] as const;
export type Fonte = (typeof FONTES)[number];

/**
 * Uma verificação do catálogo.
 *
 * `verificar` é o que separa este módulo de um checklist de papel. Quando ela existe, o resultado
 * é derivado do plano da pessoa e ela não tem o que clicar. Quando não existe, é porque a resposta
 * está no código — e aí só a confirmação dela resolve.
 */
export type Verificacao = {
  id: string;
  dominio: Dominio;
  /** O que precisa ser verdade. Uma afirmação conferível, não um tema. */
  titulo: string;
  /** Por que isto importa. Para quem nunca pensou no assunto. */
  porque: string;
  /** Como a pessoa confere, concretamente. Obrigatório mesmo quando o app verifica sozinho. */
  comoValidar: string;
  /**
   * Quando esta verificação se aplica. `undefined` = sempre.
   *
   * Verificação que não se aplica sai da lista com o motivo, em vez de aparecer como pendente
   * eterno — lista cheia de item irrelevante ensina a ignorar a lista.
   */
  aplicaSe?: (c: ContextoValidacao) => boolean;
  /**
   * A verificação automática. `undefined` quando a resposta só existe no código da pessoa.
   *
   * Devolve o estado e a evidência que o sustenta. Evidência vazia num `passou` é sinal de
   * verificação mal escrita: se não dá para dizer POR QUE passou, não passou — foi assumido.
   */
  verificar?: (c: ContextoValidacao) => { estado: Estado; evidencia: string };
  /**
   * De onde a verificação tira a conclusão. Só faz sentido junto de `verificar`.
   *
   * O padrão é `automatica` — derivado do plano. `sonda` é para o que pergunta ao banco real, e
   * pesa igual no progresso mas vale mais na leitura: é a única evidência que não depende do que
   * a pessoa escreveu no plano. Fica declarado aqui, e não deduzido do `id`, porque o motor não
   * deve conhecer nomes de verificações específicas.
   */
  fonte?: Extract<Fonte, "automatica" | "sonda">;
  /**
   * `true` quando falhar impede concluir a etapa.
   *
   * Reservado para o que quebra o produto ou vaza dado. Marcar tudo como bloqueio é o mesmo que
   * não marcar nada: a pessoa aprende a contornar em vez de corrigir.
   */
  bloqueiaEtapa?: boolean;
};

import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { PlanoIa } from "@/lib/arquitetura-ia/contrato";
import type { Respostas } from "@/lib/blueprint/respostas";
import type { EstadoTabelaPlanejada } from "@/lib/copilot/estado-banco";

export type ContextoValidacao = {
  respostas: Respostas;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  planoIa: PlanoIa | null;
  /** O resultado da sonda ao banco real. Vazio quando ninguém sondou ainda. */
  tabelasNoBanco: EstadoTabelaPlanejada[];
};

/** O resultado de uma verificação, depois de rodar o catálogo contra o projeto. */
export type Resultado = {
  verificacao: Verificacao;
  estado: Estado;
  fonte: Fonte;
  /** O que sustenta o estado. Vazio só quando `fonte` é `pendente`. */
  evidencia: string;
  /** `true` quando a pessoa pode confirmar à mão — ou seja, quando o app não consegue verificar. */
  aceitaConfirmacao: boolean;
};

/** O que a pessoa confirmou à mão, por id de verificação. */
export type Confirmacoes = Record<string, { em: string }>;

// ---------------------------------------------------------------------------------------------
// Progresso
// ---------------------------------------------------------------------------------------------

/**
 * Os pesos do progresso.
 *
 * Confirmação vale menos que verificação de propósito. Um projeto 100% confirmado à mão e 0%
 * verificado não está pronto — está declarado pronto, que é outra coisa. Sem a diferença de peso,
 * a barra de progresso vira o número que a pessoa quiser que ela seja.
 */
export const PESO_FONTE: Record<Fonte, number> = {
  sonda: 1,
  automatica: 1,
  confirmacao: 0.6,
  pendente: 0,
};

export type ProgressoDominio = {
  dominio: Dominio;
  /** Quantas verificações se aplicam a este projeto. */
  aplicaveis: number;
  passou: number;
  atencao: number;
  bloqueio: number;
  /** Quantas passaram por verificação do app, e não por confirmação da pessoa. */
  verificadas: number;
  confirmadas: number;
  /** 0 a 100, com confirmação valendo menos que verificação. */
  percentual: number;
};
