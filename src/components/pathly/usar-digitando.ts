import { useCallback, useEffect, useRef } from "react";

/**
 * "A pessoa está digitando agora?", para a moldura do compositor acender.
 *
 * Escreve um atributo direto no DOM em vez de guardar estado no React. A intenção não é economia
 * de microssegundos: o compositor já renderiza a cada tecla por causa do `value` controlado, e
 * somar um `useState` aqui faria cada tecla disparar **dois** renders em vez de um, mais um
 * terceiro quando o cronômetro zerasse. O atributo não participa do render nenhuma vez.
 *
 * Quem decide o que fazer com ele é o CSS, em `.chat-composer-frame[data-typing="true"]`.
 *
 * Arquivo próprio, e não dentro de `ui.tsx`, porque um módulo que exporta componentes e também
 * um hook perde o fast refresh do Vite — o aviso do `react-refresh` existe para isso.
 */
export function useDigitando(pausaMs = 1100) {
  const ref = useRef<HTMLDivElement>(null);
  const cronometro = useRef<number | undefined>(undefined);

  const aoDigitar = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("data-typing", "true");
    window.clearTimeout(cronometro.current);
    cronometro.current = window.setTimeout(() => {
      // O elemento pode ter saído da tela entre a última tecla e este instante.
      ref.current?.removeAttribute("data-typing");
    }, pausaMs);
  }, [pausaMs]);

  // Sem isto, trocar de rota no meio de uma frase deixa um `setTimeout` correndo para um nó morto.
  useEffect(() => () => window.clearTimeout(cronometro.current), []);

  return { ref, aoDigitar };
}
