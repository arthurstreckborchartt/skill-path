import * as Sentry from "@sentry/react";

/**
 * Monitoramento de erro — só erro. Nenhum rastreamento de comportamento, nenhuma gravação de
 * tela, nenhum dado do onboarding (que inclui renda). A Política de Privacidade declara
 * exatamente isso, então qualquer coisa a mais aqui precisa passar por ela antes.
 *
 * Sem `VITE_SENTRY_DSN` a função não faz nada: o app roda igual em dev e em quem clonar o repo
 * sem a chave, e ninguém precisa de conta no Sentry para desenvolver.
 */
export function initTelemetry() {
  const dsn = import.meta.env["VITE_SENTRY_DSN"];
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Não anexa IP nem dados de usuário automaticamente.
    sendDefaultPii: false,
    // Respiro para não estourar a cota gratuita num pico: 10% das transações de performance.
    tracesSampleRate: 0.1,
    // `console.log` pode carregar resposta do onboarding; breadcrumb de console fica fora.
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === "console" ? null : breadcrumb),
  });
}

/** Identifica a sessão por id do Supabase — sem e-mail, sem nome. */
export function setTelemetryUser(userId: string | null) {
  if (!import.meta.env["VITE_SENTRY_DSN"]) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
