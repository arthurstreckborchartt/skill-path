import type { Capacidade } from "../capacidades";

/**
 * O catálogo de ações da ponte.
 *
 * ## Este arquivo é a defesa principal
 *
 * A ponte carrega uma cópia dele, compilada dentro dela. Quando chega uma tarefa, ela procura o
 * `acaoId` **aqui** — não no que o servidor mandou. Id que não está nesta lista é recusado com
 * `ACAO_DESCONHECIDA`, e não há mensagem do servidor capaz de acrescentar uma linha.
 *
 * É por isso que não existe uma ação `executar_comando`, nem um parâmetro `args`, nem um campo
 * livre em lugar nenhum. Uma ação assim transformaria todo o resto em teatro: bastaria ela para
 * fazer qualquer coisa, e as outras vinte viram decoração.
 *
 * ## Como uma ferramenta nova entra
 *
 * Uma linha por ação, com a capacidade dela e o schema dos parâmetros. Blender, SketchUp,
 * AutoCAD, SolidWorks entram do mesmo jeito que o Revit entrou — o protocolo, a simulação e a
 * auditoria não mudam. Muda o adaptador que roda do lado de lá.
 */

// =============================================================================================
// Tipos de parâmetro
// =============================================================================================

/**
 * O schema é deliberadamente pobre: texto, número, booleano, lista de texto e enum.
 *
 * Não há objeto aninhado nem `any`, e isso é uma escolha de segurança, não de preguiça. Cada
 * parâmetro precisa ser conferível por uma função de dez linhas que roda na ponte, sem
 * dependência — porque validação com dependência é validação que alguém atualiza e quebra.
 */
export type TipoDeParametro = "texto" | "numero" | "booleano" | "lista-de-texto" | "escolha";

export type Parametro = {
  nome: string;
  tipo: TipoDeParametro;
  obrigatorio: boolean;
  descricao: string;
  /** Só para `escolha`. */
  opcoes?: readonly string[];
  /** Só para `texto`: comprimento máximo. Todo texto tem um, para nada chegar ilimitado. */
  maximo?: number;
  /**
   * Só para `texto`: o formato exigido.
   *
   * `caminho` é o mais importante: ele recusa `..`, o que impede a pessoa mais bem-intencionada
   * de mandar uma exportação para fora da pasta que autorizou.
   */
  formato?: "caminho" | "identificador" | "livre";
};

export type AcaoDaPonte = {
  id: string;
  /** O adaptador que a executa: `revit`, `vscode`. A ponte precisa ter este adaptador. */
  adaptador: string;
  titulo: string;
  descricao: string;
  capacidade: Capacidade;
  /**
   * Altera alguma coisa fora do Pathly?
   *
   * `true` obriga simulação antes. É o campo que liga o sistema de simulação — e é por isso que
   * ele mora no catálogo, e não numa lista separada que alguém esqueceria de atualizar.
   */
  altera: boolean;
  parametros: readonly Parametro[];
};

// =============================================================================================
// Revit
// =============================================================================================

/**
 * ## O que é e o que não é
 *
 * Isto é um **contrato**, não uma automação. O Revit não tem API acessível de fora do processo
 * dele: a Autodesk expõe a API .NET para add-ins que rodam **dentro** do Revit, e nada de HTTP.
 *
 * Então o adaptador daqui é a metade que cabe ao Pathly — o catálogo, a validação, a simulação e
 * a auditoria. A outra metade é um add-in em C# que hospeda um pequeno servidor local e fala com
 * a ponte. Esse add-in **não existe ainda**, e a ponte devolve `ADAPTADOR_AUSENTE` até ele
 * existir.
 *
 * O que eu não fiz, e é o que você pediu para eu não fazer: fingir automação pelo navegador.
 * Não há como um `.html` mexer num modelo do Revit, e simular isso com envio de teclas ou captura
 * de tela produziria algo que funciona na demonstração e destrói o arquivo de alguém na segunda
 * semana.
 */
