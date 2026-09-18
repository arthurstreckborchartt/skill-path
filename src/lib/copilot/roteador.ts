/**
 * O roteador: descobre sobre o que é a pergunta, sem gastar um token.
 *
 * ## Por que não é uma chamada de IA
 *
 * A alternativa óbvia seria pedir a um modelo barato que classifique a pergunta. Isso dobraria a
 * latência e o custo de TODA mensagem para descobrir o que já está escrito na própria pergunta e
 * na tela onde a pessoa está.
 *
 * As duas pistas são gratuitas e fortes: as palavras que ela usou, e onde ela estava quando
 * perguntou. O Copilot abre dentro de uma etapa — se a pessoa está na tela de banco e escreve
 * "não entendi essa parte", "essa parte" é o banco.
 *
 * ## O que acontece quando erra
 *
 * O contexto vem sem a fatia certa e a resposta fica genérica. Por isso a fatia da tela atual
 * entra SEMPRE, mesmo quando o roteador aponta para outro lugar: o custo de carregar uma fatia a
 * mais é pequeno, e o de responder sobre o assunto errado é o produto inteiro.
 */

export const FACETAS = [
  "banco",
  "api",
  "auth",
  "seguranca",
  "ia",
  "roadmap",
  "deploy",
  "erro",
  "stack",
  "produto",
  "geral",
] as const;

export type Faceta = (typeof FACETAS)[number];

export const ROTULO_FACETA: Record<Faceta, string> = {
  banco: "Banco de dados",
  api: "API",
  auth: "Autenticação",
  seguranca: "Segurança",
  ia: "Inteligência artificial",
  roadmap: "Roadmap",
  deploy: "Deploy e infraestrutura",
  erro: "Erro",
  stack: "Stack",
  produto: "Produto",
  geral: "Geral",
};

/**
 * As palavras de cada faceta, sem acento e em minúsculas.
 *
 * Fragmentos, não palavras inteiras: "migrat" pega migration, migrations, migrar e migração; e
 * "autentica" pega autenticação, autenticar e autenticado. Exigir a palavra exata faria o
 * roteador errar por causa de uma conjugação.
 */
const PALAVRAS: Record<Exclude<Faceta, "geral">, string[]> = {
  banco: [
    "banco",
    "tabela",
    "coluna",
    "schema",
    "sql",
    "postgres",
    "mysql",
    "sqlite",
    "supabase",
    "migrat",
    "foreign key",
    "chave estrangeira",
    "indice",
    "índice",
    "relacion",
    "query",
    "consulta",
    "modelo de dados",
    "entidade",
    "normaliz",
  ],
  api: [
    "api",
    "endpoint",
    "rota",
    "rest",
    "http",
    "get ",
    "post ",
    "put ",
    "patch",
    "delete",
    "request",
    "response",
    "payload",
    "contrato",
    "openapi",
    "swagger",
    "cors",
    "webhook",
  ],
  auth: [
    "login",
    "logar",
    "autentica",
    "autoriza",
    "sessao",
    "sessão",
    "token",
    "jwt",
    "senha",
    "cadastro",
    "signup",
    "permiss",
    "papel",
    "papeis",
    "papéis",
    "rbac",
    "rls",
    "oauth",
    "sso",
  ],
  seguranca: [
    "seguran",
    "vulnerab",
    "ataque",
    "invas",
    "vazamento",
    "hash",
    "criptograf",
    "xss",
    "csrf",
    "injection",
    "injecao",
    "injeção",
    "lgpd",
    "dado sensivel",
    "dado sensível",
    "exploit",
  ],
  ia: [
    "ia ",
    "inteligencia artificial",
    "inteligência artificial",
    "llm",
    "gpt",
    "claude",
    "gemini",
    "prompt",
    "embedding",
    "rag",
    "agente",
    "modelo de linguagem",
    "token",
    "openai",
    "anthropic",
  ],
  roadmap: [
    "roadmap",
    "etapa",
    "fase",
    "proxim",
    "próxim",
    "ordem",
    "cronograma",
    "prazo",
    "progresso",
    "por onde comec",
    "por onde começ",
    "o que fazer agora",
    "planejamento",
  ],
  deploy: [
    "deploy",
    "publicar",
    "hospedagem",
    "hospedar",
    "servidor",
    "vercel",
    "netlify",
    "cloudflare",
    "docker",
    "ci/cd",
    "pipeline",
    "build",
    "producao",
    "produção",
    "dominio",
    "domínio",
    "ssl",
  ],
  erro: [
    "erro",
    "error",
    "bug",
    "falha",
    "quebrou",
    "nao funciona",
    "não funciona",
    "deu ruim",
    "exception",
    "stack trace",
    "travou",
    "crash",
    "500",
    "404",
    "403",
    "nao carrega",
    "não carrega",
  ],
  stack: [
    "stack",
    "tecnologia",
    "framework",
    "react",
    "next",
    "vue",
    "node",
    "python",
    "typescript",
    "biblioteca",
    "trocar de",
    "migrar de",
    "qual linguagem",
    "front",
    "back",
    "arquitetura",
    "monolito",
    "microservi",
    "escalab",
    "complex",
    "simplific",
    "overengineer",
  ],
  produto: [
    "funcionalidade",
    "feature",
    "mvp",
    "usuario",
    "usuário",
    "publico",
    "público",
    "persona",
    "monetiz",
    "cobrar",
    "preco",
    "preço",
    "concorrente",
    "escopo",
  ],
};

