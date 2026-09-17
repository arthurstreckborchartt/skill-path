import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { validarMapa, METODOS, TIPOS_CAMPO, type MapaApi } from "./contrato";
import { CONCEITOS } from "./conceitos";
import { diretrizesEmTexto } from "@/lib/blueprint/regras";
import { ROTULO_NIVEL, type Respostas } from "@/lib/blueprint/respostas";
import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";

/**
 * Geração do mapa de APIs. **Só no servidor.**
 *
 * Recebe o modelo de dados quando ele existe, e isso muda a qualidade do resultado: com as
 * tabelas em mãos, a IA desenha endpoints sobre os dados que realmente vão existir, com os nomes
 * certos. Sem ele, ela desenha sobre as funcionalidades e inventa os campos.
 *
 * A IA **não** escreve a documentação nem os exemplos — ela devolve o contrato de cada endpoint,
 * e `derivados.ts` produz `curl`, OpenAPI, Markdown, prompts e checklist a partir dele.
 */

const SISTEMA = `Você projeta a API de um produto e ensina quem nunca fez uma.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

COMO PROJETAR:
- Só os endpoints que o MVP precisa. Endpoint que serve a uma funcionalidade marcada como
  "depois" não entra agora. Uma API de MVP costuma ter de 6 a 12 endpoints — se você passar
  disso, provavelmente está criando rota para coisa que ainda não existe.
- Nomeie por recurso, no plural: /api/produtos, /api/vendas. Nunca verbo no caminho:
  /api/criarProduto está errado.
- Use o método certo: GET busca, POST cria, PATCH altera parte, PUT substitui tudo, DELETE remove.
- Use o status certo: 201 para criação, 204 quando não há corpo, 200 no resto.
- Todo endpoint que mexe em dado de alguém precisa dizer, em "autorizacao", QUEM pode chamá-lo.
- Liste os erros de verdade daquele endpoint, com código estável em snake_case
  (email_ja_existe, saldo_insuficiente). A mensagem é o que a pessoa lê: sem jargão, sem número.

COMO EXPLICAR — é metade do trabalho:
- Em "finalidade", diga por que o endpoint existe NO NEGÓCIO da pessoa. "Registra a venda que o
  Thiago acabou de fazer na chapa" vale; "cria um registro de venda" não vale nada.
- Em "conceitosNoProjeto", ligue cada conceito da lista ao caso real dela. Não defina o conceito
  (isso o app já faz) — diga ONDE ele aparece no projeto dela e o que acontece se for ignorado.

RATE LIMITING E LOGS:
- Só marque "temLimite" onde faz diferença: login (força bruta), envio de mensagem, qualquer
  rota que chame serviço pago. Marcar tudo é o mesmo que não marcar nada.
- Em "logs", diga o que registrar. NUNCA senha, token, cartão ou dado pessoal.

O QUE NUNCA FAZER:
- Não invente endpoint que o plano não pediu.
- Não devolva dado sensível numa resposta sem marcar o campo como sensível.
- Não escreva documentação, exemplo de curl nem OpenAPI. Devolva só o contrato.`;

/** A forma de um campo de contrato. Inline, e nao `$ref` — ver o comentario no uso. */
const CAMPO = {
  type: "object",
  properties: {
    nome: { type: "string" },
    tipo: { type: "string", enum: [...TIPOS_CAMPO] },
    obrigatorio: { type: "boolean" },
    descricao: { type: "string" },
    exemplo: { type: "string", description: "Valor real, usado no exemplo de curl." },
    validacao: { type: "string", description: "A regra que o servidor confere." },
    sensivel: { type: "boolean", description: "true para dado pessoal." },
  },
  required: ["nome", "tipo", "obrigatorio", "descricao", "exemplo", "validacao", "sensivel"],
  additionalProperties: false,
};

