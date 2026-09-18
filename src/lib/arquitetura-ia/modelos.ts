import type { FuncionalidadeIa, Nivel } from "./contrato";

/**
 * O catálogo de modelos.
 *
 * ## Por que os preços vivem em código
 *
 * Preço por token não está no peso de nenhum modelo, e pedir custo para um LLM é onde ele inventa
 * número com mais confiança. Um custo mensal errado por uma ordem de grandeza leva a pessoa a
 * decidir errado sobre o próprio produto — a desistir de algo viável ou a lançar algo que vai
 * quebrar a conta no primeiro mês.
 *
 * O preço daqui é determinístico e auditável. A IA escolhe ENTRE estes modelos; ela não inventa
 * nome nem valor. Quando o modelo sugerido não existe no catálogo, `escolherModelo` cai no padrão
 * do nível em vez de aceitar a invenção.
 *
 * ## O que fazer quando isto envelhecer
 *
 * `ATUALIZADO_EM` aparece na tela junto do custo. Preço de IA cai rápido, e uma estimativa sem
 * data é uma estimativa que a pessoa não sabe se pode usar. Ao atualizar, mexa na data também.
 */

export const ATUALIZADO_EM = "2026-06-24";

export type Familia = "claude" | "outro";

export type Modelo = {
  id: string;
  nome: string;
  familia: Familia;
  /** Dólares por milhão de tokens de entrada. `null` = confira no provedor. */
  entradaPorMilhao: number | null;
  /** Dólares por milhão de tokens de saída. `null` = confira no provedor. */
  saidaPorMilhao: number | null;
  /** Janela de contexto, em tokens. */
  contexto: number;
  /** Para que serve, em uma linha — o critério de escolha, não a ficha técnica. */
  quandoUsar: string;
  /** Latência típica percebida, para a tela avisar sobre streaming. */
  velocidade: "rapida" | "media" | "lenta";
};

/**
 * Os modelos da Anthropic entram com preço exato porque é o que dá para conferir sem sair daqui.
 *
 * Os outros provedores entram por nome e sem número: escrever um preço que eu não consigo
 * verificar seria pior que não escrever nenhum, porque a pessoa acreditaria nele. A tela manda
 * conferir, e a arquitetura — qual degrau, RAG ou não — não depende do preço do concorrente.
 */
export const MODELOS: Modelo[] = [
  {
    id: "claude-haiku-4-5",
    nome: "Claude Haiku 4.5",
    familia: "claude",
    entradaPorMilhao: 1,
    saidaPorMilhao: 5,
    contexto: 200_000,
    quandoUsar:
      "Classificar, extrair campo, etiquetar, responder pergunta curta. É o padrão para volume alto.",
    velocidade: "rapida",
  },
  {
    id: "claude-sonnet-5",
    nome: "Claude Sonnet 5",
    familia: "claude",
    entradaPorMilhao: 2,
    saidaPorMilhao: 10,
    contexto: 1_000_000,
    quandoUsar:
      "Escrever, resumir bem, responder sobre documento. O meio-termo de quase todo produto.",
    velocidade: "media",
  },
  {
    id: "claude-opus-5",
    nome: "Claude Opus 5",
    familia: "claude",
    entradaPorMilhao: 5,
    saidaPorMilhao: 25,
    contexto: 1_000_000,
    quandoUsar:
      "Raciocínio difícil, código, decisão encadeada. Só quando o resultado do degrau abaixo não serviu.",
    velocidade: "lenta",
  },
  {
    id: "outro-rapido",
    nome: "Modelo rápido de outro provedor",
    familia: "outro",
    entradaPorMilhao: null,
    saidaPorMilhao: null,
    contexto: 128_000,
    quandoUsar:
      "Equivalente ao Haiku na OpenAI ou no Google. Confira o preço na página do provedor antes de orçar.",
    velocidade: "rapida",
  },
  {
    id: "outro-capaz",
    nome: "Modelo capaz de outro provedor",
    familia: "outro",
    entradaPorMilhao: null,
    saidaPorMilhao: null,
    contexto: 128_000,
    quandoUsar:
      "Equivalente ao Sonnet ou ao Opus fora da Anthropic. Confira o preço na página do provedor.",
    velocidade: "media",
  },
];

