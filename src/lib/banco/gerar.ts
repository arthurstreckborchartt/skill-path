import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import { validarModelo, TIPOS_LOGICOS, type ModeloDeDados } from "./contrato";
import { diretrizesEmTexto } from "@/lib/blueprint/regras";
import { ROTULO_NIVEL, type Respostas } from "@/lib/blueprint/respostas";
import type { Blueprint } from "@/lib/blueprint/contrato";

/**
 * Geração do modelo de dados. **Só no servidor.**
 *
 * O blueprint já traz uma lista de tabelas, mas ela é um esboço: nome, alguns campos e relações
 * escritas em português. Aqui o modelo vira coisa executável — tipos, chaves, índices,
 * constraints, enums — e, principalmente, **ganha o porquê de cada decisão**, que é o que
 * transforma um schema em aula.
 *
 * Os campos `porque` não são enfeite: são o produto. Um schema pronto a pessoa consegue pedir a
 * qualquer chatbot; o que ela não consegue é entender por que aquela relação é 1:N e por que
 * aquele campo precisa ser único.
 */

const SISTEMA = `Você é um projetista de banco de dados que ensina enquanto modela.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

COMO MODELAR:
- Modele para o MVP que está no plano, não para o produto completo. Tabela que só serve a uma
  funcionalidade marcada como "depois" não entra agora.
- Prefira o modelo mais simples que resolve. Normalização existe para evitar dado duplicado, não
  para ganhar pontos: se separar uma tabela não evita duplicata nenhuma, não separe.
- Toda tabela precisa de chave primária.
- Índice em toda chave estrangeira que vai ser usada para buscar.
- Marque como sensível todo campo que guarda dado pessoal: CPF, e-mail, telefone, endereço, data
  de nascimento, dado de saúde, dado financeiro, localização.
- Nunca crie uma coluna chamada "senha". Se houver login, a coluna é "senha_hash".

COMO EXPLICAR — esta é a parte que mais importa:
- Em "porqueExiste", escreva no formato "Você precisa de uma tabela X porque...", falando do
  negócio da pessoa, não de teoria. "Porque cada aluno paga uma mensalidade por mês e você precisa
  saber quais foram pagas" vale; "para armazenar os dados dos pagamentos" não vale nada.
- Em "porque" de cada relação, escreva "Essa relação é 1:N porque...", explicando com o caso real:
  "um food truck tem vários produtos, mas cada produto pertence a um food truck só".
- Em "porque" de cada coluna, explique a decisão daquele campo — por que é obrigatório, por que é
  único, por que esse tipo. Se a coluna é banal, diga o que ela guarda e siga.
- Escreva para quem nunca modelou banco. Explique o termo na primeira vez que ele aparecer.

SOFT DELETE E AUDITORIA:
- Só ligue "temSoftDelete" quando apagar de verdade causaria perda real — histórico financeiro,
  nota fiscal, algo que a pessoa vai precisar consultar depois. Soft delete complica TODA consulta
  do sistema para sempre.
- Só ligue "temAuditoria" quando houver mais de um tipo de usuário mexendo nos mesmos dados, ou
  exigência legal. Em sistema de uma pessoa só, é peso morto.
- Quando ligar qualquer um dos dois, explique o motivo no campo correspondente.

O QUE NUNCA FAZER:
- Não invente tabela que o plano não pediu.
- Não use tipo de banco específico: escolha entre os tipos lógicos da lista.
- Não escreva SQL. O SQL é gerado a partir do que você devolver.`;

