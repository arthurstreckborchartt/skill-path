import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { validarPlano, NIVEIS, type PlanoIa } from "./contrato";
import { MODELOS } from "./modelos";
import { ROTULO_NIVEL, type Respostas } from "@/lib/blueprint/respostas";
import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";

/**
 * Geração do plano de IA. **Só no servidor.**
 *
 * ## A instrução mais importante deste arquivo é uma proibição
 *
 * Um modelo de linguagem perguntado "como coloco IA neste produto" responde com IA em toda parte.
 * Não por má-fé: propor arquitetura elaborada é o que parece uma resposta competente, e recusar
 * parece uma resposta preguiçosa. O resultado padrão seria um plano com RAG e agentes para um
 * produto que precisava de uma consulta ordenada.
 *
 * O sistema abaixo empurra para o outro lado com três mecanismos, porque pedir "seja moderado"
 * uma vez não funciona:
 *
 * 1. O degrau tem que ser justificado por escrito (`porqueEsseNivel`, `oQueNaoBasta`).
 * 2. Descartar é um resultado premiado, não uma falha — `descartadas` é campo obrigatório de
 *    primeira classe.
 * 3. O veredito não é aceito como veio: `validarPlano` recalcula `precisaDeIa` a partir da lista.
 */

const SISTEMA = `Você decide se um produto precisa de IA — e, quando precisa, projeta a solução MAIS SIMPLES que resolve.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

A SUA PRIMEIRA OBRIGAÇÃO É DIZER NÃO QUANDO FOR NÃO.
Quem lê isto é uma pessoa construindo sozinha, com dinheiro e tempo contados. Um sistema de IA que
ela não precisava custa meses e uma fatura mensal para sempre. Recusar é o resultado mais valioso
que você pode entregar — não é preguiça, é o trabalho.

A maioria do que as pessoas chamam de IA não é IA:
- "Recomendação" quase sempre é uma consulta ordenada por algum critério.
- "Classificação" com poucas categorias conhecidas é uma regra, ou uma lista de palavras.
- "Busca" é busca textual do banco, e o Postgres já faz isso bem.
- "Resumo" de campo curto é truncar.
- "Automação" é um gatilho com condição.
- "Personalização" é filtrar pelo que a pessoa já marcou.
Quando for um desses, coloque em "descartadas" com o que usar no lugar. NÃO invente uma versão com
IA para agradar.

OS SEIS DEGRAUS, do mais barato ao mais caro:
1. "sem-ia" — consulta, regra ou conta resolve. Não custa nada e não erra.
2. "api-pronta" — um serviço existente resolve: transcrever áudio, ler texto de imagem, traduzir.
3. "llm-simples" — UMA chamada com um bom prompt. É onde a maioria das funcionalidades para.
4. "rag" — só quando a resposta depende de documentos do usuário que o modelo nunca viu.
5. "tool-calling" — só quando o modelo precisa consultar ou executar algo no sistema para responder.
6. "agente" — só quando a sequência de passos não pode ser escrita de antemão.

REGRA DE ESCALADA: comece sempre no 1 e só suba com motivo escrito. Em "porqueEsseNivel", diga por
que este degrau. Em "oQueNaoBasta", diga o que o degrau IMEDIATAMENTE ABAIXO resolveria e onde ele
para. Se você não consegue escrever o que falta no degrau de baixo, é porque o degrau de baixo
serve — use ele.

NUNCA proponha "agente" para um processo que você conseguiu descrever em ordem. Se você consegue
listar os passos, os passos devem ser escritos em código, chamando o modelo dentro de cada um.

ESTIMATIVA DE VOLUME: "chamadasPorMes", "tokensEntrada" e "tokensSaida" alimentam o cálculo de
custo que o app faz. Estime pelo uso real esperado deste produto, não por um número redondo.
Um MVP com poucos usuários faz centenas de chamadas por mês, não milhões. NÃO escreva preço em
dinheiro em lugar nenhum: o app calcula.

PROMPT DE SISTEMA: escreva o prompt real desta funcionalidade, para este projeto, com os nomes das
tabelas e dos campos que existem. Diga o formato da resposta e o que fazer quando não souber.

FALLBACK: todo provedor de IA sai do ar. Diga o que a tela faz nesse minuto — nunca "mostrar erro".

SEGURANÇA E PRIVACIDADE: diga o que é específico DESTA funcionalidade. Se ela manda dado de
cliente para fora, diga isso com todas as letras e diga o que remover antes.

COMO AVALIAR: critérios conferíveis. "A resposta cita o trecho de onde saiu" vale; "a resposta é
boa" não vale nada.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    precisaDeIa: { type: "boolean" },
    veredito: {
      type: "string",
      description:
        "A resposta direta para 'eu preciso de IA neste projeto?', endereçada a quem perguntou. Dois a quatro parágrafos curtos.",
    },
    funcionalidades: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          problema: { type: "string", description: "O problema de quem usa, não a solução." },
          nivel: { type: "string", enum: [...NIVEIS] },
          porqueEsseNivel: { type: "string" },
          oQueNaoBasta: {
            type: "string",
            description: "O que o degrau imediatamente abaixo resolveria, e onde ele para.",
          },
          input: { type: "string" },
          output: { type: "string" },
          modeloSugerido: {
            type: "string",
            description: "Um id do catálogo recebido, ou vazio quando o nível não usa LLM.",
          },
          contexto: { type: "array", items: { type: "string" } },
          promptSistema: { type: "string" },
          chamadasPorMes: { type: "number" },
          tokensEntrada: { type: "number" },
          tokensSaida: { type: "number" },
          sincrona: {
            type: "boolean",
            description: "true quando alguém espera na tela pela resposta.",
          },
          seguranca: { type: "array", items: { type: "string" } },
          privacidade: { type: "array", items: { type: "string" } },
          fallback: { type: "string" },
          comoAvaliar: { type: "array", items: { type: "string" } },
        },
        required: [
          "nome",
          "problema",
          "nivel",
          "porqueEsseNivel",
          "input",
          "output",
          "contexto",
          "chamadasPorMes",
          "tokensEntrada",
          "tokensSaida",
          "sincrona",
          "seguranca",
          "privacidade",
          "fallback",
          "comoAvaliar",
        ],
      },
    },
    descartadas: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          nome: { type: "string" },
          porque: { type: "string" },
          oQueUsarNoLugar: { type: "string" },
        },
        required: ["nome", "porque", "oQueUsarNoLugar"],
      },
    },
  },
  required: ["precisaDeIa", "veredito", "funcionalidades", "descartadas"],
};

const FORMATO = `Responda SOMENTE com JSON:
{"precisaDeIa":true,"veredito":"","funcionalidades":[{"nome":"","problema":"","nivel":"sem-ia|api-pronta|llm-simples|rag|tool-calling|agente","porqueEsseNivel":"","oQueNaoBasta":"","input":"","output":"","modeloSugerido":"","contexto":[""],"promptSistema":"","chamadasPorMes":1000,"tokensEntrada":1500,"tokensSaida":500,"sincrona":true,"seguranca":[""],"privacidade":[""],"fallback":"","comoAvaliar":[""]}],"descartadas":[{"nome":"","porque":"","oQueUsarNoLugar":""}]}

