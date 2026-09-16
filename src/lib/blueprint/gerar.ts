import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { ESQUEMAS } from "./esquemas";
import { DEPENDE_DE, VALIDADORES, podeGerar, type Bloco, type Blueprint } from "./contrato";
import { diretrizesEmTexto, filtrarTecnico } from "./regras";
import { ROTULO_NIVEL, ROTULO_TIPO, type Respostas } from "./respostas";

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
endpoints, autenticação, segurança e integrações. Modele os dados a partir dos requisitos
funcionais acima, não a partir do que é comum em projetos parecidos.`,

  operacao: `Defina o que sustenta este sistema depois de pronto: requisitos não funcionais com
número, a infraestrutura mínima com custo estimado, como o deploy acontece e quais testes valem
o esforço. Quem vai operar isto é uma pessoa só — nada aqui pode exigir um time.`,

  execucao: `Monte a ordem de construção. Cada etapa entrega algo que passa a existir e que dá
para verificar. A primeira fase é sempre fundação técnica — projeto, banco, autenticação. Tela
nunca vem antes da tabela que ela mostra.`,
};

/** Formato compacto por bloco, para os serviços que não aceitam schema estruturado. */
const FORMATO: Record<Bloco, string> = {
  fundacao: `Responda SOMENTE com JSON:
{"nome":"","descricao":"","problema":"","publico":"","persona":{"nome":"","papel":"","contexto":"","dores":[""],"alternativaAtual":""},"propostaDeValor":"","modeloDeNegocio":{"tipo":"","precoSugerido":"","justificativa":""}}`,

  produto: `Responda SOMENTE com JSON. 4 a 14 funcionalidades, no máximo um terço com "mvp". Os
requisitos detalham APENAS as funcionalidades do MVP. Nao invente funcionalidade para encher
lista — projeto pequeno tem lista pequena:
{"funcionalidades":[{"nome":"","descricao":"","prioridade":"mvp|depois","porque":"","complexidade":"baixa|media|alta"}],"requisitosFuncionais":[{"id":"RF-01","funcionalidade":"","descricao":"","criterioAceite":""}],"foraDoEscopo":[""]}`,

  tecnico: `Responda SOMENTE com JSON. Use quantas tabelas o projeto precisar, nem uma a mais:
uma tabela so e uma resposta legitima para um sistema simples:
{"stack":{"frontend":"","backend":"","banco":"","hospedagem":"","justificativa":""},"arquitetura":"","tabelas":[{"nome":"","descricao":"","campos":[{"nome":"","tipo":"","descricao":""}],"relacoes":[""]}],"endpoints":[{"metodo":"GET","caminho":"","descricao":"","autenticado":true}],"autenticacao":{"necessaria":true,"metodo":"","sessao":"","papeis":[],"protecaoDeRotas":""},"seguranca":[""],"integracoes":[{"nome":"","para":"","obrigatoria":true}],"ia":""}`,

  operacao: `Responda SOMENTE com JSON. Todo requisito não funcional precisa de um número em
"comoMedir" — sem número ele e recusado:
{"requisitosNaoFuncionais":[{"categoria":"","descricao":"","comoMedir":""}],"infraestrutura":[{"componente":"","servico":"","porque":"","custoEstimado":""}],"deploy":{"estrategia":"","ambientes":[""],"passos":[""],"variaveis":[""]},"testes":[{"tipo":"","oQueCobre":"","ferramenta":"","prioridade":"alta|media|baixa"}]}`,

  execucao: `Responda SOMENTE com JSON. 6 a 30 etapas, "ordem" começando em 1 sem pular número, e
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
  fundacao: 45_000,
  produto: 70_000,
  // Os tres maiores sobem para 85s: com o questionario e as diretrizes o prompt cresceu, e a
  // fatia por tentativa precisa de espaco para uma segunda chance depois de uma falha lenta.
  tecnico: 85_000,
  operacao: 75_000,
  execucao: 85_000,
};

const TOKENS: Record<Bloco, number> = {
  fundacao: 4096,
  produto: 10_240,
  tecnico: 12_288,
  operacao: 8192,
  execucao: 10_240,
};

/**
 * Gera um bloco. Recusa antes de gastar chamada se as dependências não estiverem prontas — é a
 * mesma regra que a tela aplica, escrita também aqui porque a tela não é o único caminho até o
 * endpoint.
 */
/** O que a pessoa respondeu, em texto, para o modelo ler antes de decidir qualquer coisa. */
function questionario(r: Respostas): string {
  const sim = (b: boolean) => (b ? "sim" : "não");
  return [
    `## O que a pessoa respondeu`,
    `O que quer criar: ${r.oQue}`,
    `Para quem: ${r.paraQuem}`,
    `Problema que resolve: ${r.problema}`,
    `Como pretende ganhar dinheiro: ${r.comoGanhaDinheiro || "ainda não sabe"}`,
    `Tipo de projeto: ${ROTULO_TIPO[r.tipo]}`,
    `Terá IA: ${sim(r.temIa)}`,
    `Terá pagamentos: ${sim(r.temPagamentos)}`,
    `Terá usuários autenticados: ${sim(r.temAutenticacao)}`,
    `Terá dados sensíveis: ${sim(r.temDadosSensiveis)}`,
    `Terá upload de arquivos: ${sim(r.temUploads)}`,
    `Tipos de usuário: ${r.tiposDeUsuario === "varios" ? "vários" : "um só"}`,
    `Terá integrações externas: ${sim(r.temIntegracoes)}${r.integracoesQuais ? ` (${r.integracoesQuais})` : ""}`,
    `Nível técnico: ${ROTULO_NIVEL[r.nivelTecnico]}`,
    `Pretende construir: ${r.comoConstroi.map((m) => (m === "ia" ? "com IA" : "programando à mão")).join(" e ")}`,
    `Stack que já decidiu: ${r.stackPreferida || "nenhuma, decida você"}`,
  ].join("\n");
}

export async function gerarBloco(
  bloco: Bloco,
  ideia: string,
  blueprint: Blueprint,
  respostas: Respostas,
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

  /**
   * As diretrizes vêm **por último**, depois do contexto e da instrução.
   *
   * Posição importa: instrução no fim da mensagem é a que o modelo segue com mais consistência, e
   * estas são as regras que não podem ser negociadas. São elas que impedem o plano de ganhar um
   * gateway de pagamento que ninguém pediu.
   */
  const usuario = [
    `A ideia, nas palavras da pessoa: "${ideia}"`,
    ``,
    questionario(respostas),
    ``,
    contexto(blueprint, bloco),
    ``,
    INSTRUCAO[bloco],
    ``,
    diretrizesEmTexto(respostas),
  ].join("\n");

  const saida = await gerarJson(
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

  // Segunda camada: o prompt resolve o caso comum, isto fecha o que escapou. Só o bloco técnico
  // tem listas onde remover um item não deixa buraco — ver `filtrarTecnico`.
  if (saida.ok && bloco === "tecnico") {
    return {
      ...saida,
      dados: filtrarTecnico(saida.dados as Record<string, unknown>, respostas),
    };
  }

  return saida;
}