export const SCHEMA_MODELO = {
  type: "object" as const,
  properties: {
    entidades: {
      type: "array",
      minItems: 1,
      maxItems: 14,
      items: {
        type: "object",
        properties: {
          nome: {
            type: "string",
            description: "snake_case, plural, sem acento. Ex: pedidos, itens_pedido.",
          },
          descricao: { type: "string", description: "O que esta tabela guarda, em uma frase." },
          porqueExiste: {
            type: "string",
            description:
              "Comece com 'Você precisa de uma tabela X porque' e explique pelo negócio da pessoa, citando o caso real dela.",
          },
          colunas: {
            type: "array",
            minItems: 2,
            maxItems: 20,
            items: {
              type: "object",
              properties: {
                nome: { type: "string", description: "snake_case, sem acento." },
                tipoLogico: {
                  type: "string",
                  enum: [...TIPOS_LOGICOS],
                  description:
                    "Use 'dinheiro' para valores monetários e 'enum' para lista fechada de valores.",
                },
                enumValores: {
                  type: "array",
                  items: { type: "string" },
                  description: "Só quando tipoLogico é 'enum'. Pelo menos 2 valores.",
                },
                tamanho: { type: "number", description: "Só para texto_curto. 0 se não souber." },
                obrigatoria: { type: "boolean" },
                unica: { type: "boolean" },
                padrao: {
                  type: "string",
                  description:
                    "Vazio se não houver. Use 'agora' para data atual, 'uuid' para id gerado, ou o valor literal.",
                },
                descricao: { type: "string" },
                porque: {
                  type: "string",
                  description:
                    "A decisão deste campo. Se é único, 'Esse campo deve ser unique porque...'. Se é obrigatório, por quê.",
                },
                sensivel: {
                  type: "boolean",
                  description: "true para dado pessoal protegido pela LGPD.",
                },
              },
              required: [
                "nome",
                "tipoLogico",
                "enumValores",
                "tamanho",
                "obrigatoria",
                "unica",
                "padrao",
                "descricao",
                "porque",
                "sensivel",
              ],
              additionalProperties: false,
            },
          },
          chavePrimaria: {
            type: "array",
            items: { type: "string" },
            description: "Nomes de colunas. Quase sempre uma só. Nunca deixe vazio.",
          },
          temTimestamps: { type: "boolean", description: "Quase sempre true." },
          temSoftDelete: { type: "boolean" },
          porqueSoftDelete: {
            type: "string",
            description: "Obrigatório quando true. Vazio se false.",
          },
          temAuditoria: { type: "boolean" },
          porqueAuditoria: {
            type: "string",
            description: "Obrigatório quando true. Vazio se false.",
          },
        },
        required: [
          "nome",
          "descricao",
          "porqueExiste",
          "colunas",
          "chavePrimaria",
          "temTimestamps",
          "temSoftDelete",
          "porqueSoftDelete",
          "temAuditoria",
          "porqueAuditoria",
        ],
        additionalProperties: false,
      },
    },
    relacoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          de: { type: "string", description: "A tabela que guarda a chave estrangeira." },
          para: { type: "string", description: "A tabela apontada." },
          coluna: { type: "string", description: "A coluna de 'de' que aponta. Precisa existir." },
          cardinalidade: { type: "string", enum: ["1:1", "1:N", "N:N"] },
          porque: {
            type: "string",
            description:
              "Comece com 'Essa relação é 1:N porque' e explique com o caso real da pessoa.",
          },
          aoApagarPai: {
            type: "string",
            enum: ["cascade", "restrict", "set null"],
            description:
              "cascade apaga os filhos junto; restrict impede apagar o pai; set null deixa o filho órfão.",
          },
        },
        required: ["de", "para", "coluna", "cardinalidade", "porque", "aoApagarPai"],
        additionalProperties: false,
      },
    },
    indices: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tabela: { type: "string" },
          colunas: { type: "array", items: { type: "string" } },
          unico: { type: "boolean" },
          porque: { type: "string", description: "Qual busca fica rápida por causa dele." },
        },
        required: ["tabela", "colunas", "unico", "porque"],
        additionalProperties: false,
      },
    },
    restricoes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tabela: { type: "string" },
          nome: { type: "string", description: "snake_case, começando com chk_." },
          expressao: {
            type: "string",
            description: "SQL simples que funciona em qualquer banco: preco >= 0, fim > inicio.",
          },
          porque: { type: "string" },
        },
        required: ["tabela", "nome", "expressao", "porque"],
        additionalProperties: false,
      },
    },
    notas: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: { type: "string" },
      description:
        "Decisões gerais do modelo e o que você deixou de fora de propósito, com o motivo.",
    },
  },
  required: ["entidades", "relacoes", "indices", "restricoes", "notas"],
  additionalProperties: false,
};

