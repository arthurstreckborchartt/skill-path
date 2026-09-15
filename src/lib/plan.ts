import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Planos da Pathly.
 *
 * O plano de verdade vive no banco, em `pathly_profiles.plano`, escrito só pelo webhook do
 * Stripe. O `localStorage` aqui é **cache de tela**: serve para o app não piscar "Gratuito"
 * enquanto a consulta ao banco não volta.
 *
 * Isso importa: quem confia no cache para decidir acesso está confiando em algo que qualquer
 * pessoa edita pelo devtools. Toda decisão que custa dinheiro — qual provedor de IA chamar, por
 * exemplo — é tomada no servidor, lendo o banco. As telas usam isto só para desenhar.
 */

export type PlanId = "free" | "pro";

/**
 * Quantas etapas o plano gratuito destrava. As etapas seguintes continuam **visíveis** — a
 * pessoa vê para onde a rota vai — mas não dá para concluí-las. Esconder a rota inteira
 * transformaria o app numa porta fechada, e ninguém assina o que não viu.
 */
export const ETAPAS_GRATIS = 2;

export const PRECO_PRO_MENSAL = 29.9;

export type Plano = {
  id: PlanId;
  nome: string;
  preco: string;
  periodo: string;
  resumo: string;
  inclui: string[];
  naoInclui: string[];
};

export const PLANOS: Plano[] = [
  {
    id: "free",
    nome: "Gratuito",
    preco: "R$ 0",
    periodo: "para sempre",
    resumo: "Para descobrir se a rota faz sentido para você.",
    inclui: [
      "Rota completa visível, do começo ao fim",
      `As ${ETAPAS_GRATIS} primeiras etapas liberadas`,
      "Material de estudo conferido, gratuito",
      "Buscas de cursos grátis e pagos",
      "Progresso salvo na sua conta",
    ],
    naoInclui: ["Etapas seguintes", "Refazer a rota", "Projetos de portfólio"],
  },
  {
    id: "pro",
    nome: "Pro",
    preco: "R$ 29,90",
    periodo: "por mês",
    resumo: "Para percorrer a rota inteira até a sua meta.",
    inclui: [
      "Todas as etapas da rota liberadas",
      "Refazer a rota quantas vezes quiser",
      "Projetos de portfólio de cada etapa",
      "Painel de habilidades completo",
      "Tudo do plano Gratuito",
    ],
    naoInclui: [],
  },
];

const CHAVE = "pathly.plano";

function ler(): PlanId {
  if (typeof window === "undefined") return "free";
  try {
    return window.localStorage.getItem(CHAVE) === "pro" ? "pro" : "free";
  } catch {
    // Navegação privada ou storage bloqueado: o gratuito é o padrão seguro.
    return "free";
  }
}

export function usePlan() {
  // Começa sempre no gratuito para o HTML do servidor bater com o primeiro paint do cliente;
  // ler o localStorage direto no useState causaria divergência de hidratação.
  const [plan, setPlan] = useState<PlanId>("free");
  const [conferindo, setConferindo] = useState(true);

  useEffect(() => {
    setPlan(ler());

    // E logo em seguida o valor do banco, que é o que vale. O cache pode estar velho (assinou
    // em outro aparelho) ou adulterado.
    let vivo = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user.id;
        if (!id) return;
        const tabela = supabase as unknown as {
          from(t: string): {
            select(c: string): {
              eq(
                c: string,
                v: string,
              ): { maybeSingle(): Promise<{ data: Record<string, unknown> | null }> };
            };
          };
        };
        const { data: linha } = await tabela
          .from("pathly_profiles")
          .select("plano")
          .eq("user_id", id)
          .maybeSingle();
        if (!vivo) return;
        const doBanco: PlanId = linha?.["plano"] === "pro" ? "pro" : "free";
        setPlan(doBanco);
        try {
          window.localStorage.setItem(CHAVE, doBanco);
        } catch {
          // storage indisponível: o estado desta sessão já está correto
        }
      } finally {
        if (vivo) setConferindo(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, []);

  return { plan, isPro: plan === "pro", conferindo };
}

/** Uma etapa está atrás do paywall quando passa do limite do gratuito. `order` começa em 1. */
export function etapaBloqueadaPorPlano(order: number, isPro: boolean): boolean {
  return !isPro && order > ETAPAS_GRATIS;
}
