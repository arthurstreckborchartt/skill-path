/**
 * O cliente MCP do Pathly: `initialize` e `tools/list`. **Só servidor.**
 *
 * ## Nada executa aqui
 *
 * Este módulo descobre e vai embora. Não há `tools/call` — chamar ferramenta é a fase 2, e ela
 * passa pelo portão de `pathly_acoes_externas`, não por aqui. Um cliente que descobre não precisa
 * do poder de executar, e dar esse poder antes da hora é o tipo de coisa que ninguém lembra de
 * tirar depois.
 *
 * ## Por que escrito à mão, e não pelo SDK
 *
 * São duas chamadas e uma notificação. O SDK oficial traz transporte por `stdio`, gerência de
 * processo e sessão — nada disso roda em Worker, e o que roda não compensa a superfície. Se a fase
 * 2 exigir mais do protocolo, a conta se refaz.
 *
 * ## O transporte
 *
 * O HTTP do MCP responde **ou** `application/json` **ou** `text/event-stream`, a critério do
 * servidor, para a mesma requisição. Quem só trata JSON quebra em metade dos servidores, então o
 * `lerResposta` abaixo aceita os dois.
 */

import { seguirComGuarda, validarDestino } from "@/lib/integracoes/destino";
import { impressaoDaFerramenta, type DescobertaDeFerramenta, type ServidorMcp } from "./contrato";

/**
 * A versão do protocolo que pedimos.
 *
 * O servidor responde com a dele, que pode ser outra, e é a dele que vale — por isso `ServidorMcp`
 * guarda o que voltou, e não o que mandamos.
 */
const PROTOCOLO = "2025-06-18";

/** Teto de ferramentas que aceito de um servidor. Lista imensa é abuso ou engano, não catálogo. */
const MAX_FERRAMENTAS = 200;

/** Teto do corpo que leio, para um servidor não encher a memória do Worker. */
const MAX_BYTES = 1_000_000;

export type Falha = { ok: false; motivo: string };
export type Descoberta = {
  ok: true;
  servidor: ServidorMcp;
  ferramentas: (DescobertaDeFerramenta & { impressao: string })[];
};

type Resposta = { result?: unknown; error?: { message?: string } };

/**
 * Lê a resposta, seja ela JSON ou SSE.
 *
 * No SSE o que interessa é a última linha `data:` com um objeto JSON-RPC que tenha `id` — os
 * eventos de progresso vêm pelo mesmo canal e não são a resposta.
 */
async function lerResposta(r: Response, id: number): Promise<Resposta | null> {
  const tipo = r.headers.get("content-type") ?? "";
  const texto = (await r.text()).slice(0, MAX_BYTES);

  if (tipo.includes("application/json")) {
    try {
      return JSON.parse(texto) as Resposta;
    } catch {
      return null;
    }
  }

  if (tipo.includes("text/event-stream")) {
    for (const linha of texto.split("\n").reverse()) {
      const corte = linha.indexOf("data:");
      if (corte !== 0) continue;
      try {
        const obj = JSON.parse(linha.slice(5).trim()) as Resposta & { id?: number };
        if (obj.id === id) return obj;
      } catch {
        /* linha de evento que não é JSON: segue procurando */
      }
    }
    return null;
  }

  return null;
}

function cabecalhos(token: string | null, sessao: string | null): Headers {
  const h = new Headers({
    "content-type": "application/json",
    // Os dois, porque o servidor escolhe em qual responder.
    accept: "application/json, text/event-stream",
  });
  if (token) h.set("authorization", `Bearer ${token}`);
  if (sessao) h.set("mcp-session-id", sessao);
  return h;
}

/**
 * Conecta, identifica o servidor e lista o que ele oferece.
 *
 * O token, quando existe, é da conexão da pessoa e vive cifrado em `pathly_conexoes` — ele chega
 * aqui já decifrado, no servidor, e nunca passa pelo navegador. `seguirComGuarda` cuida de não
 * reenviá-lo se o servidor desviar para outro host.
 */
