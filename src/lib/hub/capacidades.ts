/**
 * O modelo de capacidades do Integration Hub.
 *
 * ## O que é uma capacidade
 *
 * Uma capacidade é **uma coisa que uma ferramenta pode fazer em nome da pessoa**. Não é um escopo
 * de OAuth, não é um endpoint, e não é um provedor. `WRITE_FILES` significa a mesma coisa vindo do
 * Cursor, do Claude Code ou de um bridge local — e é isso que permite a pessoa decidir uma vez o
 * que autoriza, em vez de reaprender o vocabulário de cada fornecedor.
 *
 * ## Por que o vocabulário é do Pathly, e não do provedor
 *
 * Se a permissão fosse "escopo `repo` do GitHub", a tela teria que ensinar GitHub para autorizar
 * GitHub, GitLab para autorizar GitLab, e a pessoa nunca conseguiria comparar. Traduzir o escopo
 * do fornecedor para uma capacidade do Pathly é trabalho do adaptador — é literalmente a função
 * dele.
 *
 * ## A classe de risco existe para a tela, e para o padrão
 *
 * `leitura` não muda nada do outro lado. `escrita` cria ou altera. `execucao` roda código na
 * máquina ou na conta de alguém. `destrutiva` apaga ou é irreversível.
 *
 * Nenhuma é concedida automaticamente — isso é regra do módulo, não da classe. A classe decide
 * como a capacidade **aparece** e quanto atrito ela merece.
 */

import { DEFINICOES_NIVEL, type Nivel } from "./niveis";

export const CAPACIDADES = [
  // ---- Projeto e contexto -------------------------------------------------------------------
  "READ_PROJECT",
  "WRITE_PROJECT",
  "UPDATE_BLUEPRINT",
  // ---- Arquivos -----------------------------------------------------------------------------
  "READ_FILES",
  "WRITE_FILES",
  "CREATE_FILE",
  "UPDATE_FILE",
  "DELETE_FILE",
  // ---- Execução -----------------------------------------------------------------------------
  "EXECUTE_COMMAND",
  "RUN_TESTS",
  // ---- Git ----------------------------------------------------------------------------------
  "READ_GIT",
  "CREATE_BRANCH",
  "CREATE_COMMIT",
  "PUSH_GIT",
  // ---- Base de conhecimento (vault do Obsidian) ---------------------------------------------
  // Granularidade de pasta, e não de vault, é o ponto: "acesso ao Obsidian" é uma autorização que
  // ninguém consegue avaliar. "Ler a pasta Projects/" é.
  "READ_VAULT",
  "READ_FOLDER",
  "WRITE_FOLDER",
  "CREATE_NOTE",
  "UPDATE_NOTE",
  "DELETE_NOTE",
  "SEARCH_VAULT",
  "EXECUTE_OBSIDIAN_COMMAND",
  // ---- Ponte local --------------------------------------------------------------------------
  // Uma capacidade por ação, e não uma "permissão de Revit": autorizar ler o modelo e autorizar
  // criar elemento nele são decisões de tamanhos muito diferentes.
  "BRIDGE_CONNECT",
  "REVIT_GET_PROJECT",
  "REVIT_READ_MODEL",
  "REVIT_EXPORT",
  "REVIT_CREATE_ELEMENT",
  "REVIT_UPDATE_ELEMENT",
  "VSCODE_OPEN_FILE",
  // ---- Publicação ---------------------------------------------------------------------------
  "DEPLOY_APP",
] as const;

export type Capacidade = (typeof CAPACIDADES)[number];

