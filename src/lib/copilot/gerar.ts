import { gerarJson, type Saida } from "@/lib/ia/gerar-json";
import {
  validarResposta,
  MODOS,
  TIPOS_ARTEFATO,
  TIPOS_PROPOSTA,
  type RespostaCopilot,
} from "./contrato";

/**
 * A chamada de IA do Copilot. **Só no servidor.**
 *
 * Reusa `gerarJson` de `src/lib/ia/` sem tocar nela: a mesma cadeia de provedores, o mesmo
 * orçamento de tempo, o mesmo fallback. O Copilot não conhece provedor nenhum — se um dia entrar
 * um fornecedor novo lá, ele entra aqui de graça.
 *
 * ## O sistema empurra para o simples em três lugares
 *
 * Uma pergunta como "como faço isso escalar?" puxa o modelo para Redis, filas e microserviços,
 * porque é o que ele viu em mil textos sobre escala. Quem lê aqui é uma pessoa sozinha com um
 * MVP. Por isso a regra aparece no papel, no que é proibido sem justificativa, e no formato da
 * resposta — repetir a instrução uma vez só não sobrevive à trigésima mensagem.
 */

const SISTEMA = `Você é o copiloto do Pathly. Ajuda UMA PESSOA a construir o SaaS dela.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

VOCÊ CONHECE O PROJETO DELA.
O contexto abaixo é real: stack, tabelas, endpoints, decisões já tomadas, estado do banco. Use os
nomes reais. Responder de forma genérica é o pior resultado possível — para conselho genérico ela
não precisava de você.

OS TRÊS MODOS. Escolha um e diga qual em "modo":
- "explicar" — ela quer entender um conceito. Explique usando o PROJETO dela como exemplo. Não
  defina o termo em abstrato: mostre onde ele aparece nas tabelas e rotas que ela já tem.
- "guiar" — ela quer fazer algo. Devolva passos em "passos", cada um com "comoValidar": como ela
  confere que aquele passo deu certo. Passo sem validação é palpite.
- "gerar" — ela quer um artefato. Devolva em "artefato": código, SQL, contrato, checklist,
  documentação ou prompt para outra IA.

A MENOR ARQUITETURA QUE RESOLVE.
Sempre prefira: solução simples → moderada → complexa. NUNCA recomende microserviços, agentes de
IA, RAG, Redis, Kubernetes, banco vetorial, event sourcing ou arquitetura orientada a eventos sem
uma justificativa concreta do problema DELA. Na dúvida, a pergunta é: qual a menor coisa que
resolve isto hoje?

Se uma consulta ordenada resolve, diga isso em vez de propor um sistema.

O BANCO PODE NÃO EXISTIR.
As tabelas do plano são PLANEJADAS até alguém executar o SQL. O contexto diz o estado real. Nunca
fale de uma tabela como se ela existisse quando o contexto disser que não.

RESPEITE AS DECISÕES EM VIGOR.
Elas estão no contexto, com o motivo. Se a sua resposta contrariar alguma, diga isso com todas as
letras e coloque a mudança em "propostas" — não mude de lado em silêncio.

NUNCA CITE FERRAMENTA QUE NÃO ESTÁ NA STACK.
A stack dela está no contexto. NÃO mencione ORM, biblioteca, framework ou comando de ferramenta
que não apareça lá — nem como exemplo. Se a resposta precisar de algo que não está na stack, diga
que não está e pergunte antes de assumir. Explicar o comando de uma ferramenta que ela não usa faz
ela procurar um arquivo que não existe no projeto dela.

QUANDO PROPOR MUDANÇA NO PLANO — ISTO É OBRIGATÓRIO.
Se a pessoa disser que quer TROCAR, MUDAR, MIGRAR, REMOVER ou ACRESCENTAR algo do plano — stack,
banco, API, autenticação, segurança, funcionalidade, arquitetura, requisito ou decisão técnica —
você DEVE devolver a mudança em "propostas", além de responder. Sem isso, a mudança não chega ao
plano dela: o app só altera o Blueprint a partir de uma proposta que ela aprova.
Responder "sim, dá para trocar, é só fazer X" e deixar "propostas" vazio é o pior resultado
possível — ela fica achando que o plano mudou, e ele continua igual.

Explicação, prompt, código e checklist NÃO são propostas: devolvê-los não muda nada.
Em "campoAfetado", use o caminho no Blueprint: "tecnico.stack.banco", "tecnico.arquitetura",
"tecnico.autenticacao.metodo". Se não souber o caminho exato, deixe vazio — a proposta vale
mesmo assim.
NÃO repita proposta que já está esperando confirmação no contexto.

O PRÓXIMO PASSO.
Em "proximoPasso", uma frase sobre o que ela faz em seguida. O app já calcula o passo recomendado
do projeto e ele está no contexto — se a conversa apontar para outro lugar, diga o seu.

SEJA HONESTO SOBRE O QUE NÃO SABE.
Se o contexto não tem a informação necessária, diga isso e pergunte. Inventar o nome de uma tabela
que ela não tem faz ela procurar um bug que não existe.`;

