/**
 * Contrato do Blueprint — o plano técnico completo de um projeto.
 *
 * O Blueprint é o que o Pathly entrega: a pessoa escreve "quero criar um SaaS de gestão de
 * academias" e recebe de volta problema, público, funcionalidades, stack, modelo de dados,
 * arquitetura, riscos e a trilha de execução.
 *
 * ## Por que em blocos, e não tudo de uma vez
 *
 * Duas razões, e elas coincidem:
 *
 * 1. **Técnica.** Gerar as 23 seções numa chamada só produz um JSON de vários milhares de tokens.
 *    A geração levaria mais de dois minutos e qualquer falha jogaria tudo fora. Em quatro blocos,
 *    cada um leva ~15s, e a falha de um não derruba os outros.
 *
 * 2. **De produto, e esta é a que importa.** O princípio do app é impedir que a pessoa pule
 *    fundamento: não se escolhe banco de dados antes de saber que dados existem, nem tela antes
 *    de saber quem usa. Gerar em ordem não é só otimização — é a regra do produto virando
 *    estrutura de código. O bloco técnico recebe o bloco de produto como contexto, então ele
 *    **não tem como** ser inventado no vácuo.
 *
 * A ordem é fundacao -> produto -> tecnico -> execucao, e não pode ser invertida.
 */

/** Os quatro blocos, na ordem obrigatória de geração. */
export const BLOCOS = ["fundacao", "produto", "tecnico", "execucao"] as const;
export type Bloco = (typeof BLOCOS)[number];

/** O que cada bloco precisa ter pronto antes de poder ser gerado. */
export const DEPENDE_DE: Record<Bloco, Bloco[]> = {
  fundacao: [],
  produto: ["fundacao"],
  tecnico: ["fundacao", "produto"],
  execucao: ["fundacao", "produto", "tecnico"],
};

// ---------------------------------------------------------------------------------------------
// Bloco 1 — Fundação: para quem, que dor, por que pagariam
// ---------------------------------------------------------------------------------------------

export type Persona = {
  nome: string;
  papel: string;
  /** O dia a dia dela hoje, sem o produto. */
  contexto: string;
  dores: string[];
  /** Como ela resolve isso hoje — planilha, WhatsApp, caderno, concorrente. */
  alternativaAtual: string;
};

export type Fundacao = {
  nome: string;
  /** Uma frase que explica o produto para quem nunca ouviu falar. */
  descricao: string;
  /** A dor concreta. Não "falta de organização" — o que dói, para quem, quando. */
  problema: string;
  publico: string;
  persona: Persona;
  /** Por que escolher isto e não a alternativa atual. */
  propostaDeValor: string;
  modeloDeNegocio: {
    /** assinatura, uso, licenca, comissao, gratuito */
    tipo: string;
    /** Faixa de preço sugerida e o raciocínio por trás dela. */
    precoSugerido: string;
    justificativa: string;
  };
};

// ---------------------------------------------------------------------------------------------
// Bloco 2 — Produto: o que ele faz, e o que fica para depois
// ---------------------------------------------------------------------------------------------

export type Funcionalidade = {
  nome: string;
  descricao: string;
  /**
   * `mvp` é o que precisa existir para o produto valer alguma coisa. `depois` é o resto.
   * A separação é o ponto: sem ela a pessoa constrói tudo e não lança nada.
   */
  prioridade: "mvp" | "depois";
  /** Por que está nessa prioridade. Força a IA a justificar em vez de chutar. */
  porque: string;
  complexidade: "baixa" | "media" | "alta";
};

export type Produto = {
  funcionalidades: Funcionalidade[];
  /** O que o produto deliberadamente NÃO faz. Tão importante quanto o que faz. */
  foraDoEscopo: string[];
};

// ---------------------------------------------------------------------------------------------
// Bloco 3 — Técnico: como isso existe de verdade
// ---------------------------------------------------------------------------------------------

export type Tabela = {
  nome: string;
  descricao: string;
  campos: { nome: string; tipo: string; descricao: string }[];
  /** Relações com outras tabelas, em português: "pertence a academia". */
  relacoes: string[];
};

export type Endpoint = {
  metodo: string;
  caminho: string;
  descricao: string;
  autenticado: boolean;
};

export type Tecnico = {
  stack: {
    frontend: string;
    backend: string;
    banco: string;
    hospedagem: string;
    /** Por que essas escolhas para ESTE projeto, não em geral. */
    justificativa: string;
  };
  arquitetura: string;
  tabelas: Tabela[];
  endpoints: Endpoint[];
  seguranca: string[];
  integracoes: { nome: string; para: string; obrigatoria: boolean }[];
  /** Onde IA entra no produto — ou a constatação honesta de que não entra. */
  ia: string;
};