export async function descobrir(
  endereco: string,
  token: string | null = null,
): Promise<Descoberta | Falha> {
  const destino = validarDestino(endereco);
  if (!destino.ok) return destino;

  // --- initialize ---------------------------------------------------------------------------
  const inicio = await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, null),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOLO,
        capabilities: {},
        clientInfo: { name: "Pathly", version: "1" },
      },
    }),
  });
  if (!inicio.ok) return inicio;

  if (inicio.resposta.status === 401 || inicio.resposta.status === 403) {
    return { ok: false, motivo: "O servidor recusou a credencial." };
  }
  if (!inicio.resposta.ok) {
    return { ok: false, motivo: `O servidor respondeu ${inicio.resposta.status}.` };
  }

  const sessao = inicio.resposta.headers.get("mcp-session-id");
  const corpoInicio = await lerResposta(inicio.resposta, 1);
  if (!corpoInicio || corpoInicio.error || !corpoInicio.result) {
    return { ok: false, motivo: "O servidor não respondeu como um servidor MCP." };
  }

  const r = corpoInicio.result as {
    protocolVersion?: string;
    serverInfo?: { name?: string; version?: string };
  };
  const servidor: ServidorMcp = {
    nome: r.serverInfo?.name ?? "sem nome",
    versao: r.serverInfo?.version ?? "?",
    protocolo: r.protocolVersion ?? "?",
  };

  // A notificação de handshake. Não tem resposta, e falha aqui não impede listar.
  await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, sessao),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);

  // --- tools/list ---------------------------------------------------------------------------
  const lista = await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, sessao),
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
  });
  if (!lista.ok) return lista;
  if (!lista.resposta.ok) {
    return { ok: false, motivo: `O servidor respondeu ${lista.resposta.status} ao listar.` };
  }

  const corpoLista = await lerResposta(lista.resposta, 2);
  if (!corpoLista || corpoLista.error || !corpoLista.result) {
    return { ok: false, motivo: "O servidor não devolveu a lista de ferramentas." };
  }

  const cruas = (corpoLista.result as { tools?: unknown }).tools;
  if (!Array.isArray(cruas)) {
    return { ok: false, motivo: "A lista de ferramentas veio num formato que não entendo." };
  }
  if (cruas.length > MAX_FERRAMENTAS) {
    return { ok: false, motivo: `O servidor ofereceu mais de ${MAX_FERRAMENTAS} ferramentas.` };
  }

  const ferramentas: (DescobertaDeFerramenta & { impressao: string })[] = [];
  for (const c of cruas) {
    const t = c as {
      name?: unknown;
      description?: unknown;
      inputSchema?: unknown;
      annotations?: { destructiveHint?: unknown };
    };
    if (typeof t.name !== "string" || !t.name) continue;

    const f: DescobertaDeFerramenta = {
      nome: t.name.slice(0, 120),
      /*
       * Cortada no tamanho, porque ela vai para a tela e para o contexto do Copilot. Uma descrição
       * de dez mil caracteres não é documentação: é espaço para esconder instrução no meio.
       */
      descricao: typeof t.description === "string" ? t.description.slice(0, 2000) : "",
      entrada: t.inputSchema ?? null,
      destrutivaSegundoOServidor: t.annotations?.destructiveHint === true,
    };
    ferramentas.push({ ...f, impressao: await impressaoDaFerramenta(f) });
  }

  return { ok: true, servidor, ferramentas };
}

// =============================================================================================
// Fase 2 — chamar
// =============================================================================================

/** Teto do texto que trago de volta. O resultado vai para a tela e para o registro da ação. */
const MAX_RESULTADO = 20_000;

export type Chamada =
  { ok: true; texto: string; ehErroDaFerramenta: boolean } | { ok: false; motivo: string };

/**
 * Extrai o texto de um `CallToolResult`.
 *
 * O MCP devolve `content` como lista de blocos tipados — `text`, `image`, `resource`. Só o texto
 * vira resumo legível; os outros viram uma menção do que veio, porque dizer "recebi uma imagem" é
 * mais honesto que fingir que não veio nada.
 */
