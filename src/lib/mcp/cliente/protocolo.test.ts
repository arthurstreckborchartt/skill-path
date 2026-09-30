/**
 * A bateria do cliente MCP. `bun test`.
 *
 * O `fetch` é falso, e isso é a característica e não a limitação: o que precisa ser provado é como
 * o Pathly reage ao que um servidor devolve — inclusive ao que um servidor mal-intencionado
 * devolveria —, e para isso eu preciso escolher a resposta, não torcer para encontrá-la.
 */

import { describe, expect, test, afterEach } from "bun:test";
import { descobrir } from "./protocolo";
import { impactoDe, impressaoDaFerramenta } from "./contrato";

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

const ENDERECO = "https://mcp.exemplo.com/sse";

type Passo = { status?: number; tipo?: string; corpo: string };

/** Responde na ordem: initialize, (notificação), tools/list. */
function servidorFalso(passos: Passo[]) {
  const recebidos: { metodo: string | null; auth: string | null }[] = [];
  let i = 0;
  globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    recebidos.push({
      metodo: corpo.method ?? null,
      auth: new Headers(init?.headers ?? {}).get("authorization"),
    });
    // A notificação não consome passo: ela não tem resposta.
    if (corpo.method === "notifications/initialized") {
      return new Response("", { status: 202 });
    }
    const p = passos[i++] ?? { corpo: "{}" };
    return new Response(p.corpo, {
      status: p.status ?? 200,
      headers: { "content-type": p.tipo ?? "application/json" },
    });
  }) as typeof fetch;
  return recebidos;
}

const inicioOk = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  result: {
    protocolVersion: "2025-06-18",
    serverInfo: { name: "Servidor de Teste", version: "9.9" },
  },
});

const listaCom = (tools: unknown[]) => JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools } });

describe("descobrir", () => {
  test("recusa endereço interno antes de qualquer chamada", async () => {
    const recebidos = servidorFalso([]);
    const r = await descobrir("https://169.254.169.254/sse");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/rede interna/i);
    expect(recebidos).toHaveLength(0);
  });

  test("lista ferramentas quando o servidor responde JSON", async () => {
    servidorFalso([
      { corpo: inicioOk },
      {
        corpo: listaCom([
          {
            name: "listar_arquivos",
            description: "Lista os arquivos.",
            inputSchema: { type: "object" },
          },
        ]),
      },
    ]);

    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.servidor.nome).toBe("Servidor de Teste");
    expect(r.servidor.protocolo).toBe("2025-06-18");
    expect(r.ferramentas).toHaveLength(1);
    expect(r.ferramentas[0]?.nome).toBe("listar_arquivos");
    expect(r.ferramentas[0]?.impressao).toMatch(/^[0-9a-f]{64}$/);
  });

  test("lista ferramentas quando o servidor responde SSE", async () => {
    servidorFalso([
      { tipo: "text/event-stream", corpo: `event: message\ndata: ${inicioOk}\n\n` },
      {
        tipo: "text/event-stream",
        corpo:
          `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/progress" })}\n\n` +
          `data: ${listaCom([{ name: "buscar", description: "Busca.", inputSchema: {} }])}\n\n`,
      },
    ]);

    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ferramentas[0]?.nome).toBe("buscar");
  });

  test("manda o token quando existe, e nunca em endereço recusado", async () => {
    const recebidos = servidorFalso([{ corpo: inicioOk }, { corpo: listaCom([]) }]);
    await descobrir(ENDERECO, "segredo-da-pessoa");
    expect(recebidos[0]?.auth).toBe("Bearer segredo-da-pessoa");
  });

  test("credencial recusada vira mensagem própria, não um 401 cru", async () => {
    servidorFalso([{ status: 401, corpo: "" }]);
    const r = await descobrir(ENDERECO, "token-errado");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/recusou a credencial/i);
  });

  test("resposta que não é MCP é recusada", async () => {
    servidorFalso([{ corpo: "<html>pagina qualquer</html>", tipo: "text/html" }]);
    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/não respondeu como um servidor MCP/i);
  });

  test("lista gigante é recusada em vez de guardada", async () => {
    const muitas = Array.from({ length: 201 }, (_, i) => ({ name: `f${i}`, inputSchema: {} }));
    servidorFalso([{ corpo: inicioOk }, { corpo: listaCom(muitas) }]);
    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/mais de 200/i);
  });

  test("descrição imensa é cortada — ela vai para a tela e para o contexto do Copilot", async () => {
    servidorFalso([
      { corpo: inicioOk },
      { corpo: listaCom([{ name: "x", description: "A".repeat(50_000), inputSchema: {} }]) },
    ]);
    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.ferramentas[0]?.descricao.length).toBe(2000);
  });

  test("ferramenta sem nome é ignorada, e o resto da lista sobrevive", async () => {
    servidorFalso([
      { corpo: inicioOk },
      { corpo: listaCom([{ description: "sem nome" }, { name: "boa", inputSchema: {} }]) },
    ]);
    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ferramentas).toHaveLength(1);
      expect(r.ferramentas[0]?.nome).toBe("boa");
    }
  });
});

describe("impressão digital", () => {
  const base = {
    nome: "apagar",
    descricao: "Apaga um arquivo.",
    entrada: { type: "object", properties: { caminho: { type: "string" } } },
    destrutivaSegundoOServidor: false,
  };

  test("a ordem das chaves do schema não muda a impressão", async () => {
    const outraOrdem = {
      ...base,
      entrada: { properties: { caminho: { type: "string" } }, type: "object" },
    };
    expect(await impressaoDaFerramenta(base)).toBe(await impressaoDaFerramenta(outraOrdem));
  });

  test("trocar a descrição muda a impressão — é o que a pessoa leu para aprovar", async () => {
    const mentirosa = { ...base, descricao: "Apaga um arquivo. E todos os outros." };
    expect(await impressaoDaFerramenta(base)).not.toBe(await impressaoDaFerramenta(mentirosa));
  });

  test("um campo novo no schema muda a impressão — campo novo é capacidade nova", async () => {
    const maior = {
      ...base,
      entrada: {
        type: "object",
        properties: { caminho: { type: "string" }, recursivo: { type: "boolean" } },
      },
    };
    expect(await impressaoDaFerramenta(base)).not.toBe(await impressaoDaFerramenta(maior));
  });
});

describe("impacto", () => {
  const f = (extra: Partial<Parameters<typeof impactoDe>[0]>) =>
    impactoDe({
      nome: "x",
      descricao: "",
      entrada: {},
      destrutivaSegundoOServidor: false,
      ...extra,
    });

  test("toda ferramenta nasce escrita", () => {
    expect(f({})).toBe("escrita");
  });

  test("o servidor pode subir o peso para destrutiva", () => {
    expect(f({ destrutivaSegundoOServidor: true })).toBe("destrutiva");
  });

  test("nada que o servidor diga baixa o peso para leitura", async () => {
    // O `readOnlyHint` sequer é lido: um servidor hostil se declara inofensivo, e a dica dele não
    // pode ser o que nos deixa relaxados. Quem baixa é a pessoa, na tela.
    servidorFalso([
      { corpo: inicioOk },
      {
        corpo: listaCom([
          { name: "so_leitura", inputSchema: {}, annotations: { readOnlyHint: true } },
        ]),
      },
    ]);
    const r = await descobrir(ENDERECO);
    expect(r.ok).toBe(true);
    if (r.ok) expect(impactoDe(r.ferramentas[0]!)).toBe("escrita");
  });
});
