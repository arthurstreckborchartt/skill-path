import type { Capacidade } from "@/lib/hub/capacidades";
import { DEFINICOES } from "@/lib/hub/capacidades";
import type { Nivel } from "@/lib/hub/niveis";

/**
 * O catálogo do MCP Gateway: as ferramentas que o Pathly expõe por Model Context Protocol.
 *
 * ## O que este arquivo é, e o que ele não é
 *
 * É uma **declaração**. Cada ferramenta diz qual capacidade consome, e a capacidade já diz qual
 * nível ela exige — `capacidades.ts` e `niveis.ts` são anteriores a este módulo e continuam
 * sendo a fonte da verdade. Nada aqui inventa permissão nova.
 *
 * Isso importa porque a regra de escalada que você nomeou já está implementada em `cobre()`:
 *
 * - READ concedido, WRITE pedido → `DEGRAU[READ] = 0 < DEGRAU[WRITE] = 2` → recusa.
 * - WRITE concedido, COMMIT pedido → `DEGRAU[COMMIT] = null` → recusa, sem exceção.
 * - COMMIT concedido, PUSH pedido → os dois `null` → recusa.
 *
 * O Gateway não reimplementa isso. Ele consulta, o que é a diferença entre uma regra e duas
 * cópias de uma regra.
 *
 * ## As três famílias, e por que "request" é uma delas
 *
 * `leitura` responde. `escrita` grava **dentro do Pathly**. `solicitacao` não faz nada: cria um
 * pedido e devolve `APPROVAL_REQUIRED`.
 *
 * A terceira existe porque **"request" não significa "execute"**. Uma ferramenta externa pode
 * pedir um commit; o que ela recebe de volta é um id de pedido e a informação de que alguém
 * precisa aprovar. Não há caminho, nesta camada, entre pedir e acontecer — a execução mora em
 * `/api/integracoes/executar`, atrás do portão que já existe.
 *
 * O nome da família está no nome da ferramenta de propósito: `pathly_request_commit` não se
 * confunde com `pathly_commit` na leitura de nenhum agente.
 */

export const FAMILIAS = ["leitura", "escrita", "solicitacao"] as const;
export type Familia = (typeof FAMILIAS)[number];

export type FerramentaDeclarada = {
  nome: string;
  titulo: string;
  descricao: string;
  familia: Familia;
  /** A capacidade consumida. O nível sai dela, nunca daqui. */
  capacidade: Capacidade;
  /**
   * Só para `solicitacao`: o que a frase de confirmação cita como alvo.
   *
   * Sem isto, a tela diria "permitir executar comandos?" sem dizer qual comando — e uma
   * confirmação que não mostra o alvo é uma confirmação que a pessoa aprende a clicar sem ler.
   */
  campoDoAlvo?: string;
};

