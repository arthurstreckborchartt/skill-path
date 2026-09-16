/**
 * O questionário do Project Planner — o que a pessoa responde antes do plano existir.
 *
 * Separado do blueprint de propósito. `conteudo` é o que a IA escreveu e pode ser regerado
 * inteiro; isto é o que a **pessoa** disse, e regerar o plano nunca pode apagar. São dados de
 * naturezas diferentes, com ciclos de vida diferentes.
 */

export const TIPOS_PROJETO = [
  "saas",
  "aplicativo",
  "marketplace",
  "interno",
  "plataforma",
  "outro",
] as const;
export type TipoProjeto = (typeof TIPOS_PROJETO)[number];

export const ROTULO_TIPO: Record<TipoProjeto, string> = {
  saas: "SaaS",
  aplicativo: "Aplicativo",
  marketplace: "Marketplace",
  interno: "Sistema interno",
  plataforma: "Plataforma",
  outro: "Outro",
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
  tipo: TipoProjeto;

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
  tipo: "saas",
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
  const v = (valor ?? {}) as Partial<Respostas>;

  const texto = (x: unknown, teto: number): string =>
    typeof x === "string" ? x.trim().slice(0, teto) : "";

  const modos = Array.isArray(v.comoConstroi)
    ? v.comoConstroi.filter((m): m is ModoDeConstruir => m === "ia" || m === "manual")
    : [];

  return {
    oQue: texto(v.oQue, TETOS_RESPOSTA.oQue),
    paraQuem: texto(v.paraQuem, TETOS_RESPOSTA.paraQuem),
    problema: texto(v.problema, TETOS_RESPOSTA.problema),
    comoGanhaDinheiro: texto(v.comoGanhaDinheiro, TETOS_RESPOSTA.comoGanhaDinheiro),
    tipo: TIPOS_PROJETO.includes(v.tipo as TipoProjeto) ? (v.tipo as TipoProjeto) : "saas",
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

/** O questionário está completo o bastante para gerar um plano? */
export function respostasSuficientes(r: Respostas): boolean {
  return r.oQue.length >= 15 && r.paraQuem.length >= 5 && r.problema.length >= 15;
}
