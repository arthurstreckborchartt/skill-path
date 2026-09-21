import type { AiDevelopmentProvider } from "../contrato";

/**
 * Cursor.
 *
 * O CLI headless existe e é de fato programável — só que ele roda onde você o instalar. "Headless"
 * quer dizer sem interface, não hospedado: o Pathly continua precisando de uma máquina sua para
 * chamar, e essa máquina não existe.
 *
 * Em compensação, o Cursor é a ferramenta que melhor aproveita o caminho que o Pathly de fato
 * tem. `.cursor/rules` aceita vários arquivos com escopo, então o contexto do Pathly entra como
 * uma regra própria, sem disputar espaço com o que você já escreveu.
 */

export const CURSOR: AiDevelopmentProvider = {
  id: "cursor",
  nome: "Cursor",
  descricao:
    "O editor com IA. Lê o repositório inteiro, edita arquivo e roda comando — dentro do editor, " +
    "na sua máquina.",
  capacidades: ["READ_CONTEXT", "GENERATE", "CODE", "EXECUTE", "REVIEW", "PROJECT_CONTEXT", "MCP"],
  entregas: ["arquivo-de-regras", "mcp", "prompt"],
  retorno: "manual",
  local: true,
  mecanismo: {
    como:
      "CLI headless, que roda na infraestrutura de quem usa — sua máquina ou seu CI. Não há " +
      "serviço da Cursor que aceite uma chamada do Pathly para agir no seu projeto. O que chega " +
      "de longe são os arquivos em .cursor/rules e o cliente MCP embutido no editor.",
    verificadoEm: "2026-09-20",
    fonte: "https://cursor.com/docs/cli/headless",
  },
  capacidadesDoHub: [],
  arquivoDeRegras: {
    caminho: ".cursor/rules/pathly.mdc",
    comoUsar:
      "O Cursor lê todos os arquivos de .cursor/rules. Um arquivo só do Pathly não conflita com " +
      "as regras que você já tiver, e dá para apagar sem levar o resto junto.",
  },
  limitacoes: [
    "O Pathly não abre o seu editor nem dispara o CLI: headless significa sem interface, não hospedado na nuvem.",
    "O que o Cursor fez no seu projeto não volta sozinho para o Pathly — você registra o que aconteceu.",
    "Nenhuma permissão do Hub se aplica aqui: quem autoriza cada ação é você, no próprio Cursor.",
  ],
};