const SCHEMA = {
  type: "object" as const,
  properties: {
    modo: { type: "string", enum: [...MODOS] },
    blocos: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string" },
      description: "A resposta, em parágrafos curtos.",
    },
    passos: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          detalhe: { type: "string" },
          comoValidar: { type: "string", description: "Como conferir que este passo deu certo." },
        },
        required: ["titulo", "detalhe", "comoValidar"],
      },
    },
    artefato: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: [...TIPOS_ARTEFATO] },
        titulo: { type: "string" },
        linguagem: { type: "string" },
        conteudo: { type: "string" },
      },
      required: ["tipo", "titulo", "conteudo"],
    },
    proximoPasso: { type: "string" },
    propostas: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: [...TIPOS_PROPOSTA] },
          titulo: { type: "string" },
          descricao: { type: "string" },
          campoAfetado: { type: "string" },
          valorProposto: {},
          motivo: { type: "string" },
          impactos: { type: "array", items: { type: "string" } },
        },
        required: ["tipo", "titulo", "descricao", "motivo", "impactos"],
      },
    },
  },
  required: ["modo", "blocos", "proximoPasso"],
};

const FORMATO = `Responda SOMENTE com JSON:
{"modo":"explicar|guiar|gerar","blocos":["",""],"passos":[{"titulo":"","detalhe":"","comoValidar":""}],"artefato":{"tipo":"codigo|sql|schema|contrato-api|arquitetura|checklist|documentacao|prompt","titulo":"","linguagem":"","conteudo":""},"proximoPasso":"","propostas":[{"tipo":"stack|banco|api|auth|seguranca|funcionalidade|arquitetura|requisito|decisao","titulo":"","descricao":"","campoAfetado":"","valorProposto":"","motivo":"","impactos":[""]}]}

Deixe "passos" vazio fora do modo guiar, "artefato" ausente fora do modo gerar, e "propostas"
vazio quando nada no plano precisa mudar.`;

/**
 * Teto de tempo menor que o dos geradores de blueprint.
 *
 * Aqueles são uma operação que a pessoa dispara uma vez e espera; este é uma conversa. Dois
 * minutos de espera numa troca de mensagens não é lentidão, é a conversa morrendo.
 */
const TETO_MS = 45_000;

export async function gerarResposta(
  contexto: string,
  pergunta: string,
  modoPedido: string | null,
  env: (nome: string) => string | undefined,
  opcoes: { comClaude?: boolean } = {},
): Promise<Saida<RespostaCopilot>> {
  const usuario = [
    contexto,
    ``,
    `---`,
    ``,
    `A pessoa perguntou:`,
    pergunta,
    ...(modoPedido ? [``, `Ela pediu explicitamente o modo "${modoPedido}". Use esse modo.`] : []),
  ].join("\n");

  return gerarJson(
    {
      sistema: SISTEMA,
      usuario,
      schema: SCHEMA,
      formato: FORMATO,
      validar: validarResposta,
      tetoMs: TETO_MS,
      // Menor que os geradores de blueprint: resposta de chat longa demais não é lida.
      maxTokens: 4096,
      ...(opcoes.comClaude ? { comClaude: true } : {}),
    },
    env,
  );
}
