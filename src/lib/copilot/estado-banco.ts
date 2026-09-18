import { supabase } from "@/integrations/supabase/client";

/**
 * O estado real do banco de um projeto — e a recusa em fingir que sabe.
 *
 * ## O problema que este arquivo resolve
 *
 * O módulo de banco projeta tabelas e gera o SQL. O Blueprint guarda essas tabelas. Nada nesse
 * caminho toca no banco de ninguém: são tabelas **planejadas**.
 *
 * O Copilot vai receber "o banco do projeto" como contexto e conversar sobre ele. Sem esta
 * distinção ele diria "sua tabela de usuários tem a coluna X" sobre uma tabela que só existe no
 * plano — e a pessoa passaria a depurar um banco imaginário. É o erro mais caro que um copiloto
 * de construção pode cometer, porque ele parece competente enquanto acontece.
 *
 * ## A regra
 *
 * "Planejado" é o padrão. "Executado" exige que alguém tenha dito que rodou. "Validado" exige
 * evidência técnica — uma resposta do banco que só aconteceria se a estrutura existisse.
 *
 * Nada aqui promove um estado sozinho.
 */

export const ESTADOS_SQL = ["gerado", "aprovado", "executado", "validado", "falhou"] as const;
export type EstadoSql = (typeof ESTADOS_SQL)[number];

export const ROTULO_ESTADO_SQL: Record<EstadoSql, string> = {
  gerado: "SQL gerado, aguardando execução",
  aprovado: "SQL aprovado, aguardando execução",
  executado: "Executado, ainda não validado",
  validado: "Validado",
  falhou: "Falhou",
};

/**
 * De onde veio a informação de estado. É isto que separa "a pessoa disse" de "o banco respondeu".
 *
 * `confirmacao-humana` é aceita e registrada, mas nunca vira `validado` sozinha: quem roda um
 * script às vezes roda no projeto errado, ou roda metade e fecha a aba.
 */
export const ORIGENS_EVIDENCIA = ["nenhuma", "confirmacao-humana", "sonda-tecnica"] as const;
export type OrigemEvidencia = (typeof ORIGENS_EVIDENCIA)[number];

export type OperacaoSql = {
  id: string;
  projetoId: string;
  /** O arquivo ou o rótulo do script. */
  script: string;
  /** Para que serve, em uma linha. */
  objetivo: string;
  estado: EstadoSql;
  origemEvidencia: OrigemEvidencia;
  /** O que sustenta o estado atual, em texto. Vazio é sinal de que o estado é palpite. */
  evidencia: string;
  geradoEm: string;
  aprovadoEm: string | null;
  executadoEm: string | null;
  validadoEm: string | null;
  /** Quem executou, quando houver. */
  executor: string | null;
  erro: string | null;
};

/**
 * O resultado de sondar uma tabela.
 *
 * Os dois códigos discriminam com precisão, e a assimetria é o que torna a sonda útil:
 * `42501` é permissão negada, que só o Postgres devolve sobre algo que EXISTE; `PGRST205` é
 * ausência do schema cache do PostgREST, que só acontece quando NÃO existe.
 */
export type SondaTabela = {
  tabela: string;
  existe: boolean;
  /** `true` quando a sessão atual consegue ler. `false` com `existe: true` significa RLS ativa. */
  legivel: boolean;
  codigo: string | null;
  /** A frase que pode ser mostrada ou registrada como evidência. */
  evidencia: string;
};

const AUSENTE = "PGRST205";
const SEM_PERMISSAO = "42501";

/**
 * Sonda uma tabela sem escrever nada.
 *
 * `limit(0)` porque a pergunta é sobre a existência da estrutura, não sobre o conteúdo: não há
 * motivo para trazer linha nenhuma, e trazer linha de tabela grande custa caro para responder
 * "sim" ou "não".
 */
