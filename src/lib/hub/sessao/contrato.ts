import type { AiDevelopmentProvider } from "../ia/contrato";

/**
 * A Development Session — a unidade de orquestração do Pathly.
 *
 * ## O que o Pathly é, e o que ele não é
 *
 * Não é um agente que toma conta do computador. É um **orquestrador de contexto, planejamento e
 * estado**: ele sabe o que precisa ser feito, prepara tudo que a ferramenta precisa saber, guarda
 * o que aconteceu e decide o que vem depois. Quem escreve código é a ferramenta; quem autoriza é
 * a pessoa.
 *
 * Isso não é modéstia — é o que a pesquisa de `src/lib/hub/ia/` estabeleceu. Três das quatro
 * ferramentas rodam na máquina de quem usa, e nenhuma nuvem alcança `localhost`. Um produto que
 * prometesse conduzir a execução estaria mentindo em três de quatro casos.
 *
 * O que sobra é mais valioso do que parece. A diferença entre alguém que constrói um SaaS em três
 * meses e alguém que desiste quase nunca é a ferramenta: é perder o fio. Esquecer por que aquela
 * decisão foi tomada, refazer a tentativa que já falhou, entregar metade de uma etapa e começar
 * outra. A sessão é o fio.
 *
 * ## Os doze passos
 *
 * São os que você nomeou, e a ordem importa porque cada um só faz sentido com o anterior pronto.
 * O que a lista original não mostrava — e é o que faz a diferença na prática — são as **voltas**:
 * teste que falha devolve para a execução, validação que reprova também. Um fluxo só de ida
 * descreve o desenvolvimento que ninguém tem.
 */

export const PASSOS = [
  "planejar",
  "gerar-tarefa",
  "preparar-contexto",
  "escolher-ferramenta",
  "solicitar-execucao",
  "autorizar",
  "executar",
  "receber-resultado",
  "testar",
  "validar",
  "atualizar-blueprint",
  "concluida",
  "cancelada",
  "falhou",
] as const;

export type Passo = (typeof PASSOS)[number];

/** Os passos em que a sessão acabou. Nenhuma transição sai daqui. */
export const TERMINAIS: readonly Passo[] = ["concluida", "cancelada", "falhou"];

export function terminou(p: Passo): boolean {
  return TERMINAIS.includes(p);
}

export const ROTULO_PASSO: Record<Passo, string> = {
  planejar: "Planejar",
  "gerar-tarefa": "Gerar a tarefa",
  "preparar-contexto": "Preparar o contexto",
  "escolher-ferramenta": "Escolher a ferramenta",
  "solicitar-execucao": "Solicitar a execução",
  autorizar: "Autorizar",
  executar: "Executar",
  "receber-resultado": "Receber o resultado",
  testar: "Testar",
  validar: "Validar",
  "atualizar-blueprint": "Atualizar o blueprint",
  concluida: "Concluída",
  cancelada: "Cancelada",
  falhou: "Falhou",
};

/**
 * As transições permitidas.
 *
 * A ida é linear. As voltas são três, e cada uma existe porque o desenvolvimento real tem aquela
 * volta:
 *
 * - `receber-resultado` → `executar`: a ferramenta não terminou, ou voltou com nada aproveitável.
 * - `testar` → `executar`: teste falhou. É a volta mais comum de todas.
 * - `validar` → `executar`: passou nos testes e ainda assim não é o que a etapa pedia.
 *
 * Sem elas, a pessoa cancelaria a sessão e abriria outra — e o histórico diria que a etapa foi
 * feita de primeira, o que é falso e apaga justamente a informação mais útil: quantas voltas
 * aquela etapa custou.
 */
export const TRANSICOES: Record<Passo, readonly Passo[]> = {
  planejar: ["gerar-tarefa", "cancelada"],
  "gerar-tarefa": ["preparar-contexto", "cancelada"],
  "preparar-contexto": ["escolher-ferramenta", "cancelada"],
  "escolher-ferramenta": ["solicitar-execucao", "cancelada"],
  "solicitar-execucao": ["autorizar", "cancelada"],
  autorizar: ["executar", "cancelada", "falhou"],
  executar: ["receber-resultado", "cancelada", "falhou"],
  "receber-resultado": ["testar", "executar", "cancelada", "falhou"],
  testar: ["validar", "executar", "cancelada", "falhou"],
  validar: ["atualizar-blueprint", "executar", "cancelada", "falhou"],
  "atualizar-blueprint": ["concluida", "cancelada", "falhou"],
  concluida: [],
  cancelada: [],
  falhou: [],
};

export function podeIr(de: Passo, para: Passo): boolean {
  return TRANSICOES[de].includes(para);
}

/** Onde a sessão está na barra de progresso. Os terminais não entram na contagem. */
export const PASSOS_DO_FLUXO: readonly Passo[] = PASSOS.filter(
  (p) => !TERMINAIS.includes(p),
) as Passo[];

export function posicaoDoPasso(p: Passo): number {
  const i = PASSOS_DO_FLUXO.indexOf(p);
  return i < 0 ? PASSOS_DO_FLUXO.length : i;
}

// =============================================================================================
// O que cada passo significa depende de quem executa
// =============================================================================================

