"use client";

import React from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

/*
 * Origem: registry `@spell` (spell.sh). Trazido pelo shadcn e adaptado ao Pathly.
 *
 * O que mudou em relação ao original:
 *
 * 1. `useReducedMotion`. O componente vinha animando sempre. A regra global de
 *    `prefers-reduced-motion` do `styles.css` zera `animation-duration` de animações **CSS** — e
 *    esta é JavaScript, via `motion/react`, então passava batido. Quem pede menos movimento
 *    recebia o texto materializando palavra a palavra do mesmo jeito.
 * 2. `type Transition` como importação de tipo, exigido pelo `verbatimModuleSyntax` do projeto.
 *
 * Só aceita texto puro: `React.Children.toArray(...).filter(typeof === "string")`. Não serve para
 * conteúdo com markdown — as respostas do Copilot, por exemplo, perderiam negrito e listas.
 */

interface WordsStaggerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  speed?: number;
  autoStart?: boolean;
  onStart?: () => void;
  onComplete?: () => void;
  inView?: boolean;
  once?: boolean;
}

export function WordsStagger({
  children,
  className,
  delay = 0,
  stagger = 0.1,
  speed = 0.5,
  autoStart = true,
  onStart,
  onComplete,
  inView = false,
  once = true,
}: WordsStaggerProps) {
  const semMovimento = useReducedMotion();

  const text = React.Children.toArray(children)
    .filter((child) => typeof child === "string")
    .join("");

  const words = text.split(" ").filter((word) => word.length > 0);

  // Quem pediu menos movimento recebe o texto inteiro, de uma vez, sem desfoque nenhum.
  if (semMovimento) {
    return <div className={cn("flex flex-wrap", className)}>{text}</div>;
  }

  const transition: Transition = {
    type: "tween",
    ease: "easeOut",
    duration: speed,
  };

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
      },
    },
  };

  const wordVariants = {
    hidden: {
      opacity: 0,
      y: 10,
      filter: "blur(10px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition,
    },
  };

  /*
   * Props montadas por espalhamento em vez de `prop={cond ? x : undefined}`.
   *
   * O projeto liga `exactOptionalPropertyTypes`, e sob essa regra passar `undefined` explícito
   * para uma prop opcional é erro de tipo. O original do Spell usava a forma ternária e não
   * compilava aqui.
   */
  const gatilho = inView
    ? { whileInView: "visible" as const }
    : { animate: (autoStart ? "visible" : "hidden") as "visible" | "hidden" };
  const callbacks = {
    ...(onStart ? { onAnimationStart: onStart } : {}),
    ...(onComplete ? { onAnimationComplete: onComplete } : {}),
  };

  return (
    <motion.div
      className={cn("flex flex-wrap", className)}
      variants={containerVariants}
      initial="hidden"
      viewport={{ once }}
      {...gatilho}
      {...callbacks}
    >
      {words.map((word, index) => (
        <motion.span key={`${word}-${index}`} className="inline-block" variants={wordVariants}>
          {word}
          {index < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </motion.span>
      ))}
    </motion.div>
  );
}
