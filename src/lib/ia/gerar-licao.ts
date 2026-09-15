import { SCHEMA_LICAO, validarLicao, type Licao } from "@/lib/ia/licao-contrato";
import { SERVICOS_COMPAT } from "@/lib/ia/provedor-openai-compat";

/**
 * Geração do conteúdo de uma lição. **Só no servidor.**
 *
 * Reaproveita a mesma ideia da rota — cadeia de provedores gratuitos em paralelo, vence quem
 * responder primeiro — mas com um prompt próprio, porque o trabalho é outro: aqui é ensinar um
 * assunto específico, não organizar uma trilha.
 */

const SISTEMA = `Você escreve o conteúdo de uma aula curta para a Pathly, um app brasileiro de
aprendizagem para quem está migrando de carreira.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas.

COMO ENSINAR:
- Escreva para quem NUNCA viu o assunto. Não pressuponha vocabulário técnico sem explicar.
- Explique o que a coisa É, como FUNCIONA e por que EXISTE. Nessa ordem.
- Seja concreto: número real, comando real, nome real de ferramenta. Nunca "imagine uma empresa X".
- Não repita o título da tarefa como se fosse explicação.
- Não escreva "isso é muito importante" nem "no mundo de hoje". Ensine, não motive.

AS PERGUNTAS:
- Devem testar ENTENDIMENTO do assunto, nunca memória do título nem do objetivo da etapa.
- As alternativas erradas têm que ser erros que alguém aprendendo cometeria de verdade —
  confusões plausíveis, não absurdos nem texto de outro tema.
- Exatamente uma alternativa correta por pergunta.
- Em cada alternativa, explique: se certa, por quê; se errada, qual confusão leva até ela.

REGRAS DO PRODUTO:
- Nunca prometa emprego, renda, contratação ou vaga.
- Nunca invente estatística de mercado.
- Não indique curso pago específico — o app trata disso em outra tela.`;

export type ContextoLicao = {
  tarefa: string;
  etapa: string;
  objetivoEtapa: string;
  habilidades: string[];
  area: string;
};

function pedido(c: ContextoLicao): string {
  return [
    `Escreva a aula desta tarefa: "${c.tarefa}"`,
    ``,
    `Ela pertence à etapa "${c.etapa}", cujo objetivo é: ${c.objetivoEtapa}`,
    `Habilidades da etapa: ${c.habilidades.join(", ") || "não informadas"}`,
    `Área: ${c.area}`,
    ``,
    `Ensine o assunto da TAREFA, não da etapa inteira.`,
  ].join("\n");
}

/** Medido: o OpenRouter entrega uma aula em ~31s. Teto abaixo disso abortaria o que dá certo. */
const TETO_MS = 55_000;

/**
 * Formato em texto, não o schema JSON despejado no prompt.
 *
 * A primeira versão mandava `JSON.stringify(SCHEMA_LICAO)` dentro da mensagem de sistema — um
 * bloco enorme de metadados que o modelo tem que ler inteiro antes de escrever a primeira
 * palavra. Isso sozinho estourava o tempo. O schema continua valendo para o Gemini, que o aceita
 * como parâmetro estruturado em vez de texto.
 */
const FORMATO = `Responda SOMENTE com um objeto JSON, sem texto antes ou depois:

{
  "explicacao": ["parágrafo 1", "parágrafo 2"],
  "exemplo": "exemplo concreto com número, comando ou nome real",
  "passos": ["verbo no infinitivo...", "..."],
  "armadilhas": ["erro comum de quem começa", "..."],
  "perguntas": [
    {
      "enunciado": "pergunta sobre o assunto",
      "alternativas": [
        { "texto": "...", "correta": true, "porque": "por que está certa" },
        { "texto": "...", "correta": false, "porque": "qual confusão leva a escolher esta" }
      ]
    }
  ],
  "pratica": "o que produzir para provar que aprendeu"
}

2 a 4 parágrafos de explicação. 3 a 6 passos. 2 a 4 armadilhas. 2 ou 3 perguntas, cada uma com
EXATAMENTE 4 alternativas e EXATAMENTE uma correta.`;

