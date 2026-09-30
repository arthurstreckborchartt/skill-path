/**
 * O questionário do Project Planner — o que a pessoa responde antes do plano existir.
 *
 * Separado do blueprint de propósito. `conteudo` é o que a IA escreveu e pode ser regerado
 * inteiro; isto é o que a **pessoa** disse, e regerar o plano nunca pode apagar. São dados de
 * naturezas diferentes, com ciclos de vida diferentes.
 */

/**
 * O que a pessoa está construindo, em dois eixos.
 *
 * ## Por que dois e não um
 *
 * A lista antiga tinha um campo só — SaaS, Aplicativo, Marketplace, Sistema interno, Plataforma,
 * Outro — e ela misturava duas perguntas que não se respondem juntas. "Marketplace" não diz se é
 * web ou celular; "Aplicativo" não diz se é pago. O roadmap precisa das duas respostas e estava
 * adivinhando as duas.
 *
 * Pior: o campo era **decorativo**. `tipo` era colado no prompt da IA e não governava fase
 * nenhuma. Um projeto de app de celular recebia a fase "Deploy" genérica, sem uma palavra sobre
 * loja, revisão ou assinatura de build.
 *
 * Agora `plataforma` decide as fases técnicas e `natureza` decide o que o plano precisa ter.
 */