const REVIT: AcaoDaPonte[] = [
  {
    id: "REVIT_GET_PROJECT",
    adaptador: "revit",
    titulo: "Dados do projeto",
    descricao: "Nome, caminho, unidades e níveis do projeto aberto.",
    capacidade: "REVIT_GET_PROJECT",
    altera: false,
    parametros: [],
  },
  {
    id: "REVIT_READ_MODEL",
    adaptador: "revit",
    titulo: "Ler elementos",
    descricao: "Lista elementos de uma categoria e os parâmetros deles.",
    capacidade: "REVIT_READ_MODEL",
    altera: false,
    parametros: [
      {
        nome: "categoria",
        tipo: "texto",
        obrigatorio: true,
        descricao: "A categoria do Revit, ex. OST_Walls.",
        formato: "identificador",
        maximo: 60,
      },
      {
        nome: "limite",
        tipo: "numero",
        obrigatorio: false,
        descricao: "Quantos elementos no máximo. Padrão 200.",
      },
    ],
  },
  {
    id: "REVIT_EXPORT",
    adaptador: "revit",
    titulo: "Exportar",
    descricao: "Gera IFC, DWG, PDF ou planilha a partir do modelo.",
    capacidade: "REVIT_EXPORT",
    /* Escreve arquivo no disco. Não muda o modelo, e ainda assim passa por simulação: a pessoa
     * precisa ver onde o arquivo vai cair antes de ele cair lá. */
    altera: true,
    parametros: [
      {
        nome: "formato",
        tipo: "escolha",
        obrigatorio: true,
        descricao: "O formato de saída.",
        opcoes: ["ifc", "dwg", "pdf", "xlsx"],
      },
      {
        nome: "pasta",
        tipo: "texto",
        obrigatorio: true,
        descricao: "A pasta de destino, dentro do que você autorizou.",
        formato: "caminho",
        maximo: 300,
      },
      {
        nome: "vistas",
        tipo: "lista-de-texto",
        obrigatorio: false,
        descricao: "Os nomes das vistas a exportar. Vazio exporta o modelo inteiro.",
      },
    ],
  },
  {
    id: "REVIT_CREATE_ELEMENT",
    adaptador: "revit",
    titulo: "Criar elementos",
    descricao: "Acrescenta elementos ao modelo, a partir de uma lista aprovada.",
    capacidade: "REVIT_CREATE_ELEMENT",
    altera: true,
    parametros: [
      {
        nome: "categoria",
        tipo: "texto",
        obrigatorio: true,
        descricao: "A categoria dos elementos a criar.",
        formato: "identificador",
        maximo: 60,
      },
      {
        nome: "nivel",
        tipo: "texto",
        obrigatorio: true,
        descricao: "O nível do projeto onde eles entram.",
        maximo: 80,
      },
      {
        nome: "itens",
        tipo: "lista-de-texto",
        obrigatorio: true,
        descricao: "Um item por elemento, na notação que o add-in entende.",
      },
    ],
  },
  {
    id: "REVIT_UPDATE_ELEMENT",
    adaptador: "revit",
    titulo: "Alterar elementos",
    descricao: "Muda parâmetros de elementos existentes, a partir de uma lista aprovada.",
    capacidade: "REVIT_UPDATE_ELEMENT",
    altera: true,
    parametros: [
      {
        nome: "ids",
        tipo: "lista-de-texto",
        obrigatorio: true,
        descricao: "Os ids dos elementos a alterar.",
      },
      {
        nome: "parametro",
        tipo: "texto",
        obrigatorio: true,
        descricao: "O nome do parâmetro a mudar.",
        maximo: 80,
      },
      {
        nome: "valor",
        tipo: "texto",
        obrigatorio: true,
        descricao: "O novo valor.",
        maximo: 200,
      },
    ],
  },
];

// =============================================================================================
// VS Code
// =============================================================================================