Nao escreva preco em dinheiro nem codigo. Devolva so o plano.`;

function contexto(
  bp: Blueprint,
  modelo: ModeloDeDados | null,
  api: MapaApi | null,
  r: Respostas,
): string {
  const partes: string[] = [];

  if (bp.fundacao) {
    partes.push(
      `## O produto`,
      `${bp.fundacao.nome}: ${bp.fundacao.descricao}`,
      `Quem usa: ${bp.fundacao.persona.nome}, ${bp.fundacao.persona.papel}`,
    );
  }

  partes.push(
    ``,
    `## Quem está construindo`,
    `Nível técnico: ${ROTULO_NIVEL[r.nivelTecnico]}.`,
    `Ela ${r.temIa ? "marcou que o projeto tem IA" : "NÃO marcou que o projeto tem IA"} no questionário.`,
  );

  const mvp = bp.produto?.funcionalidades.filter((f) => f.prioridade === "mvp") ?? [];
  if (mvp.length > 0) {
    partes.push(``, `## O que o MVP faz`, ...mvp.map((f) => `- ${f.nome}: ${f.descricao}`));
  }

  if (bp.tecnico) {
    partes.push(
      ``,
      `## A stack`,
      `Frontend ${bp.tecnico.stack.frontend}, backend ${bp.tecnico.stack.backend}, banco ${bp.tecnico.stack.banco}.`,
    );
    if (bp.tecnico.ia) {
      partes.push(``, `## O que o plano técnico já disse sobre IA`, bp.tecnico.ia);
    }
  }

  if (modelo && modelo.entidades.length > 0) {
    partes.push(
      ``,
      `## As tabelas que existem`,
      ...modelo.entidades.map((e) => `- ${e.nome}: ${e.colunas.map((c) => c.nome).join(", ")}`),
    );
  }

  if (api && api.endpoints.length > 0) {
    partes.push(
      ``,
      `## Os endpoints que existem`,
      ...api.endpoints.map((e) => `- ${e.metodo} ${e.caminho}: ${e.finalidade}`),
    );
  }

  partes.push(
    ``,
    `## Os modelos que você pode sugerir`,
    `Use um destes ids em "modeloSugerido". NÃO invente outro nome — o app só reconhece estes:`,
    ...MODELOS.map((m) => `- ${m.id} (${m.nome}): ${m.quandoUsar}`),
  );

  partes.push(
    ``,
    `## Os degraus`,
    ...Object.entries(ROTULO_NIVEL).map(([id, rotulo]) => `- ${id}: ${rotulo}`),
  );

  return partes.join("\n");
}

const TETO_MS = 115_000;

export async function gerarPlanoIa(
  bp: Blueprint,
  modelo: ModeloDeDados | null,
  api: MapaApi | null,
  respostas: Respostas,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<PlanoIa>> {
  const usuario = [
    contexto(bp, modelo, api, respostas),
    ``,
    `Responda primeiro: este produto precisa de IA?`,
    ``,
    `Depois, para cada funcionalidade que sobrar, projete a solução mais simples que resolve. O que`,
    `não precisar de IA vai para "descartadas", com o que usar no lugar — e esse resultado vale`,
    `tanto quanto o outro.`,
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA,
      formato: FORMATO,
      validar: validarPlano,
      tetoMs: TETO_MS,
      maxTokens: 12_288,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