// ---------------------------------------------------------------------------------------------
// Bloco 4 — Execução: a ordem de construir
// ---------------------------------------------------------------------------------------------

export type Etapa = {
  ordem: number;
  titulo: string;
  /** O que existe de novo no mundo quando esta etapa termina. */
  entrega: string;
  fase: string;
  /** Ordem das etapas de que esta depende. Vazio = pode começar já. */
  dependeDe: number[];
  estimativaHoras: number;
};

export type Risco = {
  descricao: string;
  impacto: "baixo" | "medio" | "alto";
  mitigacao: string;
};

export type Execucao = {
  /** Fases nomeadas, na ordem. Cada etapa aponta para uma. */
  fases: { nome: string; objetivo: string }[];
  etapas: Etapa[];
  riscos: Risco[];
};

// ---------------------------------------------------------------------------------------------
// O Blueprint completo
// ---------------------------------------------------------------------------------------------

/**
 * Todo bloco é opcional porque um blueprint existe desde o primeiro bloco gerado. A tela mostra
 * o que já tem e o que ainda falta — e é justamente isso que comunica o princípio para a pessoa:
 * ela vê a seção técnica bloqueada até a fundação estar pronta.
 */
export type Blueprint = {
  fundacao?: Fundacao;
  produto?: Produto;
  tecnico?: Tecnico;
  execucao?: Execucao;
  /** Decisões que a pessoa tomou e que a IA precisa respeitar daqui em diante. */
  decisoes?: { data: string; decisao: string; porque: string }[];
};

/** Diz se um bloco pode ser gerado agora, e o que falta se não puder. */
export function podeGerar(
  blueprint: Blueprint,
  bloco: Bloco,
): { pode: true } | { pode: false; falta: Bloco[] } {
  const falta = DEPENDE_DE[bloco].filter((b) => !blueprint[b]);
  return falta.length === 0 ? { pode: true } : { pode: false, falta };
}

/** Quantos dos quatro blocos já existem. Usado na lista de projetos, sem abrir o blueprint. */
export function blocosProntos(blueprint: Blueprint): Bloco[] {
  return BLOCOS.filter((b) => Boolean(blueprint[b]));
}

// ---------------------------------------------------------------------------------------------
// Validação
//
// O schema passa por coisas inúteis: um array vazio, uma string em branco, uma etapa que depende
// de si mesma. Estes validadores rejeitam a resposta antes de ela virar tela — numa corrida entre
// provedores, um que responde rápido e mal não pode ganhar de um que responde certo.
// ---------------------------------------------------------------------------------------------

function frase(v: unknown, minimo = 10): string | null {
  return typeof v === "string" && v.trim().length >= minimo ? v.trim() : null;
}

function frases(v: unknown, minimoItens: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const limpo = v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return limpo.length >= minimoItens ? limpo.map((x) => x.trim()) : null;
}

export function validarFundacao(valor: unknown): Fundacao | null {
  if (!valor || typeof valor !== "object") return null;
  const f = valor as Partial<Fundacao>;

  const nome = frase(f.nome, 2);
  const descricao = frase(f.descricao, 15);
  const problema = frase(f.problema, 30);
  const publico = frase(f.publico, 10);
  const propostaDeValor = frase(f.propostaDeValor, 20);
  if (!nome || !descricao || !problema || !publico || !propostaDeValor) return null;

  const p = f.persona;
  const dores = frases(p?.dores, 2);
  const personaNome = frase(p?.nome, 2);
  const alternativaAtual = frase(p?.alternativaAtual, 5);
  if (!p || !dores || !personaNome || !alternativaAtual) return null;

  const m = f.modeloDeNegocio;
  if (!m || !frase(m.tipo, 3) || !frase(m.precoSugerido, 2) || !frase(m.justificativa, 15)) {
    return null;
  }

  return {
    nome,
    descricao,
    problema,
    publico,
    persona: {
      nome: personaNome,
      papel: frase(p.papel, 2) ?? "",
      contexto: frase(p.contexto, 10) ?? "",
      dores,
      alternativaAtual,
    },
    propostaDeValor,
    modeloDeNegocio: {
      tipo: m.tipo.trim(),
      precoSugerido: m.precoSugerido.trim(),
      justificativa: m.justificativa.trim(),
    },
  };
}

