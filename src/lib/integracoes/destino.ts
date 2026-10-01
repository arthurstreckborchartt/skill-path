/**
 * A guarda de destino: para onde o Pathly aceita sair.
 *
 * ## Por que isto passou a existir
 *
 * Até aqui o único destino externo real era a URL fixa da API do GitHub, escrita no código. Com
 * MCP a URL passa a vir **da pessoa**, e o `fetch` continua saindo do nosso servidor, com a nossa
 * rede e a nossa identidade. Sem guarda, `http://169.254.169.254/` vira leitura de metadados de
 * nuvem pedida por qualquer usuário — a família de falhas conhecida como SSRF.
 *
 * `rede.ts` impõe prazo, e prazo não é destino: uma chamada para o lugar errado que responde rápido
 * passa por ele sem reclamar.
 *
 * ## O que esta guarda NÃO resolve, e é honesto dizer
 *
 * O servidor compila para Worker, e ali **não há resolução de DNS** disponível ao código. Então
 * não dá para pegar um nome público que resolve para `10.0.0.5` — o chamado DNS rebinding — antes
 * de a chamada sair. O que fecha esse buraco não é esta função: é a rede por baixo recusar saída
 * para faixa privada.
 *
 * O que esta função fecha é tudo que dá para ver **na URL**: esquema, IP literal, nome reservado.
 * E, com `seguirComGuarda`, fecha o desvio por redirecionamento, que é o furo mais fácil de
 * explorar — sem ele, um host público responde `302` para `169.254.169.254` e o `fetch` segue
 * sozinho, sem ninguém olhar o segundo endereço.
 */

/**
 * Faixas que nunca são destino legítimo de um servidor MCP de terceiro.
 *
 * **O `URL` já normalizou antes de chegar aqui**, e isso importa mais do que parece. Medido:
 * `0x0a.0.0.1` vira `10.0.0.1` (hexadecimal), e `010.0.0.1` vira **`8.0.0.1`** — porque a
 * especificação manda ler `010` como octal. O segundo não é rede privada disfarçada: é outro
 * endereço, público, e recusá-lo seria bloquear um destino legítimo por parecer suspeito.
 *
 * Então a conferência é sobre os octetos da forma normalizada. Escrever regex sobre o texto cru
 * seria conferir uma coisa e chamar outra.
 */
function ipv4Proibido(host: string): boolean {
  const partes = host.split(".");
  if (partes.length !== 4) return false;

  const n = partes.map((p) => {
    const v = Number(p);
    return Number.isInteger(v) && v >= 0 && v <= 255 ? v : NaN;
  });
  if (n.some(Number.isNaN)) return false;

  const [a, b] = n as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8 — "este host"
  if (a === 10) return true; // privada
  if (a === 127) return true; // laço local
  if (a === 169 && b === 254) return true; // link-local, e os metadados de nuvem vivem aqui
  if (a === 172 && b >= 16 && b <= 31) return true; // privada
  if (a === 192 && b === 168) return true; // privada
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast e reservado
  return false;
}

function ipv6Proibido(host: string): boolean {
  // `URL` entrega IPv6 entre colchetes.
  const bruto = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (bruto === "::1" || bruto === "::") return true;
  if (bruto.startsWith("fe80:")) return true; // link-local
  if (/^f[cd]/.test(bruto)) return true; // fc00::/7, endereço local único

  /*
   * IPv4 mapeado em IPv6: `::ffff:127.0.0.1` alcança o laço local por outro caminho.
   *
   * E chega aqui **em hexadecimal**: o `URL` normaliza `[::ffff:127.0.0.1]` para
   * `[::ffff:7f00:1]`. Procurar decimal com pontos não encontrava nada, e o endereço passava —
   * foi o que a bateria pegou, e o motivo de esta parte existir em vez de uma regex de uma linha.
   */
  const decimalComPontos = bruto.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (decimalComPontos?.[1] && ipv4Proibido(decimalComPontos[1])) return true;

  const hex = bruto.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex?.[1] && hex[2]) {
    const alto = parseInt(hex[1], 16);
    const baixo = parseInt(hex[2], 16);
    const ipv4 = [alto >> 8, alto & 0xff, baixo >> 8, baixo & 0xff].join(".");
    if (ipv4Proibido(ipv4)) return true;
  }

  return false;
}

/**
 * Nomes que não precisam de DNS para serem errados.
 *
 * `metadata.google.internal` entra porque é o nome do serviço de metadados do GCP — bloquear só o
 * IP deixaria o nome funcionando.
 */
