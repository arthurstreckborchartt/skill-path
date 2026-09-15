import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { initTelemetry } from "./lib/telemetry";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // O Sentry é inicializado aqui, e não num efeito de componente, porque a integração do
  // TanStack precisa da instância do router para nomear os eventos pela rota. Só no navegador:
  // `getRouter` também roda no servidor a cada requisição, e o SDK aqui é o de browser.
  if (typeof window !== "undefined") {
    initTelemetry(router);
  }

  return router;
};
