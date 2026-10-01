/**
 * A bateria da chamada de ferramenta. `bun test`.
 *
 * Mesma escolha da bateria da descoberta: o `fetch` é falso porque o que precisa ser provado é
 * como o Pathly reage ao que um servidor devolve — inclusive ao que um servidor mal-intencionado
 * devolveria. Para isso eu preciso escolher a resposta, não torcer para encontrá-la.
 */

import { describe, expect, test, afterEach } from "bun:test";
import { chamar } from "./protocolo";

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

const ENDERECO = "https://mcp.exemplo.com/sse";

type Passo = { status?: number; tipo?: string; corpo: string };

/** Responde na ordem: initialize, (notificação não consome passo), tools/call. */
function servidorFalso(passos: Passo[]) {
  const recebidos: { metodo: string | null; params: unknown; auth: string | null }[] = [];
  let i = 0;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { method?: string; params?: unknown };
    recebidos.push({
      metodo: corpo.method ?? null,
      params: corpo.params ?? null,
      auth: new Headers(init?.headers ?? {}).get("authorization"),
    });
    if (corpo.method === "notifications/initialized") return new Response("", { status: 202 });
    const p = passos[i++] ?? { corpo: "{}" };
    return new Response(p.corpo, {
      status: p.status ?? 200,
      headers: { "content-type": p.tipo ?? "application/json" },
    });
  }) as typeof fetch;
  return recebidos;
}

const INICIALIZA: Passo = {
  corpo: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { protocolVersion: "2025-06-18", serverInfo: { name: "Exemplo", version: "1" } },
  }),
};

const resultado = (conteudo: unknown, isError = false): Passo => ({
  corpo: JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: conteudo, isError } }),
});

describe("chamar", () => {
  test("devolve o texto dos blocos de texto", async () => {
    servidorFalso([INICIALIZA, resultado([{ type: "text", text: "três itens" }])]);
    const r = await chamar(ENDERECO, "listar", {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.texto).toBe("três itens");
      expect(r.ehErroDaFerramenta).toBe(false);
    }
  });

  test("manda o nome e os argumentos que recebeu, sem remontar", async () => {
    const recebidos = servidorFalso([INICIALIZA, resultado([{ type: "text", text: "ok" }])]);
    await chamar(ENDERECO, "criar_issue", { titulo: "falha no login", urgente: true });

    const chamada = recebidos.find((r) => r.metodo === "tools/call");
    expect(chamada?.params).toEqual({
      name: "criar_issue",
      arguments: { titulo: "falha no login", urgente: true },
    });
  });

  /*
   * A distinção que mais importa nesta bateria. `isError` é a ferramenta tendo rodado e falhado —
   * a aprovação foi consumida, e o texto do erro é o resultado. Tratar como falha de rede faria o
   * app oferecer "tentar de novo" para algo que vai falhar igual.
   */
  test("isError é execução que deu errado, não falha de chamada", async () => {
    servidorFalso([INICIALIZA, resultado([{ type: "text", text: "arquivo não existe" }], true)]);
    const r = await chamar(ENDERECO, "ler", { caminho: "/x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ehErroDaFerramenta).toBe(true);
      expect(r.texto).toBe("arquivo não existe");
    }
  });

  test("error do JSON-RPC é recusa do protocolo, e não vira sucesso", async () => {
    servidorFalso([
      INICIALIZA,
      { corpo: JSON.stringify({ jsonrpc: "2.0", id: 3, error: { message: "tool not found" } }) },
    ]);
    const r = await chamar(ENDERECO, "fantasma", {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("tool not found");
  });

  test("resultado sem result nenhum não vira sucesso vazio", async () => {
    servidorFalso([INICIALIZA, { corpo: JSON.stringify({ jsonrpc: "2.0", id: 3 }) }]);
    const r = await chamar(ENDERECO, "x", {});
    expect(r.ok).toBe(false);
  });

  test("bloco que não é texto é mencionado em vez de sumir", async () => {
    servidorFalso([
      INICIALIZA,
      resultado([
        { type: "image", data: "..." },
        { type: "text", text: "e a legenda" },
      ]),
    ]);
    const r = await chamar(ENDERECO, "grafico", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe("[image]\ne a legenda");
  });

  test("conteúdo ausente não finge que veio algo", async () => {
    servidorFalso([INICIALIZA, { corpo: JSON.stringify({ jsonrpc: "2.0", id: 3, result: {} }) }]);
    const r = await chamar(ENDERECO, "x", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toContain("sem conteúdo");
  });

  test("resposta gigante é cortada", async () => {
    servidorFalso([INICIALIZA, resultado([{ type: "text", text: "a".repeat(50_000) }])]);
    const r = await chamar(ENDERECO, "x", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto.length).toBeLessThanOrEqual(20_000);
  });

  test("401 na chamada vira recusa de credencial, não erro genérico", async () => {
    servidorFalso([INICIALIZA, { status: 401, corpo: "{}" }]);
    const r = await chamar(ENDERECO, "x", {}, "segredo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("credencial");
  });

  test("o token vai nos cabeçalhos quando existe", async () => {
    const recebidos = servidorFalso([INICIALIZA, resultado([{ type: "text", text: "ok" }])]);
    await chamar(ENDERECO, "x", {}, "segredo-do-servidor");
    expect(recebidos.every((r) => r.auth === "Bearer segredo-do-servidor")).toBe(true);
  });

  test("sem token, nenhum authorization é inventado", async () => {
    const recebidos = servidorFalso([INICIALIZA, resultado([{ type: "text", text: "ok" }])]);
    await chamar(ENDERECO, "x", {});
    expect(recebidos.every((r) => r.auth === null)).toBe(true);
  });

  /* A guarda de destino vale para a chamada como vale para a descoberta — e aqui o risco é maior,
   * porque a chamada leva argumentos que a pessoa aprovou. */
  test("endereço interno é recusado antes de qualquer rede", async () => {
    let bateu = false;
    globalThis.fetch = (async () => {
      bateu = true;
      return new Response("{}");
    }) as typeof fetch;

    const r = await chamar("http://169.254.169.254/latest/meta-data/", "x", {});
    expect(r.ok).toBe(false);
    expect(bateu).toBe(false);
  });

  test("resposta em SSE é lida como a em JSON", async () => {
    servidorFalso([
      INICIALIZA,
      {
        tipo: "text/event-stream",
        corpo:
          "event: message\n" +
          `data: ${JSON.stringify({ jsonrpc: "2.0", id: 99, result: { content: [] } })}\n\n` +
          "event: message\n" +
          `data: ${JSON.stringify({ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "pelo sse" }] } })}\n\n`,
      },
    ]);
    const r = await chamar(ENDERECO, "x", {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.texto).toBe("pelo sse");
  });
});
