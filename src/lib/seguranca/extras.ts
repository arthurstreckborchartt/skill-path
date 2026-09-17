import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import type { Analise, ContextoSeguranca, Gravidade } from "./riscos";
import { RISCOS } from "./riscos";
import { ROTULO_NIVEL } from "@/lib/blueprint/respostas";

/**
 * Riscos específicos deste projeto, que um catálogo genérico não tem.
 *
 * ## Por que isto é opcional
 *
 * O catálogo de `riscos.ts` cobre o que vale para qualquer sistema, e a detecção é estática. O
 * módulo inteiro funciona sem chamar IA nenhuma — e isso é de propósito: um relatório de
 * segurança que só existe quando o provedor está de pé não serve para decidir se dá para lançar.
 *
 * A IA entra para o que só quem leu ESTE projeto enxerga. Um app offline-first de food truck tem
 * o risco de a sincronização reescrever a venda de outro dia; nenhum catálogo genérico tem isso.
 * Se a geração falhar, a tela mostra o catálogo completo e diz que os extras não vieram.
 */

const SISTEMA = `Você é um especialista em segurança revisando o plano de um produto.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

O QUE VOCÊ DEVE ENCONTRAR:
- Riscos que existem POR CAUSA das escolhas deste projeto — a arquitetura dele, o fluxo dele, o
  tipo de dado dele. Não riscos genéricos.
- Coisas que só aparecem quando se lê o conjunto: uma tabela mais o endpoint que a expõe, ou uma
  integração mais o que ela recebe de volta.

O QUE NÃO REPETIR:
A lista de riscos genéricos abaixo JÁ está coberta pelo app. Não os repita, nem com outro nome.

COMO ESCREVER:
- Em "oQuePodeAcontecer", descreva o ataque ou o acidente em termos concretos, com os nomes reais
  das tabelas e rotas deste projeto.
- Em "comoPrevenir", diga o que fazer e por quê. NUNCA entregue trecho de código pronto para
  colar: segurança copiada sem entendimento cria vulnerabilidade nova achando que fechou a antiga.
- Em "comoValidar", diga como a pessoa confere sozinha que está protegida — o que chamar, o que
  olhar, o que tem que acontecer.

Se você não encontrar nenhum risco específico além dos genéricos, devolva a lista vazia. Inventar
risco para parecer útil faz a pessoa perder tempo com o que não existe, e desconfiar do que existe.`;

export type RiscoExtra = {
  titulo: string;
  gravidade: Gravidade;
  oQuePodeAcontecer: string;
  porqueImporta: string;
  comoPrevenir: string[];
  comoValidar: string[];
};

const SCHEMA = {
  type: "object" as const,
  properties: {
    riscos: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          gravidade: { type: "string", enum: ["critico", "alto", "medio"] },
          oQuePodeAcontecer: {
            type: "string",
            description: "O ataque ou acidente, com os nomes reais das tabelas e rotas do projeto.",
          },
          porqueImporta: { type: "string", description: "Para quem nunca pensou nisso." },
          comoPrevenir: {
            type: "array",
            items: { type: "string" },
            description: "O que fazer e por quê. Nunca código pronto para colar.",
          },
          comoValidar: {
            type: "array",
            items: { type: "string" },
            description: "Como a pessoa confere sozinha. O que chamar, o que olhar.",
          },
        },
        required: [
          "titulo",
          "gravidade",
          "oQuePodeAcontecer",
          "porqueImporta",
          "comoPrevenir",
          "comoValidar",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["riscos"],
  additionalProperties: false,
};

const FORMATO = `Responda SOMENTE com JSON:
{"riscos":[{"titulo":"","gravidade":"critico|alto|medio","oQuePodeAcontecer":"","porqueImporta":"","comoPrevenir":[""],"comoValidar":[""]}]}

Lista vazia e uma resposta valida se nao houver risco especifico deste projeto.`;

function textos(v: unknown, minimo: number): string[] | null {
  if (!Array.isArray(v)) return null;
  const limpo = v.filter((x): x is string => typeof x === "string" && x.trim().length > 10);
  return limpo.length >= minimo ? limpo.map((x) => x.trim()) : null;
}

/** Frases que denunciam um "como prevenir" que virou código para colar. */
const CHEIRO_DE_CODIGO = ["```", "function ", "const ", "app.use(", "import ", "=>"];

function validar(valor: unknown): { riscos: RiscoExtra[] } | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as { riscos?: unknown };
  if (!Array.isArray(v.riscos)) return null;

  const riscos = v.riscos
    .map((x): RiscoExtra | null => {
      if (!x || typeof x !== "object") return null;
      const r = x as Partial<RiscoExtra>;

      const titulo = typeof r.titulo === "string" ? r.titulo.trim() : "";
      const oQue = typeof r.oQuePodeAcontecer === "string" ? r.oQuePodeAcontecer.trim() : "";
      const porque = typeof r.porqueImporta === "string" ? r.porqueImporta.trim() : "";
      const prevenir = textos(r.comoPrevenir, 1);
      const validarComo = textos(r.comoValidar, 1);

      if (titulo.length < 8 || oQue.length < 30 || porque.length < 20) return null;
      if (!prevenir || !validarComo) return null;

      /**
       * Recusa o que virou código para colar.
       *
       * É a regra que o produto pediu explicitamente, e ela não pode viver só no prompt: um
       * trecho de middleware colado sem entendimento é o jeito mais comum de criar uma
       * vulnerabilidade nova achando que fechou a antiga.
       */
      if (prevenir.some((p) => CHEIRO_DE_CODIGO.some((c) => p.includes(c)))) return null;

      return {
        titulo,
        gravidade: (["critico", "alto", "medio"] as const).includes(r.gravidade!)
          ? r.gravidade!
          : "medio",
        oQuePodeAcontecer: oQue,
        porqueImporta: porque,
        comoPrevenir: prevenir,
        comoValidar: validarComo,
      };
    })
    .filter((x): x is RiscoExtra => x !== null);

  return { riscos };
}

