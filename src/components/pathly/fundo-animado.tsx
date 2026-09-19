import { useEffect, useState } from "react";
import AnimatedGradient from "@/components/ui/animated-gradient";
import type { ResolvedTheme } from "@/lib/theme";

/**
 * O tema que está realmente aplicado no `<html>`, observado.
 *
 * Não usa `useTheme()` de propósito: aquele hook guarda o tema em `useState` **por instância**, e
 * a instância que troca o tema é a da tela de Configurações. Esta aqui nunca ficaria sabendo — o
 * gradiente continuaria com as cores antigas até alguém recarregar a página.
 *
 * O resto do app não sofre disso porque lê cor por token CSS, e a classe `.dark` no `<html>`
 * atualiza tudo sozinha. Como aqui a cor precisa virar string no JavaScript para ir ao shader, o
 * jeito honesto é observar o que de fato foi aplicado.
 */
function useTemaAplicado(): ResolvedTheme {
  const [tema, setTema] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const ler = () =>
      setTema(document.documentElement.classList.contains("dark") ? "dark" : "light");
    ler();
    const observador = new MutationObserver(ler);
    observador.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observador.disconnect();
  }, []);

  return tema;
}

/**
 * O fundo animado do app.
 *
 * ## Por que `custom` e não um preset
 *
 * Os seis presets do Spell são coloridos: Prism tem azul, Lava laranja e vermelho, Plasma roxo,
 * Pulse verde, Mist rosa. Só Vortex é acromático, e ele é listrado e agitado demais para ficar
 * atrás de um app de leitura.
 *
 * Então o preset é `custom`, com os valores medidos dos próprios tokens do Pathly. A diferença
 * entre `--background` e `--surface-2` é de cerca de 0.09 de luminosidade: o suficiente para o
 * fundo respirar, pouco o bastante para ninguém notar que existe um shader ali.
 *
 * O `custom` do componente não aceita cor por tema, então a troca é feita aqui.
 */
const CORES = {
  dark: { color1: "#141414", color2: "#2A2A2A", color3: "#141414" },
  light: { color1: "#F9F9F9", color2: "#F0F0F0", color3: "#F9F9F9" },
} as const;

export function FundoAnimado() {
  const cores = CORES[useTemaAplicado()];

  return (
    <AnimatedGradient
      className="pointer-events-none"
      /*
       * `zIndex: -1`, nao 0. Um elemento posicionado com z-index 0 pinta ACIMA do conteudo em
       * fluxo normal que nao tem posicionamento — e o <main> do app nao tem. Com 0 o gradiente
       * cobria o texto inteiro da pagina. Funciona porque o container do shell tem `isolate`.
       */
      style={{ position: "fixed", zIndex: -1 }}
      config={{
        preset: "custom",
        ...cores,
        /*
         * `speed: 6` é bem abaixo dos 20–39 dos presets. Um fundo de app fica na tela por horas;
         * na velocidade dos presets ele vira um objeto em movimento no canto do olho.
         */
        speed: 6,
        rotation: 0,
        proportion: 42,
        scale: 0.5,
        distortion: 4,
        swirl: 55,
        swirlIterations: 5,
        /* Máximos: sem borda dura entre as faixas, o desenho vira variação de tom e não padrão. */
        softness: 100,
        shape: "Edge",
        shapeSize: 50,
      }}
    />
  );
}
