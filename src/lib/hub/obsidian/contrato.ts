import type { Capacidade } from "../capacidades";

/**
 * A integração com o Obsidian.
 *
 * ## A pesquisa que veio antes
 *
 * Mesma regra das ferramentas de IA: descobrir o mecanismo real antes de escrever adapter. O
 * Obsidian é um app **local**, e o vault é uma pasta de arquivos `.md` no disco. Não existe API
 * na nuvem — nem do Obsidian Sync, que é serviço pago e fechado.
 *
 * | Mecanismo | Existe? | O Pathly alcança? | O que permite |
 * |---|---|---|---|
 * | **File System Access API** | sim, Chromium | **sim, no navegador da pessoa** | ler, escrever, criar, apagar, buscar |
 * | Local REST API (plugin) | sim, `127.0.0.1:27124`, bearer de 64 hex | não, da nuvem | tudo, mais comandos do Obsidian |
 * | MCP do Obsidian | sim — é o **mesmo plugin**, em `/mcp/` | não, da nuvem | igual ao REST |
 * | `obsidian://` URI | sim, sem instalar nada | parcialmente | criar, abrir, buscar — **não lê de volta** |
 * | API oficial na nuvem | **não existe** | — | — |
 *
 * ## O achado que decidiu a arquitetura
 *
 * O vault é uma pasta, e o Pathly roda num navegador. A **File System Access API** deixa uma
 * página ler e escrever numa pasta que a pessoa escolhe, com o aviso do próprio navegador. Não
 * precisa de plugin, de token, de servidor nem de porta aberta.
 *
 * E ela resolve de graça a exigência mais difícil desta integração: **nada do vault passa pela
 * nuvem do Pathly**. Não é uma política que alguém precisa respeitar — é a arquitetura. O
 * conteúdo é lido no navegador, comparado no navegador e escrito no navegador. O servidor do
 * Pathly não tem como ver, mesmo se quisesse.
 *
 * O preço é honesto e está declarado: **só funciona em Chromium** (Chrome, Edge, Brave, Opera).
 * Firefox e Safari implementam apenas o Origin Private File System e não expõem o seletor de
 * pasta. Nesses navegadores a integração não conecta, e a tela diz isso em vez de falhar no
 * meio.
 *
 * ## A permissão que nenhum mecanismo alcançável atende
 *
 * `EXECUTE_OBSIDIAN_COMMAND` está declarada porque você a nomeou, e ela existe de verdade — mas
 * só pelo Local REST API, que é `127.0.0.1`. Pela pasta não dá: arquivo não executa comando.
 * Está no catálogo marcada como indisponível, e a tela mostra assim. Fingir que dá seria criar
 * um botão que não faz nada.
 *
 * Fontes, verificadas em 2026-09-20:
 * - https://github.com/coddingtonbear/obsidian-local-rest-api
 * - https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
 * - https://obsidian.md/help/Extending+Obsidian/Obsidian+URI
 */

// =============================================================================================
// Mecanismos
// =============================================================================================

export const MECANISMOS = ["pasta", "rest-local", "mcp-local", "uri"] as const;
export type Mecanismo = (typeof MECANISMOS)[number];

export type DefinicaoMecanismo = {
  id: Mecanismo;
  nome: string;
  comoFunciona: string;
  /** O Pathly, rodando no navegador, consegue usar? */
  alcancavel: boolean;
  /** Por que não, quando não. Aparece na tela, inteiro. */
  porqueNao?: string;
  capacidades: readonly Capacidade[];
  fonte: string;
  verificadoEm: string;
};