function contexto(c: ContextoSeguranca, analise: Analise): string {
  const partes: string[] = [];

  if (c.blueprint.fundacao) {
    partes.push(`## O produto`, `${c.blueprint.fundacao.nome}: ${c.blueprint.fundacao.descricao}`);
  }
  if (c.blueprint.tecnico) {
    partes.push(
      ``,
      `## Arquitetura`,
      c.blueprint.tecnico.arquitetura,
      `Stack: ${c.blueprint.tecnico.stack.frontend} / ${c.blueprint.tecnico.stack.backend} / ${c.blueprint.tecnico.stack.banco}`,
    );
  }

  if (c.modelo) {
    partes.push(
      ``,
      `## Tabelas`,
      ...c.modelo.entidades.map(
        (e) =>
          `- ${e.nome}: ${e.colunas.map((col) => `${col.nome}${col.sensivel ? " (SENSÍVEL)" : ""}`).join(", ")}`,
      ),
    );
  }

  if (c.api) {
    partes.push(
      ``,
      `## Endpoints`,
      ...c.api.endpoints.map(
        (e) =>
          `- ${e.metodo} ${e.caminho} [${e.autenticacao}] — ${e.finalidade}${e.autorizacao ? ` | quem pode: ${e.autorizacao}` : ""}`,
      ),
    );
  }

  const r = c.respostas;
  partes.push(
    ``,
    `## O que o sistema tem`,
    `Login: ${r.temAutenticacao ? (r.tiposDeUsuario === "varios" ? "sim, com vários tipos de usuário" : "sim, um tipo só") : "não"}`,
    `Pagamentos: ${r.temPagamentos ? "sim" : "não"} | Uploads: ${r.temUploads ? "sim" : "não"} | Dados sensíveis: ${r.temDadosSensiveis ? "sim" : "não"}`,
    `Integrações: ${r.temIntegracoes ? r.integracoesQuais || "sim" : "não"}`,
    `Nível de quem vai implementar: ${ROTULO_NIVEL[r.nivelTecnico]}`,
    ``,
    `## Riscos genéricos JÁ cobertos pelo app (não repita nenhum deles)`,
    RISCOS.map((x) => x.titulo).join(" | "),
  );

  if (analise.confirmados.length > 0) {
    partes.push(
      ``,
      `## O que a análise estática já encontrou`,
      ...analise.confirmados.flatMap((a) => a.evidencias.map((e) => `- ${e}`)),
    );
  }

  return partes.join("\n");
}

/** Medido: a lista de extras é curta, então cabe num orçamento menor que os outros módulos. */
const TETO_MS = 70_000;

export async function gerarExtras(
  c: ContextoSeguranca,
  analise: Analise,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<{ riscos: RiscoExtra[] }>> {
  const usuario = [
    contexto(c, analise),
    ``,
    `Encontre os riscos de segurança que existem por causa das escolhas DESTE projeto, e que não estão na lista de genéricos acima.`,
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA,
      formato: FORMATO,
      validar,
      tetoMs: TETO_MS,
      maxTokens: 6144,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
