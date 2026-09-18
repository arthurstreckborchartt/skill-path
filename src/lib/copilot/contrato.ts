/**
 * Os contratos do Copilot: mensagem, decisão e proposta.
 *
 * ## As três coisas são diferentes, de propósito
 *
 * Uma **mensagem** é o que foi dito. Uma **proposta** é o que o Copilot quer mudar e ainda não
 * mudou. Uma **decisão** é o que ficou valendo, depois que a pessoa confirmou.
 *
 * Misturar as três numa tabela só de "eventos" pareceria mais elegante e destruiria a única
 * propriedade que importa aqui: dá para olhar as decisões ativas de um projeto e saber o que vale
 * hoje, sem reconstruir nada. Uma trilha de auditoria que precisa ser reprocessada para responder
 * "qual banco eu escolhi?" não é uma trilha de auditoria útil.
 *
 * ## Por que o Copilot propõe em vez de escrever
 *
 * O Blueprint é o produto. Uma IA que o reescreve sozinha, a partir de uma frase ambígua como
 * "não funcionou", corrompe o plano de um jeito que a pessoa só descobre sessões depois — sem
 * histórico de quem mudou o quê. A proposta existe para que a mudança tenha um autor.
 */

// ---------------------------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------------------------

export const PAPEIS = ["usuario", "copilot"] as const;
export type Papel = (typeof PAPEIS)[number];

/** Os três modos de resposta. Ver `MODOS_ROTULO` para o que cada um entrega. */
export const MODOS = ["explicar", "guiar", "gerar"] as const;
export type Modo = (typeof MODOS)[number];

export const MODO_ROTULO: Record<Modo, string> = {
  explicar: "Explicar",
  guiar: "Guiar",
  gerar: "Gerar",
};

export const MODO_RESUMO: Record<Modo, string> = {
  explicar: "Ensina o conceito usando o seu projeto como exemplo.",
  guiar: "Mostra os passos, cada um com o jeito de conferir se deu certo.",
  gerar: "Produz um artefato pronto: código, SQL, contrato ou prompt.",
};

/** Um passo do modo GUIAR. A validação não é opcional: passo sem prova é palpite. */
export type Passo = {
  titulo: string;
  detalhe: string;
  /** Como a pessoa confere que este passo deu certo, concretamente. */
  comoValidar: string;
};

export const TIPOS_ARTEFATO = [
  "codigo",
  "sql",
  "schema",
  "contrato-api",
  "arquitetura",
  "checklist",
  "documentacao",
  "prompt",
] as const;
export type TipoArtefato = (typeof TIPOS_ARTEFATO)[number];

export type Artefato = {
  tipo: TipoArtefato;
  titulo: string;
  /** Linguagem para o destaque de sintaxe, quando fizer sentido. */
  linguagem: string;
  conteudo: string;
};

/**
 * A resposta do Copilot.
 *
 * É JSON preso a schema, e não prosa livre, porque a resposta tem estrutura obrigatória — modo,
 * passos com validação, artefato, próximo passo. Com texto livre eu teria que parsear "PASSO 2"
 * de volta do markdown, e todo modelo escreve isso de um jeito diferente.
 */
export type RespostaCopilot = {
  modo: Modo;
  /** A resposta em si, em parágrafos. */
  blocos: string[];
  /** Preenchido no modo GUIAR. */
  passos: Passo[];
  /** Preenchido no modo GERAR. */
  artefato: Artefato | null;
  /** O que fazer em seguida, em uma frase. O motor determinístico dá o passo; isto dá o contexto. */
  proximoPasso: string;
  /**
   * Mudanças de estado que a resposta implica — e que NÃO acontecem sozinhas.
   *
   * O Copilot preenche isto quando percebe que a conversa mudou alguma coisa do projeto. Vira
   * proposta pendente na tela, com botão de aprovar. Nunca vira escrita direta.
   */
  propostas: PropostaSugerida[];
  /** Tecnologia cara recomendada sem justificativa concreta. Ver `TECNOLOGIAS_CARAS`. */
  alertaComplexidade: string | null;
};

