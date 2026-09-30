import type { Blueprint } from "./contrato";
import { podeNaoTerBanco, publicaEmLoja, type Respostas } from "./respostas";

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
  /**
   * Nome e objetivo trocados para certas plataformas.
   *
   * Existe por causa da fase 15. "Deploy" e "Publicação nas lojas" ocupam o mesmo lugar no
   * roadmap e são trabalhos diferentes: um você controla do começo ao fim, o outro termina
   * esperando a revisão de outra empresa, que pode recusar. Chamar os dois de "Deploy" esconde
   * justamente a parte que a pessoa não controla — e que costuma ser a que atrasa.
   */
  variante?: (r: Respostas) => { nome: string; objetivo: string } | null;
};

/** Um projeto tem backend quando o plano técnico definiu um que não seja "nenhum". */
function temBackend(_r: Respostas, bp: Blueprint): boolean {
  const backend = bp.tecnico?.stack.backend?.trim().toLowerCase() ?? "";
  if (!backend) return true; // Sem plano técnico ainda, assume que sim — é o caso comum.
  return !["nenhum", "não", "nao", "n/a", "sem backend", "-"].includes(backend);
}

/**
 * Um site guarda dados?
 *
 * Só ele levanta a dúvida: as outras plataformas guardam alguma coisa por definição. Um
 * institucional ou um portfólio muitas vezes é conteúdo estático, e nesse caso as fases de Banco,
 * Backend e APIs são trabalho que não existe. A pergunta se resolve pelo que a pessoa respondeu —
 * se há contas, uploads ou pagamentos, há dados.
 */
function siteGuardaDados(r: Respostas): boolean {
  return r.temAutenticacao || r.temUploads || r.temPagamentos || r.temIntegracoes;
}

function temDados(r: Respostas, bp: Blueprint): boolean {
  if (podeNaoTerBanco(r.plataforma) && !siteGuardaDados(r)) return false;
  return temBackend(r, bp);
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
    aplicaSe: temDados,
  },
  {
    numero: 6,
    nome: "Backend",
    objetivo: "Construir a lógica que faz o sistema funcionar.",
    aplicaSe: temDados,
  },
  {
    numero: 7,
    nome: "APIs",
    objetivo: "Expor o que o frontend precisa consumir, e nada além disso.",
    aplicaSe: temDados,
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
    /* Sem tela, não há fase de tela. Uma CLI ou uma API entregam pela saída, não pela interface. */
    aplicaSe: (r) => r.plataforma !== "cli",
    variante: (r) =>
      r.plataforma === "site"
        ? {
            nome: "Páginas e conteúdo",
            objetivo: "Construir as páginas e escrever o que vai nelas.",
          }
        : r.plataforma === "celular"
          ? {
              nome: "Telas do app",
              objetivo: "Construir as telas e a navegação, no tamanho de mão.",
            }
          : null,
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
    variante: (r) =>
      publicaEmLoja(r.plataforma)
        ? {
            nome: "Publicação nas lojas",
            objetivo:
              "Empacotar, assinar e submeter — e passar pela revisão de quem controla a loja.",
          }
        : r.plataforma === "desktop"
          ? {
              nome: "Empacotamento e distribuição",
              objetivo:
                "Gerar o instalador de cada sistema e assinar, para não assustar quem baixa.",
            }
          : null,
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

/**
 * As fases que ESTE projeto tem, na ordem canônica, já com o nome que vale para a plataforma.
 *
 * A variante é aplicada aqui, e não na tela, para que exista **uma** resposta à pergunta "como
 * se chama a fase 15 neste projeto?". Se cada tela resolvesse por conta, o roadmap diria
 * "Publicação nas lojas" e o brief da sessão diria "Deploy" — sobre a mesma etapa.
 */
export function fasesDoProjeto(r: Respostas, bp: Blueprint): Fase[] {
  return FASES.filter((f) => !f.aplicaSe || f.aplicaSe(r, bp)).map((f) => {
    const v = f.variante?.(r);
    return v ? { ...f, nome: v.nome, objetivo: v.objetivo } : f;
  });
}

/**
 * As fases que ficaram de fora, com o motivo.
 *
 * Mostradas na tela de propósito. Uma fase ausente em silêncio parece esquecimento; dizer
 * "Pagamentos não entra porque você respondeu que o projeto não cobra" transforma a ausência em
 * decisão — e deixa claro onde mexer se ela estiver errada.
 */
export function fasesForaComMotivo(r: Respostas, bp: Blueprint): { fase: Fase; porque: string }[] {
  /*
   * O motivo de uma fase de dados depende de qual das duas portas a fechou: um site sem contas,
   * uploads nem pagamentos não guarda nada — e isso é diferente de "o plano técnico escolheu não
   * ter backend". A frase errada manda a pessoa mexer no lugar errado para trazer a fase de volta.
   */
  const semDados = podeNaoTerBanco(r.plataforma) && !siteGuardaDados(r);
  const porFaltaDeDados = semDados
    ? "seu site é conteúdo: sem contas, uploads ou pagamentos, não há dado para guardar"
    : "seu plano não tem backend próprio";

  const motivos: Record<number, string> = {
    5: porFaltaDeDados,
    6: porFaltaDeDados,
    7: semDados ? porFaltaDeDados : "sem backend próprio, não há API para construir",
    8: "você respondeu que o sistema não tem contas de usuário",
    9: "uma ferramenta de linha de comando ou API não tem tela para construir",
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
