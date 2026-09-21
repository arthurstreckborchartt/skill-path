import type { Capacidade } from "../capacidades";

/**
 * `AI_DEVELOPMENT_PROVIDER` — as ferramentas de desenvolvimento com IA.
 *
 * ## A pesquisa que veio antes, e o que ela mudou
 *
 * O pedido era explícito: não inventar API. Então antes de escrever adapter, fui ver o que existe
 * de verdade em cada ferramenta. O resultado decidiu a arquitetura inteira:
 *
 * | Ferramenta | Mecanismo real | O Pathly dirige da nuvem? |
 * |---|---|---|
 * | Claude (API) | REST oficial, API key, `@anthropic-ai/sdk` | **sim** |
 * | Claude Code | CLI local / Claude Agent SDK, harness que quem usa hospeda | não |
 * | Codex | Codex SDK roda **local** e exige o CLI instalado | não |
 * | Cursor | CLI headless na infra de quem usa, `.cursor/rules`, cliente MCP | não |
 *
 * **Três das quatro rodam na máquina da pessoa.** Nuvem nenhuma alcança `localhost`, e fingir
 * que alcança produziria um botão "Executar com Cursor" que não executa nada — o pior tipo de
 * integração, porque a pessoa só descobre depois de confiar.
 *
 * ## O que o Pathly é, então
 *
 * O planejador. Ele monta um **pacote de contexto** com tudo que a ferramenta precisa saber —
 * plano, etapa, decisões, restrições, critérios de aceitação, erros conhecidos — e entrega. Como
 * entrega depende do que a ferramenta aceita, e cada adapter declara isso honestamente em
 * `entrega`.
 *
 * O caminho que funciona nos três é o mesmo que já existe neste repositório: **as três são
 * clientes MCP**, e o Pathly já expõe um servidor MCP em `/mcp`. Prompt é o mínimo garantido;
 * MCP é o melhor que dá para fazer sem um bridge local.
 */

// =============================================================================================
// Capacidades de desenvolvimento
// =============================================================================================

/**
 * O que uma ferramenta de IA sabe fazer.
 *
 * Deliberadamente separadas das `Capacidade` do Hub: aquelas são **o que a pessoa autoriza**
 * (`WRITE_FILES`, `PUSH_GIT`), estas são **o que a ferramenta consegue** (`CODE`, `REVIEW`).
 * Uma ferramenta pode saber revisar código sem nunca ter recebido permissão para ler arquivo.
 */
export const CAPACIDADES_IA = [
  "READ_CONTEXT",
  "GENERATE",
  "CODE",
  "EXECUTE",
  "REVIEW",
  "PROJECT_CONTEXT",
  "MCP",
] as const;

export type CapacidadeIa = (typeof CAPACIDADES_IA)[number];

export const ROTULO_CAPACIDADE_IA: Record<CapacidadeIa, string> = {
  READ_CONTEXT: "Recebe contexto do projeto",
  GENERATE: "Gera texto e planos",
  CODE: "Escreve código",
  EXECUTE: "Executa comandos",
  REVIEW: "Revisa código",
  PROJECT_CONTEXT: "Enxerga o projeto inteiro",
  MCP: "Fala MCP",
};

// =============================================================================================
// Como o contexto chega até a ferramenta
// =============================================================================================

/**
 * As formas de entrega, da mais fraca para a mais forte.
 *
 * `prompt` é o mínimo que sempre funciona: a pessoa copia e cola. `arquivo-de-regras` é melhor,
 * porque a ferramenta lê sozinha a cada sessão. `mcp` é melhor ainda, porque o contexto fica
 * **vivo** — a ferramenta consulta o Pathly em vez de carregar uma cópia que envelhece.
 * `api-direta` é o único em que o Pathly de fato executa algo.
 */
export const ENTREGAS = ["prompt", "arquivo-de-regras", "mcp", "api-direta", "bridge"] as const;
export type Entrega = (typeof ENTREGAS)[number];

export const ROTULO_ENTREGA: Record<Entrega, string> = {
  prompt: "Prompt para colar",
  "arquivo-de-regras": "Arquivo de regras no repositório",
  mcp: "Servidor MCP",
  "api-direta": "API direta",
  bridge: "Ponte local",
};

