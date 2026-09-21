/**
 * O que volta da ferramenta — e de onde veio.
 *
 * ## A regra que organiza este arquivo
 *
 * Três das quatro ferramentas não reportam nada de volta. O caminho honesto não é fingir que
 * reportam: é aceitar todo retorno que chegar e **marcar de onde veio**. Todo registro carrega
 * `origem`, e `origem` nunca se perde pelo caminho.
 *
 * Isso não é burocracia. "Os testes passaram" dito pela ferramenta que rodou os testes e "os
 * testes passaram" dito por quem achou que tinha rodado são a mesma frase com valores de prova
 * diferentes — e é sobre a segunda que as decisões erradas são tomadas. O histórico mostra a
 * diferença, sempre.
 *
 * ## O que é registrado
 *
 * Os oito tipos que você listou, nesta ordem, porque é a ordem em que acontecem numa etapa.
 */

export const TIPOS_DE_REGISTRO = [
  "tarefa-iniciada",
  "tarefa-concluida",
  "arquivos-alterados",
  "testes-executados",
  "erro",
  "decisao-tecnica",
  "observacao",
  "proximo-passo",
] as const;

export type TipoDeRegistro = (typeof TIPOS_DE_REGISTRO)[number];

export const ROTULO_REGISTRO: Record<TipoDeRegistro, string> = {
  "tarefa-iniciada": "Tarefa iniciada",
  "tarefa-concluida": "Tarefa concluída",
  "arquivos-alterados": "Arquivos alterados",
  "testes-executados": "Testes executados",
  erro: "Erro",
  "decisao-tecnica": "Decisão técnica",
  observacao: "Observação",
  "proximo-passo": "Próximo passo",
};

/**
 * Os três níveis de prova.
 *
 * - `ferramenta`: o Pathly leu direto, por um canal dele. É o único que vale como verificação.
 * - `colado`: a ferramenta escreveu o bloco, você trouxe. O texto é dela — tem o detalhe de quem
 *   executou —, mas o Pathly não viu acontecer, e o caminho passou por um Ctrl+C.
 * - `pessoa`: você digitou. Relato, e relato é útil sem ser prova.
 *
 * O `colado` foi acrescentado quando a orquestração começou a pedir o bloco de resultado no
 * próprio brief. Antes dele, esse caso caía em `pessoa`, e isso subestimava a informação: "2
 * testes falharam em src/auth.test.ts" escrito pela ferramenta não é a mesma coisa que alguém
 * lembrando que deu ruim. Com ele, o histórico para de achatar três coisas diferentes em duas.
 */
export const ORIGENS = ["ferramenta", "colado", "pessoa"] as const;
export type Origem = (typeof ORIGENS)[number];

export const ROTULO_ORIGEM: Record<Origem, string> = {
  ferramenta: "verificado",
  colado: "colado da ferramenta",
  pessoa: "informado por você",
};

export const EXPLICACAO_ORIGEM: Record<Origem, string> = {
  ferramenta: "A ferramenta reportou isto direto ao Pathly.",
  colado:
    "A ferramenta escreveu isto e você trouxe. O Pathly não viu acontecer — vale mais que um " +
    "relato e menos que uma verificação.",
  pessoa: "Você informou isto. O Pathly registra como relato, não como verificação.",
};

export type RegistroDeTrabalho = {
  id: string;
  tipo: TipoDeRegistro;
  origem: Origem;
  /** O id do provedor, para o histórico dizer com qual ferramenta a etapa foi feita. */
  provedorId: string;
  texto: string;
  /** Caminhos, quando o tipo pede. Vazio nos demais. */
  itens: readonly string[];
  em: string;
};

// =============================================================================================
// O retorno manual — as quatro respostas
// =============================================================================================