export type DefinicaoCapacidade = {
  id: Capacidade;
  /**
   * O nível de permissão que esta capacidade consome.
   *
   * É o que liga o catálogo ao portão: a ação declara a capacidade, a capacidade declara o nível,
   * e o nível decide se precisa de aprovação a cada vez, se exige autenticação fresca e se pode
   * virar permissão persistente. Sem esse elo, cada ação teria que repetir a mesma classificação
   * e alguma hora uma delas discordaria.
   */
  nivel: Nivel;
  /** O rótulo que a pessoa lê na tela de permissões. Frase, não jargão. */
  rotulo: string;
  /** O que ela permite, em termos concretos. É o que a pessoa está autorizando. */
  oQuePermite: string;
  /**
   * O que ela **não** permite, quando há confusão previsível.
   *
   * Existe porque metade das autorizações ruins vem de alguém supor que marcar uma coisa não
   * implicava outra. `READ_FILES` não lê `.env`; `CREATE_COMMIT` não empurra. Dizer o limite é
   * tão informativo quanto dizer o alcance.
   */
  naoPermite?: string;
  /**
   * Capacidades que esta exige para fazer sentido.
   *
   * Não são concedidas junto — o Hub recusa a ação e a tela explica o que falta. Conceder em
   * cascata seria a autorização automática que este módulo existe para impedir.
   */
  exige?: readonly Capacidade[];
};

