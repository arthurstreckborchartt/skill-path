import Anthropic from "@anthropic-ai/sdk";
import { SERVICOS_COMPAT, type ServicoCompat } from "@/lib/ia/provedor-openai-compat";

/**
 * Geração de JSON estruturado por IA, sem saber de que assunto se trata. **Só no servidor.**
 *
 * `gerar-rota.ts`, `gerar-licao.ts` e `avaliar-pratica.ts` têm, cada um, sua própria cópia de
 * `viaGemini` e `viaCompat` — três implementações do mesmo laço de corrida, que já divergiram
 * entre si em teto de tempo e tratamento de erro. O blueprint seria a quarta.
 *
 * Aqui a mecânica fica num lugar só e o que muda por caso de uso vira parâmetro: prompt, schema,
 * validador e teto. Os três arquivos antigos continuam funcionando como estão — migrá-los é
 * seguro, mas é mexer em código que está em produção e funcionando, e não é o trabalho de agora.
 *
 * A corrida é em paralelo, não em cadeia. Sequencial foi tentado e falhou: quando o Gemini está
 * congestionado ele demora ~30s para dizer que não vai responder, e só então o segundo começa.
 */

export type Saida<T> =
  | { ok: true; dados: T; modelo: string }
  | {
      ok: false;
      motivo: "sem-chave" | "invalida" | "recusa" | "erro";
      detalhe?: string | undefined;
    };

export type Pedido<T> = {
  sistema: string;
  usuario: string;
  /** Schema JSON. Vai como parâmetro estruturado no Gemini e no Claude. */
  schema: Record<string, unknown>;
  /**
   * Descrição do formato em texto, para os serviços compatíveis com a OpenAI.
   *
   * Existe porque despejar `JSON.stringify(schema)` na mensagem de sistema é caro: o modelo lê
   * um bloco enorme de metadados antes de escrever a primeira palavra, e isso sozinho já estourou
   * o tempo antes. Quando não vem, cai no schema serializado — pior, mas funciona.
   */
  formato?: string;
  /** Schema não garante conteúdo utilizável. Este é o filtro que decide se a resposta serve. */
  validar: (valor: unknown) => T | null;
  tetoMs?: number;
  maxTokens?: number;
  /** Plano Pro: coloca o Claude na corrida junto com os gratuitos. */
  comClaude?: boolean;
};

/** Padrão medido contra o uso real: o OpenRouter entrega conteúdo longo em ~31s. */
const TETO_PADRAO_MS = 55_000;
const TOKENS_PADRAO = 8192;

/**
 * Teto de **uma** tentativa: uma fatia do que resta, nunca tudo.
 *
 * Um número fixo não serve, e testar mostrou os dois lados. Fixo em 35s cortava o
 * `nemotron-3-super-120b`, que leva de 32 a 50s no bloco técnico e é o de melhor qualidade. Dar o
 * orçamento inteiro deixava o `gemini-3.6-flash` gastar 38,7s **só para devolver um 503** — uma
 * falha lenta que consumia a vez dos outros três modelos, incluindo o `lite`, que resolvia o mesmo
 * pedido em 3,2s.
 *
 * A fração resolve os dois: a primeira tentativa recebe a maior parte (generosa para quem é lento
 * mas entrega) e, se ela falhar, ainda sobra tempo para duas tentativas rápidas. O piso impede
 * que as últimas fiquem curtas demais para valer a chamada.
 */
const FATIA_POR_TENTATIVA = 0.55;
const PISO_TENTATIVA_MS = 20_000;

function tetoDaTentativa(restaMs: number): number {
  return Math.max(PISO_TENTATIVA_MS, Math.floor(restaMs * FATIA_POR_TENTATIVA));
}

/** O Gemini aceita um subconjunto do OpenAPI: tipos em MAIÚSCULAS, sem `additionalProperties`. */
export function paraGemini(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(paraGemini);
  if (!schema || typeof schema !== "object") return schema;
  const saida: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (k === "additionalProperties") continue;
    saida[k] = k === "type" && typeof v === "string" ? v.toUpperCase() : paraGemini(v);
  }
  return saida;
}

