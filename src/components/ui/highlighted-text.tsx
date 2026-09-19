import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Origem: registry `@spell` (spell.sh). A ideia é do Spell; a implementação foi refeita.
 *
 * ## Por que sem `motion`
 *
 * O original animava a barra com `motion/react`. Aqui isso não funciona, e o motivo vale registrar:
 * o `motion` desliga animações de transform por conta própria quando a pessoa pede menos movimento,
 * e **este efeito é o fim de um transform**. Desligado, a barra fica parada fora da palavra — e
 * como o texto usa `mix-blend-difference`, que depende da barra atrás para virar negativo, a
 * palavra some: preto sobre preto.
 *
 * Tentei manter o `motion` de duas formas antes de desistir dele. Tirar os `variants` quando
 * `useReducedMotion()` fosse verdadeiro não resolve, porque o hook devolve `null` no primeiro
 * render e o transform já ficava aplicado. Zerar a duração também não, porque o motion nem chega
 * a animar.
 *
 * Com animação CSS o estado final é o CSS normal — barra cobrindo a palavra — e a animação só
 * descreve de onde ela vem. A regra global de `prefers-reduced-motion` do `styles.css` zera a
 * duração, e o resultado é a palavra já destacada, legível, sem movimento. Um caminho só para os
 * dois casos, sem depender de quando um hook decide.
 */

type Origem = "left" | "right" | "top" | "bottom";

/** De onde a barra entra, como deslocamento inicial no `@keyframes highlight-sweep`. */
const DE: Record<Origem, { x: string; y: string }> = {
  left: { x: "-100%", y: "0" },
  right: { x: "100%", y: "0" },
  top: { x: "0", y: "-100%" },
  bottom: { x: "0", y: "100%" },
};

export function HighlightedText({
  children,
  className,
  from = "bottom",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  from?: Origem;
  /** Em segundos, como no componente original. */
  delay?: number;
}) {
  const estilo = {
    "--hl-x": DE[from].x,
    "--hl-y": DE[from].y,
    animationDelay: `${delay}s`,
  } as CSSProperties;

  return (
    <span className={cn("relative inline-flex overflow-hidden align-baseline", className)}>
      <span
        aria-hidden="true"
        style={estilo}
        className="highlight-sweep absolute inset-0 -left-[0.15em] -right-[0.18em] z-0 bg-foreground"
      />
      {/*
        `text-white` aqui não é escolha de paleta, é o operando da conta — e por isso escapa da
        regra de só usar tokens.

        `mix-blend-difference` calcula |fundo − texto| por canal. Com branco, o texto vira o
        inverso exato do que estiver atrás: sobre a barra clara do tema escuro dá preto, sobre a
        barra escura do tema claro dá branco. Sempre o contraste máximo, nos dois temas, com uma
        declaração só.

        Já tentei `text-background` por parecer mais "do sistema". Quebra: no tema escuro o texto
        fica a 0.19 sobre uma barra a 0.94, a diferença dá 0.75 e a palavra sai cinza sobre cinza
        claro. E no tema claro os dois valores coincidem, a diferença dá zero e a palavra some.
      */}
      <span className="relative z-10 mix-blend-difference pl-[0.15em] pr-[0.18em] text-white">
        {children}
      </span>
    </span>
  );
}

export default HighlightedText;
