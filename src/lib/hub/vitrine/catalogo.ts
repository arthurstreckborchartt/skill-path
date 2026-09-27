import type { Capacidade } from "../capacidades";

/**
 * A vitrine: todas as integrações do Pathly, numa lista só.
 *
 * ## Por que este arquivo existe
 *
 * O Hub cresceu em cinco camadas — ferramentas de IA, Obsidian, MCP, pontes locais, ações
 * externas — e cada uma ganhou a tela dela. Funciona, e parece cinco produtos.
 *
 * Aqui elas viram uma coisa. Mesmo cartão, mesmo vocabulário de estado, mesma frase sobre como a
 * conexão funciona. A pessoa não precisa saber que o Obsidian usa File System Access e o Cursor
 * usa arquivo de regras: precisa saber o que cada um faz, se está conectado, e o que pode
 * acontecer.
 *
 * ## O que a vitrine não faz
 *
 * Não executa, não conecta, não guarda credencial. Ela **descreve**. Cada integração continua
 * morando no módulo dela, com a lógica dela; este arquivo só sabe apresentá-las lado a lado.
 *
 * É o que impede a vitrine de virar um sexto lugar onde a verdade sobre permissão mora.
 */

// =============================================================================================
// Categorias
// =============================================================================================

export const CATEGORIAS = ["desenvolvimento", "conhecimento", "engenharia", "local"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  desenvolvimento: "Desenvolvimento",
  conhecimento: "Conhecimento",
  engenharia: "Design e engenharia",
  local: "Na sua máquina",
};

export const EXPLICACAO_CATEGORIA: Record<Categoria, string> = {
  desenvolvimento: "Quem escreve o código do seu projeto, e onde ele fica guardado.",
  conhecimento: "Onde o que você aprendeu no caminho é registrado.",
  engenharia: "Ferramentas de projeto e modelagem, pela ponte local.",
  local: "O programa que roda no seu computador e liga o Pathly ao que está instalado nele.",
};

// =============================================================================================
// Como a conexão funciona
// =============================================================================================

/**
 * O método de conexão, e a frase que o explica.
 *
 * ## A regra que você pediu, e por que ela importa
 *
 * Nunca "conectar sua conta" sem dizer o que isso significa. Quem autoriza sem entender o
 * mecanismo não está autorizando — está clicando. E é justamente com integração que a diferença
 * custa caro: o token fica, a permissão fica, e a pessoa não lembra o que deu.
 *
 * Cada frase aqui responde três coisas: o que sai daqui, onde a credencial fica, e o que você
 * precisa ter instalado.
 */
export const METODOS = ["oauth", "api-key", "pasta", "bridge", "mcp", "arquivo", "nenhum"] as const;
export type Metodo = (typeof METODOS)[number];

export const ROTULO_METODO: Record<Metodo, string> = {
  oauth: "OAuth",
  "api-key": "Chave de API",
  pasta: "Pasta do seu computador",
  bridge: "Pathly Bridge",
  mcp: "MCP",
  arquivo: "Arquivo no repositório",
  nenhum: "Sem conexão",
};

export const COMO_FUNCIONA: Record<Metodo, string> = {
  oauth:
    "Essa integração usa OAuth. Você autoriza no site do serviço e volta para cá — o Pathly nunca " +
    "vê sua senha, e recebe um token que você pode revogar lá ou aqui, a qualquer momento.",
  "api-key":
    "Essa integração utiliza uma chave de API que você cria no serviço e cola aqui. Ela é testada " +
    "antes de ser guardada, fica cifrada, e o Pathly não a mostra de volta depois — se você " +
    "perder, o caminho é gerar outra.",
  pasta:
    "Essa integração usa uma pasta do seu computador, escolhida por você numa janela do próprio " +
    "navegador. O conteúdo é lido e escrito aqui dentro e não passa pelos servidores do Pathly. " +
    "Só funciona em Chrome, Edge, Brave e Opera.",
  bridge:
    "Essa integração precisa do Pathly Bridge instalado no computador. Ele roda na sua máquina, " +
    "conecta para fora, e só aceita ações que já conhece — nunca comandos vindos do servidor.",
  mcp:
    "Essa integração usa MCP. A ferramenta consulta o Pathly quando precisa, em vez de carregar " +
    "uma cópia do contexto que envelhece. Quem inicia a conversa é ela.",
  arquivo:
    "Essa integração funciona por um arquivo de regras no seu repositório. O Pathly gera o " +
    "conteúdo, você coloca o arquivo uma vez, e a ferramenta passa a ler sozinha ao abrir o " +
    "projeto. Não há credencial nem conexão.",
  nenhum: "Essa integração não precisa de conexão: ela já funciona com o que o Pathly tem.",
};