export async function sondarTabela(tabela: string): Promise<SondaTabela> {
  const { error } = await supabase
    .from(tabela as never)
    .select("*")
    .limit(0);

  if (!error) {
    return {
      tabela,
      existe: true,
      legivel: true,
      codigo: null,
      evidencia: `\`${tabela}\` respondeu à consulta: a tabela existe e a sessão atual pode lê-la.`,
    };
  }

  if (error.code === SEM_PERMISSAO) {
    return {
      tabela,
      existe: true,
      legivel: false,
      codigo: error.code,
      evidencia: `\`${tabela}\` respondeu \`42501\`: a tabela existe, e a RLS recusou a leitura para esta sessão.`,
    };
  }

  if (error.code === AUSENTE) {
    return {
      tabela,
      existe: false,
      legivel: false,
      codigo: error.code,
      evidencia: `\`${tabela}\` respondeu \`PGRST205\`: a tabela não existe no banco.`,
    };
  }

  /**
   * Qualquer outro erro é inconclusivo, e inconclusivo NÃO é ausência.
   *
   * Rede fora do ar e tabela inexistente são coisas diferentes, e tratá-las igual faria o Copilot
   * anunciar que o banco da pessoa sumiu porque o wifi caiu.
   */
  return {
    tabela,
    existe: false,
    legivel: false,
    codigo: error.code ?? null,
    evidencia: `\`${tabela}\` respondeu \`${error.code ?? "erro sem código"}\`: inconclusivo. Não dá para afirmar que existe nem que não existe.`,
  };
}

export type EstadoTabelaPlanejada = {
  nome: string;
  /** `null` enquanto ninguém sondou. Não é `false`: não saber é diferente de não existir. */
  existeNoBanco: boolean | null;
  evidencia: string;
};

/**
 * Confere quais tabelas do plano existem de verdade.
 *
 * Devolve `existeNoBanco: null` para o que não foi possível determinar, e é por isso que o tipo
 * não é um booleano simples. "Não sei" é uma resposta legítima aqui, e apagá-la para simplificar
 * o tipo seria transformar ignorância em afirmação.
 */
export async function conferirTabelasPlanejadas(nomes: string[]): Promise<EstadoTabelaPlanejada[]> {
  const sondas = await Promise.all(nomes.map((n) => sondarTabela(n)));

  return sondas.map((s) => ({
    nome: s.tabela,
    existeNoBanco:
      s.codigo !== null && s.codigo !== AUSENTE && s.codigo !== SEM_PERMISSAO ? null : s.existe,
    evidencia: s.evidencia,
  }));
}

/** O resumo que entra no contexto do Copilot. */
export type ResumoBanco = {
  planejadas: number;
  existem: number;
  faltam: number;
  indeterminadas: number;
  /** A frase que o Copilot recebe. Escrita aqui para ele não ter que inferir o estado. */
  paraOContexto: string;
};

export function resumirBanco(estados: EstadoTabelaPlanejada[]): ResumoBanco {
  const existem = estados.filter((e) => e.existeNoBanco === true).length;
  const faltam = estados.filter((e) => e.existeNoBanco === false).length;
  const indeterminadas = estados.filter((e) => e.existeNoBanco === null).length;

  const partes: string[] = [];

  if (estados.length === 0) {
    partes.push("O projeto ainda não tem modelo de dados.");
  } else if (existem === 0 && indeterminadas === 0) {
    partes.push(
      `As ${estados.length} tabelas do plano são PLANEJADAS: nenhuma existe no banco ainda. O SQL foi gerado e não foi executado.`,
    );
  } else if (faltam === 0 && indeterminadas === 0) {
    partes.push(`As ${estados.length} tabelas do plano existem no banco.`);
  } else {
    partes.push(
      `Das ${estados.length} tabelas do plano, ${existem} existem no banco e ${faltam} ainda não foram criadas.`,
    );
    const nomesFaltando = estados
      .filter((e) => e.existeNoBanco === false)
      .map((e) => e.nome)
      .join(", ");
    if (nomesFaltando) partes.push(`Faltam: ${nomesFaltando}.`);
  }

  if (indeterminadas > 0) {
    partes.push(
      `${indeterminadas} não puderam ser verificadas — trate-as como desconhecidas, não como ausentes.`,
    );
  }

  return {
    planejadas: estados.length,
    existem,
    faltam,
    indeterminadas,
    paraOContexto: partes.join(" "),
  };
}