type SaidaLicao =
  | { ok: true; licao: Licao; modelo: string }
  | { ok: false; motivo: string; detalhe?: string | undefined };

async function viaGemini(
  contexto: ContextoLicao,
  chave: string,
  modelo: string,
): Promise<SaidaLicao> {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        signal: AbortSignal.timeout(TETO_MS),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SISTEMA }] },
          contents: [{ role: "user", parts: [{ text: pedido(contexto) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: paraGemini(SCHEMA_LICAO),
            maxOutputTokens: 8192,
          },
        }),
      },
    );
    const corpo = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!r.ok) return { ok: false, motivo: "erro", detalhe: corpo.error?.message };
    const texto = corpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const licao = validarLicao(JSON.parse(texto));
    return licao ? { ok: true, licao, modelo } : { ok: false, motivo: "invalida" };
  } catch (error) {
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}

/** O Gemini aceita um subconjunto do OpenAPI: tipos em MAIÚSCULAS, sem `additionalProperties`. */
function paraGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(paraGemini);
  if (!schema || typeof schema !== "object") return schema;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties") continue;
    saida[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : paraGemini(v);
  }
  return saida;
}

async function viaCompat(
  contexto: ContextoLicao,
  servico: (typeof SERVICOS_COMPAT)[number],
  chave: string,
  modelo: string,
): Promise<SaidaLicao> {
  try {
    const r = await fetch(servico.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
        ...(servico.cabecalhosExtra ?? {}),
      },
      signal: AbortSignal.timeout(TETO_MS),
      body: JSON.stringify({
        model: modelo,
        messages: [
          {
            role: "system",
            content: `${SISTEMA}\n\nResponda SOMENTE com JSON neste formato: ${JSON.stringify(SCHEMA_LICAO)}`,
          },
          { role: "user", content: pedido(contexto) },
        ],
        response_format: { type: "json_object" },
        reasoning: { exclude: true },
        max_tokens: 8192,
      }),
    });
    const corpo = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
    };
    if (!r.ok) {
      const msg = typeof corpo.error === "string" ? corpo.error : corpo.error?.message;
      return { ok: false, motivo: "erro", detalhe: msg };
    }
    const texto = corpo.choices?.[0]?.message?.content ?? "";
    const limpo = texto.replace(/```(?:json)?/gi, "").trim();
    const licao = validarLicao(JSON.parse(limpo));
    return licao
      ? { ok: true, licao, modelo: `${servico.id}/${modelo}` }
      : { ok: false, motivo: "invalida" };
  } catch (error) {
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function gerarLicao(
  contexto: ContextoLicao,
  env: (nome: string) => string | undefined,
): Promise<SaidaLicao> {
  const corridas: Promise<SaidaLicao>[] = [];

  const gemini = env("GEMINI_API_KEY");
  if (gemini)
    corridas.push(viaGemini(contexto, gemini, env("GEMINI_MODELO") || "gemini-3.5-flash"));

  for (const servico of SERVICOS_COMPAT) {
    const chave = env(servico.envChave);
    if (!chave) continue;
    const modelo = env(servico.envModelo) || servico.modelos[0]!;
    corridas.push(viaCompat(contexto, servico, chave, modelo));
  }

  if (corridas.length === 0) return { ok: false, motivo: "sem-chave" };

  // Mesma corrida da rota: uma aula que demora não pode segurar a pessoa, e uma lenta não pode
  // impedir que a rápida entregue.
  const pendentes = new Map(corridas.map((p, i) => [i, p.then((s) => ({ i, s }))]));
  let ultima: SaidaLicao = { ok: false, motivo: "erro" };
  while (pendentes.size > 0) {
    const chegou = await Promise.race(pendentes.values());
    pendentes.delete(chegou.i);
    if (chegou.s.ok) return chegou.s;
    ultima = chegou.s;
  }
  return ultima;
}
