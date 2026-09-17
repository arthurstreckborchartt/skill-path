/**
 * O conteúdo de uma etapa do roadmap — o que a pessoa lê quando abre um passo.
 *
 * ## Por que sob demanda, e não junto com o roadmap
 *
 * São doze campos por etapa, e um roadmap tem de 10 a 30 etapas. Gerar tudo de uma vez seria um
 * JSON de dezenas de milhares de tokens: nenhum modelo entrega isso numa chamada, e mesmo que
 * entregasse, a maior parte seria conteúdo que a pessoa nunca abriria. É o mesmo raciocínio que
 * já governa as aulas em `/api/licao`, e pela mesma razão: quem paga o custo é quem usa.
 *
 * ## O que "modo manual" significa aqui
 *
 * O produto não pode depender de IA para ser útil. Toda etapa traz `prompt` (para quem vai pedir
 * a uma IA) **e** `modoManual` (para quem vai digitar), e os dois precisam ser suficientes
 * sozinhos. Um `modoManual` que diz "peça para a IA gerar" é uma falha de conteúdo, não um atalho.
 */

export type Tarefa = {
  /** Uma ação concreta, começando com verbo. */
  texto: string;
  /** Por que esta tarefa existe. Sem isso vira lista de afazeres sem sentido. */
  porque: string;
};

export type ItemChecklist = {
  /** Algo verificável por quem fez. Não "entendi o conceito" — "o comando X devolve Y". */
  texto: string;
};

export type DecisaoTecnica = {
  /** A escolha que precisa ser feita nesta etapa. */
  decisao: string;
  /** A recomendação, com o porquê. Não devolva opções sem escolher uma. */
  recomendacao: string;
  /** Quando a recomendação NÃO vale. Honestidade sobre o limite da escolha. */
  quandoNaoVale: string;
};

export type Recurso = {
  titulo: string;
  /** documentação, artigo, vídeo, ferramenta */
  tipo: string;
  /** Por que vale o tempo de abrir. */
  porque: string;
};

export type ConteudoEtapa = {
  /** O que existe no mundo quando esta etapa termina. Uma frase. */
  objetivo: string;
  /** 2 a 4 parágrafos que ensinam o que é e por que existe. */
  explicacao: string[];
  tarefas: Tarefa[];
  /** O que a pessoa precisa saber antes de começar — e onde aprender se não souber. */
  conhecimentoNecessario: string[];
  recursos: Recurso[];
  checklist: ItemChecklist[];
  /** Como saber que acabou, sem depender de opinião. */
  criteriosDeConclusao: string[];
  /** O que costuma dar errado aqui, especificamente. */
  riscos: string[];
  decisoesTecnicas: DecisaoTecnica[];
  /** Prompt pronto para colar no Claude, ChatGPT, Cursor ou Lovable. */
  prompt: string;
  /** O caminho sem IA nenhuma. Precisa bastar sozinho. */
  modoManual: string[];
  /** Como provar que funcionou: comando, teste, o que observar na tela. */
  validacao: string;
};

export const SCHEMA_ETAPA = {
  type: "object" as const,
  properties: {
    objetivo: {
      type: "string",
      description:
        "O que passa a existir quando esta etapa termina. Concreto e verificável. Nunca 'entender X'.",
    },
    explicacao: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description:
        "Parágrafos que ensinam o que é isto e por que existe, para quem nunca fez. Escreva sobre o projeto da pessoa, citando os nomes reais das tabelas e funcionalidades dela.",
    },
    tarefas: {
      type: "array",
      minItems: 2,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          texto: { type: "string", description: "Ação concreta, começando com verbo." },
          porque: { type: "string", description: "Por que esta tarefa existe nesta etapa." },
        },
        required: ["texto", "porque"],
        additionalProperties: false,
      },
    },
    conhecimentoNecessario: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" },
      description:
        "O que a pessoa precisa saber ANTES de começar. Se ela não souber, diga em uma linha onde aprender.",
    },
    recursos: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Nome real do recurso. Nunca invente URL." },
          tipo: { type: "string", description: "documentação, artigo, vídeo ou ferramenta." },
          porque: { type: "string" },
        },
        required: ["titulo", "tipo", "porque"],
        additionalProperties: false,
      },
    },
    checklist: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          texto: {
            type: "string",
            description:
              "Algo que a pessoa marca depois de fazer, verificável por ela mesma. 'A tabela pedidos existe e tem as 6 colunas' vale; 'entendi modelagem' não vale.",
          },
        },
        required: ["texto"],
        additionalProperties: false,
      },
    },
    criteriosDeConclusao: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
      description: "Como saber que a etapa acabou, sem depender de opinião.",
    },
    riscos: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
      description: "O que costuma dar errado NESTA etapa especificamente, e como perceber cedo.",
    },
    decisoesTecnicas: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          decisao: { type: "string", description: "A escolha que precisa ser feita aqui." },
          recomendacao: {
            type: "string",
            description: "Escolha uma e justifique. Não devolva opções para a pessoa decidir.",
          },
          quandoNaoVale: {
            type: "string",
            description: "Em que situação esta recomendação seria a errada.",
          },
        },
        required: ["decisao", "recomendacao", "quandoNaoVale"],
        additionalProperties: false,
      },
    },
    prompt: {
      type: "string",
      description:
        "Prompt pronto para colar numa IA de código. Precisa carregar o contexto do projeto (stack, tabelas, o que já existe), dizer exatamente o que produzir e o que NÃO mudar. Escreva o prompt inteiro, não um resumo dele.",
    },
    modoManual: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" },
      description:
        "O passo a passo para fazer À MÃO, sem IA nenhuma. Precisa bastar sozinho: nunca escreva 'peça para a IA'. Cite arquivo, comando e o que digitar.",
    },
    validacao: {
      type: "string",
      description:
        "Como provar que funcionou: o comando a rodar, o que deve aparecer na tela, o que conferir no banco.",
    },
  },
  required: [
    "objetivo",
    "explicacao",
    "tarefas",
    "conhecimentoNecessario",
    "recursos",
    "checklist",
    "criteriosDeConclusao",
    "riscos",
    "decisoesTecnicas",
    "prompt",
    "modoManual",
    "validacao",
  ],
  additionalProperties: false,
};

