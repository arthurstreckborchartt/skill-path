import { useCallback, useEffect, useState } from "react";

/**
 * Planos da Pathly.
 *
 * Por enquanto isto é **só a camada visual**: o plano vive no navegador e qualquer pessoa pode
 * trocar pelo devtools. Não é falha, é o escopo — a cobrança ainda não existe. Quando a Stripe
 * entrar, o plano passa a vir do servidor (assinatura conferida no backend) e este módulo troca
 * a fonte sem que as telas mudem, porque elas só consomem `usePlan()`.
 *
 * Enquanto isso não acontece, nada aqui pode dar a entender que já existe cobrança: o botão de
 * assinar não cobra, e a tela precisa dizer isso.
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

  useEffect(() => setPlan(ler()), []);

  const mudar = useCallback((proximo: PlanId) => {
    setPlan(proximo);
    try {
      window.localStorage.setItem(CHAVE, proximo);
    } catch {
      // Sem storage o plano vale só para esta sessão — melhor que quebrar a tela.
    }
  }, []);

  return { plan, isPro: plan === "pro", mudar };
}

/** Uma etapa está atrás do paywall quando passa do limite do gratuito. `order` começa em 1. */
export function etapaBloqueadaPorPlano(order: number, isPro: boolean): boolean {
  return !isPro && order > ETAPAS_GRATIS;
}