export const DEFINICOES_MECANISMO: Record<Mecanismo, DefinicaoMecanismo> = {
  pasta: {
    id: "pasta",
    nome: "Pasta do vault, pelo navegador",
    comoFunciona:
      "Você escolhe a pasta do vault numa janela do próprio navegador, e ele pede sua permissão. " +
      "O Pathly passa a ler e escrever os arquivos .md dali — tudo dentro do navegador, sem " +
      "passar pelos servidores dele.",
    alcancavel: true,
    capacidades: [
      "READ_VAULT",
      "READ_FOLDER",
      "WRITE_FOLDER",
      "CREATE_NOTE",
      "UPDATE_NOTE",
      "DELETE_NOTE",
      "SEARCH_VAULT",
    ],
    fonte: "https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker",
    verificadoEm: "2026-09-20",
  },
  "rest-local": {
    id: "rest-local",
    nome: "Local REST API (plugin da comunidade)",
    comoFunciona:
      "Um plugin abre um servidor em 127.0.0.1:27124, protegido por uma chave de 64 caracteres. " +
      "É o mecanismo mais completo: só ele expõe os comandos do próprio Obsidian.",
    alcancavel: false,
    porqueNao:
      "127.0.0.1 é a sua máquina, e o Pathly roda na nuvem — ela não alcança o seu localhost. " +
      "Funcionaria se o Pathly rodasse aí dentro, que é outro produto.",
    capacidades: [
      "READ_VAULT",
      "READ_FOLDER",
      "WRITE_FOLDER",
      "CREATE_NOTE",
      "UPDATE_NOTE",
      "DELETE_NOTE",
      "SEARCH_VAULT",
      "EXECUTE_OBSIDIAN_COMMAND",
    ],
    fonte: "https://github.com/coddingtonbear/obsidian-local-rest-api",
    verificadoEm: "2026-09-20",
  },
  "mcp-local": {
    id: "mcp-local",
    nome: "Servidor MCP do Obsidian",
    comoFunciona:
      "É o mesmo plugin Local REST API, falando MCP em /mcp/. Serve para uma ferramenta de IA " +
      "que rode na sua máquina consultar o vault — não para o Pathly.",
    alcancavel: false,
    porqueNao: "Mesma porta, mesmo 127.0.0.1. Ser MCP não muda onde ele mora.",
    capacidades: [
      "READ_VAULT",
      "READ_FOLDER",
      "SEARCH_VAULT",
      "CREATE_NOTE",
      "UPDATE_NOTE",
      "EXECUTE_OBSIDIAN_COMMAND",
    ],
    fonte: "https://github.com/coddingtonbear/obsidian-local-rest-api",
    verificadoEm: "2026-09-20",
  },
  uri: {
    id: "uri",
    nome: "Link obsidian://",
    comoFunciona:
      "Um link que abre o Obsidian e cria ou abre uma nota. Funciona sem instalar nada, e serve " +
      "de saída de emergência: o Pathly monta o link, você clica, a nota nasce.",
    alcancavel: true,
    porqueNao:
      "Só escreve. O esquema não devolve o conteúdo de nota nenhuma, então não dá para comparar, " +
      "mesclar nem detectar conflito — e é disso que a sincronização inteira depende.",
    capacidades: ["CREATE_NOTE"],
    fonte: "https://obsidian.md/help/Extending+Obsidian/Obsidian+URI",
    verificadoEm: "2026-09-20",
  },
};

/** O mecanismo que o Pathly usa de fato. Os outros existem no catálogo para serem explicados. */
export const MECANISMO_PADRAO: Mecanismo = "pasta";

/**
 * O navegador desta pessoa suporta o mecanismo de pasta?
 *
 * Conferido antes de a tela oferecer o botão. Oferecer e falhar depois do clique é pior que não
 * oferecer, porque a pessoa passa a achar que o problema é o vault dela.
 */