export const FERRAMENTAS: readonly FerramentaDeclarada[] = [
  // ---- Leitura -------------------------------------------------------------------------------
  {
    nome: "pathly_get_project",
    titulo: "Ler o projeto",
    descricao:
      "Devolve nome, ideia, status, fase atual e progresso do projeto. Use para saber onde o " +
      "trabalho está antes de propor qualquer coisa.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_blueprint",
    titulo: "Ler o blueprint",
    descricao:
      "Devolve o plano do projeto: problema, público, stack, arquitetura, requisitos funcionais " +
      "com critério de aceitação, e o que está fora do escopo.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_current_task",
    titulo: "Ler a etapa atual",
    descricao:
      "Devolve a etapa em que o projeto está: ordem, título, entrega esperada, fase e de quais " +
      "etapas ela depende.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_technical_decisions",
    titulo: "Ler as decisões técnicas",
    descricao:
      "Devolve as decisões ativas, com o valor escolhido e o motivo. As substituídas vêm " +
      "separadas, porque saber o que foi descartado costuma valer tanto quanto o que ficou.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_project_context",
    titulo: "Ler o contexto completo",
    descricao:
      "Devolve o Execution Brief: projeto, etapa, stack, objetivo, arquitetura, decisões, " +
      "restrições, critérios de aceitação e o que já falhou. É a chamada que substitui as outras " +
      "seis quando você vai trabalhar de verdade.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_errors",
    titulo: "Ler os erros conhecidos",
    descricao:
      "Devolve o que já falhou neste projeto, com a origem de cada afirmação — verificado pela " +
      "ferramenta, colado dela, ou relatado pela pessoa. Leia antes de repetir uma tentativa.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },
  {
    nome: "pathly_get_task_history",
    titulo: "Ler o histórico de trabalho",
    descricao:
      "Devolve o que foi feito nas etapas: arquivos alterados, testes executados, decisões e " +
      "observações, do mais recente para o mais antigo.",
    familia: "leitura",
    capacidade: "READ_PROJECT",
  },

  // ---- Escrita, dentro do Pathly ---------------------------------------------------------------
  {
    nome: "pathly_update_task",
    titulo: "Atualizar uma etapa",
    descricao:
      "Marca uma etapa como fazendo, concluída ou pulada. Não toca no seu código — escreve no " +
      "registro do projeto dentro do Pathly.",
    familia: "escrita",
    capacidade: "WRITE_PROJECT",
  },
  {
    nome: "pathly_report_error",
    titulo: "Registrar um erro",
    descricao:
      "Registra algo que falhou. O que for registrado aqui volta no contexto da próxima " +
      "tentativa, para a mesma tentativa não ser repetida.",
    familia: "escrita",
    capacidade: "WRITE_PROJECT",
  },
  {
    nome: "pathly_add_decision",
    titulo: "Registrar uma decisão técnica",
    descricao:
      "Registra uma decisão com o valor escolhido e o motivo. A decisão anterior sobre o mesmo " +
      "assunto vira histórico, em vez de sumir.",
    familia: "escrita",
    capacidade: "WRITE_PROJECT",
  },
  {
    nome: "pathly_report_implementation",
    titulo: "Registrar o que foi implementado",
    descricao:
      "Registra o resultado de um trabalho: o que mudou, quais arquivos, quais testes rodaram e " +
      "o que deu errado.",
    familia: "escrita",
    capacidade: "WRITE_PROJECT",
  },
  {
    nome: "pathly_update_blueprint",
    titulo: "Propor mudança no plano",
    descricao:
      "Propõe uma alteração no blueprint. É proposta, não aplicação: o bloco entra como sugestão " +
      "e a pessoa decide.",
    familia: "escrita",
    capacidade: "UPDATE_BLUEPRINT",
  },

  // ---- Solicitação: pede, não executa ----------------------------------------------------------
  {
    nome: "pathly_request_file_change",
    titulo: "Solicitar alteração de arquivo",
    descricao:
      "Cria um pedido para alterar um arquivo do projeto. NÃO altera nada: devolve " +
      "APPROVAL_REQUIRED e o id do pedido. A alteração só acontece depois de a pessoa aprovar.",
    familia: "solicitacao",
    capacidade: "WRITE_FILES",
    campoDoAlvo: "path",
  },
  {
    nome: "pathly_request_command",
    titulo: "Solicitar execução de comando",
    descricao:
      "Cria um pedido para executar um comando. NÃO executa nada: devolve APPROVAL_REQUIRED e o " +
      "id do pedido.",
    familia: "solicitacao",
    capacidade: "EXECUTE_COMMAND",
    campoDoAlvo: "command",
  },
  {
    nome: "pathly_request_commit",
    titulo: "Solicitar um commit",
    descricao:
      "Cria um pedido de commit. NÃO commita nada: devolve APPROVAL_REQUIRED e o id do pedido. " +
      "Uma aprovação de commit nunca vale para o push.",
    familia: "solicitacao",
    capacidade: "CREATE_COMMIT",
    campoDoAlvo: "message",
  },
  {
    nome: "pathly_request_push",
    titulo: "Solicitar um push",
    descricao:
      "Cria um pedido de push. NÃO empurra nada: devolve APPROVAL_REQUIRED. Push exige " +
      "autenticação recente da pessoa, além da aprovação.",
    familia: "solicitacao",
    capacidade: "PUSH_GIT",
    campoDoAlvo: "branch",
  },
  {
    nome: "pathly_request_deploy",
    titulo: "Solicitar um deploy",
    descricao:
      "Cria um pedido de deploy. NÃO publica nada: devolve APPROVAL_REQUIRED. Deploy alcança " +
      "quem está usando o produto naquele momento, e o Pathly não reverte deploy de ninguém.",
    familia: "solicitacao",
    capacidade: "DEPLOY_APP",
    campoDoAlvo: "environment",
  },
];

export function acharFerramenta(nome: string): FerramentaDeclarada | null {
  return FERRAMENTAS.find((f) => f.nome === nome) ?? null;
}

/** O nível que uma ferramenta exige. Vem da capacidade — este módulo não decide nível. */
export function nivelDaFerramenta(f: FerramentaDeclarada): Nivel {
  return DEFINICOES[f.capacidade].nivel;
}

/**
 * Uma ferramenta de `solicitacao` nunca executa. A propriedade é verificada, não prometida.
 *
 * Existe como função — e não como comentário — porque a bateria a chama: se alguém um dia mover
 * uma ferramenta de `solicitacao` para `escrita` para "simplificar", o teste quebra antes de o
 * Gateway passar a executar um commit sem aprovação.
 */
export function apenasSolicita(f: FerramentaDeclarada): boolean {
  return f.familia === "solicitacao";
}

/** As ferramentas cujo nível é isolado — COMMIT, PUSH, DEPLOY, DELETE. */
export function deNivelIsolado(): FerramentaDeclarada[] {
  return FERRAMENTAS.filter((f) => {
    const n = nivelDaFerramenta(f);
    return n === "COMMIT" || n === "PUSH" || n === "DEPLOY" || n === "DELETE";
  });
}