export type MensagemCopilot = {
  id: string;
  papel: Papel;
  /** Texto puro quando `papel` é "usuario"; a resposta estruturada quando é "copilot". */
  texto: string;
  resposta: RespostaCopilot | null;
  criadoEm: string;
};

// ---------------------------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------------------------

export const STATUS_DECISAO = ["proposta", "ativa", "substituida", "rejeitada"] as const;
export type StatusDecisao = (typeof STATUS_DECISAO)[number];

export const ORIGENS_DECISAO = ["copilot", "usuario", "importacao", "sistema"] as const;
export type OrigemDecisao = (typeof ORIGENS_DECISAO)[number];

export type Decisao = {
  id: string;
  /** O assunto, estável entre versões: "banco", "auth", "hospedagem". */
  chave: string;
  titulo: string;
  /** O que ficou decidido. */
  valor: string;
  /** Por quê. É o que faz a decisão valer mais que o Blueprint sozinho. */
  motivo: string;
  status: StatusDecisao;
  /** A decisão que esta aposentou. */
  substituiDecisaoId: string | null;
  origem: OrigemDecisao;
  confirmadoEm: string | null;
  criadoEm: string;
};

// ---------------------------------------------------------------------------------------------
// Propostas
// ---------------------------------------------------------------------------------------------

export const STATUS_PROPOSTA = ["pendente", "aprovada", "rejeitada", "cancelada"] as const;
export type StatusProposta = (typeof STATUS_PROPOSTA)[number];

/**
 * Os tipos de mudança que exigem confirmação.
 *
 * A lista é fechada de propósito: é ela que separa "o Copilot respondeu uma pergunta" de "o
 * Copilot quer mexer no plano". Explicação, prompt, código e checklist não entram aqui — pedir
 * confirmação para cada resposta transformaria o fluxo em burocracia, e a pessoa aprenderia a
 * clicar em aprovar sem ler.
 */
export const TIPOS_PROPOSTA = [
  "stack",
  "banco",
  "api",
  "auth",
  "seguranca",
  "funcionalidade",
  "arquitetura",
  "requisito",
  "decisao",
] as const;
export type TipoProposta = (typeof TIPOS_PROPOSTA)[number];

export const ROTULO_TIPO_PROPOSTA: Record<TipoProposta, string> = {
  stack: "Stack",
  banco: "Banco de dados",
  api: "API",
  auth: "Autenticação",
  seguranca: "Segurança",
  funcionalidade: "Funcionalidade",
  arquitetura: "Arquitetura",
  requisito: "Requisito",
  decisao: "Decisão técnica",
};

/** O que a IA devolve. Vira `Proposta` só depois de gravada. */
export type PropostaSugerida = {
  tipo: TipoProposta;
  titulo: string;
  descricao: string;
  /** Caminho de ponto no Blueprint: "tecnico.stack.banco". `null` quando é só uma decisão. */
  campoAfetado: string | null;
  valorProposto: unknown;
  motivo: string;
  /** O que mais é afetado. A pessoa precisa ver o tamanho antes de aprovar. */
  impactos: string[];
};

export type Proposta = {
  id: string;
  tipo: TipoProposta;
  titulo: string;
  descricao: string;
  campoAfetado: string | null;
  valorAtual: unknown;
  valorProposto: unknown;
  motivo: string;
  impactos: string[];
  status: StatusProposta;
  /** A decisão criada na aprovação. Fecha a rastreabilidade proposta → aprovação → decisão. */
  decisaoId: string | null;
  criadoEm: string;
  confirmadoEm: string | null;
};

// ---------------------------------------------------------------------------------------------
// Anti-superengenharia
// ---------------------------------------------------------------------------------------------

/**
 * As tecnologias que não entram sem justificativa concreta.
 *
 * A mesma filosofia do módulo de Arquitetura de IA, mas aqui com dente no código: se a resposta
 * cita uma destas e não explica por quê, a tela marca. Deixar isso só no prompt de sistema seria
 * confiar que o modelo lembra da regra na trigésima mensagem — e ele não lembra.
 */