function semAcento(t: string): string {
  let s = "";
  for (const ch of t.toLowerCase().normalize("NFD")) {
    const n = ch.codePointAt(0) ?? 0;
    if (n >= 0x300 && n <= 0x36f) continue;
    s += ch;
  }
  return s;
}

/**
 * Se um termo casa com o texto.
 *
 * Termo curto e sem espaço exige palavra inteira; o resto casa por pedaço. A regra nasceu de um
 * falso positivo real: "sso" (de single sign-on) casava dentro de "isso", e a frase "quero fazer
 * isso manualmente" era roteada como pergunta de autenticação.
 *
 * Termo longo continua casando por pedaço de propósito, e é isso que faz "migrat" pegar migration,
 * migrar e migração de uma vez — a conjugação não pode decidir o roteamento.
 */
function casa(texto: string, termo: string): boolean {
  if (termo.length > 4 || /\s/.test(termo)) return texto.includes(termo);

  const escapado = termo.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escapado}($|[^a-z0-9])`).test(texto);
}

export type Roteamento = {
  /** As facetas encontradas, da mais forte para a mais fraca. Nunca vazia. */
  facetas: Faceta[];
  /** A faceta da tela onde a pessoa estava. Entra sempre, mesmo sem casar com a pergunta. */
  daTela: Faceta | null;
  /** Quantas palavras casaram por faceta. Diagnóstico — vai para o metadata da mensagem. */
  pontos: Partial<Record<Faceta, number>>;
};

/**
 * Classifica a pergunta.
 *
 * `facetaDaTela` vem de onde o Copilot foi aberto. Ela entra no resultado mesmo quando a pergunta
 * não menciona nada daquele assunto — é o que faz "não entendi essa parte" funcionar.
 */
export function rotear(pergunta: string, facetaDaTela?: Faceta): Roteamento {
  const texto = semAcento(pergunta);
  const pontos: Partial<Record<Faceta, number>> = {};

  for (const [faceta, palavras] of Object.entries(PALAVRAS) as [Faceta, string[]][]) {
    const n = palavras.filter((p) => casa(texto, semAcento(p))).length;
    if (n > 0) pontos[faceta] = n;
  }

  const ordenadas = (Object.entries(pontos) as [Faceta, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f);

  /**
   * Teto de três facetas.
   *
   * Uma pergunta longa casa com meia dúzia delas — "como protejo a API de login contra ataque"
   * pega api, auth e seguranca, e está certo. Mas passar disso significa que o orçamento de
   * contexto vira o plano inteiro, que é exatamente o que esta estratégia existe para evitar.
   */
  const facetas = ordenadas.slice(0, 3);

  if (facetaDaTela && !facetas.includes(facetaDaTela)) facetas.push(facetaDaTela);
  if (facetas.length === 0) facetas.push("geral");

  return { facetas, daTela: facetaDaTela ?? null, pontos };
}