function falha(erro: unknown): { ok: false; motivo: "erro"; detalhe?: string | undefined } {
  return { ok: false, motivo: "erro", detalhe: erro instanceof Error ? erro.message : undefined };
}

/** Os únicos caracteres que podem vir depois de uma barra invertida em JSON. */
const ESCAPES_VALIDOS = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

function ehHex(c: string): boolean {
  const n = c.codePointAt(0) ?? -1;
  const DIGITO = n >= 0x30 && n <= 0x39;
  const AF_MIN = n >= 0x61 && n <= 0x66;
  const AF_MAI = n >= 0x41 && n <= 0x46;
  return DIGITO || AF_MIN || AF_MAI;
}

/**
 * Conserta o que o modelo escreve dentro de string e o `JSON.parse` recusa.
 *
 * Dois casos, os dois vistos em produção:
 *
 * 1. **Barra invertida solta.** Ao escrever um caminho do Windows, uma expressão regular ou um
 *    `\_` de markdown, o modelo produz `\d`, que não é escape válido. O parse morre com
 *    "Unrecognized token" e a geração inteira é jogada fora — depois de 70 segundos pagos.
 * 2. **Quebra de linha crua.** JSON exige `\n`; um newline literal dentro da string é inválido.
 *
 * Consertar é seguro porque a intenção é inequívoca: uma barra que não abre escape era para ser
 * uma barra, e uma quebra de linha dentro de string era para ser uma quebra de linha. Recusar
 * seria tecnicamente correto e inútil para quem está esperando.
 */
export function repararJson(bruto: string): string {
  let saida = "";
  let emString = false;

  for (let i = 0; i < bruto.length; i++) {
    const c = bruto[i]!;

    if (!emString) {
      if (c === '"') emString = true;
      saida += c;
      continue;
    }

    if (c === '"') {
      emString = false;
      saida += c;
      continue;
    }

    if (c === "\\") {
      const proximo = bruto[i + 1] ?? "";
      const hexOk = proximo === "u" && [1, 2, 3, 4].every((k) => ehHex(bruto[i + 1 + k] ?? ""));

      if (ESCAPES_VALIDOS.has(proximo) && (proximo !== "u" || hexOk)) {
        saida += c + proximo;
        i++;
      } else {
        saida += "\\\\";
      }
      continue;
    }

    const n = c.codePointAt(0) ?? 0;
    if (n < 0x20) {
      // Controle cru dentro de string: vira o escape correspondente quando existe.
      const mapa: Record<number, string> = { 8: "\\b", 9: "\\t", 10: "\\n", 12: "\\f", 13: "\\r" };
      saida += mapa[n] ?? " ";
      continue;
    }

    saida += c;
  }

  return saida;
}

/**
 * Extrai o objeto JSON de uma resposta que pode vir suja.
 *
 * Tirar a cerca de markdown não basta. Medido em 16/09/2026: o `nemotron-3-super-120b` responde
 * "Okay, the user is asking me to..." antes do JSON mesmo com `reasoning: { exclude: true }` no
 * corpo — ou seja, o parâmetro que deveria calar o raciocínio não é respeitado por ele. Um
 * `JSON.parse` direto morre nessa primeira palavra, e o provedor perdia a corrida por um motivo
 * que não tinha nada a ver com a qualidade da resposta.
 *
 * O contador de chaves ignora o que está dentro de string para não parar num `}` que faz parte
 * de um texto — descrições de campo deste projeto têm chaves no meio.
 */
