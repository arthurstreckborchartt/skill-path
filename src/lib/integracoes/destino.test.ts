/**
 * A bateria da guarda de destino.
 *
 * Roda com `bun test`, que vem embutido — nenhuma dependência nova entra por causa deste arquivo.
 *
 * Existe porque isto é código de segurança: a diferença entre recusar e aceitar `169.254.169.254`
 * é a diferença entre um servidor MCP e uma leitura dos metadados da nuvem. Uma prova que só
 * existiu uma vez, na mão de quem escreveu, não protege a próxima pessoa que mexer aqui.
 *
 * Dois casos abaixo estão marcados: eles falharam na primeira execução e são o motivo de o módulo
 * ter a forma que tem.
 */

import { describe, expect, test } from "bun:test";
import { seguirComGuarda, validarDestino } from "./destino";

describe("validarDestino", () => {
  const aceita = [
    ["https://mcp.exemplo.com/sse", "servidor público normal"],
    ["https://mcp.exemplo.com:8443/sse", "porta alta pública é legítima"],
    ["https://8.8.8.8/sse", "IP público"],
    ["https://[2606:4700::1111]/sse", "IPv6 público"],
    [
      "https://010.0.0.1/sse",
      // Medido: o `URL` lê `010` como OCTAL e normaliza para 8.0.0.1, que é público. Recusar
      // seria bloquear um destino legítimo por parecer com um privado.
      "`010` é octal: vira 8.0.0.1",
    ],
    ["https://[::ffff:8.8.8.8]/sse", "IPv4 mapeado para público"],
  ] as const;

  for (const [url, porque] of aceita) {
    test(`aceita ${url} — ${porque}`, () => {
      expect(validarDestino(url).ok).toBe(true);
    });
  }

  const recusa = [
    ["http://mcp.exemplo.com/sse", "http em claro"],
    ["ftp://mcp.exemplo.com", "esquema que não é https"],
    ["nao-e-url", "texto que não é URL"],
    ["https://user:senha@mcp.exemplo.com", "credencial embutida some em log e em desvio"],
    ["https://localhost/sse", "laço local por nome"],
    ["https://LOCALHOST/sse", "maiúsculas não escapam"],
    ["https://algo.local/sse", "sufixo .local"],
    ["https://algo.internal/sse", "sufixo .internal"],
    ["https://metadata.google.internal/", "metadados do GCP por nome"],
    ["https://127.0.0.1/sse", "laço local"],
    ["https://127.1.2.3/sse", "127/8 inteiro, não só o .0.1"],
    ["https://169.254.169.254/latest/meta-data/", "metadados de nuvem — o caso clássico"],
    ["https://10.0.0.5/sse", "privada 10/8"],
    ["https://172.16.0.1/sse", "privada 172.16/12"],
    ["https://172.31.255.255/sse", "borda de cima do 172.16/12"],
    ["https://192.168.1.1/sse", "privada 192.168/16"],
    ["https://0.0.0.0/sse", "0/8"],
    ["https://100.64.0.1/sse", "CGNAT"],
    ["https://239.0.0.1/sse", "multicast"],
    ["https://0x0a.0.0.1/sse", "`0x0a` é hexadecimal: vira 10.0.0.1"],
    ["https://[::1]/sse", "laço local IPv6"],
    ["https://[fe80::1]/sse", "link-local IPv6"],
    ["https://[fc00::1]/sse", "local único IPv6"],
    [
      "https://[::ffff:127.0.0.1]/sse",
      // FALHOU na primeira execução. O `URL` normaliza para `[::ffff:7f00:1]`, em hexadecimal, e
      // a regex procurava decimal com pontos. Por isso `ipv6Proibido` decodifica os grupos hex.
      "IPv4 mapeado, que chega em hexadecimal",
    ],
    ["https://[::ffff:10.0.0.1]/sse", "IPv4 mapeado para privada"],
  ] as const;

  for (const [url, porque] of recusa) {
    test(`recusa ${url} — ${porque}`, () => {
      expect(validarDestino(url).ok).toBe(false);
    });
  }

  test("172.32 está fora da faixa privada e é aceito", () => {
    expect(validarDestino("https://172.32.0.1/sse").ok).toBe(true);
  });
});

describe("seguirComGuarda", () => {
  const real = globalThis.fetch;

  function fingirFetch(responder: (url: string, init?: RequestInit) => Response) {
    const chamados: { url: string; auth: string | null }[] = [];
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      chamados.push({
        url: String(url),
        auth: new Headers(init?.headers ?? {}).get("authorization"),
      });
      return responder(String(url), init);
    }) as typeof fetch;
    return chamados;
  }

  const desvio = (para: string) => new Response("", { status: 302, headers: { location: para } });

  test("302 para a rede interna é recusado, e o segundo endereço nunca é chamado", async () => {
    const chamados = fingirFetch((url) =>
      url === "https://mcp.exemplo.com/sse"
        ? desvio("https://169.254.169.254/latest/")
        : new Response("nao devia chegar aqui"),
    );

    const r = await seguirComGuarda("https://mcp.exemplo.com/sse");

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/rede interna/i);
    // A prova que importa: a validação não serve de nada se o desvio já saiu.
    expect(chamados).toHaveLength(1);
    globalThis.fetch = real;
  });

  test("302 sem `location` é recusado", async () => {
    fingirFetch(() => new Response("", { status: 302 }));
    const r = await seguirComGuarda("https://mcp.exemplo.com/sse");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/sem dizer para onde/i);
    globalThis.fetch = real;
  });

  test("cadeia de desvios longa demais é recusada", async () => {
    const chamados = fingirFetch((url) => {
      const i = Number(url.split("/").pop());
      return desvio(`https://exemplo.com/${i + 1}`);
    });
    const r = await seguirComGuarda("https://exemplo.com/0");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/vezes demais/i);
    expect(chamados.length).toBeLessThanOrEqual(5);
    globalThis.fetch = real;
  });

  test("desvio para outro host não leva o cabeçalho de autorização", async () => {
    const chamados = fingirFetch((url) =>
      url === "https://a.exemplo.com/sse"
        ? desvio("https://b.outro.com/sse")
        : new Response("ok", { status: 200 }),
    );

    const r = await seguirComGuarda("https://a.exemplo.com/sse", {
      headers: { authorization: "Bearer segredo-da-pessoa" },
    });

    expect(r.ok).toBe(true);
    expect(chamados[0]?.auth).toBe("Bearer segredo-da-pessoa");
    // O token era para o host anterior. Mandá-lo adiante é entregá-lo a quem não deveria ter.
    expect(chamados[1]?.auth).toBeNull();
    globalThis.fetch = real;
  });

  test("200 direto devolve a resposta", async () => {
    fingirFetch(() => new Response("conteudo", { status: 200 }));
    const r = await seguirComGuarda("https://mcp.exemplo.com/sse");
    expect(r.ok).toBe(true);
    if (r.ok) expect(await r.resposta.text()).toBe("conteudo");
    globalThis.fetch = real;
  });
});
