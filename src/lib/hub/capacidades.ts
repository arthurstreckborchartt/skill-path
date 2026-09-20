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

export const CAPACIDADES = [
  // ---- Projeto e contexto -------------------------------------------------------------------
  "READ_PROJECT",
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
  // ---- Base de conhecimento -----------------------------------------------------------------
  "READ_OBSIDIAN",
  "WRITE_OBSIDIAN",
  "CREATE_OBSIDIAN_NOTE",
] as const;

export type Capacidade = (typeof CAPACIDADES)[number];

export const CLASSES_DE_RISCO = ["leitura", "escrita", "execucao", "destrutiva"] as const;
export type ClasseDeRisco = (typeof CLASSES_DE_RISCO)[number];

export const ROTULO_CLASSE: Record<ClasseDeRisco, string> = {
  leitura: "Só leitura",
  escrita: "Escreve",
  execucao: "Executa",
  destrutiva: "Destrutiva",
};

export type DefinicaoCapacidade = {
  id: Capacidade;
  classe: ClasseDeRisco;
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
    classe: "leitura",
    rotulo: "Ler o contexto do projeto",
    oQuePermite:
      "Ler o plano, o modelo de dados, o mapa de API e as decisões já tomadas, para trabalhar " +
      "com o seu projeto em vez de um genérico.",
    naoPermite: "Alterar qualquer coisa no plano, nem ler outros projetos seus.",
  },
  UPDATE_BLUEPRINT: {
    id: "UPDATE_BLUEPRINT",
    classe: "escrita",
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
    classe: "leitura",
    rotulo: "Ler arquivos do repositório",
    oQuePermite: "Abrir e ler arquivos do projeto conectado.",
    naoPermite:
      "Ler arquivos de segredo (`.env`, chaves, credenciais), que o Hub recusa mesmo com esta " +
      "capacidade concedida.",
  },
  WRITE_FILES: {
    id: "WRITE_FILES",
    classe: "escrita",
    rotulo: "Modificar arquivos",
    oQuePermite: "Alterar o conteúdo de arquivos que já existem.",
    naoPermite: "Criar nem apagar arquivos — cada uma dessas é uma autorização própria.",
    exige: ["READ_FILES"],
  },
  CREATE_FILE: {
    id: "CREATE_FILE",
    classe: "escrita",
    rotulo: "Criar arquivos",
    oQuePermite: "Criar arquivos novos no projeto.",
    exige: ["READ_FILES"],
  },
  UPDATE_FILE: {
    id: "UPDATE_FILE",
    classe: "escrita",
    rotulo: "Atualizar um arquivo específico",
    oQuePermite: "Alterar um arquivo nomeado, sem alcance sobre o resto do repositório.",
    exige: ["READ_FILES"],
  },
  DELETE_FILE: {
    id: "DELETE_FILE",
    classe: "destrutiva",
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
    classe: "execucao",
    rotulo: "Executar comandos",
    oQuePermite: "Rodar comandos no ambiente conectado.",
    naoPermite:
      "Nada, na prática — é a capacidade mais ampla do catálogo. Quem executa comando arbitrário " +
      "consegue chegar a tudo que o ambiente alcança, inclusive ao que as outras capacidades " +
      "protegem. Conceda sabendo disso.",
  },
  RUN_TESTS: {
    id: "RUN_TESTS",
    classe: "execucao",
    rotulo: "Rodar os testes",
    oQuePermite: "Executar a suíte de testes do projeto e ler o resultado.",
    naoPermite: "Rodar qualquer outro comando — para isso existe `EXECUTE_COMMAND`.",
  },

  READ_GIT: {
    id: "READ_GIT",
    classe: "leitura",
    rotulo: "Ler o histórico do git",
    oQuePermite: "Ler commits, branches, diferenças e estado da árvore.",
  },
  CREATE_BRANCH: {
    id: "CREATE_BRANCH",
    classe: "escrita",
    rotulo: "Criar branches",
    oQuePermite: "Criar uma branch nova a partir do estado atual.",
    exige: ["READ_GIT"],
  },
  CREATE_COMMIT: {
    id: "CREATE_COMMIT",
    classe: "escrita",
    rotulo: "Criar commits",
    oQuePermite: "Registrar alterações num commit local.",
    naoPermite: "Publicar esse commit em lugar nenhum — empurrar é outra autorização.",
    exige: ["READ_GIT"],
  },
  PUSH_GIT: {
    id: "PUSH_GIT",
    classe: "destrutiva",
    rotulo: "Enviar para o repositório remoto",
    oQuePermite: "Publicar commits no remoto, onde outras pessoas e automações os veem.",
    naoPermite:
      "Reescrever histórico publicado — o Hub recusa `--force` independentemente desta " +
      "capacidade, porque desfazer isso não depende só de você.",
    exige: ["READ_GIT", "CREATE_COMMIT"],
  },

  READ_OBSIDIAN: {
    id: "READ_OBSIDIAN",
    classe: "leitura",
    rotulo: "Ler o seu vault",
    oQuePermite: "Ler notas do vault conectado, para usar o que você já escreveu como contexto.",
  },
  WRITE_OBSIDIAN: {
    id: "WRITE_OBSIDIAN",
    classe: "escrita",
    rotulo: "Editar notas do vault",
    oQuePermite:
      "Alterar o conteúdo de notas que já existem no vault, sobrescrevendo o que estava lá.",
    exige: ["READ_OBSIDIAN"],
  },
  CREATE_OBSIDIAN_NOTE: {
    id: "CREATE_OBSIDIAN_NOTE",
    classe: "escrita",
    rotulo: "Criar notas no vault",
    oQuePermite: "Criar notas novas, por exemplo para registrar decisões e evidências.",
    exige: ["READ_OBSIDIAN"],
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

export function ehDestrutiva(c: Capacidade): boolean {
  return DEFINICOES[c].classe === "destrutiva";
}

/** Para a tela agrupar sem inventar categoria própria. */
export function porClasse(cs: readonly Capacidade[]): Record<ClasseDeRisco, Capacidade[]> {
  const fora: Record<ClasseDeRisco, Capacidade[]> = {
    leitura: [],
    escrita: [],
    execucao: [],
    destrutiva: [],
  };
  for (const c of cs) fora[DEFINICOES[c].classe].push(c);
  return fora;
}
