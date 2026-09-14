import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/pathly/app-shell";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/app")({
  component: ProtectedApp,
});

/**
 * A sessão do Supabase vive no navegador, então a checagem é de cliente: no SSR e no primeiro
 * paint mostramos um estado neutro em vez de decidir com sessão que ainda não foi lida.
 */
function ProtectedApp() {
  const navigate = useNavigate();
  const { session, loading } = useSession();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center px-5">
        <p className="text-sm text-muted-foreground">Carregando…</p>
      </div>
    );
  }

  return <AppShell />;
}
