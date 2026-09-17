import type { Blueprint } from "./contrato";
import type { Respostas } from "./respostas";

/**
 * As 18 fases canônicas do roadmap — e a regra que decide quais existem em cada projeto.
 *
 * ## Por que as fases são fixas e a IA não as inventa
 *
 * Antes daqui, o bloco de execução pedia à IA que criasse as fases junto com as etapas. O
 * resultado era plausível e instável: o mesmo projeto gerado duas vezes vinha com "Fundação
 * Técnica" numa e "Setup Inicial" na outra, com recortes diferentes. Isso torna impossível
 * responder "onde estou?" de forma comparável, e a pessoa perde a única referência que ela tem
 * de progresso quando regera um bloco.
 *
 * Com a lista fixa, a IA faz o que ela faz bem — escrever as etapas dentro de cada fase, para
 * ESTE projeto — e o esqueleto fica estável.
 *
 * ## Por que nem toda fase aparece
 *
 * "Não crie complexidade desnecessária" só vale se o roadmap também obedecer. Uma fase de
 * Pagamentos num projeto que não cobra nada não é neutra: ela ocupa espaço na tela, sugere
 * trabalho que não existe e faz a pessoa achar que está atrasada. A regra de cada fase é uma
 * função das respostas e do plano — a mesma fonte que já governa o conteúdo em `regras.ts`.
 */

export type Fase = {
  /** 1 a 18, na ordem canônica. Estável entre projetos: a Fase 09 é sempre Frontend. */
  numero: number;
  nome: string;
  /** O que a pessoa conquista aqui, em uma frase. Aparece na tela. */
  objetivo: string;
  /**
   * Quando esta fase faz parte do projeto. `undefined` = sempre.
   *
   * Recebe o blueprint junto com as respostas porque algumas decisões só existem depois do bloco
   * técnico: se há backend, por exemplo, quem sabe é a stack, não o questionário.
   */
  aplicaSe?: (r: Respostas, bp: Blueprint) => boolean;
};

/** Um projeto tem backend quando o plano técnico definiu um que não seja "nenhum". */
function temBackend(_r: Respostas, bp: Blueprint): boolean {
  const backend = bp.tecnico?.stack.backend?.trim().toLowerCase() ?? "";
  if (!backend) return true; // Sem plano técnico ainda, assume que sim — é o caso comum.
  return !["nenhum", "não", "nao", "n/a", "sem backend", "-"].includes(backend);
}

export const FASES: Fase[] = [
  {
    numero: 1,
    nome: "Descoberta do problema",
    objetivo: "Ter certeza de que a dor que você quer resolver existe e é dessa pessoa.",
  },
  {
    numero: 2,
    nome: "Validação",
    objetivo: "Confirmar com gente de verdade antes de escrever uma linha de código.",
  },
  {
    numero: 3,
    nome: "Definição do MVP",
    objetivo: "Fechar o menor conjunto que resolve o problema de ponta a ponta.",
  },
  {
    numero: 4,
    nome: "Arquitetura",
    objetivo: "Decidir como as peças se encaixam, antes de existir qualquer peça.",
  },
  {
    numero: 5,
    nome: "Banco de dados",
    objetivo: "Modelar os dados. Nenhuma tela vem antes daqui.",
  },
  {
    numero: 6,
    nome: "Backend",
    objetivo: "Construir a lógica que faz o sistema funcionar.",
    aplicaSe: temBackend,
  },
  {
    numero: 7,
    nome: "APIs",
    objetivo: "Expor o que o frontend precisa consumir, e nada além disso.",
    aplicaSe: temBackend,
  },
  {
    numero: 8,
    nome: "Autenticação e autorização",
    objetivo: "Garantir que cada pessoa veja e faça só o que pode.",
    aplicaSe: (r) => r.temAutenticacao,
  },
  {
    numero: 9,
    nome: "Frontend",
    objetivo: "Construir as telas por onde a pessoa realmente usa o produto.",
  },
  {
    numero: 10,
    nome: "Integrações",
    objetivo: "Conectar com os sistemas de fora sem ficar refém deles.",
    aplicaSe: (r) => r.temIntegracoes,
  },
  {
    numero: 11,
    nome: "IA",
    objetivo: "Colocar o modelo onde ele agrega, com custo e falha sob controle.",
    aplicaSe: (r) => r.temIa,
  },
  {
    numero: 12,
    nome: "Pagamentos",
    objetivo: "Receber dinheiro de forma que você confie no que está na conta.",
    aplicaSe: (r) => r.temPagamentos,
  },
  {
    numero: 13,
    nome: "Testes",
    objetivo: "Cobrir o que dói quando quebra — não tudo.",
  },
  {
    numero: 14,
    nome: "Segurança",
    objetivo: "Fechar o que um estranho conseguiria fazer com o seu sistema.",
  },
  {
    numero: 15,
    nome: "Deploy",
    objetivo: "Tirar da sua máquina e colocar no ar, de forma repetível.",
  },
  {
    numero: 16,
    nome: "Monitoramento",
    objetivo: "Descobrir que quebrou antes do seu usuário te contar.",
  },
  {
    numero: 17,
    nome: "Lançamento",
    objetivo: "Colocar na frente das primeiras pessoas de verdade.",
  },
  {
    numero: 18,
    nome: "Evolução",
    objetivo: "Decidir o que construir em seguida com base em uso, não em palpite.",
  },
];

/** As fases que ESTE projeto tem, na ordem canônica. */
export function fasesDoProjeto(r: Respostas, bp: Blueprint): Fase[] {
  return FASES.filter((f) => !f.aplicaSe || f.aplicaSe(r, bp));
}

/**
 * As fases que ficaram de fora, com o motivo.
 *
 * Mostradas na tela de propósito. Uma fase ausente em silêncio parece esquecimento; dizer
 * "Pagamentos não entra porque você respondeu que o projeto não cobra" transforma a ausência em
 * decisão — e deixa claro onde mexer se ela estiver errada.
 */
export function fasesForaComMotivo(r: Respostas, bp: Blueprint): { fase: Fase; porque: string }[] {
  const motivos: Record<number, string> = {
    6: "seu plano não tem backend próprio",
    7: "sem backend próprio, não há API para construir",
    8: "você respondeu que o sistema não tem contas de usuário",
    10: "você respondeu que não há integrações externas",
    11: "você respondeu que o produto não usa IA",
    12: "você respondeu que o sistema não cobra dinheiro",
  };

  return FASES.filter((f) => f.aplicaSe && !f.aplicaSe(r, bp)).map((fase) => ({
    fase,
    porque: motivos[fase.numero] ?? "este projeto não precisa dela",
  }));
}

/** O nome exato das fases ativas, para o prompt do bloco de execução. */
export function nomesDasFases(r: Respostas, bp: Blueprint): string[] {
  return fasesDoProjeto(r, bp).map((f) => `${f.numero}. ${f.nome}`);
}

/** Encontra a fase pelo nome que a IA escreveu, tolerando o número na frente e variação de caixa. */
export function acharFase(nome: string, ativas: Fase[]): Fase | null {
  const limpo = nome
    .trim()
    .toLowerCase()
    .replace(/^\d+\s*[.)-]?\s*/, "");
  return (
    ativas.find((f) => f.nome.toLowerCase() === limpo) ??
    ativas.find((f) => limpo.includes(f.nome.toLowerCase())) ??
    null
  );
}