/** O modelo padrão de cada degrau, quando a IA não sugeriu um que exista. */
const PADRAO_POR_NIVEL: Record<Nivel, string | null> = {
  "sem-ia": null,
  "api-pronta": null,
  // Uma chamada só, geralmente classificar ou escrever pouco: o barato dá conta.
  "llm-simples": "claude-haiku-4-5",
  // RAG manda trecho de documento junto: precisa de janela e de leitura melhor.
  rag: "claude-sonnet-5",
  "tool-calling": "claude-sonnet-5",
  // Agente encadeia decisões, e erro no passo 2 contamina o 5. É onde capacidade paga.
  agente: "claude-opus-5",
};

export function acharModelo(id: string | null): Modelo | null {
  return id ? (MODELOS.find((m) => m.id === id) ?? null) : null;
}

/**
 * O modelo de uma funcionalidade: o sugerido, se existir no catálogo; senão o padrão do nível.
 *
 * Nunca a invenção. Um modelo que não existe vira uma instrução de implementação que falha na
 * primeira chamada, e a pessoa não tem como saber que o erro nasceu aqui.
 */
export function escolherModelo(f: FuncionalidadeIa): Modelo | null {
  return acharModelo(f.modeloSugerido) ?? acharModelo(PADRAO_POR_NIVEL[f.nivel]);
}

export type Custo = {
  /** Dólares por mês. `null` quando o modelo não tem preço conferido aqui. */
  porMes: number | null;
  /** Dólares por chamada, para a pessoa comparar com o que ela cobra. */
  porChamada: number | null;
  /** O que foi assumido para chegar nesse número. Sem isto o valor vira um oráculo. */
  premissas: string[];
};

/**
 * O custo de uma funcionalidade por mês.
 *
 * RAG paga duas vezes na entrada: os trechos recuperados entram no contexto de toda pergunta.
 * Agente paga várias — cada passo reenvia o histórico inteiro. O multiplicador está aqui porque
 * é a diferença entre a conta que a pessoa imagina e a que ela recebe.
 */
const PASSOS_POR_NIVEL: Record<Nivel, number> = {
  "sem-ia": 0,
  "api-pronta": 0,
  "llm-simples": 1,
  rag: 1,
  "tool-calling": 2,
  agente: 4,
};

export function calcularCusto(f: FuncionalidadeIa, m: Modelo | null): Custo {
  const passos = PASSOS_POR_NIVEL[f.nivel];

  if (!m || passos === 0) {
    return {
      porMes: null,
      porChamada: null,
      premissas:
        f.nivel === "api-pronta"
          ? ["Serviço pronto cobra por uso, não por token. Confira a tabela do provedor escolhido."]
          : ["Não usa modelo de linguagem — não há custo de token."],
    };
  }

  if (m.entradaPorMilhao === null || m.saidaPorMilhao === null) {
    return {
      porMes: null,
      porChamada: null,
      premissas: [`Preço de ${m.nome} não está neste catálogo. Confira na página do provedor.`],
    };
  }

  const entrada = (f.tokensEntrada * passos * m.entradaPorMilhao) / 1_000_000;
  const saida = (f.tokensSaida * passos * m.saidaPorMilhao) / 1_000_000;
  const porChamada = entrada + saida;

  const premissas = [
    `${f.chamadasPorMes.toLocaleString("pt-BR")} chamadas por mês, ${f.tokensEntrada.toLocaleString("pt-BR")} tokens de entrada e ${f.tokensSaida.toLocaleString("pt-BR")} de saída em cada.`,
    `Preço de ${m.nome} em ${ATUALIZADO_EM}: US$ ${m.entradaPorMilhao} por milhão de tokens de entrada, US$ ${m.saidaPorMilhao} de saída.`,
  ];

  if (passos > 1) {
    premissas.push(
      `${ROTULO_PASSOS[f.nivel]} — por isso a conta multiplica por ${passos}: cada passo reenvia o que já foi dito.`,
    );
  }

  premissas.push(
    "Sem cache de prompt. Se o mesmo contexto se repete entre chamadas, o cache derruba a entrada em até 90%.",
  );

  return { porMes: porChamada * f.chamadasPorMes, porChamada, premissas };
}