export const EXPLICACAO_ENTREGA: Record<Entrega, string> = {
  prompt:
    "O Pathly monta o texto e você cola na ferramenta. Funciona sempre, e não depende de nada " +
    "estar instalado nem configurado.",
  "arquivo-de-regras":
    "O Pathly gera um arquivo que a ferramenta lê sozinha ao abrir o projeto. Você coloca no " +
    "repositório uma vez; depois o contexto chega sem você fazer nada.",
  mcp:
    "A ferramenta consulta o Pathly diretamente, quando precisa. É o único jeito de o contexto " +
    "ficar vivo em vez de virar uma cópia que envelhece.",
  "api-direta":
    "O Pathly chama a ferramenta pela API oficial dela e recebe a resposta de volta. É a única " +
    "forma em que ele de fato executa algo.",
  bridge:
    "Um processo rodando na sua máquina, que conversa com o Pathly e alcança a ferramenta local. " +
    "Existe em Configurações → Pontes locais: ela conecta para fora, só aceita ações que já " +
    "conhece, e nada que altere acontece sem você ver antes.",
};

// =============================================================================================
// O que a ferramenta consegue devolver
// =============================================================================================

/**
 * `estruturado` só quando a ferramenta de fato reporta de volta. Hoje, isso significa API direta.
 *
 * Para as demais, o retorno é `manual` — a pessoa diz o que aconteceu. Chamar isso de limitação
 * é honesto; chamar de "integração bidirecional" seria mentira, e é a mentira que este módulo
 * inteiro existe para não contar.
 */
export const RETORNOS = ["estruturado", "manual"] as const;
export type Retorno = (typeof RETORNOS)[number];

// =============================================================================================
// O provedor
// =============================================================================================

export type AiDevelopmentProvider = {
  id: string;
  nome: string;
  /** O que ela é, em uma frase. */
  descricao: string;
  capacidades: readonly CapacidadeIa[];
  /** Como o contexto chega. Ordenado da forma preferida para a de menor esforço. */
  entregas: readonly Entrega[];
  retorno: Retorno;
  /** Roda na máquina da pessoa? Decide se o Pathly consegue alcançar. */
  local: boolean;
  /**
   * O mecanismo real, com a fonte.
   *
   * Existe para que ninguém — inclusive eu daqui a seis meses — precise confiar na memória sobre
   * o que a ferramenta oferecia. Se mudar, a linha muda junto.
   */
  mecanismo: { como: string; verificadoEm: string; fonte: string };
  /**
   * As permissões do Hub que uma ação desta ferramenta pode consumir.
   *
   * Vazio quando o Pathly não executa nada por ela — e aí não há o que autorizar, porque quem
   * age é a pessoa, na máquina dela.
   */
  capacidadesDoHub: readonly Capacidade[];
  /**
   * Onde o arquivo de regras mora, quando a ferramenta lê um. `null` quando ela não lê nenhum.
   *
   * Cada ferramenta escolheu um caminho diferente para a mesma ideia, e não há convergência à
   * vista: `CLAUDE.md`, `AGENTS.md`, `.cursor/rules/`. O Pathly gera o conteúdo uma vez e grava
   * onde cada uma procura.
   */
  arquivoDeRegras: { caminho: string; comoUsar: string } | null;
  /** O que ela NÃO faz pelo Pathly. Aparece na tela, e é a parte mais importante. */
  limitacoes: readonly string[];
};

// =============================================================================================
// Preferências por projeto
// =============================================================================================

export const PAPEIS = ["principal", "secundaria", "documentacao", "git"] as const;
export type Papel = (typeof PAPEIS)[number];

export const ROTULO_PAPEL: Record<Papel, string> = {
  principal: "Ferramenta principal",
  secundaria: "Ferramenta secundária",
  documentacao: "Documentação",
  git: "Git",
};

export const EXPLICACAO_PAPEL: Record<Papel, string> = {
  principal: "Para onde o botão “Executar” manda o contexto por padrão.",
  secundaria: "A alternativa, quando a principal não serve para aquela tarefa.",
  documentacao: "Onde as decisões e evidências são registradas.",
  git: "Onde o código mora.",
};

/** `null` = nenhuma escolhida. O Pathly não escolhe sozinho. */
export type PreferenciasDoProjeto = Record<Papel, string | null>;

export const PREFERENCIAS_VAZIAS: PreferenciasDoProjeto = {
  principal: null,
  secundaria: null,
  documentacao: null,
  git: null,
};