export function extrairJson(bruto: string): string {
  const limpo = bruto.replace(/```(?:json)?/gi, "");
  const inicio = limpo.indexOf("{");
  if (inicio === -1) return limpo.trim();

  let profundidade = 0;
  let emString = false;
  let escapando = false;

  for (let i = inicio; i < limpo.length; i++) {
    const c = limpo[i]!;
    if (escapando) {
      escapando = false;
      continue;
    }
    if (c === "\\") {
      escapando = true;
      continue;
    }
    if (c === '"') {
      emString = !emString;
      continue;
    }
    if (emString) continue;

    if (c === "{") profundidade++;
    else if (c === "}" && --profundidade === 0) return repararJson(limpo.slice(inicio, i + 1));
  }

  // Chaves desbalanceadas: resposta cortada no meio. Devolve o que há para o `validar` recusar.
  return repararJson(limpo.slice(inicio).trim());
}

/**
 * Tenta os modelos de um provedor em sequência, dentro de um orçamento de tempo compartilhado.
 *
 * Antes daqui só o primeiro modelo da lista era tentado — a lista de reserva existia e nunca era
 * usada. Isso apareceu na prática: em 16/09/2026 o `gemini-3.5-flash`, que é o padrão do projeto,
 * respondia 503 por excesso de demanda enquanto `gemini-3.6-flash` e `gemini-3.8-flash` estavam
 * de pé. Com um modelo só, o Gemini inteiro saía da corrida.
 *
 * O orçamento é do provedor, não de cada tentativa: quatro modelos a 65s cada dariam mais de
 * quatro minutos de espera.
 *
 * Mas cada tentativa tem teto próprio (`tetoDaTentativa`), e essa parte custou caro para
 * descobrir. Sem ela a primeira tentativa recebia o orçamento inteiro, e um modelo que trava
 * consumia tudo sozinho — os outros da lista nunca chegavam a ser chamados. Medido em
 * 16/09/2026: o bloco técnico falhava em 65s enquanto o `gemini-3.5-flash-lite`, o último da
 * fila, resolvia o mesmo pedido em 3,4s. A lista de reserva existia, cabia no tempo, e mesmo
 * assim não era usada.
 */
async function porModelo<T>(
  modelos: string[],
  orcamentoMs: number,
  tentar: (modelo: string, tetoMs: number) => Promise<Saida<T>>,
): Promise<Saida<T>> {
  const fim = Date.now() + orcamentoMs;
  let ultima: Saida<T> = { ok: false, motivo: "erro" };

  for (const modelo of modelos) {
    const resta = fim - Date.now();
    // Abaixo disto não dá para gerar nada útil, e a tentativa só atrasaria a resposta de falha.
    if (resta < 5_000) break;
    const s = await tentar(modelo, Math.min(resta, tetoDaTentativa(resta)));
    if (s.ok) return s;
    ultima = s;
  }

  return ultima;
}

/**
 * Modelos do Gemini, conferidos contra o catálogo ao vivo em 16/09/2026.
 *
 * Nome de modelo é a parte que envelhece mais rápido neste projeto — três já foram escritos de
 * memória e estavam errados. Estes vieram de `GET /v1beta/models` e foram chamados um a um: os
 * quatro abaixo responderam, enquanto `gemini-3.7-flash`, `gemini-flash-latest` e o próprio
 * `gemini-3.5-flash` devolveram 503 naquele instante, e `gemini-2.5-flash` foi descontinuado.
 *
 * A ordem veio da medição, não da numeração. O `3.6` respondeu em ~1,5s nas duas rodadas; o
 * `3.8`, apesar de mais novo, levou 7,5s numa e estourou 30s na outra. Modelo mais recente não é
 * modelo mais disponível, e quem chega primeiro na corrida é o que importa. O `lite` fica no fim
 * como rede de segurança, não como preferência.
 *
 * Para reconferir isto a qualquer momento: `bun --env-file=.env.local scripts/diagnostico-ia.ts`.
 */
export const MODELOS_GEMINI = [
  "gemini-3.6-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

/**
 * Conta os nós de um schema — cada objeto que declara um `type`.
 *
 * Serve para prever se o Gemini vai aceitar o schema, ver `LIMITE_NOS_GEMINI`.
 */
function contarNos(schema: unknown): number {
  if (Array.isArray(schema)) return schema.reduce<number>((n, x) => n + contarNos(x), 0);
  if (!schema || typeof schema !== "object") return 0;
  const s = schema as Record<string, unknown>;
  let n = s["type"] ? 1 : 0;
  for (const v of Object.values(s)) n += contarNos(v);
  return n;
}

/**
 * Acima disto o Gemini recusa o `responseSchema` com HTTP 400 "invalid argument".
 *
 * Medido em 16/09/2026 por bissecção, não tirado da documentação — ela não menciona este limite.
 * O schema do bloco técnico tem 33 nós e era recusado por **todos** os modelos do Gemini, o que
 * derrubava a via inteira e deixava só o OpenRouter na corrida. Com um provedor só, duas de
 * quatro gerações falharam por tempo.
 *
 * Combinações de 22 e 24 nós passaram; 25 já falhou. O teto aqui é conservador de propósito: o
 * custo de não mandar o schema é pequeno (o formato em texto continua no prompt), e o custo de
 * errar para cima é perder o provedor inteiro.
 */
const LIMITE_NOS_GEMINI = 22;

async function chamarGemini<T>(
  p: Pedido<T>,
  chave: string,
  modelo: string,
  tetoMs: number,
  comSchema: boolean,
): Promise<{ saida: Saida<T>; schemaRecusado: boolean }> {
  try {
    // Sem o schema estruturado, o formato precisa ir no texto — senão o modelo devolve JSON
    // válido com os campos que ele quiser, e o `validar` recusa tudo.
    const sistema = comSchema || !p.formato ? p.sistema : `${p.sistema}\n\n${p.formato}`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
        signal: AbortSignal.timeout(tetoMs),
        body: JSON.stringify({
          system_instruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: p.usuario }] }],
          generationConfig: {
            responseMimeType: "application/json",
            ...(comSchema ? { responseSchema: paraGemini(p.schema) } : {}),
            maxOutputTokens: p.maxTokens ?? TOKENS_PADRAO,
          },
        }),
      },
    );
    const corpo = (await r.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!r.ok) {
      return {
        saida: { ok: false, motivo: "erro", detalhe: corpo.error?.message },
        // 400 com schema é recusa do schema, não congestionamento: vale tentar sem ele. Outros
        // status (503, 429) são do serviço, e repetir sem schema não mudaria nada.
        schemaRecusado: r.status === 400 && comSchema,
      };
    }
    const texto = corpo.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
    const dados = p.validar(JSON.parse(extrairJson(texto)));
    return {
      saida: dados
        ? { ok: true, dados, modelo: `gemini/${modelo}${comSchema ? "" : " (sem schema)"}` }
        : { ok: false, motivo: "invalida" },
      schemaRecusado: false,
    };
  } catch (erro) {
    return { saida: falha(erro), schemaRecusado: false };
  }
}

/**
 * Uma tentativa no Gemini, com o schema quando ele couber.
 *
 * A retentativa sem schema existe para o limite não voltar a matar o provedor em silêncio: se o
 * Google mudar o teto, o pior que acontece é uma chamada perdida — não a perda da via inteira,
 * que foi o que aconteceu aqui e passou despercebido porque numa corrida quem erra só perde.
 */
async function viaGemini<T>(
  p: Pedido<T>,
  chave: string,
  modelo: string,
  tetoMs: number,
): Promise<Saida<T>> {
  const inicio = Date.now();
  const cabe = contarNos(paraGemini(p.schema)) <= LIMITE_NOS_GEMINI;

  const primeira = await chamarGemini(p, chave, modelo, tetoMs, cabe);
  if (!primeira.schemaRecusado) return primeira.saida;

  const resta = tetoMs - (Date.now() - inicio);
  if (resta < 5_000) return primeira.saida;
  return (await chamarGemini(p, chave, modelo, resta, false)).saida;
}

async function viaCompat<T>(
  p: Pedido<T>,
  servico: ServicoCompat,
  chave: string,
  modelo: string,
  tetoMs: number,
): Promise<Saida<T>> {
  try {
    const r = await fetch(servico.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chave}`,
        ...(servico.cabecalhosExtra ?? {}),
      },
      signal: AbortSignal.timeout(tetoMs),
      body: JSON.stringify({
        model: modelo,
        messages: [
          {
            role: "system",
            content: `${p.sistema}\n\n${p.formato ?? `Responda SOMENTE com JSON neste formato: ${JSON.stringify(p.schema)}`}`,
          },
          { role: "user", content: p.usuario },
        ],
        response_format: { type: "json_object" },
        // Sem isto o nemotron escreve o raciocínio dentro de `content`, e o JSON vem quebrado.
        reasoning: { exclude: true },
        max_tokens: p.maxTokens ?? TOKENS_PADRAO,
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
    const dados = p.validar(JSON.parse(extrairJson(texto)));
    return dados
      ? { ok: true, dados, modelo: `${servico.id}/${modelo}` }
      : { ok: false, motivo: "invalida" };
  } catch (erro) {
    return falha(erro);
  }
}

async function viaClaude<T>(p: Pedido<T>, chave: string): Promise<Saida<T>> {
  try {
    // Streaming porque a resposta é longa: um POST não-streaming com `max_tokens` alto encosta
    // no timeout de HTTP antes de terminar.
    const stream = new Anthropic({ apiKey: chave }).messages.stream({
      model: "claude-opus-5",
      max_tokens: 32000,
      system: p.sistema,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: p.schema } },
      messages: [{ role: "user", content: p.usuario }],
    });

    const resposta = await stream.finalMessage();
    // Precisa vir antes de ler o content: numa recusa o content não tem o JSON.
    if (resposta.stop_reason === "refusal") {
      return {
        ok: false,
        motivo: "recusa",
        detalhe: resposta.stop_details?.explanation ?? undefined,
      };
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const dados = p.validar(JSON.parse(texto));
    return dados ? { ok: true, dados, modelo: "claude-opus-5" } : { ok: false, motivo: "invalida" };
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      return { ok: false, motivo: "erro", detalhe: "chave da Anthropic inválida" };
    }
    if (erro instanceof Anthropic.RateLimitError) {
      return { ok: false, motivo: "erro", detalhe: "limite de uso atingido" };
    }
    return falha(erro);
  }
}