const FORMATO = `Responda SOMENTE com JSON:
{"entidades":[{"nome":"","descricao":"","porqueExiste":"","colunas":[{"nome":"","tipoLogico":"uuid|texto|texto_curto|inteiro|decimal|dinheiro|booleano|data|data_hora|json|enum","enumValores":[],"tamanho":0,"obrigatoria":true,"unica":false,"padrao":"","descricao":"","porque":"","sensivel":false}],"chavePrimaria":["id"],"temTimestamps":true,"temSoftDelete":false,"porqueSoftDelete":"","temAuditoria":false,"porqueAuditoria":""}],"relacoes":[{"de":"","para":"","coluna":"","cardinalidade":"1:N","porque":"","aoApagarPai":"restrict"}],"indices":[{"tabela":"","colunas":[""],"unico":false,"porque":""}],"restricoes":[{"tabela":"","nome":"chk_","expressao":"","porque":""}],"notas":[""]}

Nao escreva SQL. Use somente os tipos logicos da lista.`;

function contexto(bp: Blueprint, r: Respostas): string {
  const partes: string[] = [];

  if (bp.fundacao) {
    partes.push(
      `## O produto`,
      `${bp.fundacao.nome}: ${bp.fundacao.descricao}`,
      `Problema: ${bp.fundacao.problema}`,
      `Quem usa: ${bp.fundacao.persona.nome}, ${bp.fundacao.persona.papel}`,
    );
  }

  const mvp = bp.produto?.funcionalidades.filter((f) => f.prioridade === "mvp") ?? [];
  if (mvp.length > 0) {
    partes.push(
      ``,
      `## Funcionalidades do MVP (modele para ESTAS)`,
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

  const depois = bp.produto?.funcionalidades.filter((f) => f.prioridade === "depois") ?? [];
  if (depois.length > 0) {
    partes.push(
      ``,
      `## Fica para depois (NÃO modele agora, mas não inviabilize)`,
      ...depois.map((f) => `- ${f.nome}`),
    );
  }

  if (bp.tecnico) {
    partes.push(
      ``,
      `## O que o plano técnico já decidiu`,
      `Banco: ${bp.tecnico.stack.banco}`,
      `Arquitetura: ${bp.tecnico.arquitetura}`,
    );
    if (bp.tecnico.tabelas.length > 0) {
      partes.push(
        `Esboço de tabelas do plano (refine, corrija e complete — ele é só um rascunho):`,
        ...bp.tecnico.tabelas.map((t) => `- ${t.nome}: ${t.campos.map((c) => c.nome).join(", ")}`),
      );
    }
  }

  partes.push(
    ``,
    `## Quem vai usar este modelo`,
    `Nível técnico: ${ROTULO_NIVEL[r.nivelTecnico]}`,
    r.temAutenticacao
      ? `O sistema tem login${r.tiposDeUsuario === "varios" ? ", com mais de um tipo de usuário" : ", com um único tipo de usuário"}.`
      : `O sistema NÃO tem login: não crie tabela de usuários nem de sessão.`,
    r.temDadosSensiveis
      ? `O sistema guarda dados sensíveis. Marque cada um e seja rigoroso.`
      : `O sistema não guarda dados sensíveis declarados, mas marque qualquer dado pessoal que aparecer.`,
  );

  return partes.join("\n");
}

/** Medido: o modelo completo com explicações sai em 30 a 70s. */
const TETO_MS = 85_000;

export async function gerarModelo(
  bp: Blueprint,
  respostas: Respostas,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<ModeloDeDados>> {
  const usuario = [
    contexto(bp, respostas),
    ``,
    `Projete o banco de dados deste MVP. Explique cada decisão como se estivesse ensinando alguém a modelar pela primeira vez.`,
    ``,
    diretrizesEmTexto(respostas),
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA_MODELO,
      formato: FORMATO,
      validar: validarModelo,
      tetoMs: TETO_MS,
      maxTokens: 14_336,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
