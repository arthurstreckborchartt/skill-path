import type { Blueprint, Etapa } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { Decisao } from "@/lib/copilot/contrato";
import { REGRAS_DO_PATHLY, montarPacote, type EntradaDoContexto } from "../ia/contexto";

/**
 * O Execution Brief — o documento que vai para a ferramenta.
 *
 * ## Por que não é o `PacoteDeContexto`
 *
 * O pacote de `src/lib/hub/ia/contexto.ts` é a **estrutura**: oito campos, pensados para serem
 * lidos por código. O brief é o **documento**: treze seções, pensadas para serem lidas por um
 * modelo, na ordem em que ele precisa delas.
 *
 * Três seções existem só aqui, e são as que mudam o resultado:
 *
 * - `OBJECTIVE` separa o *porquê* do *o quê*. "Implementar login" com objetivo "para o dono da
 *   marcenaria abrir o app no celular sem digitar senha toda vez" produz decisões diferentes de
 *   "implementar login" sozinho.
 * - `DO NOT` é a seção que quase ninguém escreve e que evita metade do retrabalho. Vem do que o
 *   produto decidiu não fazer, mais as regras do Pathly que valem em todo projeto.
 * - `EXPECTED RESULT` é o truque que faz o retorno estruturado existir sem API nenhuma: o brief
 *   **pede** o bloco de volta, no formato exato. Uma ferramenta que não tem canal de retorno
 *   ainda assim escreve o bloco na tela, e a pessoa cola. Não é o mesmo que ler direto — e o
 *   Pathly marca a diferença —, mas é muito melhor que texto livre.
 *
 * O brief é montado em cima do pacote, não ao lado: `CONSTRAINTS`, `DECISIONS` e
 * `ACCEPTANCE CRITERIA` saem de `montarPacote`, para não existirem duas versões da mesma verdade
 * que saem de sincronia na primeira mudança.
 */

export type EntradaDoBrief = EntradaDoContexto & {
  /** O que a ferramenta deve devolver. Sai na seção `EXPECTED RESULT`. */
  pedirResultadoEstruturado: boolean;
};

export type ExecutionBrief = {
  PROJECT: string;
  CURRENT_STEP: string;
  STACK: string[];
  OBJECTIVE: string;
  CURRENT_ARCHITECTURE: string[];
  DECISIONS: string[];
  CONSTRAINTS: string[];
  FILES: string[];
  TASK: string;
  ACCEPTANCE_CRITERIA: string[];
  DO_NOT: string[];
  KNOWN_ERRORS: string[];
  EXPECTED_RESULT: string;
};

/**
 * O formato que o brief pede de volta.
 *
 * Os sete campos que você nomeou. O texto é escrito para um modelo, então é imperativo e sem
 * gentileza: instruções educadas viram sugestões, e sugestão em prompt é ignorada.
 */
export const FORMATO_DO_RESULTADO = `Ao terminar, escreva este bloco, exatamente com estes sete cabeçalhos:

STATUS: sucesso | parcial | falhou | bloqueado
CHANGES: o que você mudou, em uma linha por mudança
FILES: os caminhos que você tocou, um por linha
TESTS: o comando que rodou e o resultado. Se não rodou nenhum, escreva "nenhum"
ERRORS: o que deu errado. Se nada deu, escreva "nenhum"
DECISIONS: decisões técnicas que você tomou e que fogem do plano. Se nenhuma, escreva "nenhuma"
NEXT_STEP: o que fazer em seguida

Não invente TESTS. Se você não executou o comando, "nenhum" é a resposta certa — dizer que
passou sem ter rodado apaga a única informação que o próximo passo precisava.`;

/**
 * As proibições que valem em todo projeto.
 *
 * São as mesmas de `CONSTRAINTS` no pacote, promovidas a seção própria porque `DO NOT` é lido com
 * outro peso: restrição descreve o terreno, proibição descreve a cerca.
 */
const NUNCA = [
  "Não faça commit nem push. Quem decide o que entra no histórico é a pessoa, não você.",
  "Não apague arquivo que você não criou nesta tarefa.",
  "Não altere o banco de dados de produção.",
  "Não instale dependência nova sem dizer qual e por quê.",
  "Não mude uma decisão técnica em silêncio: diga qual, por que, e espere.",
];

function linhas(...v: (string | null | undefined)[]): string {
  return v.filter((x): x is string => Boolean(x && x.trim())).join("\n");
}

