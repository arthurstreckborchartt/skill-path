import "./lib/error-capture";

import { captureException, withSentry } from "@sentry/cloudflare";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { registrarEnvCloudflare } from "@/lib/server-env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const erro = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(erro);
  captureException(erro);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * O SDK do Cloudflare, e não o de Node que a documentação do TanStack Start sugere: este app
 * roda em Workers (nitro preset cloudflare-module), onde não existe flag `--import` nem as APIs
 * de Node que a instrumentação automática usa.
 *
 * Sem DSN a função devolve undefined e o SDK não inicializa — mesmo comportamento do cliente.
 */
const sentryOptions = (env: unknown) => {
  const dsn =
    (env as { VITE_SENTRY_DSN?: string } | undefined)?.VITE_SENTRY_DSN ??
    import.meta.env["VITE_SENTRY_DSN"];
  if (!dsn) return undefined;
  return {
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  };
};

export default withSentry(sentryOptions, {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    // Este é o único lugar onde os secrets do Worker chegam. Guardar aqui é o que permite que
    // uma rota de servidor (que não recebe `env`) consiga lê-los — ver src/lib/server-env.ts.
    registrarEnvCloudflare(env);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      // captureException explícito: o try/catch abaixo devolve a página de erro e o erro nunca
      // sobe, então o wrapper sozinho não veria nada.
      console.error(error);
      captureException(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
});
