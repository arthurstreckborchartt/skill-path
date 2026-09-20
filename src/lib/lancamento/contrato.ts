import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { PlanoIa } from "@/lib/arquitetura-ia/contrato";
import type { Respostas } from "@/lib/blueprint/respostas";
import type { EstadoTabelaPlanejada } from "@/lib/copilot/estado-banco";

/**
 * Production Launch: sair do localhost sem quebrar nada.
 *
 * ## O que este módulo é, e o que ele recusa ser
 *
 * É a distância entre "roda na minha máquina" e "roda para outras pessoas, e continua rodando
 * amanhã". Essa distância não é uma lista de tarefas: é um conjunto de decisões que a pessoa vai
 * tomar uma vez e conviver com elas por anos — onde mora o banco, quem tem a chave, o que
 * acontece quando dá errado às três da manhã.
 *
 * Ele recusa ser um checklist de papel. A regra é a mesma do [[Validation Engine]]: **o que o app
 * consegue derivar do plano não é clicável.** Só o que vive no código ou na conta de terceiros
 * aceita confirmação, e confirmação pesa menos que verificação. Um checklist todo clicável ensina
 * a clicar.
 *
 * ## Por que os três ambientes são a espinha, e não um rótulo
 *
 * Quase todo desastre de lançamento cabe em uma frase: **alguém achou que estava num ambiente e
 * estava em outro.** A migration rodada na produção, o teste que apagou dados reais, a chave de
 * desenvolvimento publicada, o webhook de teste apontando para o banco de verdade.
 *
 * Por isso ambiente não é uma etiqueta neste módulo — é um eixo. Cada passo declara em quais
 * ambientes vale, e o que **muda** entre eles. Um passo que se comporta igual nos três é raro, e
 * quando é, isso também está dito.
 */

// ---------------------------------------------------------------------------------------------
// Ambientes
// ---------------------------------------------------------------------------------------------

export const AMBIENTES = ["desenvolvimento", "staging", "producao"] as const;
export type Ambiente = (typeof AMBIENTES)[number];

export const ROTULO_AMBIENTE: Record<Ambiente, string> = {
  desenvolvimento: "Desenvolvimento",
  staging: "Staging",
  producao: "Produção",
};

/**
 * O que cada ambiente é para valer — a definição que separa os três quando alguém confunde.
 *
 * A linha que mais importa é a do staging. Staging só serve se for **parecido com produção e
 * separado dela**: mesmas versões, mesma forma de deploy, mesmas variáveis — e banco próprio,
 * dados próprios, chaves próprias. Um staging que compartilha banco com produção não é staging,
 * é produção com outro endereço, e o primeiro teste destrutivo prova isso.
 */
export const DEFINICAO_AMBIENTE: Record<Ambiente, { resumo: string; regra: string }> = {
  desenvolvimento: {
    resumo: "Sua máquina. Dados descartáveis, erros visíveis, tudo pode quebrar.",
    regra:
      "Nada aqui pode alcançar dado de gente de verdade. Se o seu `.env.local` tem uma chave que " +
      "funciona em produção, o ambiente já vazou.",
  },
  staging: {
    resumo: "Um ensaio de produção. Igual em forma, separado em conteúdo.",
    regra:
      "Mesmas versões e mesmo jeito de subir que produção, com banco, dados e chaves próprios. " +
      "Staging que divide banco com produção não é staging — é produção com outro endereço.",
  },
  producao: {
    resumo: "Onde há pessoas e dados reais. O único lugar onde errar custa.",
    regra:
      "Toda mudança chega aqui por um caminho que você consegue desfazer. Se não dá para voltar " +
      "em minutos, ainda não é produção — é aposta.",
  },
};

// ---------------------------------------------------------------------------------------------
// Trilhas (os cinco checklists)
// ---------------------------------------------------------------------------------------------

export const TRILHAS = ["pre-lancamento", "seguranca", "banco", "desempenho", "producao"] as const;
export type Trilha = (typeof TRILHAS)[number];

export const ROTULO_TRILHA: Record<Trilha, string> = {
  "pre-lancamento": "Pré-lançamento",
  seguranca: "Segurança",
  banco: "Banco de dados",
  desempenho: "Desempenho",
  producao: "Produção",
};

export const DESCRICAO_TRILHA: Record<Trilha, string> = {
  "pre-lancamento": "O que precisa existir antes de alguém conseguir abrir o seu app.",
  seguranca: "O que impede que abrir o app seja um problema para você ou para quem abriu.",
  banco: "Onde os dados moram, como mudam de forma, e o que acontece quando somem.",
  desempenho: "Se aguenta, quanto custa, e o que trava primeiro.",
  producao: "O dia seguinte: enxergar o que está acontecendo e desfazer quando der errado.",
};

// ---------------------------------------------------------------------------------------------
// Estados e fontes — o mesmo vocabulário do Validation Engine, de propósito
// ---------------------------------------------------------------------------------------------