export function suportaPasta(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

// =============================================================================================
// A conexão
// =============================================================================================

/** Os seis passos que você pediu, na ordem em que acontecem. */
export const PASSOS_DA_CONEXAO = [
  "detectar",
  "conferir-mecanismo",
  "autorizar",
  "testar",
  "escolher-vault",
  "escolher-pastas",
] as const;

export type PassoDaConexao = (typeof PASSOS_DA_CONEXAO)[number];

export const ROTULO_PASSO_CONEXAO: Record<PassoDaConexao, string> = {
  detectar: "Detectar o que dá para usar aqui",
  "conferir-mecanismo": "Conferir o mecanismo",
  autorizar: "Autorizar",
  testar: "Testar o acesso",
  "escolher-vault": "Escolher o vault",
  "escolher-pastas": "Escolher as pastas",
};

export const EXPLICACAO_PASSO_CONEXAO: Record<PassoDaConexao, string> = {
  detectar:
    "O Pathly olha o seu navegador e diz qual mecanismo existe aqui. Em Chrome, Edge, Brave e " +
    "Opera, a pasta do vault funciona. Em Firefox e Safari, não há seletor de pasta e a conexão " +
    "não vai adiante.",
  "conferir-mecanismo":
    "O que cada mecanismo permite, e o que não permite. Comandos do Obsidian, por exemplo, só " +
    "existem pelo plugin Local REST API — que roda na sua máquina e o Pathly não alcança.",
  autorizar:
    "Quem pede a permissão é o navegador, não o Pathly, e você escolhe a pasta na janela dele. " +
    "Dá para retirar a permissão a qualquer momento, pelo próprio navegador.",
  testar:
    "O Pathly lê a pasta e confere que ela parece um vault. Se não parecer, ele diz o que " +
    "encontrou em vez de seguir e falhar depois.",
  "escolher-vault":
    "Se você tem mais de um vault, escolhe qual. O Pathly guarda a referência da pasta, não uma " +
    "cópia do conteúdo.",
  "escolher-pastas":
    "Quais pastas o Pathly pode ler e escrever. Nenhuma vem marcada: o vault inteiro só é " +
    "liberado se você liberar, explicitamente.",
};

// =============================================================================================
// O que é sincronizado
// =============================================================================================

/**
 * Os sete tipos de conteúdo que o Pathly leva para o vault.
 *
 * Cada um é ligado ou desligado separadamente. "Sincronizar com o Obsidian" como um interruptor
 * só é a autorização que ninguém consegue avaliar; sete interruptores são sete decisões que dá
 * para tomar.
 */
export const TIPOS_DE_SINCRONIA = [
  "blueprint",
  "decisoes",
  "estado",
  "tarefas",
  "erros",
  "pesquisa",
  "logs",
] as const;

export type TipoDeSincronia = (typeof TIPOS_DE_SINCRONIA)[number];

export const ROTULO_SINCRONIA: Record<TipoDeSincronia, string> = {
  blueprint: "Blueprint",
  decisoes: "Decisões técnicas",
  estado: "Estado do projeto",
  tarefas: "Tarefas",
  erros: "Erros",
  pesquisa: "Pesquisa",
  logs: "Registro de desenvolvimento",
};

/** O que exatamente vai para o vault em cada tipo. A tela mostra antes de ligar. */
export const CONTEUDO_SINCRONIA: Record<TipoDeSincronia, string> = {
  blueprint:
    "O plano do projeto: o problema, o público, a stack, a arquitetura, os requisitos e o que " +
    "está fora do escopo.",
  decisoes:
    "Cada decisão técnica ativa, com o valor escolhido e o motivo. As substituídas viram " +
    "histórico na mesma nota.",
  estado: "Onde o projeto está: fase, etapa atual, quantas etapas concluídas, e o próximo passo.",
  tarefas:
    "As etapas da trilha como caixas de marcar, com a entrega esperada e a fase de cada uma.",
  erros: "O que falhou em cada etapa, e se foi verificado, colado da ferramenta ou relatado.",
  pesquisa:
    "As notas de pesquisa que você criar pelo Pathly. Esta é a única em que o Pathly quase só " +
    "lê — o conteúdo é seu.",
  logs:
    "A linha do tempo de cada sessão de desenvolvimento: passos, arquivos alterados, testes e " +
    "resultado.",
};

// =============================================================================================
// Eventos
// =============================================================================================

export const EVENTOS_OBSIDIAN = [
  "NOTE_CREATED",
  "NOTE_UPDATED",
  "NOTE_DELETED",
  "BLUEPRINT_SYNCED",
  "DECISION_SYNCED",
  "TASK_SYNCED",
] as const;

export type EventoObsidian = (typeof EVENTOS_OBSIDIAN)[number];

export const ROTULO_EVENTO: Record<EventoObsidian, string> = {
  NOTE_CREATED: "Nota criada",
  NOTE_UPDATED: "Nota atualizada",
  NOTE_DELETED: "Nota apagada",
  BLUEPRINT_SYNCED: "Blueprint sincronizado",
  DECISION_SYNCED: "Decisão sincronizada",
  TASK_SYNCED: "Tarefa sincronizada",
};

export type RegistroDeEvento = {
  evento: EventoObsidian;
  caminho: string;
  /** `pathly` quando o Pathly escreveu; `obsidian` quando a mudança veio de fora. */
  origem: "pathly" | "obsidian";
  em: string;
  detalhe?: string;
};

// =============================================================================================
// Direção e conflito
// =============================================================================================

export const DIRECOES = ["pathly-para-obsidian", "obsidian-para-pathly", "bidirecional"] as const;
export type Direcao = (typeof DIRECOES)[number];

export const ROTULO_DIRECAO: Record<Direcao, string> = {
  "pathly-para-obsidian": "Pathly → Obsidian",
  "obsidian-para-pathly": "Obsidian → Pathly",
  bidirecional: "Nos dois sentidos",
};

export const EXPLICACAO_DIRECAO: Record<Direcao, string> = {
  "pathly-para-obsidian":
    "O Pathly escreve no vault e nunca lê de volta para mudar o projeto. O mais previsível, e o " +
    "padrão.",
  "obsidian-para-pathly":
    "O que você escrever no vault volta para o projeto. O Pathly não escreve nada no vault.",
  bidirecional:
    "Os dois. Mais útil e mais sujeito a conflito — quando os dois lados mudam a mesma nota, o " +
    "Pathly para e pergunta em vez de escolher.",
};

/** O que fazer quando a nota mudou dos dois lados. Quem decide é sempre a pessoa. */
export const SAIDAS_DE_CONFLITO = ["comparar", "usar-obsidian", "usar-pathly", "manual"] as const;
export type SaidaDeConflito = (typeof SAIDAS_DE_CONFLITO)[number];

export const ROTULO_CONFLITO: Record<SaidaDeConflito, string> = {
  comparar: "Comparar alterações",
  "usar-obsidian": "Usar Obsidian",
  "usar-pathly": "Usar Pathly",
  manual: "Mesclar manualmente",
};

export const CONSEQUENCIA_CONFLITO: Record<SaidaDeConflito, string> = {
  comparar: "Mostra as duas versões lado a lado. Nada é escrito enquanto você olha.",
  "usar-obsidian":
    "O que está no vault vence. O Pathly desiste desta escrita e passa a considerar a nota como " +
    "está.",
  "usar-pathly": "O Pathly reescreve os blocos dele. O que você escreveu fora deles continua lá.",
  manual:
    "Abre a nota para você editar aqui, com as duas versões à vista. O Pathly grava o que você " +
    "deixar.",
};

// =============================================================================================
// A conexão guardada
// =============================================================================================

export type PastaAutorizada = {
  /** Caminho relativo à raiz do vault: `Projects/NEXOS-Finance`. */
  caminho: string;
  ler: boolean;
  escrever: boolean;
};

export type ConexaoObsidian = {
  mecanismo: Mecanismo;
  /** O nome da pasta raiz escolhida. Não é caminho absoluto — o navegador não entrega isso. */
  vault: string;
  pastas: PastaAutorizada[];
  tipos: Record<TipoDeSincronia, boolean>;
  direcao: Direcao;
  /** **Desligada por padrão.** Ver `sincronizacao.ts`. */
  automatica: boolean;
  conectadoEm: string;
};

/** Uma conexão nova: tudo desligado, nenhuma pasta liberada. O padrão nunca concede. */
export function conexaoVazia(
  vault: string,
  mecanismo: Mecanismo = MECANISMO_PADRAO,
): ConexaoObsidian {
  return {
    mecanismo,
    vault,
    pastas: [],
    tipos: {
      blueprint: false,
      decisoes: false,
      estado: false,
      tarefas: false,
      erros: false,
      pesquisa: false,
      logs: false,
    },
    direcao: "pathly-para-obsidian",
    automatica: false,
    conectadoEm: new Date().toISOString(),
  };
}

/** A pasta autorizada que cobre este caminho, se houver. Subpasta herda da pasta acima. */
export function pastaQueCobre(
  caminho: string,
  pastas: readonly PastaAutorizada[],
): PastaAutorizada | null {
  const candidatas = pastas.filter(
    (p) => caminho === p.caminho || caminho.startsWith(`${p.caminho}/`),
  );
  /* A mais específica ganha: `Projects/X` sobrepõe `Projects` quando as duas estão na lista. */
  return candidatas.sort((a, b) => b.caminho.length - a.caminho.length)[0] ?? null;
}

export function podeLer(caminho: string, c: ConexaoObsidian): boolean {
  return pastaQueCobre(caminho, c.pastas)?.ler ?? false;
}

export function podeEscrever(caminho: string, c: ConexaoObsidian): boolean {
  const p = pastaQueCobre(caminho, c.pastas);
  /* Escrever sem poder ler seria escrever às cegas — e é assim que se apaga o que não se viu. */
  return Boolean(p?.escrever && p.ler);
}