/** O que a pessoa precisa ter antes de tentar. `null` quando não precisa de nada. */
export const PRE_REQUISITO: Record<Metodo, string | null> = {
  oauth: null,
  "api-key": "Uma conta no serviço, com permissão para criar chave de API.",
  pasta: "Um navegador Chromium: Chrome, Edge, Brave ou Opera.",
  bridge: "O Pathly Bridge rodando na máquina onde a ferramenta está.",
  mcp: "Um cliente MCP — Claude Desktop, Cursor ou Codex sabem fazer isso sozinhos.",
  arquivo: "Acesso ao repositório do projeto, para colocar o arquivo.",
  nenhum: null,
};

// =============================================================================================
// Estados
// =============================================================================================

/**
 * O vocabulário de estado, compartilhado por todas as integrações.
 *
 * Sem ele, cada tela inventaria o próprio "conectado". Com ele, o ponto verde significa a mesma
 * coisa no Obsidian e no Revit — e quando é amarelo, a pessoa já aprendeu o que fazer.
 *
 * Os estados de falha são a parte que quase todo produto trata como detalhe: token vencido, OAuth
 * cancelado, ferramenta fechada, conflito de sincronização. Eles são a maior parte do tempo de
 * uso de uma integração madura, e cada um precisa dizer o próximo passo.
 */
export const ESTADOS = [
  "carregando",
  "nao-conectada",
  "conectada",
  "offline",
  "nao-instalada",
  "token-expirado",
  "permissao-expirada",
  "oauth-cancelado",
  "mcp-indisponivel",
  "conflito",
  "sem-suporte",
  "revogada",
  "erro",
] as const;

export type Estado = (typeof ESTADOS)[number];

export type Tom = "neutro" | "bom" | "atencao" | "ruim";

export const TOM_DO_ESTADO: Record<Estado, Tom> = {
  carregando: "neutro",
  "nao-conectada": "neutro",
  conectada: "bom",
  offline: "atencao",
  "nao-instalada": "atencao",
  "token-expirado": "atencao",
  "permissao-expirada": "atencao",
  "oauth-cancelado": "neutro",
  "mcp-indisponivel": "atencao",
  conflito: "atencao",
  "sem-suporte": "ruim",
  revogada: "neutro",
  erro: "ruim",
};

export const ROTULO_ESTADO: Record<Estado, string> = {
  carregando: "Verificando",
  "nao-conectada": "Não conectada",
  conectada: "Conectada",
  offline: "Offline",
  "nao-instalada": "Não instalada",
  "token-expirado": "Token vencido",
  "permissao-expirada": "Permissão vencida",
  "oauth-cancelado": "Autorização cancelada",
  "mcp-indisponivel": "MCP fora do ar",
  conflito: "Conflito para resolver",
  "sem-suporte": "Não dá neste navegador",
  revogada: "Revogada",
  erro: "Com erro",
};

/**
 * O que aconteceu, e o que fazer. Sempre as duas coisas.
 *
 * Um estado que só diz o problema deixa a pessoa parada. "Token vencido" sem "reconecte" é a
 * mesma informação que um ponto amarelo — e o ponto amarelo já estava lá.
 */
export const EXPLICACAO_ESTADO: Record<Estado, string> = {
  carregando: "Conferindo o estado desta integração.",
  "nao-conectada": "Ainda não há nada conectado aqui. Nenhuma permissão foi concedida.",
  conectada: "Funcionando. As permissões que você concedeu continuam valendo.",
  offline:
    "A conexão existe, mas não está respondendo agora. Se for uma ponte, confira se o programa " +
    "está aberto na sua máquina.",
  "nao-instalada":
    "A ferramenta não foi encontrada neste computador, ou não está aberta. A conexão continua " +
    "válida — é só o programa que não está lá.",
  "token-expirado":
    "O token venceu ou foi revogado no serviço. Reconecte: nenhuma permissão que você concedeu " +
    "aqui é perdida.",
  "permissao-expirada":
    "As permissões desta integração venceram. Ela continua conectada, mas não consegue fazer " +
    "nada até você autorizar de novo.",
  "oauth-cancelado":
    "Você fechou a autorização antes de terminar, e nada foi conectado. Dá para começar de novo " +
    "quando quiser.",
  "mcp-indisponivel":
    "O servidor MCP não respondeu. A ferramenta continua funcionando pelos outros caminhos — o " +
    "que se perde é o contexto vivo.",
  conflito:
    "Há mudanças dos dois lados esperando decisão. Nada é escrito enquanto você não escolher.",
  "sem-suporte":
    "Este navegador não tem o recurso que esta integração precisa. Abra o Pathly no Chrome, " +
    "Edge, Brave ou Opera.",
  revogada: "Você revogou esta integração. Ela não faz mais nada até ser conectada de novo.",
  erro: "Algo falhou ao conferir esta integração. Tentar de novo costuma resolver.",
};

