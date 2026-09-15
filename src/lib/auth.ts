import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { setTelemetryUser } from "@/lib/telemetry";

export type SessionState = { session: Session | null; loading: boolean };

/**
 * Sessão do Supabase. O cliente só é tocado dentro do efeito: no SSR não existe sessão nenhuma
 * (ela vive no storage do navegador), então instanciar o cliente no servidor seria só risco de erro.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ session: data.session, loading: false });
      setTelemetryUser(data.session?.user.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setState({ session, loading: false });
      setTelemetryUser(session?.user.id ?? null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/**
 * O resultado de entrar com Google, já traduzido para o que a tela precisa decidir.
 *
 * `redirecting` existe porque um dos dois caminhos possíveis abandona a página: navegar por cima
 * dele só atrapalharia o retorno.
 */
export type GoogleSignIn =
  { status: "ok" } | { status: "redirecting" } | { status: "error"; message: string };

/**
 * O Google **não** está ligado direto no Supabase: o projeto tem o provedor marcado como ativo,
 * mas sem o OAuth secret — `/auth/v1/authorize?provider=google` responde
 * `Unsupported provider: missing OAuth secret`. Quem carrega as credenciais é o broker do
 * Lovable, e só no fim a sessão é gravada no Supabase via `setSession`
 * (ver src/integrations/lovable/index.ts, que é gerado e não deve ser editado à mão).
 *
 * Por isso a forma da resposta mudou em relação ao `signInWithOAuth` do Supabase, que sempre
 * saía da página. Aqui o caminho normal é um popup que resolve com a sessão já gravada — e aí
 * quem navega somos nós. Se a tela só olhasse para o erro, como antes, a pessoa entraria de
 * verdade e continuaria olhando para o botão girando.
 */
export async function signInWithGoogle(redirectPath: string): Promise<GoogleSignIn> {
  try {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${redirectPath}`,
    });
    if (result.error) return { status: "error", message: authErrorMessage(result.error.message) };
    if (result.redirected) return { status: "redirecting" };
    return { status: "ok" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: "error", message: authErrorMessage(message) };
  }
}

/** Mensagens do Supabase vêm em inglês e técnicas demais para a tela de login. */
export function authErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("user already registered")) return "Esse e-mail já tem conta. Tente entrar.";
  if (m.includes("password should be at least"))
    return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("unable to validate email address") || m.includes("invalid email"))
    return "E-mail inválido.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Espere um pouco e tente de novo.";
  // O fluxo do Google abre uma janela: os dois jeitos de ela morrer não são "erro do servidor"
  // e merecem um texto que diga o que fazer.
  if (m.includes("popup") || m.includes("pop-up"))
    return "O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.";
  if (m.includes("cancel") || m.includes("closed") || m.includes("access_denied"))
    return "A janela do Google foi fechada antes de concluir.";
  return "Não deu para concluir agora. Tente novamente.";
}