/**
 * As quatro que você pediu, e nenhuma quinta.
 *
 * Um campo de texto livre sozinho aqui produziria "deu certo" e "tá dando erro", que não
 * alimentam nada. Quatro botões produzem quatro caminhos diferentes no Pathly — e o texto livre
 * continua existindo, mas **dentro** da resposta escolhida, onde já tem significado.
 */
export const RESPOSTAS = [
  "implementei",
  "nao-funcionou",
  "preciso-de-ajuda",
  "mudei-a-arquitetura",
] as const;

export type Resposta = (typeof RESPOSTAS)[number];

export const ROTULO_RESPOSTA: Record<Resposta, string> = {
  implementei: "Implementei",
  "nao-funcionou": "Não funcionou",
  "preciso-de-ajuda": "Preciso de ajuda",
  "mudei-a-arquitetura": "Mudei a arquitetura",
};

/** O que o Pathly faz com cada uma. Aparece embaixo do botão, antes de a pessoa clicar. */
export const CONSEQUENCIA_RESPOSTA: Record<Resposta, string> = {
  implementei:
    "Registra a etapa como entregue e abre a próxima. Você ainda confirma antes de fechar.",
  "nao-funcionou":
    "Guarda o que falhou. Vai junto no próximo contexto, para a ferramenta não repetir a mesma tentativa.",
  "preciso-de-ajuda": "Abre o Copilot com o contexto desta etapa já carregado.",
  "mudei-a-arquitetura":
    "Registra a mudança como decisão técnica. Entra no contexto de todas as etapas seguintes.",
};

/** O que o campo de texto pede em cada resposta. Genérico aqui vira resposta genérica depois. */
export const PERGUNTA_RESPOSTA: Record<Resposta, string> = {
  implementei: "O que ficou pronto?",
  "nao-funcionou": "O que aconteceu? Cole a mensagem de erro, se houver.",
  "preciso-de-ajuda": "Onde você travou?",
  "mudei-a-arquitetura": "O que mudou, e por quê?",
};

/** Sem texto, `nao-funcionou` vira um registro que não ajuda ninguém — nem a próxima tentativa. */
export const TEXTO_OBRIGATORIO: Record<Resposta, boolean> = {
  implementei: false,
  "nao-funcionou": true,
  "preciso-de-ajuda": true,
  "mudei-a-arquitetura": true,
};

const TIPO_DA_RESPOSTA: Record<Resposta, TipoDeRegistro> = {
  implementei: "tarefa-concluida",
  "nao-funcionou": "erro",
  "preciso-de-ajuda": "observacao",
  "mudei-a-arquitetura": "decisao-tecnica",
};

export type EntradaManual = {
  resposta: Resposta;
  texto: string;
  /** Caminhos que a pessoa listou, se listou. Opcional em toda resposta. */
  arquivos?: readonly string[];
};

export function validarEntradaManual(e: EntradaManual): string | null {
  if (TEXTO_OBRIGATORIO[e.resposta] && !e.texto.trim()) {
    return PERGUNTA_RESPOSTA[e.resposta];
  }
  return null;
}

