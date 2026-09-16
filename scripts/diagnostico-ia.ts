/**
 * Diz quais modelos de IA estão de pé agora. Rode com:
 *
 *   bun --env-file=.env.local scripts/diagnostico-ia.ts
 *
 * Existe porque nome de modelo é a parte deste projeto que envelhece mais rápido, e já quebrou
 * três vezes: `gemini-2.0-flash` foi aposentado, `meta-llama/llama-3.3-70b-instruct:free` nunca
 * existiu, e em 16/09/2026 o `gemini-3.5-flash` — o padrão do código — respondia 503 enquanto o
 * `3.6` e o `3.8` estavam vivos. Numa corrida em paralelo, um provedor que erra apenas perde,
 * sem alarme nenhum: o app continua funcionando pelos outros e o problema fica invisível.
 *
 * Lê as listas do próprio código, e não uma cópia — um script que testa nomes escritos à mão
 * envelheceria junto com o que ele deveria vigiar.
 */

import { MODELOS_GEMINI } from "../src/lib/ia/gerar-json";
import { SERVICOS_COMPAT } from "../src/lib/ia/provedor-openai-compat";

const TETO_MS = 30_000;
const PERGUNTA = 'Responda SOMENTE com JSON: {"ok":true}';

type Linha = { alvo: string; estado: string; nota: string; segundos: string };

function cronometrar(inicio: number): string {
  return `${((Date.now() - inicio) / 1000).toFixed(1)}s`;
}

async function testarGemini(chave: string, modelo: string): Promise<Linha> {
  const inicio = Date.now();
  const alvo = `gemini/${modelo}`;
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        signal: AbortSignal.timeout(TETO_MS),
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PERGUNTA }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 100 },
        }),
      },
    );
    const corpo = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!r.ok) {
      return {
        alvo,
        estado: String(r.status),
        nota: corpo.error?.message ?? "",
        segundos: cronometrar(inicio),
      };
    }
    const texto = corpo.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return {
      alvo,
      estado: "OK",
      nota: texto.replace(/\s+/g, " ").trim(),
      segundos: cronometrar(inicio),
    };
  } catch (erro) {
    return {
      alvo,
      estado: "FALHA",
      nota: erro instanceof Error ? erro.message : "",
      segundos: cronometrar(inicio),
    };
  }
}

async function testarCompat(
  servico: (typeof SERVICOS_COMPAT)[number],
  chave: string,
  modelo: string,
): Promise<Linha> {
  const inicio = Date.now();
  const alvo = `${servico.id}/${modelo}`;
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
        messages: [{ role: "user", content: PERGUNTA }],
        response_format: { type: "json_object" },
        reasoning: { exclude: true },
        max_tokens: 100,
      }),
    });
    const corpo = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
    };
    if (!r.ok) {
      const msg = typeof corpo.error === "string" ? corpo.error : (corpo.error?.message ?? "");
      return { alvo, estado: String(r.status), nota: msg, segundos: cronometrar(inicio) };
    }
    const texto = corpo.choices?.[0]?.message?.content ?? "";
    // Resposta que não começa com `{` significa raciocínio vazando para o `content`. Funciona,
    // graças ao `extrairJson`, mas é bom saber — foi o que derrubou o nemotron antes da correção.
    const sujo = !texto.trimStart().startsWith("{");
    return {
      alvo,
      estado: sujo ? "OK (sujo)" : "OK",
      nota: texto.replace(/\s+/g, " ").trim(),
      segundos: cronometrar(inicio),
    };
  } catch (erro) {
    return {
      alvo,
      estado: "FALHA",
      nota: erro instanceof Error ? erro.message : "",
      segundos: cronometrar(inicio),
    };
  }
}

const testes: Promise<Linha>[] = [];
const semChave: string[] = [];

const gemini = process.env.GEMINI_API_KEY;
if (gemini) testes.push(...MODELOS_GEMINI.map((m) => testarGemini(gemini, m)));
else semChave.push("GEMINI_API_KEY");

for (const servico of SERVICOS_COMPAT) {
  const chave = process.env[servico.envChave];
  if (!chave) {
    semChave.push(servico.envChave);
    continue;
  }
  testes.push(...servico.modelos.map((m) => testarCompat(servico, chave, m)));
}

if (testes.length === 0) {
  console.log("Nenhuma chave configurada. Coloque pelo menos uma em .env.local.");
  process.exit(1);
}

const linhas = await Promise.all(testes);
const largura = Math.max(...linhas.map((l) => l.alvo.length));

for (const l of linhas) {
  console.log(
    `${l.alvo.padEnd(largura)}  ${l.estado.padEnd(9)}  ${l.segundos.padStart(6)}  ${l.nota.slice(0, 70)}`,
  );
}

const vivos = linhas.filter((l) => l.estado.startsWith("OK")).length;
console.log(`\n${vivos} de ${linhas.length} responderam.`);
if (semChave.length) console.log(`Sem chave local (pulados): ${semChave.join(", ")}`);
// Um provedor inteiro fora não é motivo de alarme — a corrida existe para isso. Nenhum de pé é.
if (vivos === 0) process.exit(1);
