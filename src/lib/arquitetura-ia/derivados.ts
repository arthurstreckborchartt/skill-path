import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { FuncionalidadeIa, Nivel, PlanoIa } from "./contrato";
import { ROTULO_NIVEL } from "./contrato";
import {
  ATUALIZADO_EM,
  calcularCusto,
  calcularLatencia,
  escolherModelo,
  formatarDolar,
  type Custo,
  type Latencia,
  type Modelo,
} from "./modelos";

/**
 * Tudo o que se deriva do plano: custo, latência, observabilidade, checklist e os prompts.
 *
 * Nada disto é gerado pela IA, e a razão é a mesma em todos os casos: são coisas que se calculam.
 * Pedir ao modelo que escreva o prompt de implementação daria markdown bonito e genérico, que
 * esquece o nome do banco da pessoa — enquanto o código tem a stack, o modelo de dados e a
 * autenticação na mão, e monta a mesma instrução sem gastar um token.
 */

/** O contexto do projeto que os prompts de implementação precisam conhecer. */
export type ContextoProjeto = {
  nome: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
};

export type FuncionalidadeCalculada = {
  f: FuncionalidadeIa;
  modelo: Modelo | null;
  custo: Custo;
  latencia: Latencia;
  observabilidade: string[];
  /** O prompt para colar numa IA de codificação. */
  promptImplementacao: string;
};

// ---------------------------------------------------------------------------------------------
// Observabilidade
// ---------------------------------------------------------------------------------------------

/**
 * O que registrar, por degrau.
 *
 * É canônico porque não depende do projeto: quem chama um LLM precisa das mesmas quatro coisas
 * para não ficar cego. E é por degrau porque um agente sem registro de cada passo é uma caixa
 * preta que ninguém consegue depurar depois — enquanto uma chamada simples com esse tanto de log
 * é cerimônia que ninguém vai manter.
 */
const OBSERVABILIDADE: Record<Nivel, string[]> = {
  "sem-ia": [],
  "api-pronta": [
    "Registre quanto tempo o serviço levou e quantas vezes falhou. É o que decide se vale trocar de provedor.",
    "Guarde o identificador que o provedor devolve: sem ele, abrir chamado sobre um resultado ruim é impossível.",
  ],
  "llm-simples": [
    "Registre tokens de entrada e de saída de cada chamada. Sem isso você descobre o custo pela fatura, um mês depois.",
    "Guarde o prompt e a resposta das chamadas que falharam ou que alguém reclamou. É o seu único material de depuração.",
    "Marque qual versão do prompt gerou cada resposta. Sem isso, não dá para saber se a piora veio da sua mudança.",
    "Conte quantas vezes o formato voltou inválido. Se esse número sobe, o prompt está degradando.",
  ],
  rag: [
    "Registre tokens e custo por chamada, como em qualquer chamada de LLM.",
    "Guarde QUAIS trechos foram recuperados em cada resposta. Quando a resposta vem errada, o erro quase sempre está aqui, não no prompt.",
    "Registre quando a busca não achou nada relevante. É o sinal de que falta documento, e é diferente de o modelo ter errado.",
    "Marque a versão do índice. Regerar embeddings com outro modelo muda todas as respostas de uma vez.",
  ],
  "tool-calling": [
    "Registre tokens e custo, contando todas as voltas — não só a primeira.",
    "Registre cada ferramenta chamada, com argumentos e resultado. É onde aparecem tanto os bugs quanto as tentativas de abuso.",
    "Conte as chamadas de ferramenta que falharam por permissão. Um número que sobe é alguém testando os limites.",
    "Meça o tempo total da resposta, não o de cada chamada: é o total que a pessoa sente.",
  ],
  agente: [
    "Registre a sequência inteira de passos de cada execução, com o custo de cada um. Um agente sem isso é indepurável.",
    "Ponha um teto de passos e de custo por execução, e registre quando ele for atingido. Agente em laço é a falha mais cara que existe.",
    "Guarde a tarefa original junto do resultado final. Sem os dois lados, não dá para avaliar se ele fez o que foi pedido.",
    "Meça a taxa de tarefas concluídas sem intervenção. É o único número que diz se o agente está funcionando.",
  ],
};

// ---------------------------------------------------------------------------------------------
// Prompts de implementação
// ---------------------------------------------------------------------------------------------

