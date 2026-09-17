/**
 * O mapa de APIs do projeto — a fonte de onde saem OpenAPI, exemplos, checklist e prompts.
 *
 * Mesma decisão do módulo de banco: a IA devolve um modelo estruturado e o **código** deriva os
 * artefatos. Pedir "escreva a documentação da API" traria markdown bonito e inútil para gerar
 * exemplo de `curl` correto, conferir se todo endpoint autenticado trata 401, ou montar um
 * OpenAPI que uma ferramenta consiga ler.
 *
 * Aqui cada endpoint é um objeto com os doze campos que importam, e tudo o mais é função deles.
 */

export const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
export type MetodoHttp = (typeof METODOS)[number];

/**
 * O que cada método significa, para quem nunca usou.
 *
 * Canônico, e não gerado: a definição de PUT não muda de projeto para projeto. O que muda é onde
 * ele aparece no projeto da pessoa, e isso a IA escreve em `comoApareceAqui`.
 */
export const EXPLICACAO_METODO: Record<MetodoHttp, string> = {
  GET: "Busca informação e não muda nada. Pode ser repetido à vontade sem efeito colateral.",
  POST: "Cria algo novo. Chamar duas vezes cria dois — por isso importa proteger contra clique duplo.",
  PUT: "Substitui um registro inteiro. O que você não mandar é apagado.",
  PATCH: "Altera só os campos que você mandar. O resto fica como estava.",
  DELETE: "Remove. Chamar de novo depois de remover deve responder que já não existe, sem quebrar.",
};

export const TIPOS_CAMPO = [
  "texto",
  "numero",
  "booleano",
  "data",
  "uuid",
  "email",
  "lista",
  "objeto",
  "arquivo",
] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export type CampoContrato = {
  nome: string;
  tipo: TipoCampo;
  obrigatorio: boolean;
  descricao: string;
  /** Valor de exemplo real, usado para montar o `curl` e o corpo de teste. */
  exemplo: string;
  /** A regra que o servidor precisa conferir. "e-mail válido", "mínimo 8 caracteres". */
  validacao: string;
  /** Dado pessoal. Decide se ele pode aparecer em log e em resposta. */
  sensivel: boolean;
};

export type RespostaSucesso = {
  /** 200, 201, 204… */
  status: number;
  quando: string;
  corpo: CampoContrato[];
};

export type ErroHttp = {
  status: number;
  /** Código estável que o cliente pode testar: `email_ja_existe`. Nunca a mensagem. */
  codigo: string;
  quando: string;
  /** O que a pessoa lê na tela. Sem jargão, sem número de status. */
  mensagem: string;
};

export type TipoAutenticacao = "nenhuma" | "sessao" | "token" | "api_key";

export const EXPLICACAO_AUTENTICACAO: Record<TipoAutenticacao, string> = {
  nenhuma: "Qualquer um chama, sem se identificar.",
  sessao: "O navegador manda um cookie que o servidor criou no login.",
  token: "O cliente manda um token (JWT) no cabeçalho Authorization a cada chamada.",
  api_key: "Uma chave fixa, para outro sistema chamar — não para uma pessoa.",
};

export type Endpoint = {
  /** Estável, para o checklist e os prompts apontarem para cá. Ex: `post-auth-login`. */
  id: string;
  metodo: MetodoHttp;
  /** Com os parâmetros no formato `:id`. Ex: `/api/projetos/:id`. */
  caminho: string;
  /** Por que este endpoint existe, no negócio da pessoa. Não "retorna os dados do usuário". */
  finalidade: string;
  /** O nome do grupo a que pertence. Ex: "Autenticação". */
  grupo: string;
  autenticacao: TipoAutenticacao;
  /** Quem pode chamar depois de autenticado. "Só o dono do projeto." */
  autorizacao: string;
  parametrosRota: CampoContrato[];
  parametrosConsulta: CampoContrato[];
  corpoRequisicao: CampoContrato[];
  respostaSucesso: RespostaSucesso;
  erros: ErroHttp[];
  limiteUso: { temLimite: boolean; quanto: string; porque: string };
  /** O que registrar em log quando este endpoint é chamado. Nunca dado sensível. */
  logs: string[];
  /** Cuidados específicos DESTE endpoint. */
  seguranca: string[];
};

export type GrupoApi = {
  nome: string;
  descricao: string;
};

export type MapaApi = {
  grupos: GrupoApi[];
  endpoints: Endpoint[];
  /** Regras que valem para a API inteira: formato de data, paginação, envelope de erro. */
  convencoes: string[];
  /**
   * Como cada conceito aparece NESTE projeto.
   *
   * A definição do conceito é canônica (`conceitos.ts`); isto é a ponte para o caso real da
   * pessoa — "JWT aqui guarda o id do dono do food truck, e é conferido em toda rota de venda".
   */
  conceitosNoProjeto: { conceito: string; comoApareceAqui: string }[];
};

