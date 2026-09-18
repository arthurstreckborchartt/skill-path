import type { Blueprint } from "@/lib/blueprint/contrato";
import type { Faceta } from "./roteador";

/**
 * O próximo passo lógico do projeto — calculado, não gerado.
 *
 * ## Por que isto não passa por IA
 *
 * Perguntar "qual o próximo passo?" a um modelo produziria passos que o app não tem: ele
 * inventaria "configure o CI/CD" para um produto onde essa tela não existe, e a pessoa iria
 * procurar um botão que ninguém construiu.
 *
 * O estado real está todo aqui — quais blocos do plano existem, se há modelo de dados, mapa de
 * API, análise de segurança, arquitetura de IA, quantas etapas do roadmap foram concluídas. Com
 * isso, o passo seguinte é uma consulta, não um palpite. E o motivo vem junto: "a autenticação
 * afeta as permissões das APIs" é uma frase que precisa estar certa sempre, não às vezes.
 *
 * ## A ordem não é arbitrária
 *
 * Cada passo depende do anterior por uma razão técnica, e é essa razão que aparece na tela. Banco
 * antes de API porque endpoint desenhado sem saber que dados existem inventa os campos.
 * Autenticação antes de segurança porque metade do catálogo de riscos só se aplica a projeto com
 * conta de usuário.
 */

export type EstadoDoProjeto = {
  blueprint: Blueprint;
  temModelo: boolean;
  temApi: boolean;
  temSeguranca: boolean;
  temArquiteturaIa: boolean;
  etapasConcluidas: number;
  etapasTotal: number;
  questionarioCompleto: boolean;
};

export type ProximoPasso = {
  id: string;
  titulo: string;
  /** Por que este passo agora, e não outro. Aparece na tela. */
  porque: string;
  /** Para onde levar a pessoa. `null` quando o passo não tem tela própria. */
  rota: string | null;
  /** A faceta que o Copilot assume quando a pessoa clica em "Entender". */
  faceta: Faceta;
  /** `true` quando o projeto acabou: não há passo seguinte, e dizer isso é a resposta certa. */
  concluido: boolean;
};

type Regra = {
  id: string;
  quando: (e: EstadoDoProjeto) => boolean;
  titulo: string;
  porque: string;
  rota: (id: string) => string | null;
  faceta: Faceta;
};

/**
 * As regras, na ordem de prioridade. A primeira que casar vence.
 *
 * Ordem é tudo aqui: `questionario` antes de qualquer coisa porque sem ele nada mais pode ser
 * gerado, e `roadmap` por último porque executar é o que sobra quando o plano está pronto.
 */