/** O bloco de contexto do projeto, igual em todo prompt: é o que faz a instrução não ser genérica. */
function contextoDoProjeto(c: ContextoProjeto): string[] {
  const t = c.blueprint.tecnico;
  const linhas: string[] = [`## O projeto`, ``, `Nome: ${c.nome}`];

  if (c.blueprint.fundacao) linhas.push(`O que é: ${c.blueprint.fundacao.descricao}`);

  if (t) {
    linhas.push(
      ``,
      `## Stack`,
      ``,
      `- Frontend: ${t.stack.frontend}`,
      `- Backend: ${t.stack.backend}`,
      `- Banco: ${t.stack.banco}`,
      `- Hospedagem: ${t.stack.hospedagem}`,
      ``,
      `Arquitetura: ${t.arquitetura}`,
      ``,
      `Autenticação: ${t.autenticacao.metodo}. ${t.autenticacao.protecaoDeRotas}`,
    );

    if (t.autenticacao.papeis.length > 0) {
      linhas.push(
        `Papéis: ${t.autenticacao.papeis.map((p) => `${p.nome} (${p.pode.join(", ")})`).join("; ")}`,
      );
    }
  }

  if (c.modelo && c.modelo.entidades.length > 0) {
    linhas.push(``, `## Tabelas que já existem`, ``);
    for (const e of c.modelo.entidades) {
      linhas.push(`- \`${e.nome}\`: ${e.colunas.map((col) => col.nome).join(", ")}`);
    }
  }

  if (c.api && c.api.endpoints.length > 0) {
    linhas.push(``, `## Endpoints que já existem`, ``);
    for (const e of c.api.endpoints) {
      linhas.push(`- \`${e.metodo} ${e.caminho}\` — ${e.finalidade}`);
    }
  }

  return linhas;
}

/**
 * A instrução de arquitetura, por degrau.
 *
 * O parágrafo mais importante de cada uma é o que diz **o que não construir**. Uma IA de
 * codificação que recebe "implemente busca nos documentos" entrega banco vetorial, fila de
 * indexação e reranker — porque é o que ela viu em mil tutoriais, não porque este projeto precisa.
 * Dizer o teto é o que impede isso.
 */
const INSTRUCAO_POR_NIVEL: Record<Nivel, string[]> = {
  "sem-ia": [
    "Esta funcionalidade NÃO deve usar IA. Implemente com consulta, regra ou cálculo no próprio backend.",
    "Se em algum momento parecer que só um modelo resolve, pare e releia o problema: a análise concluiu que não é o caso.",
  ],
  "api-pronta": [
    "Use um serviço pronto para isto. NÃO implemente modelo próprio e NÃO monte prompt.",
    "Trate o serviço como qualquer integração externa: chave no ambiente, timeout, retry com espera crescente e um caminho para quando ele estiver fora.",
  ],
  "llm-simples": [
    "UMA chamada ao modelo, com um prompt de sistema. Nada além disso.",
    "NÃO monte RAG, NÃO use ferramentas, NÃO faça laço de agente. Se a resposta vier ruim, o conserto é o prompt — não mais arquitetura.",
    "Peça resposta estruturada pelo parâmetro do provedor, com schema, e valide o resultado antes de gravar qualquer coisa.",
    "Guarde o prompt num arquivo versionado, não embutido no meio da função.",
  ],
  rag: [
    "Implemente em dois tempos: buscar trechos relevantes, depois responder com base neles.",
    "Use o banco que o projeto já tem. Se for Postgres, use pgvector — NÃO contrate um banco vetorial dedicado nesta etapa.",
    "Corte os documentos por seção ou parágrafo, com um pouco de sobreposição. NÃO corte por número fixo de caracteres.",
    "Monte a resposta de modo que ela cite de qual trecho saiu, e instrua o modelo a dizer que não sabe quando os trechos não respondem a pergunta.",
    "NÃO acrescente reranker, expansão de consulta nem busca híbrida agora. Meça primeiro; acrescente só o que a medição pedir.",
  ],
  "tool-calling": [
    "Descreva ao modelo as funções que ele pode pedir, com schema de argumentos, e execute-as no seu backend.",
    "Cada ferramenta confere permissão por conta própria, como se a chamada viesse de fora — porque vem. NÃO confie no modelo para filtrar o que ele pode acessar.",
    "NÃO exponha ferramenta genérica (executar SQL, chamar URL arbitrária). Uma função por operação concreta.",
    "Ponha teto no número de voltas e devolva erro claro ao atingir o teto.",
  ],
  agente: [
    "Implemente o laço: o modelo decide, seu código executa, o resultado volta, repete até concluir.",
    "Teto obrigatório de passos E de custo por execução, verificado a cada volta. Sem os dois, uma falha vira fatura.",
    "Registre cada passo com entrada, saída e custo. Sem esse registro o agente é indepurável.",
    "Antes de escrever: confirme que a sequência de passos realmente não pode ser escrita à mão. Se puder, escreva à mão e chame o modelo dentro de cada passo — fica mais barato, mais rápido e testável.",
  ],
};