// ---------------------------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------------------------

function texto(v: unknown, minimo: number): string | null {
  return typeof v === "string" && v.trim().length >= minimo ? v.trim() : null;
}

function identificador(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim().toLowerCase() : "";
  return /^[a-z0-9_-]{1,60}$/.test(t) ? t : null;
}

/** Normaliza `/api/users/{id}` e `api/users/:id` para a mesma forma. */
function caminhoLimpo(v: unknown): string | null {
  let t = typeof v === "string" ? v.trim() : "";
  if (!t) return null;
  // Chaves do OpenAPI viram dois-pontos: um formato só no app inteiro evita comparar strings
  // diferentes que significam a mesma rota.
  t = t.replace(/\{([a-zA-Z0-9_]+)\}/g, ":$1");
  if (!t.startsWith("/")) t = `/${t}`;
  return /^[a-zA-Z0-9/:_.-]{2,120}$/.test(t) ? t : null;
}

function validarCampo(v: unknown): CampoContrato | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Partial<CampoContrato>;
  const nome = texto(c.nome, 1);
  if (!nome) return null;

  return {
    nome,
    tipo: TIPOS_CAMPO.includes(c.tipo as TipoCampo) ? (c.tipo as TipoCampo) : "texto",
    obrigatorio: c.obrigatorio === true,
    descricao: texto(c.descricao, 3) ?? "",
    exemplo: texto(c.exemplo, 1) ?? "",
    validacao: texto(c.validacao, 3) ?? "",
    sensivel: c.sensivel === true,
  };
}

function campos(v: unknown): CampoContrato[] {
  return (Array.isArray(v) ? v : [])
    .map(validarCampo)
    .filter((c): c is CampoContrato => c !== null);
}

function statusValido(v: unknown, padrao: number): number {
  return typeof v === "number" && v >= 100 && v <= 599 ? Math.floor(v) : padrao;
}

function validarEndpoint(v: unknown): Endpoint | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Partial<Endpoint>;

  const caminho = caminhoLimpo(e.caminho);
  const finalidade = texto(e.finalidade, 15);
  if (!caminho || !finalidade) return null;

  const metodo = METODOS.includes(e.metodo as MetodoHttp) ? (e.metodo as MetodoHttp) : "GET";

  /**
   * Parâmetros de rota deduzidos do caminho, não só do que a IA declarou.
   *
   * `/api/projetos/:id` sem `id` declarado produziria um `curl` com `:id` literal na URL — um
   * exemplo que não roda. O caminho é a verdade; a declaração só acrescenta descrição.
   */
  const declarados = campos(e.parametrosRota);
  const naRota = [...caminho.matchAll(/:([a-zA-Z0-9_]+)/g)].map((m) => m[1]!);
  const parametrosRota = naRota.map((nome) => {
    const achado = declarados.find((d) => d.nome === nome);
    return (
      achado ?? {
        nome,
        tipo: "uuid" as TipoCampo,
        obrigatorio: true,
        descricao: `O ${nome} do recurso.`,
        exemplo: "00000000-0000-0000-0000-000000000000",
        validacao: "precisa existir",
        sensivel: false,
      }
    );
  });

  const sucesso = e.respostaSucesso;
  // 201 para criação, 204 quando não há corpo, 200 no resto: o padrão certo por método evita o
  // erro mais comum de API caseira, que é devolver 200 para tudo.
  const statusPadrao = metodo === "POST" ? 201 : metodo === "DELETE" ? 204 : 200;

  const erros = (Array.isArray(e.erros) ? e.erros : [])
    .filter((x): x is ErroHttp => Boolean(x) && Boolean(texto(x.quando, 5)))
    .map((x) => ({
      status: statusValido(x.status, 400),
      codigo: identificador(x.codigo) ?? "erro",
      quando: x.quando.trim(),
      mensagem: texto(x.mensagem, 5) ?? "Não foi possível completar a ação.",
    }));

  /**
   * Acrescenta os erros que a forma do endpoint obriga a existir.
   *
   * Medido em 17/09/2026: a IA devolveu exatamente um erro por endpoint. Um endpoint autenticado
   * sem 401 documentado leva quem implementa a esquecer o caso, e é o erro mais comum de API
   * caseira — a rota devolve 500, ou pior, devolve os dados.
   *
   * Isto é dedução, não invenção: se a rota exige token, a resposta para "sem token" existe
   * quer ela esteja documentada ou não. Só o que já foi escrito pela IA é preservado, porque o
   * texto dela é mais específico que o meu.
   */
  const jaTem = (status: number) => erros.some((x) => x.status === status);
  const completos = [...erros];

  if (e.autenticacao !== "nenhuma" && !jaTem(401)) {
    completos.push({
      status: 401,
      codigo: "nao_autenticado",
      quando: "A chamada chegou sem identificação, ou com uma que expirou.",
      mensagem: "Entre na sua conta para continuar.",
    });
  }
  if (parametrosRota.length > 0 && !jaTem(404)) {
    completos.push({
      status: 404,
      codigo: "nao_encontrado",
      quando: "O registro pedido não existe — ou não é de quem chamou.",
      mensagem: "Não encontramos o que você procura.",
    });
  }
  if (e.limiteUso?.temLimite === true && !jaTem(429)) {
    completos.push({
      status: 429,
      codigo: "limite_excedido",
      quando: "Quem chamou passou do teto de chamadas desta rota.",
      mensagem: "Você tentou muitas vezes seguidas. Espere um pouco.",
    });
  }
  const corpo = metodo === "GET" || metodo === "DELETE" ? [] : campos(e.corpoRequisicao);
  if (corpo.some((c) => c.obrigatorio) && !jaTem(400) && !jaTem(422)) {
    completos.push({
      status: 422,
      codigo: "dados_invalidos",
      quando: "Faltou um campo obrigatório, ou algum valor não passou na validação.",
      mensagem: "Confira os campos e tente de novo.",
    });
  }

  return {
    id: identificador(e.id) ?? `${metodo.toLowerCase()}${caminho.replace(/[^a-z0-9]+/gi, "-")}`,
    metodo,
    caminho,
    finalidade,
    grupo: texto(e.grupo, 2) ?? "Geral",
    autenticacao: (["nenhuma", "sessao", "token", "api_key"] as const).includes(e.autenticacao!)
      ? e.autenticacao!
      : "nenhuma",
    autorizacao: texto(e.autorizacao, 5) ?? "",
    parametrosRota,
    parametrosConsulta: campos(e.parametrosConsulta),
    // GET e DELETE não têm corpo. Se a IA inventou um, ele é descartado: um exemplo de `curl`
    // com corpo num GET ensinaria errado.
    corpoRequisicao: corpo,
    respostaSucesso: {
      status: statusValido(sucesso?.status, statusPadrao),
      quando: texto(sucesso?.quando, 5) ?? "A operação deu certo.",
      corpo: campos(sucesso?.corpo),
    },
    erros: completos,
    limiteUso: {
      temLimite: e.limiteUso?.temLimite === true,
      quanto: texto(e.limiteUso?.quanto, 3) ?? "",
      porque: texto(e.limiteUso?.porque, 10) ?? "",
    },
    logs: (Array.isArray(e.logs) ? e.logs : []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 5,
    ),
    seguranca: (Array.isArray(e.seguranca) ? e.seguranca : []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 5,
    ),
  };
}

