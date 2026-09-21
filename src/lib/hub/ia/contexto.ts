import type { Blueprint, Etapa } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { Decisao } from "@/lib/copilot/contrato";

/**
 * O pacote de contexto — o que o Pathly entrega a uma ferramenta de IA.
 *
 * ## Por que isto existe
 *
 * A diferença entre um agente que acerta e um que inventa quase nunca é o modelo: é o que ele
 * sabe. "Implemente autenticação" produz a autenticação genérica de um projeto genérico.
 * "Implemente autenticação **neste** projeto, que usa Supabase, tem estas cinco tabelas, já
 * decidiu sessão por cookie, e precisa passar nestes critérios" produz outra coisa.
 *
 * O Pathly tem todos esses dados. Montá-los num pacote é o produto inteiro desta camada.
 *
 * ## As oito seções
 *
 * São as que você nomeou, e cada uma responde a uma pergunta que um agente faria se pudesse:
 *
 * - `PROJECT_CONTEXT` — o que estamos construindo, e com o quê
 * - `CURRENT_STEP` — onde estamos na trilha
 * - `TECHNICAL_DECISIONS` — o que já foi decidido e não se rediscute agora
 * - `FILES_RELEVANT` — onde mexer
 * - `TASK` — o que fazer
 * - `CONSTRAINTS` — o que não pode
 * - `ACCEPTANCE_CRITERIA` — como saber que ficou pronto
 * - `KNOWN_ERRORS` — o que já deu errado, para não repetir
 *
 * `KNOWN_ERRORS` é a que mais economiza tempo e a que quase todo mundo esquece: sem ela, a
 * ferramenta refaz a tentativa que já falhou, com convicção.
 */

export type PacoteDeContexto = {
  PROJECT_CONTEXT: string;
  CURRENT_STEP: string;
  TECHNICAL_DECISIONS: string[];
  FILES_RELEVANT: string[];
  TASK: string;
  CONSTRAINTS: string[];
  ACCEPTANCE_CRITERIA: string[];
  KNOWN_ERRORS: string[];
};

export type EntradaDoContexto = {
  nomeProjeto: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  decisoes: readonly Decisao[];
  /** A etapa em que a pessoa está. `null` quando a trilha ainda não existe. */
  etapa: Etapa | null;
  etapasConcluidas: number;
  etapasTotal: number;
  /** O que já falhou nesta etapa, dito pela pessoa. Vem do retorno manual. */
  errosConhecidos: readonly string[];
};

/**
 * As restrições que não vêm do plano: são do Pathly, e valem em todo projeto.
 *
 * Exportadas porque o Execution Brief tem uma seção `DO NOT` que diz as mesmas coisas com mais
 * força. Repetir as duas no mesmo documento não reforça nada — ensina o modelo que este documento
 * se repete, e ele passa a ler tudo com menos atenção. O brief subtrai estas daqui e mantém as
 * dele.
 */
export const REGRAS_DO_PATHLY = [
  "Não faça commit nem push sem a pessoa pedir explicitamente.",
  "Não apague arquivo que você não criou nesta tarefa.",
  "Se uma decisão técnica precisar mudar, diga qual e por quê em vez de mudar em silêncio.",
] as const;

function linhas(...v: (string | null | undefined)[]): string {
  return v.filter((x): x is string => Boolean(x && x.trim())).join("\n");
}

