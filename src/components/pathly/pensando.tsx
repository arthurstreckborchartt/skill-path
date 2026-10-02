import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

/**
 * "Espere, estou trabalhando" — o mesmo sinal em toda espera do app.
 *
 * ## Por que um componente, e não um texto em cada lugar
 *
 * Antes cada espera se dizia de um jeito: um `Shimmer` sozinho na conversa, outro no painel, e na
 * criação de projeto só o botão girando no canto. Um texto com brilho correndo é sutil demais
 * para ser lido como "espere" — parece um rótulo com efeito, e a pessoa clica de novo. E três
 * formas de esperar são três coisas que a pessoa precisa aprender a reconhecer.
 *
 * ## O anel
 *
 * Gira com as cores do compositor, então ele pertence à mesma família da moldura que acende
 * quando se digita: quem já viu a luz correndo na borda do campo reconhece este anel como "a
 * mesma coisa trabalhando". Desenhado em CSS (`.pensando-anel` em `styles.css`), sem SVG e sem
 * biblioteca.
 *
 * `role="status"` com `aria-live="polite"`: leitor de tela anuncia a espera sem interromper o que
 * a pessoa estava ouvindo.
 */
export function Pensando({ children, className }: { children: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-3 text-sm text-muted-foreground", className)}
    >
      <span aria-hidden className="pensando-anel" />
      <Shimmer>{children}</Shimmer>
    </div>
  );
}