export const PLATAFORMAS = ["site", "webapp", "celular", "desktop", "extensao", "cli"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const ROTULO_PLATAFORMA: Record<Plataforma, string> = {
  site: "Site",
  webapp: "Aplicação web",
  celular: "App de celular",
  desktop: "App de computador",
  extensao: "Extensão de navegador",
  cli: "Ferramenta de linha de comando ou API",
};

/** Uma linha por plataforma, para a pessoa escolher sem adivinhar o que cada palavra abarca. */
export const EXEMPLO_PLATAFORMA: Record<Plataforma, string> = {
  site: "Institucional, landing page, portfólio, blog — conteúdo que as pessoas leem.",
  webapp: "Roda no navegador e as pessoas entram e usam. SaaS, painel, sistema.",
  celular: "iOS, Android, ou os dois. Publicado nas lojas.",
  desktop: "Windows, macOS ou Linux, instalado na máquina.",
  extensao: "Chrome, Firefox ou Edge, dentro do navegador de quem usa.",
  cli: "Sem tela: um comando no terminal, ou uma API que outros programas consomem.",
};

export const NATUREZAS = ["pago", "marketplace", "interno", "pessoal", "gratuito"] as const;
export type Natureza = (typeof NATUREZAS)[number];

export const ROTULO_NATUREZA: Record<Natureza, string> = {
  pago: "Produto pago",
  marketplace: "Marketplace",
  interno: "Uso interno",
  pessoal: "Pessoal ou portfólio",
  gratuito: "Gratuito e aberto",
};

export const EXEMPLO_NATUREZA: Record<Natureza, string> = {
  pago: "Alguém paga para usar — assinatura, licença, cobrança por uso.",
  marketplace: "Conecta dois lados e fica com uma parte da transação.",
  interno: "Para você, sua equipe ou sua empresa. Ninguém de fora usa.",
  pessoal: "Seu, para mostrar trabalho ou resolver algo que só você tem.",
  gratuito: "Qualquer um usa sem pagar, e não há plano de cobrar.",
};

/** Naturezas em que o plano precisa dizer como entra dinheiro. Nas outras, cobrar seria inventar. */
export function cobra(n: Natureza): boolean {
  return n === "pago" || n === "marketplace";
}

/**
 * Plataformas que entregam pela loja de um terceiro.
 *
 * Muda a fase de publicação inteira: em vez de "colocar no ar", é empacotar, assinar, submeter e
 * **esperar revisão de outra empresa** — que pode recusar. Chamar isso de "Deploy" esconde a
 * única parte que a pessoa não controla.
 */
export function publicaEmLoja(p: Plataforma): boolean {
  return p === "celular" || p === "extensao";
}

/** Plataformas que normalmente não guardam dados próprios. Só `site` — e mesmo assim, às vezes. */
export function podeNaoTerBanco(p: Plataforma): boolean {
  return p === "site";
}

// ---------------------------------------------------------------------------------------------
// A ponte com os projetos que já existem
// ---------------------------------------------------------------------------------------------

/**
 * Traduz o `tipo` antigo para os dois eixos novos.
 *
 * Projetos criados antes desta mudança têm `tipo: "saas"` gravado no banco e nenhum dos campos
 * novos. Sem esta tabela eles cairiam no padrão e um marketplace viraria "site pessoal" — o plano
 * mudaria de forma debaixo de quem já estava construindo.
 *
 * A tradução é conservadora: quando o tipo antigo não dizia a plataforma, assume `webapp`, que era
 * o que o produto de fato gerava.
 */
const DO_TIPO_ANTIGO: Record<string, { plataforma: Plataforma; natureza: Natureza }> = {
  saas: { plataforma: "webapp", natureza: "pago" },
  aplicativo: { plataforma: "celular", natureza: "pago" },
  marketplace: { plataforma: "webapp", natureza: "marketplace" },
  interno: { plataforma: "webapp", natureza: "interno" },
  plataforma: { plataforma: "webapp", natureza: "pago" },
  outro: { plataforma: "webapp", natureza: "pessoal" },
};

export type NivelTecnico = "iniciante" | "intermediario" | "avancado";

export const ROTULO_NIVEL: Record<NivelTecnico, string> = {
  iniciante: "Estou começando",
  intermediario: "Já construí algumas coisas",
  avancado: "Programo há bastante tempo",
};

/** Como a pessoa pretende construir. Os dois podem estar marcados — é o caso mais comum. */
export type ModoDeConstruir = "ia" | "manual";

export type Respostas = {
  /** O que quer criar, nas palavras dela. É a mesma frase que dá nome provisório ao projeto. */
  oQue: string;
  paraQuem: string;
  problema: string;
  comoGanhaDinheiro: string;
  /** Onde o produto roda. Governa as fases técnicas do roadmap. */
  plataforma: Plataforma;
  /** De que ele vive. Governa o que o plano precisa ter — e o que seria invenção. */
  natureza: Natureza;

  temIa: boolean;
  temPagamentos: boolean;
  temAutenticacao: boolean;
  temDadosSensiveis: boolean;
  temIntegracoes: boolean;
  /** Quais, quando `temIntegracoes`. Texto livre: a pessoa costuma saber os nomes. */
  integracoesQuais: string;
  temUploads: boolean;
  /** `varios` liga RBAC. Um único tipo de usuário não precisa de papéis. */
  tiposDeUsuario: "um" | "varios";

  nivelTecnico: NivelTecnico;
  comoConstroi: ModoDeConstruir[];
  /** Vazio quando ela não sabe ainda — e aí a IA escolhe. */
  stackPreferida: string;
};

/**
 * Valores iniciais.
 *
 * Todos os "tem" começam em `false` porque o produto existe justamente para **não** criar
 * complexidade que ninguém pediu. Um padrão ligado viraria arquitetura que a pessoa não escolheu.
 */
export const RESPOSTAS_VAZIAS: Respostas = {
  oQue: "",
  paraQuem: "",
  problema: "",
  comoGanhaDinheiro: "",
  /*
   * `webapp` + `pago` é o padrão porque continua sendo o caso mais comum, e porque um padrão
   * qualquer teria que ser escolhido. Mas os dois campos aparecem no questionário com as opções
   * à vista — ninguém precisa descobrir que existe um padrão para trocá-lo.
   */
  plataforma: "webapp",
  natureza: "pago",
  temIa: false,
  temPagamentos: false,
  temAutenticacao: false,
  temDadosSensiveis: false,
  temIntegracoes: false,
  integracoesQuais: "",
  temUploads: false,
  tiposDeUsuario: "um",
  nivelTecnico: "iniciante",
  comoConstroi: ["ia"],
  stackPreferida: "",
};

/** Tetos por campo. O questionário inteiro precisa caber no limite de corpo do endpoint. */
export const TETOS_RESPOSTA = {
  oQue: 400,
  paraQuem: 300,
  problema: 500,
  comoGanhaDinheiro: 300,
  integracoesQuais: 300,
  stackPreferida: 200,
} as const;

/**
 * Normaliza o que vem do cliente ou do banco.
 *
 * Roda dos dois lados: no servidor porque o corpo da requisição é do usuário, e na leitura porque
 * um projeto criado antes desta coluna existir tem `respostas = {}` e as telas não podem quebrar
 * por causa disso.
 */
export function lerRespostas(valor: unknown): Respostas {
  const v = (valor ?? {}) as Partial<Respostas> & { tipo?: string };

  const texto = (x: unknown, teto: number): string =>
    typeof x === "string" ? x.trim().slice(0, teto) : "";

  const modos = Array.isArray(v.comoConstroi)
    ? v.comoConstroi.filter((m): m is ModoDeConstruir => m === "ia" || m === "manual")
    : [];

  /*
   * A ordem importa: o campo novo ganha do antigo, e o antigo ganha do padrão.
   *
   * Assim um projeto que já foi reaberto e salvo com os eixos novos não volta a ser derivado do
   * `tipo` que ficou na linha — o `tipo` continua gravado no banco e continuaria vencendo se a
   * ordem fosse outra.
   */
  const antigo = typeof v.tipo === "string" ? DO_TIPO_ANTIGO[v.tipo] : undefined;
  const plataforma = PLATAFORMAS.includes(v.plataforma as Plataforma)
    ? (v.plataforma as Plataforma)
    : (antigo?.plataforma ?? "webapp");
  const natureza = NATUREZAS.includes(v.natureza as Natureza)
    ? (v.natureza as Natureza)
    : (antigo?.natureza ?? "pago");

  return {
    oQue: texto(v.oQue, TETOS_RESPOSTA.oQue),
    paraQuem: texto(v.paraQuem, TETOS_RESPOSTA.paraQuem),
    problema: texto(v.problema, TETOS_RESPOSTA.problema),
    comoGanhaDinheiro: texto(v.comoGanhaDinheiro, TETOS_RESPOSTA.comoGanhaDinheiro),
    plataforma,
    natureza,
    temIa: v.temIa === true,
    temPagamentos: v.temPagamentos === true,
    temAutenticacao: v.temAutenticacao === true,
    temDadosSensiveis: v.temDadosSensiveis === true,
    temIntegracoes: v.temIntegracoes === true,
    integracoesQuais: texto(v.integracoesQuais, TETOS_RESPOSTA.integracoesQuais),
    temUploads: v.temUploads === true,
    tiposDeUsuario: v.tiposDeUsuario === "varios" ? "varios" : "um",
    nivelTecnico:
      v.nivelTecnico === "intermediario" || v.nivelTecnico === "avancado"
        ? v.nivelTecnico
        : "iniciante",
    // Nunca vazio: sem isto o plano não sabe se escreve para quem vai pedir à IA ou digitar.
    comoConstroi: modos.length > 0 ? modos : ["ia"],
    stackPreferida: texto(v.stackPreferida, TETOS_RESPOSTA.stackPreferida),
  };
}

/**
 * O questionário está completo o bastante para gerar um plano?
 *
 * `problema` deixou de ser exigido de todo mundo. Um portfólio não resolve dor de ninguém, e um
 * projeto gratuito de fim de semana também não — obrigar essas pessoas a inventar uma dor produz
 * um plano construído sobre uma frase falsa. Onde alguém paga, a dor volta a ser obrigatória:
 * quem cobra sem saber o que resolve não tem produto, tem esperança.
 */
export function respostasSuficientes(r: Respostas): boolean {
  const base = r.oQue.length >= 15 && r.paraQuem.length >= 5;
  return exigeProblema(r.natureza) ? base && r.problema.length >= 15 : base;
}

export function exigeProblema(n: Natureza): boolean {
  return n === "pago" || n === "marketplace" || n === "interno";
}
