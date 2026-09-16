import { SERVICOS_COMPAT } from "@/lib/ia/provedor-openai-compat";

/**
 * Correção da prática escrita.
 *
 * Esta é a peça que transforma leitura em aprendizado. Escolher alternativa testa
 * reconhecimento — a resposta certa está na tela, basta reconhecê-la. Escrever obriga a
 * recuperar da memória e organizar, que é o que fixa. E recuperar sem correção fixa o erro
 * junto, por isso a correção precisa ser específica, não um "muito bem".
 *
 * A regra mais importante do prompt é a que proíbe elogio vazio. Um avaliador que aprova tudo
 * destrói exatamente o valor que ele existe para criar.
 */

const SISTEMA = `Você corrige o exercício de alguém aprendendo, num app brasileiro de estudo.

Escreva em português do Brasil, na segunda pessoa ("você"), direto e curto.

COMO CORRIGIR:
- Aponte o que a pessoa acertou citando o que ELA escreveu, não genericamente.
- Aponte o que falta ou está errado, e explique POR QUE está errado.
- Se a resposta estiver vaga demais para avaliar, diga isso e peça o que falta.
- Dê UMA coisa concreta para melhorar. Não uma lista de dez.

PROIBIDO:
- Elogio vazio: "ótimo!", "muito bem!", "você está no caminho certo!" sem dizer o quê.
- Aprovar resposta incompleta só para a pessoa se sentir bem. Isso a prejudica.
- Reescrever o exercício pela pessoa. Aponte o caminho, não entregue pronto.
- Prometer emprego, renda ou vaga.

O campo "aprovado" diz se a pessoa demonstrou que fez e entendeu. Seja honesto: aprovar quem
não demonstrou tira o sentido do exercício.`;

const FORMATO = `Responda SOMENTE com JSON:

{
  "aprovado": true,
  "acertou": "o que ela demonstrou, citando o que escreveu",
  "faltou": "o que falta ou está errado, e por quê (string vazia se nada faltou)",
  "proximoPasso": "UMA coisa concreta para fazer agora"
}`;

export type Correcao = {
  aprovado: boolean;
  acertou: string;
  faltou: string;
  proximoPasso: string;
};

export type EnvioPratica = {
  tarefa: string;
  pratica: string;
  resposta: string;
};

export type SaidaCorrecao =
  { ok: true; correcao: Correcao } | { ok: false; motivo: string; detalhe?: string | undefined };

function validar(valor: unknown): Correcao | null {
  if (!valor || typeof valor !== "object") return null;
  const c = valor as Partial<Correcao>;
  if (typeof c.acertou !== "string" || !c.acertou.trim()) return null;
  return {
    // Ausente vira reprovado de propósito: na dúvida, não aprova.
    aprovado: c.aprovado === true,
    acertou: c.acertou,
    faltou: typeof c.faltou === "string" ? c.faltou : "",
    proximoPasso: typeof c.proximoPasso === "string" ? c.proximoPasso : "",
  };
}

function pedido(e: EnvioPratica): string {
  return [
    `Tarefa: ${e.tarefa}`,
    `O exercício pedia: ${e.pratica}`,
    ``,
    `A pessoa respondeu:`,
    `"""`,
    e.resposta.slice(0, 4000),
    `"""`,
  ].join("\n");
}

const TETO_MS = 30_000;

async function viaGemini(e: EnvioPratica, chave: string, modelo: string): Promise<SaidaCorrecao> {
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        signal: AbortSignal.timeout(TETO_MS),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: `${SISTEMA}\n\n${FORMATO}` }] },
          contents: [{ role: "user", parts: [{ text: pedido(e) }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
        }),
      },
    );
    const corpo = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!r.ok) return { ok: false, motivo: "erro", detalhe: corpo.error?.message };
    const texto = corpo.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const correcao = validar(JSON.parse(texto));
    return correcao ? { ok: true, correcao } : { ok: false, motivo: "invalida" };
  } catch (error) {
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}

async function viaCompat(
  e: EnvioPratica,
  servico: (typeof SERVICOS_COMPAT)[number],
  chave: string,
  modelo: string,
): Promise<SaidaCorrecao> {
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
          { role: "system", content: `${SISTEMA}\n\n${FORMATO}` },
          { role: "user", content: pedido(e) },
        ],
        response_format: { type: "json_object" },
        reasoning: { exclude: true },
        max_tokens: 2048,
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
    const texto = (corpo.choices?.[0]?.message?.content ?? "").replace(/```(?:json)?/gi, "").trim();
    const correcao = validar(JSON.parse(texto));
    return correcao ? { ok: true, correcao } : { ok: false, motivo: "invalida" };
  } catch (error) {
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}

export async function avaliarPratica(
  envio: EnvioPratica,
  env: (nome: string) => string | undefined,
): Promise<SaidaCorrecao> {
  const corridas: Promise<SaidaCorrecao>[] = [];

  const gemini = env("GEMINI_API_KEY");
  if (gemini) corridas.push(viaGemini(envio, gemini, env("GEMINI_MODELO") || "gemini-3.5-flash"));

  for (const servico of SERVICOS_COMPAT) {
    const chave = env(servico.envChave);
    if (!chave) continue;
    corridas.push(viaCompat(envio, servico, chave, env(servico.envModelo) || servico.modelos[0]!));
  }

  if (corridas.length === 0) return { ok: false, motivo: "sem-chave" };

  // Em paralelo, como o resto: a pessoa acabou de escrever e está esperando o retorno — é o
  // pior momento possível para uma fila de provedores lentos.
  const pendentes = new Map(corridas.map((p, i) => [i, p.then((s) => ({ i, s }))]));
  let ultima: SaidaCorrecao = { ok: false, motivo: "erro" };
  while (pendentes.size > 0) {
    const chegou = await Promise.race(pendentes.values());
    pendentes.delete(chegou.i);
    if (chegou.s.ok) return chegou.s;
    ultima = chegou.s;
  }
  return ultima;
}