const NOMES_PROIBIDOS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function nomeProibido(host: string): boolean {
  const h = host.toLowerCase();
  if (NOMES_PROIBIDOS.has(h)) return true;
  // Sufixos de rede interna que nenhum servidor público usa.
  return [".localhost", ".local", ".internal", ".localdomain"].some((s) => h.endsWith(s));
}

export type Destino =
  | { ok: true; url: URL }
  | {
      ok: false;
      /** Frase curta em português, para a tela. Nunca ecoa a URL inteira de volta. */
      motivo: string;
    };

/**
 * Valida uma URL de servidor MCP antes de qualquer chamada.
 *
 * Exige `https`: em `http` o token que a pessoa colou viaja em claro, e o conteúdo devolvido — que
 * vai para o contexto do Copilot — pode ser trocado no caminho.
 */
export function validarDestino(entrada: string): Destino {
  let url: URL;
  try {
    url = new URL(entrada);
  } catch {
    return { ok: false, motivo: "Endereço inválido." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, motivo: "Só aceito endereço https." };
  }

  // Credencial na URL some sem avisar em log e em redirecionamento. Melhor recusar do que carregar.
  if (url.username || url.password) {
    return { ok: false, motivo: "Não aceito usuário e senha no endereço." };
  }

  const host = url.hostname;
  if (!host) return { ok: false, motivo: "Endereço sem host." };

  if (nomeProibido(host) || ipv4Proibido(host) || ipv6Proibido(host)) {
    return { ok: false, motivo: "Este endereço aponta para a rede interna." };
  }

  return { ok: true, url };
}

/** Quantos desvios aceito antes de desistir. Cadeia longa é sinal, não acidente. */
const MAX_DESVIOS = 3;
const TIMEOUT_MS = 10_000;

/**
 * `fetch` que revalida o destino a cada desvio.
 *
 * O `fetch` normal segue redirecionamento sozinho, e é aí que a guarda de cima seria contornada:
 * o primeiro endereço passa, o servidor responde `302` para `169.254.169.254`, e a segunda chamada
 * sai sem ninguém olhar. Com `redirect: "manual"` cada salto volta para cá e é validado de novo.
 *
 * O cabeçalho de autorização **não** viaja no desvio: se o destino mudou de host, o token era para
 * o host anterior, e reenviá-lo é entregá-lo a quem não deveria recebê-lo.
 */
export async function seguirComGuarda(
  entrada: string,
  init: RequestInit = {},
): Promise<{ ok: true; resposta: Response } | { ok: false; motivo: string }> {
  let alvo = entrada;

  for (let salto = 0; salto <= MAX_DESVIOS; salto++) {
    const destino = validarDestino(alvo);
    if (!destino.ok) return destino;

    const hostAnterior = destino.url.host;

    /*
     * O `fetch` que estoura vira recusa, não exceção.
     *
     * Esta função devolve `{ ok: false, motivo }` para toda outra forma de não dar certo —
     * endereço inválido, desvio sem destino, desvio demais. A falha de rede era a única que
     * escapava por cima, e é a mais provável de todas: conectar servidor de fora é a situação em
     * que o outro lado não responder é rotina.
     *
     * O efeito era um 500 com stack no lugar da frase que a tela sabe mostrar. `api/mcp/conectar`
     * não tem `try/catch`, então quem digitasse um endereço de servidor fora do ar via o app
     * quebrar em vez de ler "não consegui falar com o servidor".
     */
    let resposta: Response;
    try {
      resposta = await fetch(destino.url, {
        ...init,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      // `AbortSignal.timeout` rejeita com `TimeoutError`. Dizer qual das duas foi muda o que a
      // pessoa faz: esperar e tentar de novo, ou conferir o endereço.
      const expirou = e instanceof Error && e.name === "TimeoutError";
      return {
        ok: false,
        motivo: expirou
          ? `O servidor não respondeu em ${Math.round(TIMEOUT_MS / 1000)} segundos.`
          : "Não consegui falar com o servidor.",
      };
    }

    if (resposta.status < 300 || resposta.status > 399) {
      return { ok: true, resposta };
    }

    const proximo = resposta.headers.get("location");
    if (!proximo) return { ok: false, motivo: "O servidor desviou sem dizer para onde." };

    const absoluto = new URL(proximo, destino.url).toString();
    const mudouDeHost = new URL(absoluto).host !== hostAnterior;
    if (mudouDeHost && init.headers) {
      const limpos = new Headers(init.headers);
      limpos.delete("authorization");
      init = { ...init, headers: limpos };
    }
    alvo = absoluto;
  }

  return { ok: false, motivo: "O servidor desviou vezes demais." };
}
