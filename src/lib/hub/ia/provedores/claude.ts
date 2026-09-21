import type { AiDevelopmentProvider } from "../contrato";

/**
 * Claude, em duas formas que não se parecem em nada por dentro.
 *
 * A mesma marca, e mecanismos opostos: a **API** é um endpoint REST que qualquer servidor chama,
 * e o **Claude Code** é um processo na máquina da pessoa. O Pathly alcança o primeiro e não
 * alcança o segundo, e juntá-los numa integração só — "Claude" — faria a tela prometer pelo
 * conjunto o que só metade entrega.
 *
 * Por isso são dois provedores. A pessoa escolhe qual, sabendo o que cada um faz.
 */

export const CLAUDE_API: AiDevelopmentProvider = {
  id: "claude-api",
  nome: "Claude (API)",
  descricao:
    "O modelo pela API oficial da Anthropic. O Pathly manda o contexto e recebe a resposta de " +
    "volta, sem você copiar nada.",
  capacidades: ["READ_CONTEXT", "GENERATE", "CODE", "REVIEW", "MCP"],
  entregas: ["api-direta", "mcp", "prompt"],
  retorno: "estruturado",
  local: false,
  mecanismo: {
    como:
      "REST oficial em POST /v1/messages, autenticada por API key, com o SDK @anthropic-ai/sdk. " +
      "Aceita conector MCP remoto, então o Pathly pode servir contexto vivo em vez de mandar " +
      "uma cópia.",
    verificadoEm: "2026-09-20",
    fonte: "https://docs.claude.com/en/api/messages",
  },
  /*
   * Só leitura. Chamar a API é ler o projeto para montar o pacote e mandar — nada sai do Pathly
   * em direção ao seu repositório, então não há escrita, commit nem deploy para autorizar.
   */
  capacidadesDoHub: ["READ_PROJECT"],
  arquivoDeRegras: null,
  limitacoes: [
    "Não enxerga o seu repositório: só sabe o que o Pathly contar no pacote de contexto.",
    "Não roda comando, não roda teste e não altera arquivo na sua máquina.",
    "A chave da API é sua, e o consumo é cobrado na sua conta da Anthropic.",
  ],
};

export const CLAUDE_CODE: AiDevelopmentProvider = {
  id: "claude-code",
  nome: "Claude Code",
  descricao:
    "O agente que roda no seu terminal, lê o repositório inteiro, edita arquivo e executa " +
    "comando. A ferramenta mais capaz da lista — e a que o Pathly menos controla.",
  capacidades: ["READ_CONTEXT", "GENERATE", "CODE", "EXECUTE", "REVIEW", "PROJECT_CONTEXT", "MCP"],
  entregas: ["mcp", "arquivo-de-regras", "prompt"],
  retorno: "manual",
  local: true,
  mecanismo: {
    como:
      "CLI que roda na sua máquina. O Claude Agent SDK (@anthropic-ai/claude-agent-sdk) é o mesmo " +
      "harness publicado como biblioteca, mas quem hospeda é você: não existe endpoint da " +
      "Anthropic para o Pathly disparar uma sessão sua. O que dá para fazer de longe é ser " +
      "servidor MCP e escrever o CLAUDE.md que ele lê sozinho.",
    verificadoEm: "2026-09-20",
    fonte: "https://docs.claude.com/en/docs/claude-code/sdk",
  },
  capacidadesDoHub: [],
  arquivoDeRegras: {
    caminho: "CLAUDE.md",
    comoUsar:
      "Fica na raiz do repositório. O Claude Code lê no começo de toda sessão, sem você pedir.",
  },
  limitacoes: [
    "O Pathly não inicia, não interrompe e não acompanha uma sessão sua: ele roda na sua máquina, e a nuvem não alcança a sua máquina.",
    "O que aconteceu na sessão só chega ao Pathly se você contar, ou se o Claude Code consultar o Pathly por MCP.",
    "Nenhuma permissão do Hub se aplica aqui: quem autoriza cada ação é você, no próprio Claude Code.",
  ],
};