const ROTULO_PASSOS: Record<Nivel, string> = {
  "sem-ia": "",
  "api-pronta": "",
  "llm-simples": "",
  rag: "",
  "tool-calling": "Uma chamada para decidir a ferramenta e outra para responder",
  agente: "Um agente costuma dar quatro voltas antes de terminar",
};

/** O custo em dólares, escrito para caber numa tela sem virar notação científica. */
export function formatarDolar(v: number | null): string {
  if (v === null) return "—";
  if (v === 0) return "US$ 0";
  if (v < 0.01) return `US$ ${v.toFixed(4)}`;
  if (v < 1) return `US$ ${v.toFixed(2)}`;
  if (v < 1000) return `US$ ${v.toFixed(2)}`;
  return `US$ ${Math.round(v).toLocaleString("pt-BR")}`;
}

export type Latencia = {
  /** A faixa esperada, em texto. Faixa e não número: depende do tamanho da resposta. */
  faixa: string;
  /** Precisa de streaming? */
  streaming: boolean;
  /** Por que essa recomendação. */
  porque: string;
};

/**
 * A latência esperada, e a única pergunta que importa sobre ela: alguém está esperando?
 *
 * Resposta que demora 8 segundos com a tela parada é percebida como travamento; a mesma resposta
 * aparecendo palavra por palavra é percebida como funcionando. A diferença é streaming, e ela
 * custa uma linha de código — quando decidida antes, e uma reescrita quando decidida depois.
 */
export function calcularLatencia(f: FuncionalidadeIa, m: Modelo | null): Latencia {
  if (!m || f.nivel === "sem-ia") {
    return {
      faixa: "imediato",
      streaming: false,
      porque: "Não passa por modelo de linguagem: responde na velocidade da sua consulta.",
    };
  }

  if (f.nivel === "api-pronta") {
    return {
      faixa: "de 1 a 10 segundos",
      streaming: false,
      porque:
        "Serviço pronto devolve o resultado inteiro de uma vez. Se demora, mostre progresso em vez de esperar.",
    };
  }

  const base =
    m.velocidade === "rapida"
      ? "de 1 a 4 segundos"
      : m.velocidade === "media"
        ? "de 3 a 10 segundos"
        : "de 5 a 25 segundos";

  const faixa =
    f.nivel === "agente"
      ? "de 20 segundos a vários minutos"
      : f.nivel === "tool-calling"
        ? `${base}, vezes o número de ferramentas chamadas`
        : f.nivel === "rag"
          ? `${base}, mais a busca nos documentos`
          : base;

  if (!f.sincrona) {
    return {
      faixa,
      streaming: false,
      porque:
        "Ninguém está esperando na tela: rode em segundo plano e avise quando terminar. Isso também deixa você usar a API em lote, que custa metade.",
    };
  }

  if (f.nivel === "agente") {
    return {
      faixa,
      streaming: true,
      porque:
        "Um agente que trabalha calado por dois minutos é indistinguível de um travado. Mostre cada passo enquanto acontece.",
    };
  }

  return {
    faixa,
    streaming: f.tokensSaida > 200,
    porque:
      f.tokensSaida > 200
        ? "A resposta é longa e alguém está esperando: sem streaming, a tela fica parada até a última palavra."
        : "A resposta é curta o bastante para aparecer de uma vez — streaming aqui só adiciona complexidade.",
  };
}
