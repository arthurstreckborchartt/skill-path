/**
 * O contrato do plano de IA.
 *
 * ## Por que existe um veredito antes da arquitetura
 *
 * Este módulo é o único do blueprint que pode responder "você não precisa disso". Os outros
 * projetam o que a pessoa já decidiu ter — todo produto tem dados, todo produto tem API. IA não:
 * na maior parte dos projetos que chegam aqui, uma consulta ordenada resolve o que a pessoa
 * chamou de recomendação, e um `if` resolve o que ela chamou de classificação.
 *
 * Um módulo que só arquiteta assume a premissa e entrega uma arquitetura cara para um problema
 * que não existia. Por isso `precisaDeIa` vem antes de `funcionalidades`, e `descartadas` é um
 * campo de primeira classe, não um rodapé.
 *
 * ## Por que o nível é escolhido, e defendido
 *
 * `nivel` é a decisão mais cara do módulo — ela separa uma chamada de API de um sistema de
 * agentes. Por isso vem acompanhada de `porqueEsseNivel` e `oQueNaoBasta`: a IA tem que dizer o
 * que o degrau de baixo resolveria e por que ele não serve. Escolha sem justificativa escrita
 * tende para cima, porque arquitetura complexa parece mais competente — e é exatamente isso que
 * este produto existe para evitar.
 */

/**
 * Os cinco degraus, do mais barato ao mais caro.
 *
 * A ordem é a ordem de preferência. Subir um degrau precisa de motivo escrito; descer, não.
 */
export const NIVEIS = [
  "sem-ia",
  "api-pronta",
  "llm-simples",
  "rag",
  "tool-calling",
  "agente",
] as const;

export type Nivel = (typeof NIVEIS)[number];

export const ROTULO_NIVEL: Record<Nivel, string> = {
  "sem-ia": "Sem IA",
  "api-pronta": "API pronta",
  "llm-simples": "Uma chamada de LLM",
  rag: "Busca nos documentos (RAG)",
  "tool-calling": "LLM com ferramentas",
  agente: "Agente",
};

export const RESUMO_NIVEL: Record<Nivel, string> = {
  "sem-ia": "Uma consulta, uma regra ou uma conta resolve. Não custa token nenhum e não erra.",
  "api-pronta":
    "Um serviço que já existe resolve — transcrever, traduzir, ler texto de imagem. Preço fixo por uso, sem prompt para manter.",
  "llm-simples": "Uma chamada com um prompt bom. É onde a maioria das funcionalidades de IA para.",
  rag: "O modelo precisa responder sobre documentos que ele nunca viu. Busca primeiro, responde depois.",
  "tool-calling": "O modelo precisa consultar ou executar algo no seu sistema para responder.",
  agente:
    "O modelo decide sozinho a sequência de passos. Caro, lento e difícil de testar — precisa de um problema que justifique.",
};

/** O peso de cada degrau, para ordenar e para detectar escalada sem motivo. */
export const PESO_NIVEL: Record<Nivel, number> = {
  "sem-ia": 0,
  "api-pronta": 1,
  "llm-simples": 2,
  rag: 3,
  "tool-calling": 4,
  agente: 5,
};

export type FuncionalidadeIa = {
  id: string;
  nome: string;
  /** O problema de quem usa o produto, não a solução técnica. */
  problema: string;
  nivel: Nivel;
  /** Por que este degrau, e não o de baixo. Força a IA a defender em vez de escalar por reflexo. */
  porqueEsseNivel: string;
  /** O que o degrau de baixo resolveria, e onde ele para. Vazio quando o nível já é o mais baixo. */
  oQueNaoBasta: string;
  /** O que entra: de onde vem e em que formato. */
  input: string;
  /** O que sai, e o que a tela faz com isso. */
  output: string;
  /** Id de um modelo do catálogo. `null` quando o nível não usa LLM. */
  modeloSugerido: string | null;
  /** O que precisa estar no contexto da chamada para a resposta fazer sentido. */
  contexto: string[];
  /** O prompt de sistema desta funcionalidade, escrito para este projeto. */
  promptSistema: string;
  /**
   * Volume estimado. A IA estima, o código calcula o custo.
   *
   * Pedir o custo em dinheiro para o modelo é onde ele inventa número com mais confiança — preço
   * por token não está no peso dele, e uma estimativa errada aqui leva a pessoa a decidir errado
   * sobre o próprio produto.
   */
  chamadasPorMes: number;
  tokensEntrada: number;
  tokensSaida: number;
  /** Alguém está esperando na tela? Decide streaming e o teto de latência aceitável. */
  sincrona: boolean;
  /** Riscos de segurança que existem por causa desta funcionalidade. */
  seguranca: string[];
  /** Que dado sai da sua casa nesta chamada, e o que fazer a respeito. */
  privacidade: string[];
  /** O que o produto faz quando a IA falha, demora demais ou responde bobagem. */
  fallback: string;
  /** Como saber se está funcionando — critérios conferíveis, não "ficou bom". */
  comoAvaliar: string[];
};

export type Descartada = {
  nome: string;
  /** Por que isto não precisa de IA. */
  porque: string;
  /** O que fazer no lugar. Sem isto, a recusa vira só um "não". */
  oQueUsarNoLugar: string;
};

export type PlanoIa = {
  /** O veredito, antes de qualquer arquitetura. */
  precisaDeIa: boolean;
  /** A justificativa do veredito, endereçada a quem perguntou. */
  veredito: string;
  funcionalidades: FuncionalidadeIa[];
  /** O que foi cogitado e não virou IA. Vale tanto quanto o que virou. */
  descartadas: Descartada[];
};

