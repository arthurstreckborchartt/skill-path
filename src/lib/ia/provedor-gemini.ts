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
 * Cadeia de modelos, em ordem de preferência.
 *
 * Medido, não escolhido por intuição: em 15/09/2026, `gemini-3.5-flash` respondeu em 1,1s
 * enquanto `gemini-3.6-flash`, `gemini-flash-latest` e `gemini-flash-lite-latest` estavam todos
 * em "high demand". O mais novo não é o mais disponível — modelo recém-lançado é justamente o
 * mais disputado na camada gratuita.
 *
 * Cair para outro modelo vale mais que repetir no mesmo: quando um está congestionado, ele
 * continua congestionado 4 segundos depois. `GEMINI_MODELO` sobrescreve a cadeia inteira.
 */
const MODELOS_PADRAO = ["gemini-3.5-flash", "gemini-3.6-flash"];

/**
 * Os dois tetos vêm de medição, e o equilíbrio entre eles é a parte delicada.
 *
 * Uma geração que dá certo leva ~20s — é uma rota inteira de resposta. Um modelo congestionado,
 * por outro lado, responde "high demand" em ~7s. Essa assimetria é o que faz a cadeia funcionar:
 * o modelo ruim se elimina rápido e sobra tempo para o bom terminar.
 *
 * Daí os números: 30s por tentativa (uma geração de 20s cabe com folga — um teto menor mataria
 * justamente as que iam dar certo, e eu quase cometi esse erro com 13s) e 40s de prazo total,
 * que acomoda uma falha rápida seguida de um sucesso completo.
 */
const PRAZO_TOTAL_MS = 40_000;

/**
 * Teto por tentativa. Sem isto o prazo total não vale nada: checar o relógio ANTES de cada
 * tentativa não impede que uma que começou dentro do prazo estoure sozinha — foi o que aconteceu,
 * 41s numa corrida com teto declarado de 25s. Quem segura uma requisição em voo é o abort.
 */
const TETO_POR_TENTATIVA_MS = 30_000;

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

/** Pausa curta entre passadas na cadeia. Curta de propósito: o prazo total é o freio real. */
const ESPERA_ENTRE_PASSADAS_MS = 1500;

export async function gerarComGemini(
  perfil: OnboardingProfile,
  apiKey: string | undefined,
  modelo: string | undefined = undefined,
): Promise<SaidaProvedor> {
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  const modelos = modelo ? [modelo] : MODELOS_PADRAO;
  const corpoRequisicao = montarCorpo(perfil);
  const limite = Date.now() + PRAZO_TOTAL_MS;

  let ultima: SaidaProvedor = { ok: false, motivo: "erro", detalhe: "nenhuma tentativa" };

  // Duas passadas pela cadeia. A primeira tenta cada modelo uma vez — se o preferido está
  // congestionado, o seguinte costuma responder na hora. A segunda existe para a falha que é
  // mesmo momentânea, e só acontece se ainda houver tempo no relógio.
  for (let passada = 0; passada < 2; passada++) {
    if (passada > 0) {
      if (Date.now() >= limite) break;
      await new Promise((r) => setTimeout(r, ESPERA_ENTRE_PASSADAS_MS));
    }

    for (const m of modelos) {
      if (Date.now() >= limite) return ultima;

      // O menor entre o teto da tentativa e o que sobra do prazo total.
      const restante = Math.min(TETO_POR_TENTATIVA_MS, limite - Date.now());
      ultima = await umaTentativa(
        `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`,
        apiKey,
        corpoRequisicao,
        restante,
      );
      if (ultima.ok) return ultima;

      // Erro permanente (400, 403, 404) é problema nosso: não adianta trocar de modelo nem
      // esperar, e insistir só faz a pessoa esperar o mesmo erro chegar de novo.
      if (ultima.motivo !== "erro" || ultima.transitorio !== true) return ultima;
    }
  }

  return ultima;
}

function montarCorpo(perfil: OnboardingProfile): string {
  return JSON.stringify({
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
}

async function umaTentativa(
  url: string,
  apiKey: string,
  corpoRequisicao: string,
  tetoMs: number,
): Promise<SaidaProvedor> {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: corpoRequisicao,
      signal: AbortSignal.timeout(Math.max(1000, tetoMs)),
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
    // Abort conta como transitório: o modelo estava lento, o próximo da cadeia pode não estar.
    const abortou = error instanceof Error && error.name === "TimeoutError";
    return {
      ok: false,
      motivo: "erro",
      detalhe: abortou
        ? "tempo esgotado nesta tentativa"
        : error instanceof Error
          ? error.message
          : undefined,
      transitorio: true,
    };
  }
}