export function validarProduto(valor: unknown): Produto | null {
  if (!valor || typeof valor !== "object") return null;
  const p = valor as Partial<Produto>;
  if (!Array.isArray(p.funcionalidades)) return null;

  const funcionalidades = p.funcionalidades.filter(
    (f): f is Funcionalidade =>
      Boolean(f) &&
      Boolean(frase(f.nome, 2)) &&
      Boolean(frase(f.descricao, 10)) &&
      (f.prioridade === "mvp" || f.prioridade === "depois") &&
      ["baixa", "media", "alta"].includes(f.complexidade),
  );
  if (funcionalidades.length < 4) return null;

  // Um MVP com tudo dentro não é um MVP, e é o erro que este produto existe para evitar. Se o
  // modelo marcou tudo como essencial, a resposta não serve — outro provedor na corrida pode
  // fazer melhor do que corrigir isto no escuro.
  const mvp = funcionalidades.filter((f) => f.prioridade === "mvp").length;
  if (mvp === 0 || mvp === funcionalidades.length) return null;

  return { funcionalidades, foraDoEscopo: frases(p.foraDoEscopo, 1) ?? [] };
}

export function validarTecnico(valor: unknown): Tecnico | null {
  if (!valor || typeof valor !== "object") return null;
  const t = valor as Partial<Tecnico>;

  const s = t.stack;
  if (!s || !frase(s.frontend, 2) || !frase(s.banco, 2) || !frase(s.justificativa, 20)) return null;
  if (!frase(t.arquitetura, 50)) return null;

  const tabelas = (Array.isArray(t.tabelas) ? t.tabelas : []).filter(
    (tb): tb is Tabela =>
      Boolean(tb) &&
      Boolean(frase(tb.nome, 2)) &&
      Array.isArray(tb.campos) &&
      tb.campos.filter((c) => c && frase(c.nome, 1) && frase(c.tipo, 2)).length >= 2,
  );
  // Sem modelo de dados não há blueprint técnico — é a seção que tudo o mais referencia.
  if (tabelas.length < 2) return null;

  const endpoints = (Array.isArray(t.endpoints) ? t.endpoints : []).filter(
    (e): e is Endpoint => Boolean(e) && Boolean(frase(e.metodo, 3)) && Boolean(frase(e.caminho, 2)),
  );

  return {
    stack: {
      frontend: s.frontend.trim(),
      backend: frase(s.backend, 2) ?? "",
      banco: s.banco.trim(),
      hospedagem: frase(s.hospedagem, 2) ?? "",
      justificativa: s.justificativa.trim(),
    },
    arquitetura: t.arquitetura!.trim(),
    tabelas,
    endpoints,
    seguranca: frases(t.seguranca, 1) ?? [],
    integracoes: (Array.isArray(t.integracoes) ? t.integracoes : []).filter(
      (i) => i && frase(i.nome, 2) && frase(i.para, 5),
    ),
    ia: frase(t.ia, 10) ?? "",
  };
}

export function validarExecucao(valor: unknown): Execucao | null {
  if (!valor || typeof valor !== "object") return null;
  const e = valor as Partial<Execucao>;

  const fases = (Array.isArray(e.fases) ? e.fases : []).filter(
    (f) => f && frase(f.nome, 2) && frase(f.objetivo, 10),
  );
  if (fases.length < 2) return null;

  const brutas = (Array.isArray(e.etapas) ? e.etapas : []).filter(
    (x): x is Etapa =>
      Boolean(x) &&
      typeof x.ordem === "number" &&
      Boolean(frase(x.titulo, 5)) &&
      Boolean(frase(x.entrega, 10)),
  );
  if (brutas.length < 5) return null;

  // Reordena e renumera em vez de confiar no `ordem` que veio: modelos pulam número e repetem.
  // A ordem da trilha é a espinha do produto — ela precisa estar certa, não parecida.
  const etapas = brutas
    .slice()
    .sort((a, b) => a.ordem - b.ordem)
    .map((x, i) => {
      const ordem = i + 1;
      return {
        ...x,
        ordem,
        // Dependência de etapa posterior (ou de si mesma) criaria um bloqueio impossível de
        // resolver na tela: a pessoa não conseguiria começar nada.
        dependeDe: (Array.isArray(x.dependeDe) ? x.dependeDe : []).filter(
          (d) => typeof d === "number" && d >= 1 && d < ordem,
        ),
        estimativaHoras:
          typeof x.estimativaHoras === "number" && x.estimativaHoras > 0
            ? Math.min(x.estimativaHoras, 40)
            : 4,
        fase: fases.some((f) => f.nome === x.fase) ? x.fase : fases[0]!.nome,
      };
    });

  return {
    fases: fases.map((f) => ({ nome: f.nome.trim(), objetivo: f.objetivo.trim() })),
    etapas,
    riscos: (Array.isArray(e.riscos) ? e.riscos : []).filter(
      (r): r is Risco =>
        Boolean(r) &&
        Boolean(frase(r.descricao, 15)) &&
        ["baixo", "medio", "alto"].includes(r.impacto) &&
        Boolean(frase(r.mitigacao, 10)),
    ),
  };
}

export const VALIDADORES = {
  fundacao: validarFundacao,
  produto: validarProduto,
  tecnico: validarTecnico,
  execucao: validarExecucao,
} as const;
