/**
 * O que o executor recusa antes de tocar na rede. `bun test`.
 *
 * Esta bateria existe por uma razão só: a fase 2 deixa o Pathly **chamar** um servidor de fora, e
 * a aprovação da pessoa é o que autoriza isso. Cada teste aqui é uma forma de a chamada sair
 * diferente do que foi aprovado.
 *
 * O `fetch` falso serve para provar o contrário do que uma bateria normal prova: nas recusas,
 * `bateu` tem que continuar `false`. Uma recusa que mesmo assim tocou a rede não é recusa.
 */

import { describe, expect, test, afterEach } from "bun:test";
import { executarAcao, type ContextoExecucao } from "./executor";
import type { AcaoExterna } from "./contrato";

const real = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = real;
});

const ENDERECO = "https://mcp.exemplo.com/sse";

function acao(p: Partial<AcaoExterna> = {}): AcaoExterna {
  return {
    id: "a1",
    provedor: "mcp",
    acaoId: "criar_issue",
    projetoId: null,
    resumo: "Criar uma issue",
    destino: "mcp.exemplo.com → criar_issue",
    impacto: "escrita",
    payload: { servidor: ENDERECO, argumentos: { titulo: "x" } },
    estado: "aprovada",
    criadoEm: "",
    decididoEm: null,
    executadoEm: null,
    resultado: null,
    erro: null,
    ...p,
  } as AcaoExterna;
}

const contexto = (mcp: ContextoExecucao["mcp"]): ContextoExecucao => ({ token: null, mcp });

const CONECTADO = { endereco: ENDERECO, token: null, ferramentas: ["criar_issue", "listar"] };

/** Conta se a rede foi tocada, e responde algo plausível quando for. */
function espiarRede() {
  const estado = { bateu: false };
  globalThis.fetch = (async (_u: RequestInfo | URL, init?: RequestInit) => {
    estado.bateu = true;
    const corpo = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
    if (corpo.method === "notifications/initialized") return new Response("", { status: 202 });
    if (corpo.method === "initialize") {
      return new Response(
        JSON.stringify({ jsonrpc: "2.0", id: 1, result: { serverInfo: { name: "E" } } }),
        { headers: { "content-type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        result: { content: [{ type: "text", text: "issue #7 criada" }] },
      }),
      { headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
  return estado;
}

describe("executor, provedor mcp", () => {
  test("sem servidor conectado, recusa sem tocar a rede", async () => {
    const rede = espiarRede();
    const r = await executarAcao(acao(), contexto(null));
    expect(r.ok).toBe(false);
    expect(rede.bateu).toBe(false);
    if (!r.ok) expect(r.permanente).toBe(true);
  });

  /*
   * O caso que a função `servidorMcpDaAcao` existe para impedir. Se o endereço do payload pudesse
   * virar destino, aprovar uma ação seria apontar o Pathly para onde se quisesse.
   */
  test("endereço do payload diferente do conectado, recusa sem tocar a rede", async () => {
    const rede = espiarRede();
    const r = await executarAcao(
      acao({ payload: { servidor: "https://outro.exemplo.com/sse", argumentos: {} } }),
      contexto(CONECTADO),
    );
    expect(r.ok).toBe(false);
    expect(rede.bateu).toBe(false);
  });

  test("payload sem servidor nenhum, recusa", async () => {
    const rede = espiarRede();
    const r = await executarAcao(acao({ payload: { argumentos: {} } }), contexto(CONECTADO));
    expect(r.ok).toBe(false);
    expect(rede.bateu).toBe(false);
  });

  /*
   * Aprovação de ontem, ferramenta removida hoje. Sem esta guarda o Pathly chamaria um nome que o
   * servidor já não oferece, e o que acontece com ele passa a ser decisão do servidor.
   */
  test("ferramenta que o servidor não oferece mais, recusa sem tocar a rede", async () => {
    const rede = espiarRede();
    const r = await executarAcao(acao({ acaoId: "apagar_tudo" }), contexto(CONECTADO));
    expect(r.ok).toBe(false);
    expect(rede.bateu).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("não oferece mais");
  });

  test("tudo conferindo, chama e devolve o texto", async () => {
    const rede = espiarRede();
    const r = await executarAcao(acao(), contexto(CONECTADO));
    expect(rede.bateu).toBe(true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resumo).toBe("issue #7 criada");
  });

  test("argumentos que não são objeto viram objeto vazio, não quebram", async () => {
    espiarRede();
    const r = await executarAcao(
      acao({ payload: { servidor: ENDERECO, argumentos: "texto solto" } }),
      contexto(CONECTADO),
    );
    expect(r.ok).toBe(true);
  });

  /*
   * A ferramenta rodou e falhou. Isso e `ok`, com o erro no resumo: a aprovação foi consumida, e
   * o que o servidor fez do lado dele o Pathly não desfaz. Marcar como falha ofereceria "tentar de
   * novo" e gastaria uma segunda aprovação para repetir o mesmo erro.
   */
  test("erro da ferramenta é execução feita, com o erro no resumo", async () => {
    globalThis.fetch = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const corpo = JSON.parse(String(init?.body ?? "{}")) as { method?: string };
      if (corpo.method === "notifications/initialized") return new Response("", { status: 202 });
      if (corpo.method === "initialize") {
        return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: {} }), {
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          result: {
            content: [{ type: "text", text: "sem permissão no repositório" }],
            isError: true,
          },
        }),
        { headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const r = await executarAcao(acao(), contexto(CONECTADO));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resumo).toContain("sem permissão");
  });

  test("falha de rede é temporária, e não permanente", async () => {
    globalThis.fetch = (async () => {
      throw new Error("conexão caiu");
    }) as typeof fetch;

    const r = await executarAcao(acao(), contexto(CONECTADO));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.permanente).toBe(false);
  });
});