function texto(v: unknown, minimo: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= minimo ? t : null;
}

function lista(v: unknown, minimoItens: number): string[] {
  if (!Array.isArray(v)) return [];
  const itens = v.map((x) => texto(x, 3)).filter((x): x is string => x !== null);
  return itens.length >= minimoItens ? itens : [];
}

function inteiro(v: unknown, minimo: number, maximo: number, padrao: number): number {
  const n = typeof v === "number" ? Math.round(v) : Number.NaN;
  if (!Number.isFinite(n)) return padrao;
  return Math.min(maximo, Math.max(minimo, n));
}

function nivelValido(v: unknown): Nivel | null {
  return typeof v === "string" && (NIVEIS as readonly string[]).includes(v) ? (v as Nivel) : null;
}

function idDoNome(nome: string, indice: number): string {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.length >= 2 ? base.slice(0, 40) : `funcionalidade-${indice + 1}`;
}

function validarFuncionalidade(valor: unknown, indice: number): FuncionalidadeIa | null {
  if (!valor || typeof valor !== "object") return null;
  const f = valor as Partial<FuncionalidadeIa>;

  const nome = texto(f.nome, 3);
  const problema = texto(f.problema, 15);
  const nivel = nivelValido(f.nivel);
  if (!nome || !problema || !nivel) return null;

  const input = texto(f.input, 5);
  const output = texto(f.output, 5);
  if (!input || !output) return null;

  /**
   * Nível acima de `api-pronta` sem justificativa escrita cai para `llm-simples`.
   *
   * A alternativa seria recusar a funcionalidade inteira, o que é pior: a pessoa perde a análise
   * por causa de um campo. Rebaixar preserva o resto e erra para o lado barato, que é o lado
   * certo de errar aqui.
   */
  const porqueEsseNivel = texto(f.porqueEsseNivel, 15);
  const nivelFinal =
    PESO_NIVEL[nivel] > PESO_NIVEL["llm-simples"] && !porqueEsseNivel ? "llm-simples" : nivel;

  return {
    id: idDoNome(nome, indice),
    nome,
    problema,
    nivel: nivelFinal,
    porqueEsseNivel: porqueEsseNivel ?? RESUMO_NIVEL[nivelFinal],
    oQueNaoBasta: texto(f.oQueNaoBasta, 10) ?? "",
    input,
    output,
    modeloSugerido: texto(f.modeloSugerido, 2),
    contexto: lista(f.contexto, 1),
    promptSistema: texto(f.promptSistema, 20) ?? "",
    chamadasPorMes: inteiro(f.chamadasPorMes, 1, 10_000_000, 1000),
    tokensEntrada: inteiro(f.tokensEntrada, 1, 1_000_000, 1500),
    tokensSaida: inteiro(f.tokensSaida, 1, 128_000, 500),
    sincrona: f.sincrona !== false,
    seguranca: lista(f.seguranca, 1),
    privacidade: lista(f.privacidade, 1),
    fallback: texto(f.fallback, 10) ?? "",
    comoAvaliar: lista(f.comoAvaliar, 1),
  };
}

function validarDescartada(valor: unknown): Descartada | null {
  if (!valor || typeof valor !== "object") return null;
  const d = valor as Partial<Descartada>;

  const nome = texto(d.nome, 3);
  const porque = texto(d.porque, 15);
  /**
   * Descartar sem dizer o que usar no lugar é o pior resultado possível deste campo: a pessoa
   * fica sabendo que a ideia dela não presta e continua sem saber o que fazer.
   */
  const oQueUsarNoLugar = texto(d.oQueUsarNoLugar, 10);
  if (!nome || !porque || !oQueUsarNoLugar) return null;

  return { nome, porque, oQueUsarNoLugar };
}

export function validarPlano(valor: unknown): PlanoIa | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<PlanoIa>;

  const veredito = texto(p.veredito, 20);
  if (!veredito) return null;

  const funcionalidades = (Array.isArray(p.funcionalidades) ? p.funcionalidades : [])
    .map(validarFuncionalidade)
    .filter((f): f is FuncionalidadeIa => f !== null);

  // Ids repetidos quebram as chaves de lista na tela e a referência do checklist.
  const vistos = new Set<string>();
  const unicas = funcionalidades.map((f) => {
    let id = f.id;
    let n = 2;
    while (vistos.has(id)) id = `${f.id}-${n++}`;
    vistos.add(id);
    return { ...f, id };
  });

  const descartadas = (Array.isArray(p.descartadas) ? p.descartadas : [])
    .map(validarDescartada)
    .filter((d): d is Descartada => d !== null);

  /**
   * O veredito é recalculado, não aceito.
   *
   * Um plano que diz `precisaDeIa: true` e não lista nenhuma funcionalidade acima de `sem-ia`
   * está se contradizendo, e a contradição sempre aparece do mesmo jeito: o modelo quer agradar
   * quem perguntou. Quem decide é a lista.
   */
  const comIa = unicas.filter((f) => f.nivel !== "sem-ia");

  // Sem nenhuma funcionalidade e sem nada descartado, não sobrou análise nenhuma para mostrar.
  if (unicas.length === 0 && descartadas.length === 0) return null;

  return { precisaDeIa: comIa.length > 0, veredito, funcionalidades: unicas, descartadas };
}