/**
 * O VS Code tem CLI (`code`), e é o adaptador que funciona hoje sem nada novo.
 *
 * Uma ação só, e de propósito: abrir um arquivo numa linha. É o gesto que o Pathly de fato
 * precisa — levar a pessoa até onde a etapa acontece — e não abre caminho para nada além disso.
 *
 * O que seria fácil e errado: uma ação `VSCODE_RUN_TASK` que recebe o nome de uma tarefa do
 * `tasks.json`. Parece típada, e não é: o conteúdo do `tasks.json` é arbitrário, então o nome da
 * tarefa é um ponteiro para um comando qualquer. Seria "execute isto" com um passo a mais.
 */
const VSCODE: AcaoDaPonte[] = [
  {
    id: "VSCODE_OPEN_FILE",
    adaptador: "vscode",
    titulo: "Abrir arquivo no editor",
    descricao: "Abre um arquivo do projeto no VS Code, numa linha específica.",
    capacidade: "VSCODE_OPEN_FILE",
    altera: false,
    parametros: [
      {
        nome: "caminho",
        tipo: "texto",
        obrigatorio: true,
        descricao: "O caminho do arquivo, relativo à pasta do projeto.",
        formato: "caminho",
        maximo: 300,
      },
      {
        nome: "linha",
        tipo: "numero",
        obrigatorio: false,
        descricao: "A linha onde abrir. Padrão 1.",
      },
    ],
  },
];

// =============================================================================================
// O catálogo
// =============================================================================================

export const ACOES: readonly AcaoDaPonte[] = [...REVIT, ...VSCODE];

export function acharAcao(id: string): AcaoDaPonte | null {
  return ACOES.find((a) => a.id === id) ?? null;
}

export function acoesDoAdaptador(adaptador: string): AcaoDaPonte[] {
  return ACOES.filter((a) => a.adaptador === adaptador);
}

export const ADAPTADORES = [...new Set(ACOES.map((a) => a.adaptador))];

/**
 * Os adaptadores que existem de fato, e o que falta em cada um.
 *
 * Declarado aqui e mostrado na tela. Um adaptador "em breve" que aparece como disponível é a
 * mentira mais fácil de cometer neste módulo.
 */
export const SITUACAO_ADAPTADOR: Record<string, { pronto: boolean; oQueFalta: string | null }> = {
  vscode: {
    pronto: true,
    oQueFalta: null,
  },
  revit: {
    pronto: false,
    oQueFalta:
      "Um add-in do Revit, em C#, que exponha um servidor local para a ponte conversar. A API do " +
      "Revit só existe dentro do processo dele — não há caminho por HTTP de fora, e automação por " +
      "navegador seria fingimento. Enquanto o add-in não existir, estas ações respondem " +
      "ADAPTADOR_AUSENTE.",
  },
};

/**
 * As ferramentas que este mesmo protocolo atende quando alguém escrever o adaptador.
 *
 * Não estão no catálogo de ações porque ação sem adaptador é promessa. Estão aqui para dizer que
 * a arquitetura não precisa mudar para recebê-las — o que muda é o programa do outro lado.
 */
export const FERRAMENTAS_FUTURAS = [
  { nome: "Blender", como: "Add-on em Python, que o Blender já carrega nativamente." },
  { nome: "SketchUp", como: "Extensão em Ruby, pela API de extensões." },
  { nome: "AutoCAD", como: "Plugin .NET ou AutoLISP." },
  { nome: "SolidWorks", como: "Add-in .NET pela API COM." },
] as const;

/** Toda ação que altera precisa de simulação. A lista sai do catálogo, não de uma cópia. */
export function exigeSimulacao(id: string): boolean {
  return acharAcao(id)?.altera ?? false;
}

/** As capacidades que uma ponte precisa para um conjunto de adaptadores. */
export function capacidadesDe(adaptadores: readonly string[]): Capacidade[] {
  const cs = ACOES.filter((a) => adaptadores.includes(a.adaptador)).map((a) => a.capacidade);
  return [...new Set<Capacidade>(["BRIDGE_CONNECT", ...cs])];
}
