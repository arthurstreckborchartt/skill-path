import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { ESQUEMAS } from "./esquemas";
import { DEPENDE_DE, VALIDADORES, podeGerar, type Bloco, type Blueprint } from "./contrato";

/**
 * Geração de um bloco do blueprint. **Só no servidor.**
 *
 * A regra que sustenta o produto está em `contexto()`: cada bloco recebe, por escrito, o que já
 * foi decidido nos blocos anteriores. O bloco técnico não escolhe banco de dados no vácuo — ele
 * lê as funcionalidades marcadas como MVP e modela para elas.
 *
 * Isso é o oposto de pedir tudo a um chatbot de uma vez, que é o que a pessoa faria sozinha. Lá,
 * o modelo inventa uma stack genérica antes de saber quem usa. Aqui a ordem é forçada.
 */

const SISTEMA = `Você é um arquiteto de software sênior que ajuda uma pessoa a sair de uma ideia
solta e chegar a um plano técnico que dá para executar.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas e diretas.

COMO PENSAR:
- Seja específico até doer. "Cadastro de alunos com foto, plano e vencimento" vale; "gestão de
  usuários" não vale nada.
- Prefira o simples que funciona ao impressionante que atrasa. Quem vai construir isto é uma
  pessoa só, provavelmente sozinha, com tempo limitado.
- Quando houver escolha, escolha e justifique. Não devolva três opções para a pessoa decidir —
  ela veio aqui porque não sabe decidir isso ainda.
- Se a ideia tiver um problema sério (mercado inexistente, exigência legal pesada, custo de
  infraestrutura incompatível com o preço), diga isso no campo apropriado. Não finja que está tudo
  bem para ser agradável.

O QUE NUNCA FAZER:
- Não invente número de mercado, estatística, faturamento ou porcentagem de crescimento.
- Não prometa resultado, receita ou prazo de sucesso.
- Não use "revolucionário", "disruptivo", "inovador", "solução completa" nem "de ponta".
- Não escreva nada que só faça sentido depois de ler um pitch de investidor.`;

/**
 * O que já foi decidido, em texto, para o modelo ler antes de escrever o bloco seguinte.
 *
 * Só entra o que importa para a decisão do bloco atual: mandar o blueprint inteiro a cada chamada
 * empurraria o prompt para milhares de tokens e deixaria o modelo mais lento sem ficar melhor.
 */
function contexto(bp: Blueprint, bloco: Bloco): string {
  const partes: string[] = [];

  if (DEPENDE_DE[bloco].includes("fundacao") && bp.fundacao) {
    const f = bp.fundacao;
    partes.push(
      `## O que já foi definido sobre o produto`,
      `Nome: ${f.nome}`,
      `O que é: ${f.descricao}`,
      `Problema: ${f.problema}`,
      `Público: ${f.publico}`,
      `Quem usa: ${f.persona.nome}, ${f.persona.papel}. ${f.persona.contexto}`,
      `Hoje resolve assim: ${f.persona.alternativaAtual}`,
      `Proposta de valor: ${f.propostaDeValor}`,
      `Modelo de negócio: ${f.modeloDeNegocio.tipo}, ${f.modeloDeNegocio.precoSugerido}`,
    );
  }

  if (DEPENDE_DE[bloco].includes("produto") && bp.produto) {
    const mvp = bp.produto.funcionalidades.filter((x) => x.prioridade === "mvp");
    const depois = bp.produto.funcionalidades.filter((x) => x.prioridade === "depois");
    partes.push(
      ``,
      `## Funcionalidades do MVP (modele para ESTAS)`,
      ...mvp.map((x) => `- ${x.nome}: ${x.descricao}`),
      ``,
      `## Ficam para depois (não modele agora, mas não inviabilize)`,
      ...depois.map((x) => `- ${x.nome}`),
      ``,
      `## Fora do escopo`,
      ...bp.produto.foraDoEscopo.map((x) => `- ${x}`),
    );
  }

  if (DEPENDE_DE[bloco].includes("tecnico") && bp.tecnico) {
    const t = bp.tecnico;
    partes.push(
      ``,
      `## Decisões técnicas já tomadas`,
      `Stack: ${t.stack.frontend} / ${t.stack.backend} / ${t.stack.banco} / ${t.stack.hospedagem}`,
      `Arquitetura: ${t.arquitetura}`,
      `Tabelas: ${t.tabelas.map((x) => x.nome).join(", ")}`,
      `Integrações: ${t.integracoes.map((x) => x.nome).join(", ") || "nenhuma"}`,
    );
  }

  // Decisões que a pessoa tomou valem mais que qualquer preferência do modelo — é o projeto dela.
  if (bp.decisoes?.length) {
    partes.push(
      ``,
      `## Decisões que a pessoa já tomou e que você DEVE respeitar`,
      ...bp.decisoes.map((d) => `- ${d.decisao} (motivo: ${d.porque})`),
    );
  }

  return partes.join("\n");
}

