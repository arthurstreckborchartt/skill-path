"use client";

/*
 * Origem: registry `@spell` (spell.sh). Adaptado ao Pathly.
 *
 * O que mudou:
 *
 * 1. As 21 cores de anel viraram tres. Num app monocromatico, `focus:ring-fuchsia-600` e peso
 *    morto — e pior, e um convite a alguem usar.
 * 2. `dark:bg-neutral-950`, `bg-white` e `dark:border-neutral-700/75` viraram token. O fundo do
 *    rotulo PRECISA ser o mesmo do campo: ele finge ser um entalhe na borda, e qualquer diferenca
 *    de tom entrega o truque.
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
    <div className={cn("group relative w-full", className, containerClassName)}>
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
        sobe para cima da borda, com o fundo do campo atrás para parecer um entalhe nela.

        A posição é `top` e `font-size`, e não `translate` com `scale` como no original: aquelas
        classes não chegavam a aplicar aqui (o computado ficava em `translate: 0px` nos dois
        estados, então o rótulo nunca saía do lugar). Duas propriedades diretas fazem o mesmo
        efeito sem depender de composição de transform.
      */}
      <label
        className={cn(
          "pointer-events-none absolute left-2.5 px-1.5 text-muted-foreground transition-all duration-200",
          // Estado de repouso: pequeno, sobre a borda de cima.
          "top-0 -translate-y-1/2 bg-surface-2 text-xs",
          // Campo vazio e sem foco: volta a ocupar o campo, no tamanho do texto.
          "peer-placeholder-shown:top-1/2 peer-placeholder-shown:bg-transparent peer-placeholder-shown:text-base peer-placeholder-shown:sm:text-sm",
          // Foco traz de volta para a borda mesmo com o campo vazio.
          "peer-focus:top-0 peer-focus:bg-surface-2 peer-focus:text-xs",
        )}
      >
        {label}
      </label>
      {isPasswordType && (
        <button
          className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
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