function idNovo(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * A resposta manual vira registros — plural, porque uma resposta costuma carregar mais de um
 * fato. "Implementei, mexi nestes quatro arquivos" são duas coisas que o histórico consulta
 * separado.
 */
export function registrosDaResposta(
  e: EntradaManual,
  provedorId: string,
  agora = new Date(),
): RegistroDeTrabalho[] {
  const em = agora.toISOString();
  const base = { origem: "pessoa" as const, provedorId, em };

  const saida: RegistroDeTrabalho[] = [
    {
      id: idNovo(),
      tipo: TIPO_DA_RESPOSTA[e.resposta],
      texto: e.texto.trim() || ROTULO_RESPOSTA[e.resposta],
      itens: [],
      ...base,
    },
  ];

  const arquivos = (e.arquivos ?? []).filter((x) => x.trim());
  if (arquivos.length > 0) {
    saida.push({
      id: idNovo(),
      tipo: "arquivos-alterados",
      texto: `${arquivos.length} arquivo(s) alterado(s), segundo você.`,
      itens: arquivos,
      ...base,
    });
  }

  return saida;
}

// =============================================================================================
// O retorno estruturado — quando a ferramenta de fato reporta
// =============================================================================================

/**
 * O que uma ferramenta com API direta devolve.
 *
 * Tudo opcional: uma resposta da API pode trazer só texto. Campo ausente não vira registro — um
 * "testes executados: nenhum" registrado como fato seria pior que silêncio, porque parece
 * verificação.
 */
export type RetornoEstruturado = {
  resumo?: string;
  arquivos?: readonly string[];
  testes?: { comando: string; passou: boolean; saida?: string };
  erros?: readonly string[];
  decisoes?: readonly string[];
  observacoes?: readonly string[];
  proximoPasso?: string;
};

export function registrosDoRetorno(
  r: RetornoEstruturado,
  provedorId: string,
  agora = new Date(),
): RegistroDeTrabalho[] {
  const em = agora.toISOString();
  const base = { origem: "ferramenta" as const, provedorId, em };
  const saida: RegistroDeTrabalho[] = [];

  const simples = (tipo: TipoDeRegistro, texto?: string) => {
    if (texto && texto.trim()) saida.push({ id: idNovo(), tipo, texto, itens: [], ...base });
  };
  const varios = (tipo: TipoDeRegistro, textos?: readonly string[]) => {
    for (const t of textos ?? []) simples(tipo, t);
  };

  simples("tarefa-concluida", r.resumo);

  const arquivos = (r.arquivos ?? []).filter((x) => x.trim());
  if (arquivos.length > 0) {
    saida.push({
      id: idNovo(),
      tipo: "arquivos-alterados",
      texto: `${arquivos.length} arquivo(s) alterado(s).`,
      itens: arquivos,
      ...base,
    });
  }

  if (r.testes) {
    saida.push({
      id: idNovo(),
      tipo: "testes-executados",
      texto: `${r.testes.comando} — ${r.testes.passou ? "passou" : "falhou"}.`,
      /*
       * A saída do comando entra como item, não no texto: ela pode ter centenas de linhas, e o
       * texto é o que aparece na lista do histórico.
       */
      itens: r.testes.saida ? [r.testes.saida] : [],
      ...base,
    });
  }

  varios("erro", r.erros);
  varios("decisao-tecnica", r.decisoes);
  varios("observacao", r.observacoes);
  simples("proximo-passo", r.proximoPasso);

  return saida;
}

// =============================================================================================
// O laço se fechando
// =============================================================================================

/**
 * Os erros desta etapa, para `KNOWN_ERRORS` do próximo pacote de contexto.
 *
 * É aqui que o retorno deixa de ser histórico e passa a valer alguma coisa: o que falhou ontem
 * chega amanhã na cabeça da ferramenta, antes de ela tentar de novo.
 *
 * A origem entra no texto. A ferramenta precisa saber que "não funcionou" é o relato de uma
 * pessoa, não um teste que falhou — as duas informações são úteis, e não são a mesma.
 */
export function errosConhecidosDe(registros: readonly RegistroDeTrabalho[]): string[] {
  const marca: Record<Origem, string> = {
    ferramenta: "",
    colado: " (reportado pela ferramenta)",
    pessoa: " (relatado por você)",
  };
  return registros
    .filter((r) => r.tipo === "erro" || (r.tipo === "testes-executados" && /falhou/.test(r.texto)))
    .map((r) => `${r.texto}${marca[r.origem]}`);
}

/** As decisões que vieram do trabalho, para virarem `Decisao` do projeto. */
export function decisoesDe(registros: readonly RegistroDeTrabalho[]): RegistroDeTrabalho[] {
  return registros.filter((r) => r.tipo === "decisao-tecnica");
}