const INSTRUCAO: Record<Bloco, string> = {
  fundacao: `Defina a fundação deste produto: que problema real ele resolve, para quem, e por que
alguém pagaria por ele. Se a ideia estiver vaga, escolha a interpretação mais específica e
defensável — não devolva algo genérico só porque a ideia veio genérica.`,

  produto: `Liste o que este produto faz, separando o que precisa existir no MVP do que fica para
depois. O MVP é o menor conjunto que já resolve o problema da persona de ponta a ponta — se
faltar uma peça desse caminho, o produto não serve para nada.`,

  tecnico: `Defina como este produto existe tecnicamente: stack, arquitetura, modelo de dados,
endpoints, segurança e integrações. Modele os dados a partir das funcionalidades do MVP acima,
não a partir do que é comum em projetos parecidos.`,

  execucao: `Monte a ordem de construção. Cada etapa entrega algo que passa a existir e que dá
para verificar. A primeira fase é sempre fundação técnica — projeto, banco, autenticação. Tela
nunca vem antes da tabela que ela mostra.`,
};

/** Formato compacto por bloco, para os serviços que não aceitam schema estruturado. */
const FORMATO: Record<Bloco, string> = {
  fundacao: `Responda SOMENTE com JSON:
{"nome":"","descricao":"","problema":"","publico":"","persona":{"nome":"","papel":"","contexto":"","dores":[""],"alternativaAtual":""},"propostaDeValor":"","modeloDeNegocio":{"tipo":"","precoSugerido":"","justificativa":""}}`,

  produto: `Responda SOMENTE com JSON. 6 a 14 funcionalidades, no máximo um terço com prioridade "mvp":
{"funcionalidades":[{"nome":"","descricao":"","prioridade":"mvp|depois","porque":"","complexidade":"baixa|media|alta"}],"foraDoEscopo":[""]}`,

  tecnico: `Responda SOMENTE com JSON:
{"stack":{"frontend":"","backend":"","banco":"","hospedagem":"","justificativa":""},"arquitetura":"","tabelas":[{"nome":"","descricao":"","campos":[{"nome":"","tipo":"","descricao":""}],"relacoes":[""]}],"endpoints":[{"metodo":"GET","caminho":"","descricao":"","autenticado":true}],"seguranca":[""],"integracoes":[{"nome":"","para":"","obrigatoria":true}],"ia":""}`,

  execucao: `Responda SOMENTE com JSON. 10 a 30 etapas, "ordem" começando em 1 sem pular número, e
"fase" sempre igual ao nome de uma das fases:
{"fases":[{"nome":"","objetivo":""}],"etapas":[{"ordem":1,"titulo":"","entrega":"","fase":"","dependeDe":[],"estimativaHoras":4}],"riscos":[{"descricao":"","impacto":"baixo|medio|alto","mitigacao":""}]}`,
};

/**
 * Tetos por bloco, calibrados pelo tamanho da saída e não por um número redondo.
 *
 * `execucao` é o maior de longe: até 30 etapas com entrega e dependências. `fundacao` é o menor,
 * e é o que a pessoa espera na tela — vale mantê-lo curto para o primeiro resultado chegar rápido.
 */
const TETOS_MS: Record<Bloco, number> = {
  fundacao: 40_000,
  produto: 50_000,
  tecnico: 65_000,
  execucao: 65_000,
};

const TOKENS: Record<Bloco, number> = {
  fundacao: 4096,
  produto: 6144,
  tecnico: 10_240,
  execucao: 10_240,
};

/**
 * Gera um bloco. Recusa antes de gastar chamada se as dependências não estiverem prontas — é a
 * mesma regra que a tela aplica, escrita também aqui porque a tela não é o único caminho até o
 * endpoint.
 */
export async function gerarBloco(
  bloco: Bloco,
  ideia: string,
  blueprint: Blueprint,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<unknown>> {
  const permissao = podeGerar(blueprint, bloco);
  if (!permissao.pode) {
    return {
      ok: false,
      motivo: "invalida",
      detalhe: `Antes de gerar "${bloco}" é preciso ter: ${permissao.falta.join(", ")}.`,
    };
  }

  const usuario = [
    `A ideia, nas palavras da pessoa: "${ideia}"`,
    ``,
    contexto(blueprint, bloco),
    ``,
    INSTRUCAO[bloco],
  ]
    .filter((x) => x !== undefined)
    .join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: ESQUEMAS[bloco],
      formato: FORMATO[bloco],
      validar: VALIDADORES[bloco] as (v: unknown) => unknown | null,
      tetoMs: TETOS_MS[bloco],
      maxTokens: TOKENS[bloco],
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