/** O botão que resolve o estado. `null` quando não há o que fazer — e aí a tela não inventa um. */
export const ACAO_DO_ESTADO: Record<Estado, string | null> = {
  carregando: null,
  "nao-conectada": "Conectar",
  conectada: "Gerenciar",
  offline: "Tentar de novo",
  "nao-instalada": "Como instalar",
  "token-expirado": "Reconectar",
  "permissao-expirada": "Revisar permissões",
  "oauth-cancelado": "Conectar",
  "mcp-indisponivel": "Tentar de novo",
  conflito: "Resolver",
  "sem-suporte": null,
  revogada: "Conectar de novo",
  erro: "Tentar de novo",
};

/** Estados em que a integração consegue trabalhar. Só um: o resto é atrito a resolver. */
export function estaUtil(e: Estado): boolean {
  return e === "conectada";
}

/** Estados que pedem atenção da pessoa — o que o Security Center conta. */
export function pedeAtencao(e: Estado): boolean {
  return TOM_DO_ESTADO[e] === "atencao" || TOM_DO_ESTADO[e] === "ruim";
}

// =============================================================================================
// As integrações
// =============================================================================================

export type IntegracaoDaVitrine = {
  id: string;
  nome: string;
  /** Uma linha, abaixo do nome no cartão. O que ela é, não o que ela usa. */
  subtitulo: string;
  categoria: Categoria;
  metodo: Metodo;
  /** Os nomes curtos das capacidades, para os chips do cartão. Não são permissões. */
  capacidades: readonly string[];
  /** As capacidades do Hub que ela consome, quando consome. */
  capacidadesDoHub: readonly Capacidade[];
  /**
   * Para onde “Gerenciar” leva.
   *
   * União fechada, e não `string`, porque o `Link` do router confere a rota em tempo de
   * compilação. Com `string` ele aceitaria qualquer coisa e o erro só apareceria no clique.
   */
  rota: "/app/ferramentas" | "/app/pontes" | "/app/integracoes" | "/app/obsidian";
  /** `false` quando a integração está declarada mas ainda não funciona. A tela diz. */
  disponivel: boolean;
  /** O que falta, quando não está disponível. Aparece inteiro. */
  oQueFalta?: string;
};

