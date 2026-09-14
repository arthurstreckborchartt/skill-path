import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
      if (active) setState({ session: data.session, loading: false });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ session, loading: false });
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

export function signInWithGoogle(redirectPath: string) {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}${redirectPath}` },
  });
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
  return "Não deu para concluir agora. Tente novamente.";
}