export const DEFINICOES: Record<Capacidade, DefinicaoCapacidade> = {
  READ_PROJECT: {
    id: "READ_PROJECT",
    nivel: "READ",
    rotulo: "Ler o contexto do projeto",
    oQuePermite:
      "Ler o plano, o modelo de dados, o mapa de API e as decisões já tomadas, para trabalhar " +
      "com o seu projeto em vez de um genérico.",
    naoPermite: "Alterar qualquer coisa no plano, nem ler outros projetos seus.",
  },
  WRITE_PROJECT: {
    id: "WRITE_PROJECT",
    nivel: "WRITE",
    rotulo: "Escrever no registro do projeto",
    oQuePermite:
      "Registrar no Pathly o que aconteceu: etapa concluída, erro encontrado, decisão técnica " +
      "tomada, trabalho entregue. É o que uma ferramenta externa precisa para o projeto não " +
      "envelhecer enquanto ela trabalha.",
    naoPermite:
      "Tocar no seu código, no seu repositório ou no seu vault. Isto escreve no registro do " +
      "projeto dentro do Pathly, e em nada fora dele.",
    exige: ["READ_PROJECT"],
  },
  UPDATE_BLUEPRINT: {
    id: "UPDATE_BLUEPRINT",
    // SUGGEST, e nao WRITE: ela cria proposta, e proposta nao muda nada sozinha.
    nivel: "SUGGEST",
    rotulo: "Propor mudanças no plano",
    oQuePermite:
      "Criar propostas de alteração no Blueprint — que continuam passando pela sua aprovação, " +
      "uma a uma, como já acontece com as propostas do Copilot.",
    naoPermite:
      "Escrever no Blueprint direto. Nenhuma integração escreve no plano sem passar pelo mesmo " +
      "portão de aprovação que o Copilot usa.",
    exige: ["READ_PROJECT"],
  },

  READ_FILES: {
    id: "READ_FILES",
    nivel: "READ",
    rotulo: "Ler arquivos do repositório",
    oQuePermite: "Abrir e ler arquivos do projeto conectado.",
    naoPermite:
      "Ler arquivos de segredo (`.env`, chaves, credenciais), que o Hub recusa mesmo com esta " +
      "capacidade concedida.",
  },
  WRITE_FILES: {
    id: "WRITE_FILES",
    nivel: "WRITE",
    rotulo: "Modificar arquivos",
    oQuePermite: "Alterar o conteúdo de arquivos que já existem.",
    naoPermite: "Criar nem apagar arquivos — cada uma dessas é uma autorização própria.",
    exige: ["READ_FILES"],
  },
  CREATE_FILE: {
    id: "CREATE_FILE",
    nivel: "WRITE",
    rotulo: "Criar arquivos",
    oQuePermite: "Criar arquivos novos no projeto.",
    exige: ["READ_FILES"],
  },
  UPDATE_FILE: {
    id: "UPDATE_FILE",
    nivel: "WRITE",
    rotulo: "Atualizar um arquivo específico",
    oQuePermite: "Alterar um arquivo nomeado, sem alcance sobre o resto do repositório.",
    exige: ["READ_FILES"],
  },
  DELETE_FILE: {
    id: "DELETE_FILE",
    nivel: "DELETE",
    rotulo: "Apagar arquivos",
    oQuePermite:
      "Remover arquivos do projeto, inclusive os que você não escreveu e os que não estão " +
      "abertos no editor.",
    naoPermite:
      "Recuperá-los. O que não estiver commitado no git não tem de onde voltar — e o que " +
      "estiver depende de alguém lembrar de procurar.",
    exige: ["READ_FILES"],
  },

  EXECUTE_COMMAND: {
    id: "EXECUTE_COMMAND",
    nivel: "EXECUTE",
    rotulo: "Executar comandos",
    oQuePermite: "Rodar comandos no ambiente conectado.",
    naoPermite:
      "Nada, na prática — é a capacidade mais ampla do catálogo. Quem executa comando arbitrário " +
      "consegue chegar a tudo que o ambiente alcança, inclusive ao que as outras capacidades " +
      "protegem. Conceda sabendo disso.",
  },
  RUN_TESTS: {
    id: "RUN_TESTS",
    nivel: "EXECUTE",
    rotulo: "Rodar os testes",
    oQuePermite: "Executar a suíte de testes do projeto e ler o resultado.",
    naoPermite: "Rodar qualquer outro comando — para isso existe `EXECUTE_COMMAND`.",
  },

  READ_GIT: {
    id: "READ_GIT",
    nivel: "READ",
    rotulo: "Ler o histórico do git",
    oQuePermite: "Ler commits, branches, diferenças e estado da árvore.",
  },
  CREATE_BRANCH: {
    id: "CREATE_BRANCH",
    nivel: "WRITE",
    rotulo: "Criar branches",
    oQuePermite: "Criar uma branch nova a partir do estado atual.",
    exige: ["READ_GIT"],
  },
  CREATE_COMMIT: {
    id: "CREATE_COMMIT",
    nivel: "COMMIT",
    rotulo: "Criar commits",
    oQuePermite: "Registrar alterações num commit local.",
    naoPermite: "Publicar esse commit em lugar nenhum — empurrar é outra autorização.",
    exige: ["READ_GIT"],
  },
  PUSH_GIT: {
    id: "PUSH_GIT",
    nivel: "PUSH",
    rotulo: "Enviar para o repositório remoto",
    oQuePermite: "Publicar commits no remoto, onde outras pessoas e automações os veem.",
    naoPermite:
      "Reescrever histórico publicado — o Hub recusa `--force` independentemente desta " +
      "capacidade, porque desfazer isso não depende só de você.",
    exige: ["READ_GIT", "CREATE_COMMIT"],
  },

  READ_VAULT: {
    id: "READ_VAULT",
    nivel: "READ",
    rotulo: "Ler o vault inteiro",
    oQuePermite:
      "Ler qualquer nota do vault conectado, em qualquer pasta, para usar o que você já escreveu " +
      "como contexto.",
    naoPermite:
      "Escrever nada. E não é o que o Pathly pede por padrão — o padrão é pasta por pasta, " +
      "porque o vault inteiro costuma ter muita coisa que não é sobre o projeto.",
  },
  READ_FOLDER: {
    id: "READ_FOLDER",
    nivel: "READ",
    rotulo: "Ler uma pasta do vault",
    oQuePermite:
      "Ler as notas de uma pasta específica que você escolher, e das subpastas dela. As outras " +
      "pastas continuam invisíveis para o Pathly.",
  },
  WRITE_FOLDER: {
    id: "WRITE_FOLDER",
    nivel: "WRITE",
    rotulo: "Escrever numa pasta do vault",
    oQuePermite:
      "Alterar notas dentro de uma pasta específica — e só dentro dos blocos que o próprio Pathly " +
      "escreveu, delimitados por marcadores na nota.",
    naoPermite:
      "Tocar no que você escreveu à mão. O texto fora dos marcadores do Pathly não é alterado, e " +
      "quando os marcadores somem o Pathly para e pergunta em vez de adivinhar.",
    exige: ["READ_FOLDER"],
  },
  CREATE_NOTE: {
    id: "CREATE_NOTE",
    nivel: "WRITE",
    rotulo: "Criar notas",
    oQuePermite:
      "Criar notas que ainda não existem, dentro das pastas autorizadas — por exemplo uma nota " +
      "por decisão técnica ou por erro encontrado.",
    exige: ["WRITE_FOLDER"],
  },
  UPDATE_NOTE: {
    id: "UPDATE_NOTE",
    nivel: "WRITE",
    rotulo: "Atualizar notas existentes",
    oQuePermite:
      "Reescrever os blocos do Pathly numa nota que já existe, mantendo intacto o resto do texto.",
    naoPermite: "Substituir a nota inteira. Quando só uma seção muda, só ela é reescrita.",
    exige: ["WRITE_FOLDER"],
  },
  DELETE_NOTE: {
    id: "DELETE_NOTE",
    nivel: "DELETE",
    rotulo: "Apagar notas",
    oQuePermite:
      "Remover uma nota do vault, uma por vez e sempre com você confirmando aquela nota " +
      "especificamente.",
    naoPermite:
      "Apagar em lote, e apagar sem você confirmar aquela nota especificamente. Uma autorização " +
      "de apagar nunca vale para a próxima.",
    exige: ["WRITE_FOLDER"],
  },
  SEARCH_VAULT: {
    id: "SEARCH_VAULT",
    nivel: "READ",
    rotulo: "Buscar no vault",
    oQuePermite:
      "Procurar um termo nas pastas autorizadas e receber de volta os trechos que casaram — não " +
      "as notas inteiras.",
    exige: ["READ_FOLDER"],
  },
  EXECUTE_OBSIDIAN_COMMAND: {
    id: "EXECUTE_OBSIDIAN_COMMAND",
    nivel: "EXECUTE",
    rotulo: "Executar comandos do Obsidian",
    oQuePermite:
      "Disparar comandos do próprio Obsidian — abrir o gráfico, rodar um plugin, executar um " +
      "template.",
    naoPermite:
      "Funcionar pelo caminho de pasta. Só o plugin Local REST API expõe comandos, e ele roda em " +
      "127.0.0.1 — fora do alcance do Pathly na nuvem. Declarada aqui porque a permissão existe; " +
      "nenhum mecanismo que o Pathly alcança hoje a atende.",
    exige: ["READ_VAULT"],
  },

  BRIDGE_CONNECT: {
    id: "BRIDGE_CONNECT",
    nivel: "READ",
    rotulo: "Conectar uma ponte local",
    oQuePermite:
      "Registrar um agente rodando na sua máquina e deixá-lo buscar tarefas do Pathly. Sozinha, " +
      "ela não autoriza nenhuma ação: cada tipo de ação tem permissão própria.",
    naoPermite:
      "Executar qualquer coisa. A ponte só aceita ações que ela mesma conhece, e cada uma exige " +
      "a permissão dela.",
  },
  REVIT_GET_PROJECT: {
    id: "REVIT_GET_PROJECT",
    nivel: "READ",
    rotulo: "Ler os dados do projeto no Revit",
    oQuePermite:
      "Ler nome, caminho, unidades e níveis do projeto aberto no Revit — o suficiente para o " +
      "Pathly saber com o que está lidando.",
    exige: ["BRIDGE_CONNECT"],
  },
  REVIT_READ_MODEL: {
    id: "REVIT_READ_MODEL",
    nivel: "READ",
    rotulo: "Ler elementos do modelo",
    oQuePermite:
      "Consultar elementos do modelo por categoria e ler os parâmetros deles, sem alterar nada.",
    exige: ["BRIDGE_CONNECT"],
  },
  REVIT_EXPORT: {
    id: "REVIT_EXPORT",
    nivel: "WRITE",
    rotulo: "Exportar do Revit",
    oQuePermite:
      "Gerar um arquivo a partir do modelo — IFC, DWG, PDF ou planilha — numa pasta que você " +
      "indicar.",
    naoPermite: "Alterar o modelo. Exportar lê o modelo e escreve fora dele.",
    exige: ["BRIDGE_CONNECT", "REVIT_READ_MODEL"],
  },
  REVIT_CREATE_ELEMENT: {
    id: "REVIT_CREATE_ELEMENT",
    nivel: "WRITE",
    rotulo: "Criar elementos no modelo",
    oQuePermite:
      "Acrescentar elementos ao modelo aberto — paredes, portas, ambientes — a partir de uma " +
      "lista que você aprova antes, elemento por elemento.",
    naoPermite:
      "Criar sem você ver antes. Toda criação passa por uma simulação que diz quantos e quais " +
      "elementos entrariam, e nada acontece até você autorizar aquela simulação.",
    exige: ["BRIDGE_CONNECT", "REVIT_READ_MODEL"],
  },
  REVIT_UPDATE_ELEMENT: {
    id: "REVIT_UPDATE_ELEMENT",
    nivel: "WRITE",
    rotulo: "Alterar elementos do modelo",
    oQuePermite:
      "Mudar parâmetros de elementos que já existem no modelo, a partir de uma lista que você " +
      "aprova antes.",
    naoPermite:
      "Apagar elemento, e alterar sem simulação. O que vai mudar é mostrado antes, com o valor " +
      "atual ao lado do novo.",
    exige: ["BRIDGE_CONNECT", "REVIT_READ_MODEL"],
  },
  VSCODE_OPEN_FILE: {
    id: "VSCODE_OPEN_FILE",
    nivel: "READ",
    rotulo: "Abrir um arquivo no editor",
    oQuePermite:
      "Abrir um arquivo do seu projeto no VS Code, numa linha específica — o gesto de levar você " +
      "até onde a etapa acontece.",
    naoPermite: "Ler, escrever ou executar nada. Só abre o editor no lugar certo.",
    exige: ["BRIDGE_CONNECT"],
  },

  DEPLOY_APP: {
    id: "DEPLOY_APP",
    nivel: "DEPLOY",
    rotulo: "Publicar o projeto",
    oQuePermite:
      "Disparar um deploy do projeto conectado, levando o que está lá para quem estiver usando " +
      "o produto naquele momento.",
    naoPermite:
      "Desfazer. Voltar atrás depende do provedor de hospedagem e do que você tiver preparado " +
      "antes — o Pathly não reverte deploy de ninguém.",
    exige: ["READ_PROJECT"],
  },
};

/** As capacidades que faltam para uma ação poder acontecer. Vazio = pode. */
export function faltamPara(pedida: Capacidade, concedidas: readonly Capacidade[]): Capacidade[] {
  const falta: Capacidade[] = [];
  if (!concedidas.includes(pedida)) falta.push(pedida);
  for (const dep of DEFINICOES[pedida].exige ?? []) {
    if (!concedidas.includes(dep)) falta.push(dep);
  }
  return falta;
}

export function nivelDe(c: Capacidade): Nivel {
  return DEFINICOES[c].nivel;
}

/** `true` quando cada ocorrência precisa de aprovação, mesmo com permissão já concedida. */
export function exigeAprovacaoPorAcao(c: Capacidade): boolean {
  return DEFINICOES_NIVEL[DEFINICOES[c].nivel].aprovacaoPorAcao;
}

/** Para a tela agrupar sem inventar categoria própria. */
export function porNivel(cs: readonly Capacidade[]): Partial<Record<Nivel, Capacidade[]>> {
  const fora: Partial<Record<Nivel, Capacidade[]>> = {};
  for (const c of cs) {
    const n = DEFINICOES[c].nivel;
    (fora[n] ??= []).push(c);
  }
  return fora;
}
