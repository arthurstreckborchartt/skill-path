"use client";

/*
 * Origem: registry `@spell` (spell.sh). Adaptado ao Pathly.
 *
 * O que mudou:
 *
 * 1. As 21 cores de anel viraram tres. Num app monocromatico, `focus:ring-fuchsia-600` e peso
 *    morto — e pior, e um convite a alguem usar.
 * 2. `dark:bg-neutral-950`, `bg-white` e `dark:border-neutral-700/75` viraram token.
 * 2b. O entalhe da borda virou `fieldset`+`legend`. O original fingia o buraco com um fundo
 *    solido atras do rotulo, o que exige casar a cor com o que esta atras — e atras esta o fundo
 *    animado em WebGL, que se move. Nenhuma cor fixa casa com isso, e o falso entalhe aparecia
 *    como um retangulo pairando. Com `legend`, o buraco e buraco: o navegador tira a largura
 *    dela do traco, sem pintar nada.
 * 3. Altura 12 e `text-base sm:text-sm`, herdados do `AuthField` que este componente
 *    substituiu: abaixo de 16px o Safari do iPhone da zoom ao focar o campo.
 * 3b. O campo e transparente: o que aparece dentro dele e o fundo da pagina. Combina com a borda
 *    entalhada — nenhuma das duas pinta nada, entao nao ha cor para casar com nada.
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

/**
 * A cor do foco, aplicada na borda do `fieldset` — nao num anel.
 *
 * `ring` do Tailwind e `box-shadow`, e box-shadow e um retangulo fechado: nao existe como abrir
 * um entalhe nele. Com o anel no campo, o foco desenhava uma segunda linha por cima do rotulo,
 * justamente onde a borda tinha acabado de abrir espaco.
 *
 * Como a borda ja mora no `fieldset`, e o `fieldset` ja tem o vao, expressar o foco nela sai
 * entalhado de graca.
 */
const corDeFoco: Record<RingColor, string> = {
  muted: "peer-focus:border-ring",
  primary: "peer-focus:border-foreground/40",
  destructive: "peer-focus:border-destructive",
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
      {/*
        A borda NÃO está aqui. Ela é desenhada pelo `fieldset` abaixo, que é quem consegue abrir
        um entalhe de verdade para o rótulo. O campo fica com uma borda transparente só para o
        tamanho da caixa não mudar.
      */}
      <input
        className={cn(
          // text-base no celular: abaixo de 16px o Safari do iPhone da zoom ao focar o campo.
          "peer block h-12 w-full rounded-md border border-transparent bg-transparent px-4 text-base text-foreground outline-none transition-colors disabled:opacity-60 sm:text-sm",
          isPasswordType && "pr-9",
        )}
        placeholder={placeholder}
        type={inputType}
        {...props}
      />

      {/*
        O entalhe na borda, de verdade.

        ## Por que `fieldset` e `legend`

        A versão anterior punha o rótulo montado na borda com um fundo sólido atrás, fingindo um
        buraco. Fingir exige casar a cor com o que está atrás — e atrás da metade de fora está a
        página, que neste app tem fundo animado em WebGL. Nenhuma cor fixa casa com um fundo que
        se move: o "entalhe" aparecia como um retângulo pairando sobre o campo.

        `legend` dentro de `fieldset` é a única construção do HTML em que o navegador **remove**
        a largura do conteúdo do traço da borda. O buraco é buraco, não tinta por cima. Funciona
        sobre a página, sobre um `panel`, sobre o fundo animado e sobre o que vier depois.

        A `legend` aqui é invisível e serve só para abrir o vão — quem se vê é o `label` adiante,
        que é o que anima entre dentro e fora do campo. Duas peças porque uma `legend` não pode
        descer para o meio do campo: ela é presa à borda de cima.

        `max-w-0` fechado, `max-w-full` aberto, com transição — é o vão que abre junto com o
        rótulo subindo, em vez de aparecer de uma vez.

        O `peer-*` vale no `fieldset`, que é irmão do campo; `[&>legend]` alcança a filha. A
        variante do Tailwind gera `~` (irmão), então aplicá-la direto na `legend` não funcionaria.
      */}
      <fieldset
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 m-0 rounded-md border border-input p-0 transition-colors",
          // 2px no foco: e o destaque, e ele nasce entalhado por ser a mesma borda.
          "peer-focus:border-2",
          corDeFoco[ringColor],
          // A compensacao de 1px vira 2px quando a borda engrossa — senao o vao anda junto.
          "peer-focus:[&>legend]:ml-[8px]",
          /*
            `ml-[9px]` e nao `ml-2.5` (10px): a `legend` se posiciona a partir da caixa de
            conteudo do `fieldset`, que ja esta 1px para dentro por causa da propria borda. O
            rotulo se posiciona a partir da caixa externa. Sem o desconto, o vao fica 1px a
            direita do texto e sobra uma lasca de linha a esquerda dele.
          */
          "[&>legend]:ml-[9px] [&>legend]:h-0 [&>legend]:max-w-0 [&>legend]:overflow-hidden [&>legend]:p-0 [&>legend]:text-xs [&>legend]:whitespace-nowrap [&>legend]:opacity-0 [&>legend]:transition-all [&>legend]:duration-200",
          "peer-focus:[&>legend]:max-w-full peer-focus:[&>legend]:px-1.5",
          "peer-[:not(:placeholder-shown)]:[&>legend]:max-w-full peer-[:not(:placeholder-shown)]:[&>legend]:px-1.5",
        )}
      >
        <legend>{label}</legend>
      </fieldset>

      {/*
        O rótulo visível. Vazio e sem foco, ocupa o campo; com conteúdo ou em foco, encolhe e sobe
        para cima da borda — onde a `legend` já abriu o vão.

        A condição de repouso é `:placeholder-shown:not(:focus)` num seletor só, e não duas
        variantes irmãs disputando. `peer-placeholder-shown` e `peer-focus` têm a mesma
        especificidade, e qual vence depende da ordem em que o Tailwind as emite — aqui dependia:
        com o campo vazio e em foco, o rótulo ficava lá embaixo, atrás do cursor.
      */}
      <label
        className={cn(
          "pointer-events-none absolute left-2.5 px-1.5 text-muted-foreground transition-all duration-200",
          // Levantado é o estado base: em cima da borda, atravessando a linha.
          "top-0 -translate-y-1/2 text-xs",
          // Em repouso desce e ocupa o campo, no tamanho do texto.
          "peer-[:placeholder-shown:not(:focus)]:top-1/2 peer-[:placeholder-shown:not(:focus)]:text-base",
          "peer-[:placeholder-shown:not(:focus)]:sm:text-sm",
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