function promptDeImplementacao(
  f: FuncionalidadeIa,
  m: Modelo | null,
  latencia: Latencia,
  observabilidade: string[],
  c: ContextoProjeto,
): string {
  const p: string[] = [
    `Implemente "${f.nome}" no projeto abaixo.`,
    ``,
    ...contextoDoProjeto(c),
    ``,
    `## A funcionalidade`,
    ``,
    `Problema que ela resolve: ${f.problema}`,
    `Entra: ${f.input}`,
    `Sai: ${f.output}`,
    ``,
    `## A abordagem decidida: ${ROTULO_NIVEL[f.nivel]}`,
    ``,
    ...INSTRUCAO_POR_NIVEL[f.nivel].map((x) => `- ${x}`),
  ];

  if (f.porqueEsseNivel)
    p.push(``, `Por que esta abordagem e não uma mais complexa: ${f.porqueEsseNivel}`);

  if (m) {
    p.push(``, `## Modelo`, ``, `Use \`${m.id}\` (${m.nome}).`);
    if (m.familia === "outro") {
      p.push(
        `O catálogo do Pathly não fixa o provedor aqui — escolha um equivalente e confirme o preço antes de subir.`,
      );
    }
  }

  if (f.contexto.length > 0) {
    p.push(
      ``,
      `## O que precisa estar no contexto da chamada`,
      ``,
      ...f.contexto.map((x) => `- ${x}`),
    );
  }

  if (f.promptSistema) {
    p.push(
      ``,
      `## Prompt de sistema sugerido`,
      ``,
      `Use este como ponto de partida, num arquivo versionado:`,
      ``,
      `"""`,
      f.promptSistema,
      `"""`,
    );
  }

  if (latencia.streaming) {
    p.push(
      ``,
      `## Streaming`,
      ``,
      `Obrigatório aqui: ${latencia.porque} Guarde a resposta completa no servidor enquanto transmite — se a conexão cair, a pessoa não pode perder o que já foi escrito.`,
    );
  } else if (!f.sincrona) {
    p.push(
      ``,
      `## Execução`,
      ``,
      `Rode em segundo plano e avise quando terminar. ${latencia.porque}`,
    );
  }

  if (f.seguranca.length > 0 || f.privacidade.length > 0) {
    p.push(``, `## Segurança e privacidade`, ``);
    for (const x of f.seguranca) p.push(`- ${x}`);
    for (const x of f.privacidade) p.push(`- ${x}`);
    p.push(
      `- Trate tudo que vier de quem usa como texto hostil: nunca deixe o conteúdo do usuário virar instrução do sistema.`,
    );
  }

  if (f.fallback) {
    p.push(
      ``,
      `## Quando a IA falhar`,
      ``,
      `${f.fallback}`,
      ``,
      `Implemente esse caminho junto, não depois. Provedor de IA sai do ar, e a tela precisa continuar funcionando.`,
    );
  }

  if (observabilidade.length > 0) {
    p.push(``, `## O que registrar`, ``, ...observabilidade.map((x) => `- ${x}`));
  }

  if (f.comoAvaliar.length > 0) {
    p.push(
      ``,
      `## Como saber que funcionou`,
      ``,
      ...f.comoAvaliar.map((x) => `- ${x}`),
      ``,
      `Monte um arquivo com 20 a 30 casos reais e a resposta esperada de cada um, e rode antes e depois de qualquer mudança de prompt.`,
    );
  }

  p.push(
    ``,
    `## Limite deste pedido`,
    ``,
    `Implemente exatamente o que está acima. Não acrescente abstração, camada de configuração nem provedor alternativo que não foi pedido — o produto está sendo construído por uma pessoa só, e cada peça a mais é uma peça a mais para manter.`,
  );

  return p.join("\n");
}

// ---------------------------------------------------------------------------------------------
// Derivação
// ---------------------------------------------------------------------------------------------

export function calcular(f: FuncionalidadeIa, c: ContextoProjeto): FuncionalidadeCalculada {
  const modelo = escolherModelo(f);
  const custo = calcularCusto(f, modelo);
  const latencia = calcularLatencia(f, modelo);
  const observabilidade = OBSERVABILIDADE[f.nivel];

  return {
    f,
    modelo,
    custo,
    latencia,
    observabilidade,
    promptImplementacao: promptDeImplementacao(f, modelo, latencia, observabilidade, c),
  };
}

