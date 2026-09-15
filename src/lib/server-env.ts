/**
 * Leitura de variáveis de ambiente no servidor.
 *
 * No Cloudflare os secrets do Worker **não** aparecem em `process.env`: eles chegam como o
 * segundo argumento do `fetch`, e só. É por isso que `src/server.ts` já lia o DSN do Sentry de
 * lá. Este módulo guarda esse objeto quando a primeira requisição entra e oferece uma leitura
 * única para o resto do servidor, sem cada lugar ter que redescobrir isso.
 *
 * Guardar em escopo de módulo é seguro aqui: é o mesmo env para todas as requisições do Worker,
 * não tem nada por requisição dentro dele.
 */

let envCloudflare: Record<string, unknown> | undefined;

export function registrarEnvCloudflare(env: unknown): void {
  if (env && typeof env === "object") envCloudflare = env as Record<string, unknown>;
}

/**
 * Procura nas três fontes, nesta ordem: o env do Worker (produção), `process.env` (Node, e
 * `.env.local` no desenvolvimento) e as `VITE_*` embutidas no build.
 */
export function lerEnv(nome: string): string | undefined {
  const doWorker = envCloudflare?.[nome];
  if (typeof doWorker === "string" && doWorker) return doWorker;

  const doNode = typeof process !== "undefined" ? process.env?.[nome] : undefined;
  if (typeof doNode === "string" && doNode) return doNode;

  const doVite = (import.meta.env as Record<string, string | undefined>)[nome];
  if (typeof doVite === "string" && doVite) return doVite;

  return undefined;
}

/** Só diz ONDE a variável foi encontrada, nunca o valor. Serve para diagnosticar deploy. */
export function fontesDe(nome: string): { worker: boolean; node: boolean; build: boolean } {
  return {
    worker: typeof envCloudflare?.[nome] === "string" && !!envCloudflare[nome],
    node: typeof process !== "undefined" && !!process.env?.[nome],
    build: !!(import.meta.env as Record<string, string | undefined>)[nome],
  };
}
