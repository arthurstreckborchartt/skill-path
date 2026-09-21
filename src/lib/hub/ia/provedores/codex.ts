import type { AiDevelopmentProvider } from "../contrato";

/**
 * OpenAI Codex.
 *
 * Existe um Codex na nuvem, e foi ele que quase me fez escrever um adapter errado. Ele roda
 * tarefas em container na infraestrutura da OpenAI — mas é ligado à conta ChatGPT de quem usa e
 * dirigido pela interface dela, não por uma API que um terceiro chame em nome da pessoa. O que a
 * OpenAI publica para programar contra o Codex é o **SDK**, e o SDK conversa com o **CLI
 * instalado na máquina**.
 *
 * Ou seja: o Codex na nuvem existe, e mesmo assim o Pathly não o alcança. A distinção entre "a
 * ferramenta roda na nuvem" e "eu consigo chamá-la de fora" é exatamente onde uma integração
 * falsa nasceria.
 */

export const CODEX: AiDevelopmentProvider = {
  id: "codex",
  nome: "OpenAI Codex",
  descricao:
    "O agente de código da OpenAI, no seu terminal ou no seu editor. Lê o repositório, edita " +
    "arquivo e roda comando.",
  capacidades: ["READ_CONTEXT", "GENERATE", "CODE", "EXECUTE", "REVIEW", "PROJECT_CONTEXT", "MCP"],
  entregas: ["arquivo-de-regras", "mcp", "prompt"],
  retorno: "manual",
  local: true,
  mecanismo: {
    como:
      "O Codex SDK roda local e exige o CLI do Codex instalado — é ele que executa, não um " +
      "endpoint remoto. O Codex cloud roda na infraestrutura da OpenAI, mas amarrado à conta " +
      "ChatGPT de quem usa; não há API para um serviço de fora disparar tarefa em nome de " +
      "terceiros. Resta o que funciona: AGENTS.md no repositório, e MCP.",
    verificadoEm: "2026-09-20",
    fonte: "https://learn.chatgpt.com/docs/codex-sdk",
  },
  capacidadesDoHub: [],
  arquivoDeRegras: {
    caminho: "AGENTS.md",
    comoUsar:
      "Fica na raiz do repositório. O Codex lê ao abrir o projeto. É o mesmo arquivo que outras " +
      "ferramentas já adotaram, então escrever um serve a várias.",
  },
  limitacoes: [
    "O Pathly não dispara tarefa no Codex: o SDK executa pelo CLI da sua máquina, e o Codex na nuvem responde à sua conta ChatGPT, não a um serviço de fora.",
    "O resultado de uma tarefa não volta sozinho para o Pathly — você registra o que aconteceu.",
    "Nenhuma permissão do Hub se aplica aqui: quem autoriza cada ação é você, no próprio Codex.",
  ],
};