export function validarMapa(valor: unknown): MapaApi | null {
  if (!valor || typeof valor !== "object") return null;
  const m = valor as Partial<MapaApi>;

  const endpoints = (Array.isArray(m.endpoints) ? m.endpoints : [])
    .map(validarEndpoint)
    .filter((e): e is Endpoint => e !== null);
  if (endpoints.length < 1) return null;

  // Ids repetidos quebram a referência do checklist e as chaves de lista na tela.
  const vistos = new Set<string>();
  const unicos = endpoints.map((e) => {
    let id = e.id;
    let n = 2;
    while (vistos.has(id)) id = `${e.id}-${n++}`;
    vistos.add(id);
    return { ...e, id };
  });

  const declarados = (Array.isArray(m.grupos) ? m.grupos : []).filter(
    (g): g is GrupoApi => Boolean(g) && Boolean(texto(g.nome, 2)),
  );

  /**
   * Grupo citado por endpoint mas não declarado vira grupo mesmo assim.
   *
   * Descartar esconderia o endpoint da tela, que agrupa por aqui. Um grupo sem descrição é pior
   * que nada; um endpoint invisível é pior ainda.
   */
  const nomesDeclarados = new Set(declarados.map((g) => g.nome));
  const faltando = [...new Set(unicos.map((e) => e.grupo))].filter((n) => !nomesDeclarados.has(n));

  return {
    grupos: [
      ...declarados.map((g) => ({ nome: g.nome.trim(), descricao: texto(g.descricao, 5) ?? "" })),
      ...faltando.map((nome) => ({ nome, descricao: "" })),
    ],
    endpoints: unicos,
    convencoes: (Array.isArray(m.convencoes) ? m.convencoes : []).filter(
      (x): x is string => typeof x === "string" && x.trim().length > 10,
    ),
    conceitosNoProjeto: (Array.isArray(m.conceitosNoProjeto) ? m.conceitosNoProjeto : [])
      .filter(
        (x): x is { conceito: string; comoApareceAqui: string } =>
          Boolean(x) && Boolean(texto(x.conceito, 2)) && Boolean(texto(x.comoApareceAqui, 15)),
      )
      .map((x) => ({ conceito: x.conceito.trim(), comoApareceAqui: x.comoApareceAqui.trim() })),
  };
}
