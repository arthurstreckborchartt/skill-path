import { supabase } from "@/integrations/supabase/client";
import type { OnboardingProfile } from "@/lib/onboarding";
import type { RouteStep } from "@/lib/route-map";

/**
 * Lado do cliente da rota por IA. Guarda o resultado localmente para a tela abrir instantânea na
 * volta, com a cópia do banco como fonte de verdade entre aparelhos.
 */

const CHAVE = "pathly.route.ia.v1";

export type RotaSalva = { papel: string; signature: string; steps: RouteStep[] };

export function lerRotaIA(): RotaSalva | null {
  if (typeof window === "undefined") return null;
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const valor = JSON.parse(bruto) as Partial<RotaSalva>;
    if (!Array.isArray(valor.steps) || valor.steps.length === 0) return null;
    if (typeof valor.signature !== "string") return null;
    return { papel: valor.papel ?? "", signature: valor.signature, steps: valor.steps };
  } catch {
    return null;
  }
}

function salvarRotaIA(rota: RotaSalva): void {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(rota));
  } catch {
    // Storage cheio ou bloqueado: a rota continua valendo nesta sessão.
  }
}

export function limparRotaIA(): void {
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}

export type FalhaGeracao = { motivo: string; detalhe?: string | undefined };

/**
 * Pede a rota ao servidor. **Nunca lança**: se a IA não estiver disponível, quem chama segue com
 * a rota por regras, que é completa e já funciona. A pessoa não pode ficar sem rota porque um
 * serviço externo caiu.
 */
export async function gerarRotaIA(
  perfil: OnboardingProfile,
): Promise<{ ok: true; rota: RotaSalva } | { ok: false; falha: FalhaGeracao }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, falha: { motivo: "sem-sessao" } };

    const r = await fetch("/api/rota", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(perfil),
    });

    const corpo = (await r.json()) as Partial<RotaSalva> & { motivo?: string; detalhe?: string };

    if (!r.ok || !Array.isArray(corpo.steps) || corpo.steps.length === 0) {
      return {
        ok: false,
        falha: { motivo: corpo.motivo ?? `http-${r.status}`, detalhe: corpo.detalhe },
      };
    }

    const rota: RotaSalva = {
      papel: corpo.papel ?? "",
      signature: corpo.signature ?? "",
      steps: corpo.steps,
    };
    salvarRotaIA(rota);
    return { ok: true, rota };
  } catch (error) {
    return {
      ok: false,
      falha: { motivo: "rede", detalhe: error instanceof Error ? error.message : undefined },
    };
  }
}