export const INTEGRACOES: readonly IntegracaoDaVitrine[] = [
  // ---- Desenvolvimento -------------------------------------------------------------------------
  {
    id: "claude-api",
    nome: "Claude",
    subtitulo: "IA de desenvolvimento",
    categoria: "desenvolvimento",
    metodo: "api-key",
    capacidades: ["Contexto", "Geração", "Código", "MCP"],
    capacidadesDoHub: ["READ_PROJECT"],
    rota: "/app/ferramentas",
    disponivel: true,
  },
  {
    id: "claude-code",
    nome: "Claude Code",
    subtitulo: "Agente no seu terminal",
    categoria: "desenvolvimento",
    metodo: "arquivo",
    capacidades: ["Contexto", "Código", "Comandos", "MCP"],
    capacidadesDoHub: [],
    rota: "/app/ferramentas",
    disponivel: true,
  },
  {
    id: "codex",
    nome: "Codex",
    subtitulo: "Agente de código da OpenAI",
    categoria: "desenvolvimento",
    metodo: "arquivo",
    capacidades: ["Contexto", "Código", "Comandos"],
    capacidadesDoHub: [],
    rota: "/app/ferramentas",
    disponivel: true,
  },
  {
    id: "cursor",
    nome: "Cursor",
    subtitulo: "Editor com IA",
    categoria: "desenvolvimento",
    metodo: "arquivo",
    capacidades: ["Contexto", "Código", "MCP"],
    capacidadesDoHub: [],
    rota: "/app/ferramentas",
    disponivel: true,
  },
  {
    id: "vscode",
    nome: "VS Code",
    subtitulo: "Seu editor, pela ponte",
    categoria: "desenvolvimento",
    metodo: "bridge",
    capacidades: ["Abrir arquivo"],
    capacidadesDoHub: ["VSCODE_OPEN_FILE"],
    rota: "/app/pontes",
    disponivel: true,
  },
  {
    id: "github",
    nome: "GitHub",
    subtitulo: "Onde o código mora",
    categoria: "desenvolvimento",
    metodo: "oauth",
    capacidades: ["Repositórios", "Leitura"],
    capacidadesDoHub: ["READ_GIT"],
    rota: "/app/integracoes",
    disponivel: true,
  },
  {
    id: "gitlab",
    nome: "GitLab",
    subtitulo: "Onde o código mora",
    categoria: "desenvolvimento",
    metodo: "oauth",
    capacidades: ["Repositórios", "Leitura"],
    capacidadesDoHub: ["READ_GIT"],
    rota: "/app/integracoes",
    disponivel: false,
    oQueFalta:
      "Falta registrar o aplicativo OAuth do Pathly no GitLab. O caminho é o mesmo do GitHub, que " +
      "já funciona — é trabalho de configuração, não de código.",
  },

  // ---- Conhecimento ----------------------------------------------------------------------------
  {
    id: "obsidian",
    nome: "Obsidian",
    subtitulo: "Seu vault de anotações",
    categoria: "conhecimento",
    metodo: "pasta",
    capacidades: ["Ler", "Escrever", "Buscar", "Sincronizar"],
    capacidadesDoHub: ["READ_FOLDER", "WRITE_FOLDER", "CREATE_NOTE", "UPDATE_NOTE", "SEARCH_VAULT"],
    rota: "/app/obsidian",
    disponivel: true,
  },

  // ---- Design e engenharia ---------------------------------------------------------------------
  {
    id: "revit",
    nome: "Revit",
    subtitulo: "Modelagem BIM, pela ponte",
    categoria: "engenharia",
    metodo: "bridge",
    capacidades: ["Ler modelo", "Exportar", "Criar", "Alterar"],
    capacidadesDoHub: [
      "REVIT_GET_PROJECT",
      "REVIT_READ_MODEL",
      "REVIT_EXPORT",
      "REVIT_CREATE_ELEMENT",
      "REVIT_UPDATE_ELEMENT",
    ],
    rota: "/app/pontes",
    disponivel: false,
    oQueFalta:
      "Falta um add-in do Revit, em C#. A API dele só existe dentro do processo do próprio Revit — " +
      "não há caminho por HTTP de fora, e automação por navegador seria fingimento. O lado do " +
      "Pathly está pronto e esperando.",
  },

  // ---- Local ------------------------------------------------------------------------------------
  {
    id: "ponte",
    nome: "Pathly Bridge",
    subtitulo: "O elo com o seu computador",
    categoria: "local",
    metodo: "bridge",
    capacidades: ["Conectar", "Simular", "Executar"],
    capacidadesDoHub: ["BRIDGE_CONNECT"],
    rota: "/app/pontes",
    disponivel: true,
  },
];

export function acharIntegracao(id: string): IntegracaoDaVitrine | null {
  return INTEGRACOES.find((i) => i.id === id) ?? null;
}

export function porCategoria(c: Categoria): IntegracaoDaVitrine[] {
  return INTEGRACOES.filter((i) => i.categoria === c);
}

/**
 * A busca de "Adicionar integração".
 *
 * Procura no nome, no subtítulo, na categoria e nas capacidades — porque quem procura "git" quer
 * achar GitHub, e quem procura "anotação" quer achar Obsidian sem saber o nome do produto.
 */
export function buscar(termo: string): IntegracaoDaVitrine[] {
  const t = termo.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!t) return [...INTEGRACOES];

  const casa = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t);

  return INTEGRACOES.filter(
    (i) =>
      casa(i.nome) ||
      casa(i.subtitulo) ||
      casa(ROTULO_CATEGORIA[i.categoria]) ||
      casa(ROTULO_METODO[i.metodo]) ||
      i.capacidades.some(casa),
  );
}

/**
 * As abas da tela de uma integração.
 *
 * `revogar` fica por último e separada das outras no visual — é a única irreversível, e uma aba
 * de revogar no meio das outras é clicada por engano.
 */
export const ABAS = [
  "visao-geral",
  "permissoes",
  "projetos",
  "historico",
  "configuracao",
  "revogar",
] as const;

export type Aba = (typeof ABAS)[number];

export const ROTULO_ABA: Record<Aba, string> = {
  "visao-geral": "Visão geral",
  permissoes: "Permissões",
  projetos: "Projetos conectados",
  historico: "Histórico",
  configuracao: "Configuração",
  revogar: "Revogar",
};
