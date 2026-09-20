"use client";

/*
 * Origem: registry `@spell` (spell.sh). Adaptado ao Pathly.
 *
 * O que mudou:
 *
 * 1. As 21 cores de anel viraram tres. Num app monocromatico, `focus:ring-fuchsia-600` e peso
 *    morto — e pior, e um convite a alguem usar.
 * 2. `dark:bg-neutral-950`, `bg-white` e `dark:border-neutral-700/75` viraram token.
 * 2b. O rotulo levantado perdeu o fundo e saiu de cima da borda. O original o montava na borda
 *    com um fundo solido atras, fingindo um entalhe — truque que exige casar a cor com o que
 *    esta atras. Neste app, atras esta o fundo animado em WebGL, que se move: nenhuma cor fixa
 *    casa, e o entalhe virava um retangulo pairando sobre o campo. Sem fundo, nao ha o que casar.
 * 3. Altura 12 e `text-base sm:text-sm`, herdados do `AuthField` que este componente
 *    substituiu: abaixo de 16px o Safari do iPhone da zoom ao focar o campo. O fundo e
 *    `surface-2`, o mesmo que os campos de autenticacao ja usavam.
 * 4. Rotulos do botao de senha em portugues.
 *
 * O `autofill:shadow-[...]` do original saiu: o app ja trata `:-webkit-autofill` globalmente no
 * `styles.css`, com token, e duas regras para a mesma coisa e uma para divergir depois.
 */

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { EyeIcon, EyeOffIcon } from "lucide-react";

type RingColor = "muted" | "primary" | "destructive";

interface LabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  ringColor?: RingColor;
  containerClassName?: string;
}

const ringColorMap: Record<RingColor, string> = {
  muted: "focus:ring-ring",
  primary: "focus:ring-foreground/40",
  destructive: "focus:ring-destructive",
};

export function LabelInput({
  label = "",
  ringColor = "muted",
  containerClassName,
  className,
  type = "text",
  placeholder = "",
  ...props
}: LabelInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isPasswordType = type === "password";
  const inputType = isPasswordType ? (isVisible ? "text" : "password") : type;

  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    /*
      `pt-5` reserva a faixa onde o rótulo levantado vive.

      O componente reserva o próprio espaço em vez de exigir que quem o usa abra folga: o
      formulário de autenticação tem 16px entre campos, e um rótulo de 16px acima do campo
      encostaria no campo de cima. Quem sabe de quanto o rótulo precisa é ele.
    */
    <div className={cn("group relative w-full pt-5", className, containerClassName)}>
      <input
        className={cn(
          // text-base no celular: abaixo de 16px o Safari do iPhone da zoom ao focar o campo.
          "peer block h-12 w-full rounded-md border border-input bg-surface-2 px-4 text-base text-foreground outline-none transition-colors focus:border-foreground/35 focus:ring-2 disabled:opacity-60 sm:text-sm",
          isPasswordType && "pr-9",
          ringColorMap[ringColor],
        )}
        placeholder={placeholder}
        type={inputType}
        {...props}
      />
      {/*
        O rótulo é o placeholder. Vazio, ele ocupa o campo; com conteúdo ou em foco, encolhe e
        sobe — para **acima** do campo, não para cima da borda.

        ## Por que não fica mais sobre a borda

        A versão anterior punha o rótulo montado na borda de cima, metade dentro do campo e
        metade fora, com `bg-surface-2` atrás fingindo um entalhe. O truque exige que a cor do
        rótulo case com o que está atrás — e atrás da metade de fora não está o campo: está a
        página, que neste app tem um **fundo animado em WebGL**. Nenhuma cor fixa casa com um
        fundo que se move, então o entalhe aparecia como um retângulo sólido pairando sobre o
        campo.

        Sem fundo nenhum, não há o que casar. Funciona sobre a página, sobre um `panel`, sobre o
        fundo animado, e sobre qualquer coisa que venha depois.

        A posição é `top` e `font-size`, e não `translate` com `scale` como no original: aquelas
        classes não chegavam a aplicar aqui (o computado ficava em `translate: 0px` nos dois
        estados, então o rótulo nunca saía do lugar).
      */}
      <label
        className={cn(
          "pointer-events-none absolute left-4 text-muted-foreground transition-all duration-200",
          // Levantado é o estado base: no topo do container, na faixa que o `pt-5` reservou.
          "top-0 translate-y-0 text-xs",
          /*
            Em repouso o rótulo desce e ocupa o campo. `2.75rem` = os 1.25rem reservados pelo
            `pt-5` + metade da altura do campo (`h-12`); com `-translate-y-1/2`, o centro do
            rótulo cai no centro do campo.

            A condição é `:placeholder-shown:not(:focus)` num seletor só, e não duas regras
            disputando — `peer-placeholder-shown` e `peer-focus` são variantes irmãs, e qual
            delas vence depende da ordem em que o Tailwind as emite. Aqui dependia: com o campo
            vazio e em foco, o rótulo continuava lá embaixo, atrás do cursor. Uma condição só
            não tem desempate para perder.
          */
          "peer-[:placeholder-shown:not(:focus)]:top-[2.75rem] peer-[:placeholder-shown:not(:focus)]:-translate-y-1/2",
          "peer-[:placeholder-shown:not(:focus)]:text-base peer-[:placeholder-shown:not(:focus)]:sm:text-sm",
        )}
      >
        {label}
      </label>
      {isPasswordType && (
        <button
          className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute end-0 top-5 flex h-12 w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
          onClick={toggleVisibility}
          aria-label={isVisible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={isVisible}
        >
          {isVisible ? (
            <EyeOffIcon size={16} aria-hidden="true" />
          ) : (
            <EyeIcon size={16} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}

export default LabelInput;