function textoDoResultado(result: unknown): { texto: string; erro: boolean } {
  const r = (result ?? {}) as { content?: unknown; isError?: unknown };
  const erro = r.isError === true;

  if (!Array.isArray(r.content)) return { texto: "O servidor respondeu sem conteúdo.", erro };

  const partes: string[] = [];
  for (const bloco of r.content) {
    const b = (bloco ?? {}) as { type?: unknown; text?: unknown };
    if (b.type === "text" && typeof b.text === "string") partes.push(b.text);
    else if (typeof b.type === "string") partes.push(`[${b.type}]`);
  }

  const texto = partes.join("\n").trim();
  return { texto: texto ? texto.slice(0, MAX_RESULTADO) : "O servidor respondeu sem texto.", erro };
}

/**
 * Chama uma ferramenta.
 *
 * ## O que esta função NÃO decide
 *
 * Ela não sabe se a pessoa aprovou, nem se o servidor é um que ela conectou, nem se a ferramenta
 * existe no catálogo dela. Essas três perguntas são respondidas antes, por quem chama — e a
 * terceira importa: uma ferramenta removida do servidor não pode continuar executável só porque
 * uma ação antiga a menciona.
 *
 * O que ela garante é o transporte: destino validado, desvio que troca de host não leva a
 * credencial junto, prazo de 10s, e teto no que volta.
 *
 * ## `isError` não é falha de rede
 *
 * O MCP distingue "a chamada não aconteceu" de "a ferramenta rodou e deu errado". A segunda volta
 * com `ok: true` e `ehErroDaFerramenta: true`: foi uma execução de verdade, consumiu a aprovação,
 * e o texto do erro é o resultado que a pessoa precisa ler. Tratá-la como falha de rede faria o
 * app oferecer "tentar de novo" para algo que vai falhar igual.
 */
export async function chamar(
  endereco: string,
  ferramenta: string,
  argumentos: Record<string, unknown>,
  token: string | null = null,
): Promise<Chamada> {
  const destino = validarDestino(endereco);
  if (!destino.ok) return destino;

  /*
   * O handshake de novo, a cada chamada.
   *
   * Um servidor com sessão exige `initialize` antes de aceitar `tools/call`, e o Worker não
   * guarda estado entre requisições — não há sessão para reaproveitar. É uma ida a mais na rede
   * em troca de não inventar um cache de sessão que ficaria velho sem ninguém perceber.
   */
  const inicio = await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, null),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOLO,
        capabilities: {},
        clientInfo: { name: "Pathly", version: "1" },
      },
    }),
  });
  if (!inicio.ok) return inicio;

  if (inicio.resposta.status === 401 || inicio.resposta.status === 403) {
    return { ok: false, motivo: "O servidor recusou a credencial." };
  }
  if (!inicio.resposta.ok) {
    return { ok: false, motivo: `O servidor respondeu ${inicio.resposta.status}.` };
  }

  const sessao = inicio.resposta.headers.get("mcp-session-id");

  await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, sessao),
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }).catch(() => undefined);

  // --- tools/call -----------------------------------------------------------------------------
  const chamada = await seguirComGuarda(endereco, {
    method: "POST",
    headers: cabecalhos(token, sessao),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: ferramenta, arguments: argumentos },
    }),
  });
  if (!chamada.ok) return chamada;

  if (chamada.resposta.status === 401 || chamada.resposta.status === 403) {
    return { ok: false, motivo: "O servidor recusou a credencial na chamada." };
  }
  if (!chamada.resposta.ok) {
    return { ok: false, motivo: `O servidor respondeu ${chamada.resposta.status} à chamada.` };
  }

  const corpo = await lerResposta(chamada.resposta, 3);
  if (!corpo) return { ok: false, motivo: "Não entendi a resposta do servidor." };

  /*
   * `error` do JSON-RPC é o protocolo recusando — ferramenta inexistente, parâmetro faltando. É
   * diferente de `isError`, que é a ferramenta tendo rodado e falhado.
   */
  if (corpo.error) {
    const m = typeof corpo.error.message === "string" ? corpo.error.message.slice(0, 300) : "";
    return { ok: false, motivo: m || "O servidor recusou a chamada." };
  }
  if (corpo.result === undefined) {
    return { ok: false, motivo: "O servidor respondeu sem resultado." };
  }

  const { texto, erro } = textoDoResultado(corpo.result);
  return { ok: true, texto, ehErroDaFerramenta: erro };
}