export const TECNOLOGIAS_CARAS = [
  "microservi",
  "kubernetes",
  "event-driven",
  "event sourcing",
  "vector database",
  "banco vetorial",
  "redis",
  "kafka",
  "graphql federation",
  "service mesh",
] as const;

// ---------------------------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------------------------

function texto(v: unknown, minimo: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= minimo ? t : null;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => texto(x, 2)).filter((x): x is string => x !== null);
}

function umDe<T extends string>(v: unknown, valores: readonly T[]): T | null {
  return typeof v === "string" && (valores as readonly string[]).includes(v) ? (v as T) : null;
}

function validarPasso(valor: unknown): Passo | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<Passo>;

  const titulo = texto(p.titulo, 3);
  const detalhe = texto(p.detalhe, 10);
  if (!titulo || !detalhe) return null;

  return {
    titulo,
    detalhe,
    // Passo sem validação ainda serve: recusar a resposta inteira por causa de um campo é pior
    // que entregar o passo dizendo, honestamente, que a conferência é manual.
    comoValidar: texto(p.comoValidar, 5) ?? "Confira à mão que este passo deu certo.",
  };
}

function validarArtefato(valor: unknown): Artefato | null {
  if (!valor || typeof valor !== "object") return null;
  const a = valor as Partial<Artefato>;

  const conteudo = texto(a.conteudo, 10);
  if (!conteudo) return null;

  return {
    tipo: umDe(a.tipo, TIPOS_ARTEFATO) ?? "documentacao",
    titulo: texto(a.titulo, 3) ?? "Artefato",
    linguagem: texto(a.linguagem, 1) ?? "text",
    conteudo,
  };
}

function validarPropostaSugerida(valor: unknown): PropostaSugerida | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<PropostaSugerida>;

  const tipo = umDe(p.tipo, TIPOS_PROPOSTA);
  const titulo = texto(p.titulo, 3);
  const descricao = texto(p.descricao, 10);
  /**
   * Proposta sem motivo é recusada inteira, ao contrário dos outros campos opcionais.
   *
   * O motivo é o que a pessoa lê para decidir aprovar. Uma proposta que chega sem ele vira um
   * botão "mude o seu banco de dados" sem argumento — e é exatamente assim que alguém aprova uma
   * mudança que não entendeu.
   */
  const motivo = texto(p.motivo, 10);
  if (!tipo || !titulo || !descricao || !motivo) return null;

  return {
    tipo,
    titulo,
    descricao,
    campoAfetado: texto(p.campoAfetado, 3),
    valorProposto: p.valorProposto ?? null,
    motivo,
    impactos: lista(p.impactos),
  };
}

/** Acha tecnologia cara citada sem a palavra "porque" por perto. Heurística, e assumida como tal. */
function detectarComplexidade(blocos: string[]): string | null {
  const texto = blocos.join(" ").toLowerCase();
  const achadas = TECNOLOGIAS_CARAS.filter((t) => texto.includes(t));
  if (achadas.length === 0) return null;

  return `Esta resposta cita ${achadas.join(", ")}. Confira se a justificativa convence antes de seguir — a pergunta certa é qual a menor arquitetura que resolve o seu problema.`;
}

export function validarResposta(valor: unknown): RespostaCopilot | null {
  if (!valor || typeof valor !== "object") return null;
  const r = valor as Partial<RespostaCopilot>;

  const blocos = lista(r.blocos);
  if (blocos.length === 0) return null;

  const modo = umDe(r.modo, MODOS) ?? "explicar";

  const passos = (Array.isArray(r.passos) ? r.passos : [])
    .map(validarPasso)
    .filter((p): p is Passo => p !== null);

  const propostas = (Array.isArray(r.propostas) ? r.propostas : [])
    .map(validarPropostaSugerida)
    .filter((p): p is PropostaSugerida => p !== null);

  return {
    modo,
    blocos,
    passos,
    artefato: validarArtefato(r.artefato),
    proximoPasso: texto(r.proximoPasso, 5) ?? "",
    propostas,
    alertaComplexidade: detectarComplexidade(blocos),
  };
}