const REGRAS: Regra[] = [
  {
    id: "questionario",
    quando: (e) => !e.questionarioCompleto,
    titulo: "Responder o questionário do projeto",
    porque:
      "Tudo o mais sai das suas respostas. Sem elas, cada bloco do plano seria escrito para um projeto genérico, e não para o seu.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "produto",
  },
  {
    id: "fundacao",
    quando: (e) => !e.blueprint.fundacao,
    titulo: "Gerar a Fundação do plano",
    porque:
      "É o bloco que define que problema você resolve e para quem. Os outros quatro dependem dele — listar funcionalidades antes disso produz uma lista de desejos, não um produto.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "produto",
  },
  {
    id: "produto",
    quando: (e) => !e.blueprint.produto,
    titulo: "Gerar o bloco Produto",
    porque:
      "É onde o MVP ganha fronteira: o que entra agora e o que fica para depois. Sem isso, o modelo de dados é desenhado para funcionalidades que talvez nunca existam.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "produto",
  },
  {
    id: "tecnico",
    quando: (e) => !e.blueprint.tecnico,
    titulo: "Gerar o bloco Técnico",
    porque:
      "É aqui que a stack, a arquitetura e a autenticação são decididas. Escolher tecnologia antes de saber que dados existem é o erro mais caro de um projeto — e o mais difícil de desfazer.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "stack",
  },
  {
    id: "banco",
    quando: (e) => !e.temModelo,
    titulo: "Projetar o banco de dados",
    porque:
      "O modelo de dados é o que sustenta todo o resto. Cada endpoint, cada tela e cada permissão sai das tabelas que você definir aqui.",
    rota: (id) => `/app/banco/${id}`,
    faceta: "banco",
  },
  {
    id: "api",
    quando: (e) => !e.temApi,
    titulo: "Projetar a API",
    porque:
      "Agora que as tabelas existem, os endpoints podem ser desenhados sobre os dados que realmente vão existir, com os nomes certos. Antes do banco, eles seriam inventados.",
    rota: (id) => `/app/api/${id}`,
    faceta: "api",
  },
  {
    id: "seguranca",
    quando: (e) => !e.temSeguranca,
    titulo: "Analisar a segurança",
    porque:
      "Com banco e API prontos, a análise tem o que ler: ela encontra senha sem hash, valor de cobrança vindo do cliente e rota sem checagem de dono — apontando o lugar exato no seu plano.",
    rota: (id) => `/app/seguranca/${id}`,
    faceta: "seguranca",
  },
  {
    id: "arquitetura-ia",
    quando: (e) => !e.temArquiteturaIa,
    titulo: "Decidir se o projeto precisa de IA",
    porque:
      "Antes de implementar IA, vale responder se ela é necessária. A análise diz o que resolve sem IA, o que resolve com uma chamada só, e quanto cada opção custa por mês.",
    rota: (id) => `/app/arquitetura-ia/${id}`,
    faceta: "ia",
  },
  {
    id: "operacao",
    quando: (e) => !e.blueprint.operacao,
    titulo: "Gerar o bloco Operação",
    porque:
      "É o que sustenta o produto depois de pronto: requisitos, infraestrutura, deploy e testes. Só dá para dimensionar isso sabendo o que o sistema faz e como ele é montado.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "deploy",
  },
  {
    id: "execucao",
    quando: (e) => !e.blueprint.execucao,
    titulo: "Gerar a trilha de execução",
    porque:
      "É a ordem de construir, etapa por etapa. Ela sai do modelo de dados — sem ele, viraria uma lista de tarefas soltas que não encaixam.",
    rota: (id) => `/app/blueprint/${id}`,
    faceta: "roadmap",
  },
  {
    id: "roadmap",
    quando: (e) => e.etapasConcluidas < e.etapasTotal,
    titulo: "Executar a próxima etapa do roadmap",
    porque:
      "O plano está completo. O que falta agora é construir, na ordem que a trilha define — cada etapa depende do que a anterior deixou pronto.",
    rota: (id) => `/app/roadmap/${id}`,
    faceta: "roadmap",
  },
];

/**
 * O passo seguinte, com o motivo.
 *
 * Nunca devolve "o que você quer fazer?". Quando tudo está pronto, devolve isso explicitamente
 * em vez de improvisar mais uma tarefa — um copiloto que sempre encontra o que fazer a seguir
 * nunca deixa a pessoa terminar.
 */
export function calcularProximoPasso(projetoId: string, e: EstadoDoProjeto): ProximoPasso {
  const regra = REGRAS.find((r) => r.quando(e));

  if (!regra) {
    return {
      id: "concluido",
      titulo: "O plano está completo e o roadmap, terminado",
      porque:
        "Não há próximo passo dentro do Pathly. Daqui em diante é manter o que existe — e voltar aqui quando o projeto mudar.",
      rota: null,
      faceta: "geral",
      concluido: true,
    };
  }

  return {
    id: regra.id,
    titulo: regra.titulo,
    porque: regra.porque,
    rota: regra.rota(projetoId),
    faceta: regra.faceta,
    concluido: false,
  };
}

/** O progresso em porcentagem, para o cabeçalho do painel. */
export function calcularProgresso(e: EstadoDoProjeto): number {
  const marcos = [
    e.questionarioCompleto,
    Boolean(e.blueprint.fundacao),
    Boolean(e.blueprint.produto),
    Boolean(e.blueprint.tecnico),
    e.temModelo,
    e.temApi,
    e.temSeguranca,
    e.temArquiteturaIa,
    Boolean(e.blueprint.operacao),
    Boolean(e.blueprint.execucao),
  ];

  const feitos = marcos.filter(Boolean).length;

  /**
   * O roadmap vale metade do total.
   *
   * Sem esse peso, um projeto com o plano inteiro pronto e nenhuma etapa executada mostraria 100%
   * — e o Pathly estaria dizendo que o trabalho acabou quando ele mal começou.
   */
  const planoPronto = feitos / marcos.length;
  const execucao = e.etapasTotal > 0 ? e.etapasConcluidas / e.etapasTotal : 0;

  return Math.round((planoPronto * 0.5 + execucao * 0.5) * 100);
}