export type ResumoPlano = {
  /** Soma do que dá para somar. `null` quando nenhum item tem preço conferido. */
  custoMensal: number | null;
  /** Quantos itens ficaram de fora da soma, por falta de preço no catálogo. */
  semPreco: number;
  comIa: number;
  semIa: number;
  /** O degrau mais alto do plano. Decide o tom da tela. */
  nivelMaximo: Nivel | null;
};

export function resumir(calculadas: FuncionalidadeCalculada[]): ResumoPlano {
  const comPreco = calculadas.filter((x) => x.custo.porMes !== null);
  const naoBarato = calculadas.filter((x) => x.f.nivel !== "sem-ia");

  return {
    custoMensal:
      comPreco.length > 0 ? comPreco.reduce((s, x) => s + (x.custo.porMes ?? 0), 0) : null,
    semPreco: naoBarato.length - comPreco.length,
    comIa: naoBarato.length,
    semIa: calculadas.length - naoBarato.length,
    nivelMaximo:
      naoBarato.length > 0
        ? naoBarato.reduce((a, b) => (PESO[a.f.nivel] >= PESO[b.f.nivel] ? a : b)).f.nivel
        : null,
  };
}

const PESO: Record<Nivel, number> = {
  "sem-ia": 0,
  "api-pronta": 1,
  "llm-simples": 2,
  rag: 3,
  "tool-calling": 4,
  agente: 5,
};

/** O relatório em Markdown, para anexar no README ou mandar para alguém revisar. */
export function gerarRelatorio(
  plano: PlanoIa,
  calculadas: FuncionalidadeCalculada[],
  resumo: ResumoPlano,
  nomeProjeto: string,
): string {
  const p: string[] = [`# Arquitetura de IA — ${nomeProjeto}`, ``];

  p.push(`## Você precisa de IA?`, ``, plano.precisaDeIa ? `**Sim, em parte.**` : `**Não.**`, ``);
  p.push(plano.veredito, ``);

  if (plano.descartadas.length > 0) {
    p.push(`## O que não precisa de IA`, ``);
    for (const d of plano.descartadas) {
      p.push(`### ${d.nome}`, ``, d.porque, ``, `**No lugar:** ${d.oQueUsarNoLugar}`, ``);
    }
  }

  if (calculadas.length > 0) {
    p.push(`## As funcionalidades`, ``);

    if (resumo.custoMensal !== null) {
      p.push(
        `Custo estimado: **${formatarDolar(resumo.custoMensal)} por mês** (preços de ${ATUALIZADO_EM}).`,
        ``,
      );
    }

    for (const { f, modelo, custo, latencia, observabilidade } of calculadas) {
      p.push(`### ${f.nome} — ${ROTULO_NIVEL[f.nivel]}`, ``);
      p.push(`**Problema:** ${f.problema}`, ``);
      p.push(`**Entra:** ${f.input}`, ``);
      p.push(`**Sai:** ${f.output}`, ``);
      if (f.porqueEsseNivel) p.push(`**Por que esta abordagem:** ${f.porqueEsseNivel}`, ``);
      if (f.oQueNaoBasta) p.push(`**O que o degrau abaixo não resolve:** ${f.oQueNaoBasta}`, ``);
      if (modelo) p.push(`**Modelo:** ${modelo.nome} (\`${modelo.id}\`)`, ``);
      p.push(`**Custo:** ${formatarDolar(custo.porMes)} por mês`, ``);
      p.push(...custo.premissas.map((x) => `- ${x}`), ``);
      p.push(`**Latência:** ${latencia.faixa}. ${latencia.porque}`, ``);
      if (f.contexto.length > 0)
        p.push(`**Contexto:**`, ``, ...f.contexto.map((x) => `- ${x}`), ``);
      if (f.seguranca.length > 0)
        p.push(`**Segurança:**`, ``, ...f.seguranca.map((x) => `- ${x}`), ``);
      if (f.privacidade.length > 0)
        p.push(`**Privacidade:**`, ``, ...f.privacidade.map((x) => `- ${x}`), ``);
      if (f.fallback) p.push(`**Quando falhar:** ${f.fallback}`, ``);
      if (f.comoAvaliar.length > 0)
        p.push(`**Como avaliar:**`, ``, ...f.comoAvaliar.map((x) => `- ${x}`), ``);
      if (observabilidade.length > 0)
        p.push(`**Observabilidade:**`, ``, ...observabilidade.map((x) => `- ${x}`), ``);
    }
  }

  return p.join("\n");
}