export const SCHEMA_API = {
  type: "object" as const,
  properties: {
    grupos: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Ex: Autenticação, Vendas, Estoque." },
          descricao: { type: "string" },
        },
        required: ["nome", "descricao"],
        additionalProperties: false,
      },
    },
    endpoints: {
      type: "array",
      minItems: 3,
      // 14, e nao 24. Uma API de MVP tem de 6 a 12 endpoints; o teto alto convidava a IA a
      // encher a lista, e 24 contratos completos nao cabiam em geracao nenhuma — estourava 93s.
      // O teto menor e melhor pelos dois lados: cabe no tempo e evita a complexidade que este
      // produto existe para prevenir.
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "snake ou kebab. Ex: post-auth-login." },
          metodo: { type: "string", enum: [...METODOS] },
          caminho: {
            type: "string",
            description: "Ex: /api/produtos/:id. Parâmetro com dois-pontos.",
          },
          finalidade: {
            type: "string",
            description: "Por que existe, no negócio da pessoa, citando o caso real dela.",
          },
          grupo: { type: "string", description: "O nome exato de um dos grupos acima." },
          autenticacao: { type: "string", enum: ["nenhuma", "sessao", "token", "api_key"] },
          autorizacao: {
            type: "string",
            description: "Quem pode chamar depois de autenticado. Ex: 'Só o dono do food truck'.",
          },
          // O campo vai inline em vez de `$ref`: cada provedor trata referencia de schema de um
          // jeito, e repetir a definicao custa tokens uma vez, enquanto um `$ref` recusado custa
          // a geracao inteira.
          parametrosRota: { type: "array", items: CAMPO },
          parametrosConsulta: { type: "array", items: CAMPO },
          corpoRequisicao: {
            type: "array",
            items: CAMPO,
            description: "Vazio para GET e DELETE.",
          },
          respostaSucesso: {
            type: "object",
            properties: {
              status: {
                type: "number",
                description: "201 para criação, 204 sem corpo, 200 no resto.",
              },
              quando: { type: "string" },
              corpo: { type: "array", items: CAMPO },
            },
            required: ["status", "quando", "corpo"],
            additionalProperties: false,
          },
          erros: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                status: { type: "number" },
                codigo: { type: "string", description: "snake_case estável. Ex: email_ja_existe." },
                quando: { type: "string" },
                mensagem: { type: "string", description: "O que a pessoa lê. Sem jargão." },
              },
              required: ["status", "codigo", "quando", "mensagem"],
              additionalProperties: false,
            },
          },
          limiteUso: {
            type: "object",
            properties: {
              temLimite: { type: "boolean" },
              quanto: {
                type: "string",
                description: "Ex: '5 por minuto por IP'. Vazio se não tem.",
              },
              porque: { type: "string", description: "Vazio se não tem limite." },
            },
            required: ["temLimite", "quanto", "porque"],
            additionalProperties: false,
          },
          logs: {
            type: "array",
            items: { type: "string" },
            description: "O que registrar. Nunca senha, token nem dado pessoal.",
          },
          seguranca: {
            type: "array",
            items: { type: "string" },
            description: "Cuidados específicos DESTE endpoint.",
          },
        },
        required: [
          "id",
          "metodo",
          "caminho",
          "finalidade",
          "grupo",
          "autenticacao",
          "autorizacao",
          "parametrosRota",
          "parametrosConsulta",
          "corpoRequisicao",
          "respostaSucesso",
          "erros",
          "limiteUso",
          "logs",
          "seguranca",
        ],
        additionalProperties: false,
      },
    },
    convencoes: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: { type: "string" },
      description: "Regras válidas para toda a API: formato de data, paginação, envelope de erro.",
    },
    conceitosNoProjeto: {
      type: "array",
      items: {
        type: "object",
        properties: {
          conceito: {
            type: "string",
            description: `O id exato de um destes: ${CONCEITOS.map((c) => c.id).join(", ")}.`,
          },
          comoApareceAqui: {
            type: "string",
            description:
              "Onde este conceito aparece NO PROJETO da pessoa e o que quebra se for ignorado. Não defina o conceito.",
          },
        },
        required: ["conceito", "comoApareceAqui"],
        additionalProperties: false,
      },
    },
  },
  required: ["grupos", "endpoints", "convencoes", "conceitosNoProjeto"],
  additionalProperties: false,
};

const FORMATO = `Responda SOMENTE com JSON:
{"grupos":[{"nome":"","descricao":""}],"endpoints":[{"id":"","metodo":"GET|POST|PUT|PATCH|DELETE","caminho":"/api/","finalidade":"","grupo":"","autenticacao":"nenhuma|sessao|token|api_key","autorizacao":"","parametrosRota":[],"parametrosConsulta":[],"corpoRequisicao":[{"nome":"","tipo":"texto","obrigatorio":true,"descricao":"","exemplo":"","validacao":"","sensivel":false}],"respostaSucesso":{"status":200,"quando":"","corpo":[]},"erros":[{"status":400,"codigo":"","quando":"","mensagem":""}],"limiteUso":{"temLimite":false,"quanto":"","porque":""},"logs":[""],"seguranca":[""]}],"convencoes":["",""],"conceitosNoProjeto":[{"conceito":"","comoApareceAqui":""}]}

Nao escreva documentacao, curl nem OpenAPI. Devolva so o contrato.`;