export function montarPacote(e: EntradaDoContexto): PacoteDeContexto {
  const t = e.blueprint.tecnico;
  const f = e.blueprint.fundacao;

  const PROJECT_CONTEXT = linhas(
    `Projeto: ${e.nomeProjeto}`,
    f?.descricao ? `O que é: ${f.descricao}` : null,
    t?.stack
      ? `Stack: ${[t.stack.frontend, t.stack.backend, t.stack.banco, t.stack.hospedagem].filter(Boolean).join(" · ")}`
      : null,
    t?.arquitetura ? `Arquitetura: ${t.arquitetura}` : null,
    e.modelo ? `Modelo de dados: ${e.modelo.entidades.length} entidades.` : null,
    e.api ? `API: ${e.api.endpoints.length} endpoints.` : null,
  );

  const CURRENT_STEP = e.etapa
    ? linhas(
        `Etapa ${e.etapa.ordem} de ${e.etapasTotal}: ${e.etapa.titulo}`,
        e.etapa.entrega ? `Entrega: ${e.etapa.entrega}` : null,
        e.etapa.fase ? `Fase: ${e.etapa.fase}` : null,
        `Concluídas até agora: ${e.etapasConcluidas}.`,
      )
    : "A trilha de execução ainda não foi gerada. Não há etapa corrente.";

  /*
   * Só as decisões vigentes. Uma decisão superada continua no histórico do Copilot de propósito —
   * é auditoria —, mas mandá-la para a ferramenta faria ela respeitar uma escolha que já foi
   * desfeita, e discutir com o código atual.
   */
  const TECHNICAL_DECISIONS = e.decisoes
    .filter((d) => d.status === "ativa")
    .map((d) => `${d.titulo}: ${d.valor}${d.motivo ? ` — porque: ${d.motivo}` : ""}`);

  /*
   * O Pathly **não enxerga o repositório**: ele conhece o plano, não a árvore de arquivos. A
   * `Etapa` do blueprint não carrega caminho nenhum, e inventar um seria pior que não listar —
   * a ferramenta iria procurar arquivos que não existem.
   *
   * Então o que vai aqui é o que o plano de fato conhece: as tabelas e os endpoints que a etapa
   * provavelmente toca. Quem sabe o caminho real é a ferramenta, que está dentro do repositório.
   */
  const FILES_RELEVANT = [
    ...(e.modelo?.entidades ?? []).map((x) => `tabela: ${x.nome}`),
    ...(e.api?.endpoints ?? []).slice(0, 12).map((x) => `endpoint: ${x.metodo} ${x.caminho}`),
  ];

  /* A entrega do blueprint quase sempre já termina em ponto; somar outro produz "remoto..". */
  const pontuado = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);

  const TASK = e.etapa
    ? linhas(
        e.etapa.titulo,
        e.etapa.entrega ? `O resultado esperado: ${pontuado(e.etapa.entrega)}` : null,
      )
    : "Sem tarefa definida: gere a trilha de execução no Pathly antes.";

  const CONSTRAINTS = [
    ...(t?.seguranca ?? []),
    ...(e.blueprint.operacao?.requisitosNaoFuncionais ?? []).map((r) =>
      r.comoMedir ? `${r.descricao} (medido por: ${r.comoMedir})` : r.descricao,
    ),
    ...REGRAS_DO_PATHLY,
  ];

  /*
   * Critério de aceitação vive nos **requisitos funcionais**, não na etapa — e é assim que o
   * blueprint foi desenhado: `RF-01` descreve o que precisa ser verdade, e a etapa entrega isso.
   * Quando a etapa cita um `RF`, filtramos por ele; quando não cita, vão todos, porque um
   * critério a mais é ruído e um critério a menos é retrabalho.
   */
  const citados = (e.etapa?.titulo ?? "") + " " + (e.etapa?.entrega ?? "");
  const requisitos = e.blueprint.produto?.requisitosFuncionais ?? [];
  const relevantes = requisitos.filter((r) => citados.includes(r.id));
  const ACCEPTANCE_CRITERIA = (relevantes.length > 0 ? relevantes : requisitos).map(
    (r) => `${r.id} — ${r.descricao}: ${r.criterioAceite}`,
  );

  return {
    PROJECT_CONTEXT,
    CURRENT_STEP,
    TECHNICAL_DECISIONS,
    FILES_RELEVANT,
    TASK,
    CONSTRAINTS,
    ACCEPTANCE_CRITERIA,
    KNOWN_ERRORS: [...e.errosConhecidos],
  };
}

/**
 * O pacote em Markdown, que é o formato que toda ferramenta aceita.
 *
 * Seções vazias somem. Um cabeçalho `## KNOWN_ERRORS` sem nada embaixo ocupa contexto e ensina a
 * ferramenta a ignorar cabeçalhos.
 */
export function pacoteEmMarkdown(p: PacoteDeContexto): string {
  const bloco = (titulo: string, conteudo: string | string[]): string | null => {
    if (Array.isArray(conteudo)) {
      const uteis = conteudo.filter((x) => x && x.trim());
      return uteis.length === 0 ? null : `## ${titulo}\n${uteis.map((x) => `- ${x}`).join("\n")}`;
    }
    return conteudo.trim() ? `## ${titulo}\n${conteudo}` : null;
  };

  return [
    bloco("PROJECT_CONTEXT", p.PROJECT_CONTEXT),
    bloco("CURRENT_STEP", p.CURRENT_STEP),
    bloco("TECHNICAL_DECISIONS", p.TECHNICAL_DECISIONS),
    bloco("FILES_RELEVANT", p.FILES_RELEVANT),
    bloco("TASK", p.TASK),
    bloco("CONSTRAINTS", p.CONSTRAINTS),
    bloco("ACCEPTANCE_CRITERIA", p.ACCEPTANCE_CRITERIA),
    bloco("KNOWN_ERRORS", p.KNOWN_ERRORS),
  ]
    .filter((x): x is string => x !== null)
    .join("\n\n");
}

/** As seções que ficaram vazias. A tela mostra — contexto incompleto é do que a pessoa precisa saber. */
export function secoesVazias(p: PacoteDeContexto): string[] {
  const vazio = (v: string | string[]) => (Array.isArray(v) ? v.length === 0 : !v.trim());
  return (Object.keys(p) as (keyof PacoteDeContexto)[]).filter((k) => vazio(p[k]));
}