/** Formato em texto, para os provedores que não aceitam schema estruturado. */
export const FORMATO_ETAPA = `Responda SOMENTE com JSON:
{"objetivo":"","explicacao":["",""],"tarefas":[{"texto":"","porque":""}],"conhecimentoNecessario":[""],"recursos":[{"titulo":"","tipo":"","porque":""}],"checklist":[{"texto":""}],"criteriosDeConclusao":["",""],"riscos":[""],"decisoesTecnicas":[{"decisao":"","recomendacao":"","quandoNaoVale":""}],"prompt":"","modoManual":["","",""],"validacao":""}

O campo "prompt" e o campo "modoManual" precisam funcionar de forma independente: um para quem
vai pedir a uma IA, outro para quem vai digitar tudo à mão. Nunca escreva "peça para a IA" dentro
de "modoManual".`;

function textos(v: unknown, minimo: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const limpo = v.filter((x): x is string => typeof x === "string" && x.trim().length > 2);
  return limpo.length >= minimo ? limpo.map((x) => x.trim()) : null;
}

/**
 * Schema não garante conteúdo utilizável.
 *
 * A checagem mais importante é a do `modoManual`: um passo a passo manual que manda pedir à IA
 * derruba a promessa de o produto funcionar sem IA, e passa pelo schema sem problema nenhum.
 */
export function validarEtapa(valor: unknown): ConteudoEtapa | null {
  if (!valor || typeof valor !== "object") return null;
  const e = valor as Partial<ConteudoEtapa>;

  const objetivo = typeof e.objetivo === "string" ? e.objetivo.trim() : "";
  if (objetivo.length < 15) return null;

  const explicacao = textos(e.explicacao, 2);
  const conhecimentoNecessario = textos(e.conhecimentoNecessario, 1);
  const criteriosDeConclusao = textos(e.criteriosDeConclusao, 2);
  const riscos = textos(e.riscos, 1);
  const modoManual = textos(e.modoManual, 3);
  if (!explicacao || !conhecimentoNecessario || !criteriosDeConclusao || !riscos || !modoManual) {
    return null;
  }

  // O modo manual não pode delegar para a IA — é justamente a alternativa a ela.
  const delega = modoManual.some((p) => {
    const t = p.toLowerCase();
    return (
      t.includes("peça para a ia") ||
      t.includes("peca para a ia") ||
      t.includes("use o prompt acima")
    );
  });
  if (delega) return null;

  const tarefas = (Array.isArray(e.tarefas) ? e.tarefas : []).filter(
    (t): t is Tarefa =>
      Boolean(t) &&
      typeof t.texto === "string" &&
      t.texto.trim().length > 5 &&
      typeof t.porque === "string" &&
      t.porque.trim().length > 5,
  );
  if (tarefas.length < 2) return null;

  const checklist = (Array.isArray(e.checklist) ? e.checklist : []).filter(
    (c): c is ItemChecklist =>
      Boolean(c) && typeof c.texto === "string" && c.texto.trim().length > 5,
  );
  if (checklist.length < 2) return null;

  const prompt = typeof e.prompt === "string" ? e.prompt.trim() : "";
  // Prompt curto demais é um resumo do prompt, não o prompt. Inútil para colar.
  if (prompt.length < 80) return null;

  const validacao = typeof e.validacao === "string" ? e.validacao.trim() : "";
  if (validacao.length < 15) return null;

  return {
    objetivo,
    explicacao,
    tarefas,
    conhecimentoNecessario,
    recursos: (Array.isArray(e.recursos) ? e.recursos : []).filter(
      (r): r is Recurso => Boolean(r) && typeof r.titulo === "string" && r.titulo.trim().length > 2,
    ),
    checklist,
    criteriosDeConclusao,
    riscos,
    decisoesTecnicas: (Array.isArray(e.decisoesTecnicas) ? e.decisoesTecnicas : []).filter(
      (d): d is DecisaoTecnica =>
        Boolean(d) &&
        typeof d.decisao === "string" &&
        d.decisao.trim().length > 5 &&
        typeof d.recomendacao === "string" &&
        d.recomendacao.trim().length > 5,
    ),
    prompt,
    modoManual,
    validacao,
  };
}