function contexto(bp: Blueprint, modelo: ModeloDeDados | null, r: Respostas): string {
  const partes: string[] = [];

  if (bp.fundacao) {
    partes.push(
      `## O produto`,
      `${bp.fundacao.nome}: ${bp.fundacao.descricao}`,
      `Quem usa: ${bp.fundacao.persona.nome}, ${bp.fundacao.persona.papel}`,
    );
  }

  const mvp = bp.produto?.funcionalidades.filter((f) => f.prioridade === "mvp") ?? [];
  if (mvp.length > 0) {
    partes.push(
      ``,
      `## Funcionalidades do MVP (a API existe para ESTAS)`,
      ...mvp.map((f) => `- ${f.nome}: ${f.descricao}`),
    );
  }

  const rf = bp.produto?.requisitosFuncionais ?? [];
  if (rf.length > 0) {
    partes.push(
      ``,
      `## Requisitos funcionais`,
      ...rf.slice(0, 12).map((x) => `- ${x.id}: ${x.descricao}`),
    );
  }

  /**
   * O modelo de dados entra inteiro quando existe.
   *
   * Sem ele a IA inventa os nomes dos campos e a API sai desalinhada do banco — dois artefatos do
   * mesmo projeto discordando sobre como a coisa se chama.
   */
  if (modelo) {
    partes.push(
      ``,
      `## As tabelas que já existem (use estes nomes)`,
      ...modelo.entidades.map(
        (e) =>
          `- ${e.nome}: ${e.colunas.map((c) => `${c.nome}${c.sensivel ? " (SENSÍVEL)" : ""}`).join(", ")}`,
      ),
    );
    if (modelo.relacoes.length > 0) {
      partes.push(
        `Relações: ${modelo.relacoes.map((x) => `${x.de}.${x.coluna} → ${x.para}`).join(" | ")}`,
      );
    }
  } else if (bp.tecnico?.tabelas.length) {
    partes.push(
      ``,
      `## Esboço de tabelas do plano`,
      ...bp.tecnico.tabelas.map((t) => `- ${t.nome}: ${t.campos.map((c) => c.nome).join(", ")}`),
    );
  }

  if (bp.tecnico) {
    partes.push(``, `## Stack`, `${bp.tecnico.stack.backend} / ${bp.tecnico.stack.banco}`);
    if (bp.tecnico.autenticacao.necessaria) {
      partes.push(`Autenticação decidida no plano: ${bp.tecnico.autenticacao.metodo}`);
    }
  }

  partes.push(
    ``,
    `## Quem vai implementar`,
    `Nível técnico: ${ROTULO_NIVEL[r.nivelTecnico]}`,
    r.temAutenticacao
      ? `O sistema tem login${r.tiposDeUsuario === "varios" ? ", com mais de um tipo de usuário" : ", com um único tipo de usuário"}.`
      : `O sistema NÃO tem login. Nenhum endpoint deve exigir autenticação de pessoa.`,
    r.temPagamentos ? `O sistema cobra dinheiro: inclua o webhook do provedor de pagamento.` : ``,
    r.temIntegracoes && r.integracoesQuais ? `Integrações: ${r.integracoesQuais}` : ``,
    ``,
    `## Conceitos que você deve ligar ao projeto`,
    `Para cada um que se aplicar, escreva em "conceitosNoProjeto" onde ele aparece AQUI:`,
    CONCEITOS.map((c) => c.id).join(", "),
  );

  return partes.filter(Boolean).join("\n");
}

/**
 * Medido: o mapa completo com contratos e erros leva de 45 a 80s.
 *
 * Com teto de 24 endpoints a geração estourava 93s e nunca terminava. O teto caiu para 14, o que
 * resolveu o tempo; este orçamento continua alto porque cada endpoint carrega corpo, resposta e
 * lista de erros, e isso ainda é muita saída.
 */
const TETO_MS = 115_000;

export async function gerarMapaApi(
  bp: Blueprint,
  modelo: ModeloDeDados | null,
  respostas: Respostas,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<MapaApi>> {
  const usuario = [
    contexto(bp, modelo, respostas),
    ``,
    `Projete a API deste MVP. Explique cada endpoint pelo negócio, não pela técnica.`,
    ``,
    diretrizesEmTexto(respostas),
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA_API,
      formato: FORMATO,
      validar: validarMapa,
      tetoMs: TETO_MS,
      maxTokens: 14_336,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