export const ESTADOS = ["passou", "atencao", "bloqueio"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ROTULO_ESTADO: Record<Estado, string> = {
  passou: "Pronto",
  atencao: "Atenção",
  bloqueio: "Bloqueio",
};

export const FONTES = ["automatica", "sonda", "confirmacao", "pendente"] as const;
export type Fonte = (typeof FONTES)[number];

/**
 * Confirmação vale menos que verificação, pelo mesmo motivo de sempre: um lançamento 100%
 * confirmado à mão e 0% verificado não está pronto, está declarado pronto.
 */
export const PESO_FONTE: Record<Fonte, number> = {
  sonda: 1,
  automatica: 1,
  confirmacao: 0.6,
  pendente: 0,
};

// ---------------------------------------------------------------------------------------------
// Contexto e passos
// ---------------------------------------------------------------------------------------------

export type ContextoLancamento = {
  nomeProjeto: string;
  respostas: Respostas;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  planoIa: PlanoIa | null;
  /** Resultado da sonda ao banco real. Vazio quando ninguém sondou. */
  tabelasNoBanco: EstadoTabelaPlanejada[];
};

/**
 * Um passo do lançamento.
 *
 * `ensina` é o que separa este módulo de uma lista: a pessoa precisa entender a decisão, não
 * executá-la no escuro. `armadilha` é o erro clássico — quase sempre mais útil que a instrução,
 * porque é o que ela faria sozinha.
 */
export type Passo = {
  id: string;
  trilha: Trilha;
  /** Em quais ambientes este passo existe. A maioria não existe nos três. */
  ambientes: readonly Ambiente[];
  /** Uma afirmação conferível, não um tema. "Tem domínio" é tema; "o domínio resolve" é passo. */
  titulo: string;
  /** Por que isto importa, para quem nunca pensou no assunto. */
  porque: string;
  /** A explicação. É aqui que o módulo ensina, e não só cobra. */
  ensina: string;
  /** O erro que quase todo mundo comete aqui. Opcional, mas é a parte mais útil quando existe. */
  armadilha?: string;
  /** O que muda de um ambiente para outro. Só quando muda mesmo. */
  porAmbiente?: Partial<Record<Ambiente, string>>;
  /** Como a pessoa confere, concretamente. Obrigatório mesmo quando o app verifica sozinho. */
  comoValidar: string;
  /** Quando este passo se aplica. `undefined` = sempre. */
  aplicaSe?: (c: ContextoLancamento) => boolean;
  /** A verificação automática. `undefined` quando a resposta só existe fora do alcance do app. */
  verificar?: (c: ContextoLancamento) => { estado: Estado; evidencia: string };
  fonte?: Extract<Fonte, "automatica" | "sonda">;
  /** `true` quando falhar impede lançar. Reservado para o que perde dado ou vaza segredo. */
  bloqueiaLancamento?: boolean;
  /**
   * A tarefa a mandar para um agente de código, em uma frase imperativa.
   *
   * Vira prompt pelo `prompt-builder`, que já sabe falar com Claude, Cursor, Codex, Lovable e
   * ChatGPT — este módulo não reimplementa isso. O que ele traz é a tarefa certa; o contexto do
   * projeto e as regras de convivência vêm de lá.
   */
  tarefa?: (c: ContextoLancamento) => string;
};

export type Resultado = {
  passo: Passo;
  estado: Estado;
  fonte: Fonte;
  evidencia: string;
  /** `true` quando a pessoa pode confirmar à mão — ou seja, quando o app não consegue verificar. */
  aceitaConfirmacao: boolean;
};

/**
 * As confirmações deste módulo moram na mesma linha do Validation Engine, com prefixo no id.
 *
 * Não é economia: é que a tabela guarda "o que esta pessoa confirmou neste projeto", e lançamento
 * é mais uma coisa que ela confirma. Uma tabela nova exigiria mais um SQL para rodar no Supabase,
 * mais um estado a acompanhar em `ESTADO-SQL.md`, e mais uma chance de ambiente ficar pela metade
 * — tudo isso para guardar um objeto com as mesmas chaves.
 */
export const PREFIXO_CONFIRMACAO = "lancamento:";

export function idConfirmacao(passoId: string): string {
  return `${PREFIXO_CONFIRMACAO}${passoId}`;
}

export type ProgressoTrilha = {
  trilha: Trilha;
  aplicaveis: number;
  passou: number;
  atencao: number;
  bloqueio: number;
  verificados: number;
  confirmados: number;
  /** 0 a 100, com confirmação valendo menos que verificação. */
  percentual: number;
};

export type Relatorio = {
  resultados: Resultado[];
  porTrilha: ProgressoTrilha[];
  /** Passos com `bloqueiaLancamento` que não passaram. Enquanto houver um, não se lança. */
  bloqueios: Resultado[];
  percentualGeral: number;
  /** Quantos passos saíram da lista por não se aplicarem, e por quê. */
  naoAplicaveis: number;
};