/**
 * A mesma máquina de estados descreve duas realidades diferentes, e a tela precisa dizer qual.
 *
 * Quando o Pathly chama a ferramenta (hoje, só a API da Anthropic), `autorizar` é uma aprovação
 * de verdade: a pessoa libera e o Pathly age. Quando a ferramenta roda na máquina dela, o mesmo
 * passo significa outra coisa — a pessoa está decidindo começar, e o Pathly só anota.
 *
 * Escrever "Autorizar" nos dois casos seria o tipo de imprecisão que faz alguém acreditar que
 * negar no Pathly impediria o Cursor de rodar. Não impediria. O Cursor nem sabe que o Pathly
 * existe.
 */
export function explicarPasso(passo: Passo, provedor: AiDevelopmentProvider | null): string {
  const oPathlyExecuta = provedor !== null && !provedor.local;
  const nome = provedor?.nome ?? "a ferramenta";

  switch (passo) {
    case "planejar":
      return "Conferindo onde você está na trilha e o que a etapa pede.";
    case "gerar-tarefa":
      return "Transformando a etapa do plano numa tarefa com começo e fim.";
    case "preparar-contexto":
      return "Montando o Execution Brief: plano, decisões, restrições, critérios e o que já falhou.";
    case "escolher-ferramenta":
      return "Escolhendo para onde o brief vai.";
    case "solicitar-execucao":
      return oPathlyExecuta
        ? `Preparando a chamada para ${nome}. Nada sai antes de você autorizar.`
        : `O brief está pronto para ${nome}. Copie ou baixe o arquivo de regras.`;
    case "autorizar":
      return oPathlyExecuta
        ? "Você autoriza, e só então o Pathly chama. Uma autorização vale uma execução."
        : `Quem decide começar é você, no ${nome}. O Pathly registra que começou — ele não consegue impedir nem disparar nada na sua máquina.`;
    case "executar":
      return oPathlyExecuta
        ? `O Pathly está falando com ${nome}.`
        : `${nome} está trabalhando na sua máquina. O Pathly não acompanha — ele espera você voltar.`;
    case "receber-resultado":
      return oPathlyExecuta
        ? "Lendo o que a ferramenta devolveu."
        : "Cole o bloco de resultado que a ferramenta escreveu, ou responda as quatro perguntas.";
    case "testar":
      return "Os testes desta etapa: o que rodou e o que passou.";
    case "validar":
      return "Conferindo contra os critérios de aceitação. Teste verde não é critério atendido.";
    case "atualizar-blueprint":
      return "Levando decisões e mudanças para o plano, para a próxima etapa já nascer sabendo.";
    case "concluida":
      return "Etapa entregue. A próxima tarefa começa numa sessão nova.";
    case "cancelada":
      return "Sessão encerrada sem concluir a etapa. O que foi registrado continua no histórico.";
    case "falhou":
      return "A sessão parou num erro. O que falhou entra no contexto da próxima tentativa.";
  }
}

// =============================================================================================
// A sessão
// =============================================================================================

/** Uma ação que a sessão pediu, aprovou ou executou. Espelha o modelo de capacidades do Hub. */
export type AcaoDaSessao = {
  capacidade: string;
  descricao: string;
  em: string;
};

export type DevelopmentSession = {
  id: string;
  projectId: string;
  /**
   * A integração do Hub que executa, quando houver uma.
   *
   * `null` para ferramenta local: não há integração, porque o Pathly não executa nada. Guardar um
   * id aqui nesse caso sugeriria um caminho de execução que não existe.
   */
  integrationId: string | null;
  /** O id do `AiDevelopmentProvider`. É sempre preenchido depois de `escolher-ferramenta`. */
  provider: string | null;
  /** A tarefa. Hoje é sempre uma etapa da trilha: `etapa:7`. */
  taskId: string;
  currentStep: Passo;
  /**
   * O Execution Brief **congelado** no momento em que foi entregue.
   *
   * Snapshot, e a palavra é literal: o blueprint muda, as decisões mudam, e três dias depois
   * ninguém consegue responder "o que a ferramenta sabia quando fez isso?". Com o snapshot, essa
   * pergunta tem resposta — e é a primeira que se faz quando o resultado veio errado.
   */
  contextSnapshot: unknown | null;
  requestedActions: AcaoDaSessao[];
  approvedActions: AcaoDaSessao[];
  executedActions: AcaoDaSessao[];
  result: unknown | null;
  errors: string[];
  technicalDecisions: string[];
  startedAt: string;
  completedAt: string | null;
  /** As transições já feitas. Escrita por gatilho no banco, nunca pelo cliente. */
  steps: { passo: Passo; em: string }[];
};

/** Uma sessão só está viva se não terminou. Uma etapa não tem duas sessões vivas ao mesmo tempo. */
export function viva(s: DevelopmentSession): boolean {
  return !terminou(s.currentStep);
}

/**
 * O que falta para sair do passo atual.
 *
 * `null` quando a sessão pode avançar. A tela usa isto para saber se o botão "Avançar" está
 * liberado — e, quando não está, para dizer o motivo em vez de só desabilitar.
 */
export function oQueFalta(s: DevelopmentSession): string | null {
  switch (s.currentStep) {
    case "escolher-ferramenta":
      return s.provider ? null : "Escolha a ferramenta que vai fazer esta tarefa.";
    case "preparar-contexto":
      return s.contextSnapshot ? null : "O contexto ainda não foi congelado.";
    case "receber-resultado":
      return s.result
        ? null
        : "Informe o que aconteceu — pelo bloco de resultado ou pelas quatro respostas.";
    default:
      return null;
  }
}
