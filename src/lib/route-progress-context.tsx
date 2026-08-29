import { createContext, useContext, type ReactNode } from "react";
import { useRouteProgress, type RouteProgressValue } from "@/lib/route-map";

/**
 * `useRouteProgress` guarda seu estado num `useState` local — perfeito para uma única tela,
 * mas o Dashboard e o AppShell (nível/XP no menu) precisam refletir exatamente o mesmo estado
 * ao mesmo tempo. Duas chamadas separadas do hook leriam do mesmo localStorage, mas cada uma
 * ficaria "surda" às mudanças feitas pela outra até um novo mount. O Provider chama o hook uma
 * única vez, no nível do AppShell, e todas as telas consomem essa mesma instância.
 */
const RouteProgressContext = createContext<RouteProgressValue | null>(null);

export function RouteProgressProvider({ children }: { children: ReactNode }) {
  const value = useRouteProgress();
  return <RouteProgressContext.Provider value={value}>{children}</RouteProgressContext.Provider>;
}

export function useRouteProgressContext(): RouteProgressValue {
  const ctx = useContext(RouteProgressContext);
  if (!ctx) throw new Error("useRouteProgressContext precisa de <RouteProgressProvider> acima na árvore.");
  return ctx;
}