/**
 * Dispara todos os provedores com chave configurada e devolve a primeira resposta **válida**.
 *
 * "Válida" e não "primeira" é o ponto: um provedor que responde rápido com JSON fora do contrato
 * não pode ganhar a corrida de um que responde certo. Por isso o `validar` roda dentro de cada
 * provedor, antes da comparação.
 */
export async function gerarJson<T>(
  p: Pedido<T>,
  env: (nome: string) => string | undefined,
): Promise<Saida<T>> {
  const corridas: Promise<Saida<T>>[] = [];

  if (p.comClaude) {
    const chave = env("ANTHROPIC_API_KEY");
    if (chave) corridas.push(viaClaude(p, chave));
  }

  const orcamento = p.tetoMs ?? TETO_PADRAO_MS;

  // `GEMINI_MODELO`, quando definido, substitui a lista inteira: é a saída de emergência para
  // trocar de modelo em produção sem esperar um deploy.
  const gemini = env("GEMINI_API_KEY");
  if (gemini) {
    const forcado = env("GEMINI_MODELO");
    const modelos = forcado ? [forcado] : MODELOS_GEMINI;
    corridas.push(
      porModelo(modelos, orcamento, (modelo, teto) => viaGemini(p, gemini, modelo, teto)),
    );
  }

  for (const servico of SERVICOS_COMPAT) {
    const chave = env(servico.envChave);
    if (!chave) continue;
    const forcado = env(servico.envModelo);
    const modelos = forcado ? [forcado] : servico.modelos;
    corridas.push(
      porModelo(modelos, orcamento, (modelo, teto) => viaCompat(p, servico, chave, modelo, teto)),
    );
  }

  if (corridas.length === 0) return { ok: false, motivo: "sem-chave" };

  const pendentes = new Map(corridas.map((c, i) => [i, c.then((s) => ({ i, s }))]));
  // Guardada para o caso de todas falharem: devolver a última falha real diz mais do que um
  // "erro" genérico — normalmente ela carrega a mensagem do provedor.
  let ultima: Saida<T> = { ok: false, motivo: "erro" };
  while (pendentes.size > 0) {
    const chegou = await Promise.race(pendentes.values());
    pendentes.delete(chegou.i);
    if (chegou.s.ok) return chegou.s;
    ultima = chegou.s;
  }
  return ultima;
}
