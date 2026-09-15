import { SISTEMA, resumirPerfil } from "@/lib/ia/prompt";
import { validarRota, type SaidaProvedor } from "@/lib/ia/contrato";
import type { OnboardingProfile } from "@/lib/onboarding";

/**
 * Provedor do plano gratuito: Gemini, camada gratuita.
 *
 * Por que aqui não há SDK: o `@google/generative-ai` traria mais um pacote ao bundle do Worker
 * para fazer um único POST. A API é REST simples e `fetch` existe nativo no runtime — o SDK não
 * pagaria o próprio peso.
 *
 * Obtenção da chave: aistudio.google.com/apikey, gratuito e sem cartão.
 */

/**
 * O nome do modelo é a parte mais perecível deste arquivo: o Google aposenta versões e a API
 * responde com erro dizendo qual é a sucessora. Por isso ele é sobrescrevível por env
 * (`GEMINI_MODELO`) — quando cair de novo, é variável de ambiente, não deploy de código.
 */
const MODELO_PADRAO = "gemini-3.6-flash";

/**
 * O Gemini aceita um subconjunto do OpenAPI, não o JSON Schema completo: os tipos são em
 * MAIÚSCULAS e `additionalProperties` não existe. É por isso que este schema é escrito à mão em
 * vez de reaproveitar o `SCHEMA_ROTA` do Claude — converter um no outro daria mais linhas e mais
 * chance de erro silencioso do que manter os dois lado a lado.
 */
const SCHEMA_GEMINI = {
  type: "OBJECT",
  properties: {
    papel: { type: "STRING" },
    etapas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          titulo: { type: "STRING" },
          objetivo: { type: "STRING" },
          porque: { type: "STRING" },
          marco: { type: "STRING" },
          habilidades: { type: "ARRAY", items: { type: "STRING" } },
          projetos: { type: "ARRAY", items: { type: "STRING" } },
          dificuldade: { type: "STRING", enum: ["fácil", "médio", "difícil"] },
          impacto: { type: "STRING", enum: ["médio", "alto", "muito alto"] },
          horas: { type: "NUMBER" },
          tarefas: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: [
          "titulo",
          "objetivo",
          "porque",
          "marco",
          "habilidades",
          "projetos",
          "dificuldade",
          "impacto",
          "horas",
          "tarefas",
        ],
      },
    },
  },
  required: ["papel", "etapas"],
};

type RespostaGemini = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

/**
 * Quais falhas vale repetir.
 *
 * Só as que passam sozinhas: sobrecarga do modelo e erro de servidor. Repetir um 400 (requisição
 * malformada), um 403 (chave errada) ou um 404 (modelo que não existe) é gastar tempo da pessoa
 * esperando o mesmo erro chegar de novo — esses são problemas nossos, não do momento.
 *
 * O 429 é o caso ambíguo e por isso tem tratamento próprio: na camada gratuita ele tanto pode ser
 * o limite por minuto, que passa em segundos, quanto a cota do dia, que não passa hoje. Repetimos
 * uma vez; se insistir, tratamos como cota e paramos.
 */
function vaiPassarSozinho(status: number, mensagem: string): boolean {
  if (status >= 500) return true;
  if (status === 429) return true;
  // "high demand" chega com 200 em alguns casos e com 5xx em outros; o texto é o sinal confiável.
  return /high demand|overload|try again|temporar/i.test(mensagem);
}

const ESPERAS_MS = [1500, 4000];

export async function gerarComGemini(
  perfil: OnboardingProfile,
  apiKey: string | undefined,
  modelo: string | undefined = MODELO_PADRAO,
): Promise<SaidaProvedor> {
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo || MODELO_PADRAO}:generateContent`;
  const corpoRequisicao = JSON.stringify({
    system_instruction: { parts: [{ text: SISTEMA }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Monte a trilha de estudo desta pessoa. Entre 6 e 10 etapas, cada uma com 4 a 8 tarefas.

${resumirPerfil(perfil)}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: SCHEMA_GEMINI,
      maxOutputTokens: 8192,
    },
  });

  let ultima: SaidaProvedor = { ok: false, motivo: "erro", detalhe: "nenhuma tentativa" };

  // Até 3 tentativas. O teto de espera somado é ~5,5s, escolhido contra a tela de "montando sua
  // rota": ela já espera a geração terminar, e um minuto de silêncio ali é pior que uma falha.
  for (let tentativa = 0; tentativa <= ESPERAS_MS.length; tentativa++) {
    if (tentativa > 0) {
      await new Promise((r) => setTimeout(r, ESPERAS_MS[tentativa - 1]));
    }

    ultima = await umaTentativa(url, apiKey, corpoRequisicao);
    if (ultima.ok) return ultima;

    const podeRepetir = ultima.motivo === "erro" && ultima.transitorio === true;
    if (!podeRepetir) return ultima;

    // 429 repetido é cota do dia, não congestionamento: parar é mais honesto que insistir.
    if (ultima.status === 429 && tentativa >= 1) {
      return { ok: false, motivo: "erro", detalhe: "cota gratuita esgotada" };
    }
  }

  return ultima;
}

async function umaTentativa(
  url: string,
  apiKey: string,
  corpoRequisicao: string,
): Promise<SaidaProvedor> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: corpoRequisicao,
    });

    const corpo = (await r.json()) as RespostaGemini;

    if (!r.ok) {
      const msg = corpo.error?.message ?? `HTTP ${r.status}`;
      return {
        ok: false,
        motivo: "erro",
        detalhe: msg,
        status: r.status,
        transitorio: vaiPassarSozinho(r.status, msg),
      };
    }

    // Bloqueio por política vem com 200 e sem candidato. Não é transitório: repetir o mesmo
    // prompt daria o mesmo bloqueio.
    if (corpo.promptFeedback?.blockReason) {
      return { ok: false, motivo: "recusa", detalhe: corpo.promptFeedback.blockReason };
    }

    const texto = corpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!texto.trim()) {
      // Resposta vazia costuma ser corte por limite de saída ou soluço do modelo: vale repetir.
      return { ok: false, motivo: "erro", detalhe: "resposta vazia", transitorio: true };
    }

    const rota = validarRota(JSON.parse(texto));
    if (!rota) return { ok: false, motivo: "invalida" };
    return { ok: true, rota };
  } catch (error) {
    // Falha de rede: exatamente o tipo de coisa que passa na tentativa seguinte.
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
      transitorio: true,
    };
  }
}
