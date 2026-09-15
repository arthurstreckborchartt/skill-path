/**
 * Camada de pagamento. **Só roda no servidor** — a chave secreta do Stripe nunca pode entrar no
 * bundle, pela mesma razão das chaves de IA.
 *
 * Sem SDK, como no provedor compatível com OpenAI: a API do Stripe aceita
 * `application/x-www-form-urlencoded` e `fetch` existe nativo no Worker. O SDK oficial traria
 * um pacote grande para fazer três chamadas.
 */

const API = "https://api.stripe.com/v1";

/** O Stripe espera form-urlencoded com colchetes para aninhar: `a[b][0][c]=v`. */
function paraForm(obj: Record<string, unknown>, prefixo = ""): string[] {
  const partes: string[] = [];
  for (const [chave, valor] of Object.entries(obj)) {
    if (valor === undefined || valor === null) continue;
    const nome = prefixo ? `${prefixo}[${chave}]` : chave;
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => {
        if (item && typeof item === "object") {
          partes.push(...paraForm(item as Record<string, unknown>, `${nome}[${i}]`));
        } else {
          partes.push(`${encodeURIComponent(`${nome}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else if (typeof valor === "object") {
      partes.push(...paraForm(valor as Record<string, unknown>, nome));
    } else {
      partes.push(`${encodeURIComponent(nome)}=${encodeURIComponent(String(valor))}`);
    }
  }
  return partes;
}

export async function chamarStripe<T>(
  caminho: string,
  chave: string,
  corpo?: Record<string, unknown>,
): Promise<{ ok: true; dados: T } | { ok: false; erro: string; status: number }> {
  try {
    const r = await fetch(`${API}${caminho}`, {
      method: corpo ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${chave}`,
        ...(corpo ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      ...(corpo ? { body: paraForm(corpo).join("&") } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const dados = (await r.json()) as T & { error?: { message?: string } };
    if (!r.ok) {
      return { ok: false, erro: dados.error?.message ?? `HTTP ${r.status}`, status: r.status };
    }
    return { ok: true, dados };
  } catch (error) {
    return {
      ok: false,
      erro: error instanceof Error ? error.message : "falha de rede",
      status: 0,
    };
  }
}

/**
 * Confere a assinatura do webhook.
 *
 * Isto não é opcional e não é burocracia: sem verificar, qualquer pessoa que descobrisse a URL
 * mandaria um POST dizendo "fulano virou Pro" e viraria Pro de graça. O endpoint é público por
 * definição — a assinatura é a única coisa que separa o Stripe de um impostor.
 *
 * HMAC-SHA256 sobre `<timestamp>.<corpo cru>`, comparado em tempo constante. O corpo tem que ser
 * o texto exato recebido: reserializar o JSON muda bytes e invalida a assinatura.
 */
export async function assinaturaValida(
  corpoCru: string,
  cabecalho: string | null,
  segredo: string,
  toleranciaSegundos = 300,
): Promise<boolean> {
  if (!cabecalho) return false;

  const partes = Object.fromEntries(
    cabecalho.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as { t?: string; v1?: string };

  if (!partes.t || !partes.v1) return false;

  // Janela de tempo: sem ela, uma requisição legítima capturada uma vez poderia ser reenviada
  // para sempre.
  const idade = Math.abs(Date.now() / 1000 - Number(partes.t));
  if (!Number.isFinite(idade) || idade > toleranciaSegundos) return false;

  const codificador = new TextEncoder();
  const chave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinado = await crypto.subtle.sign(
    "HMAC",
    chave,
    codificador.encode(`${partes.t}.${corpoCru}`),
  );
  const esperado = [...new Uint8Array(assinado)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Comparação em tempo constante: um `===` vazaria, pelo tempo de resposta, quantos caracteres
  // iniciais o atacante acertou.
  if (esperado.length !== partes.v1.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferenca |= esperado.charCodeAt(i) ^ partes.v1.charCodeAt(i);
  }
  return diferenca === 0;
}