export function montarBrief(e: EntradaDoBrief): ExecutionBrief {
  const pacote = montarPacote(e);
  const t = e.blueprint.tecnico;
  const f = e.blueprint.fundacao;

  const objetivoDaFase =
    e.blueprint.execucao?.fases?.find((x) => x.nome === e.etapa?.fase)?.objetivo ?? null;

  const STACK = t?.stack
    ? [t.stack.frontend, t.stack.backend, t.stack.banco, t.stack.hospedagem].filter(
        (x): x is string => Boolean(x && x.trim()),
      )
    : [];

  /*
   * A arquitetura é o que já existe, não o que vai ser construído. Um agente que não recebe isto
   * propõe a arquitetura dele — geralmente boa, geralmente incompatível com as outras seis etapas
   * que já foram feitas.
   */
  const CURRENT_ARCHITECTURE = [
    t?.arquitetura ? `Padrão: ${t.arquitetura}` : null,
    t?.autenticacao?.metodo
      ? `Autenticação: ${t.autenticacao.metodo}${t.autenticacao.sessao ? ` (sessão: ${t.autenticacao.sessao})` : ""}`
      : null,
    e.modelo ? `Banco: ${e.modelo.entidades.length} entidades já modeladas.` : null,
    e.api ? `API: ${e.api.endpoints.length} endpoints já mapeados.` : null,
    t?.integracoes?.length
      ? `Integrações previstas: ${t.integracoes.map((i) => i.nome).join(", ")}.`
      : null,
  ].filter((x): x is string => x !== null);

  /*
   * `foraDoEscopo` é a parte do blueprint que ninguém relê e que resolve mais discussão que
   * qualquer outra. "O produto não faz emissão de nota fiscal" evita a tarde em que a ferramenta
   * implementa emissão de nota fiscal porque parecia faltar.
   */
  const DO_NOT = [
    ...(e.blueprint.produto?.foraDoEscopo ?? []).map((x) => `Fora do escopo: ${x}`),
    ...NUNCA,
  ];

  return {
    PROJECT: linhas(e.nomeProjeto, f?.descricao ?? null),
    CURRENT_STEP: pacote.CURRENT_STEP,
    STACK,
    /*
     * O porquê, e **só** o porquê. A entrega já está em `TASK`; repeti-la aqui fazia as duas
     * seções dizerem a mesma frase, e um documento que se repete ensina o modelo a ler os
     * cabeçalhos com menos atenção.
     *
     * O objetivo da fase é a melhor resposta que o plano tem para "por que esta etapa existe" —
     * ele foi escrito exatamente para isso e nunca tinha sido usado em lugar nenhum.
     */
    OBJECTIVE: linhas(
      objetivoDaFase ? `Por que esta etapa existe: ${objetivoDaFase}` : null,
      f?.problema ? `O problema que o produto resolve: ${f.problema}` : null,
    ),
    CURRENT_ARCHITECTURE,
    DECISIONS: pacote.TECHNICAL_DECISIONS,
    /*
     * As regras do Pathly saem daqui: `DO NOT` as carrega numa versão mais direta, e o mesmo
     * recado duas vezes no mesmo documento ensina o modelo que ele se repete.
     */
    CONSTRAINTS: pacote.CONSTRAINTS.filter(
      (c) => !(REGRAS_DO_PATHLY as readonly string[]).includes(c),
    ),
    FILES: pacote.FILES_RELEVANT,
    TASK: pacote.TASK,
    ACCEPTANCE_CRITERIA: pacote.ACCEPTANCE_CRITERIA,
    DO_NOT,
    KNOWN_ERRORS: pacote.KNOWN_ERRORS,
    EXPECTED_RESULT: e.pedirResultadoEstruturado ? FORMATO_DO_RESULTADO : "",
  };
}

/** A ordem em que as seções saem. É a ordem em que um modelo precisa delas. */
const ORDEM: (keyof ExecutionBrief)[] = [
  "PROJECT",
  "CURRENT_STEP",
  "STACK",
  "OBJECTIVE",
  "CURRENT_ARCHITECTURE",
  "DECISIONS",
  "CONSTRAINTS",
  "FILES",
  "TASK",
  "ACCEPTANCE_CRITERIA",
  "DO_NOT",
  "KNOWN_ERRORS",
  "EXPECTED_RESULT",
];

/** O cabeçalho como aparece no documento: `CURRENT_STEP` vira `CURRENT STEP`. */
function titulo(chave: keyof ExecutionBrief): string {
  return chave.replace(/_/g, " ");
}

/**
 * O brief em texto.
 *
 * Seção vazia some. Um `DO NOT:` sem nada embaixo ensina o modelo que cabeçalho deste documento
 * pode estar vazio — e ele passa a ler os outros com menos atenção.
 */
export function briefEmTexto(b: ExecutionBrief): string {
  const blocos: string[] = [];

  for (const chave of ORDEM) {
    const v = b[chave];
    if (Array.isArray(v)) {
      const uteis = v.filter((x) => x && x.trim());
      if (uteis.length > 0)
        blocos.push(`${titulo(chave)}:\n${uteis.map((x) => `- ${x}`).join("\n")}`);
    } else if (typeof v === "string" && v.trim()) {
      blocos.push(`${titulo(chave)}:\n${v}`);
    }
  }

  return blocos.join("\n\n");
}

/** As seções que ficaram vazias. A tela mostra por nome — contexto incompleto é do que a pessoa precisa saber. */
export function secoesVaziasDoBrief(b: ExecutionBrief): (keyof ExecutionBrief)[] {
  return ORDEM.filter((k) => {
    const v = b[k];
    return Array.isArray(v) ? v.length === 0 : !String(v).trim();
  });
}

/**
 * Quanto do brief está de pé, de 0 a 100.
 *
 * Existe porque "o contexto está incompleto" não ajuda a decidir se vale mandar assim mesmo. Um
 * número decide: 90% manda, 40% é melhor gerar o modelo de dados antes.
 *
 * `EXPECTED_RESULT` e `KNOWN_ERRORS` ficam fora da conta — o primeiro é escolha, e o segundo estar
 * vazio é uma boa notícia, não um buraco.
 */
export function completudeDoBrief(b: ExecutionBrief): number {
  const fora: (keyof ExecutionBrief)[] = ["EXPECTED_RESULT", "KNOWN_ERRORS"];
  const contam = ORDEM.filter((k) => !fora.includes(k));
  const vazias = secoesVaziasDoBrief(b).filter((k) => contam.includes(k));
  return Math.round(((contam.length - vazias.length) / contam.length) * 100);
}

/** Atalho: monta o brief e devolve já em texto, que é o que a tela copia. */
export function briefDaEtapa(params: {
  nomeProjeto: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  decisoes: readonly Decisao[];
  etapa: Etapa | null;
  etapasConcluidas: number;
  etapasTotal: number;
  errosConhecidos: readonly string[];
  pedirResultadoEstruturado: boolean;
}): { brief: ExecutionBrief; texto: string } {
  const brief = montarBrief(params);
  return { brief, texto: briefEmTexto(brief) };
}
