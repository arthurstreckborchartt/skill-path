import {
  Database,
  Lightbulb,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  SquareCheck,
} from "lucide-react";
import { BLOCOS, type Blueprint } from "@/lib/blueprint/contrato";
import type { Projeto } from "@/lib/blueprint/usar-projetos";

/**
 * O catálogo das partes de um projeto, sem nenhum componente.
 *
 * Mora fora do `.tsx` por causa do Fast Refresh: um arquivo que exporta componentes **e** funções
 * perde o recarregamento a quente, e o eslint avisa. Com a lista, os tipos e as contas aqui, o
 * arquivo de componentes exporta só componentes.
 */

/**
 * As partes, na ordem em que um projeto ganha corpo.
 *
 * Plano e Decisões primeiro porque são o que existe antes de qualquer código; Publicar por
 * último. Não é uma ordem obrigatória — é a ordem em que a lista faz sentido sendo lida de cima
 * para baixo.
 *
 * O campo `rota` saiu: ele existia quando cada parte era um destino, e virou letra morta quando
 * elas passaram a abrir em painel. `decisoes` não tem rota própria nenhuma, e manter o campo me
 * obrigaria a inventar uma para ela.
 */
export const PARTES = [
  { slug: "plano", rotulo: "Plano", icone: MapIcon },
  { slug: "decisoes", rotulo: "Decisões", icone: Lightbulb },
  { slug: "etapas", rotulo: "Etapas", icone: ListChecks },
  { slug: "dados", rotulo: "Dados", icone: Database },
  { slug: "api", rotulo: "API", icone: Plug },
  { slug: "ia", rotulo: "IA", icone: Sparkles },
  { slug: "validacao", rotulo: "Validação", icone: SquareCheck },
  { slug: "seguranca", rotulo: "Segurança", icone: ShieldCheck },
  { slug: "publicar", rotulo: "Publicar", icone: Rocket },
] as const satisfies readonly {
  slug: string;
  rotulo: string;
  icone: LucideIcon;
}[];

export type SlugDeParte = (typeof PARTES)[number]["slug"];

const SLUGS = PARTES.map((p) => p.slug) as readonly string[];

/**
 * `null` para qualquer coisa fora dos oito slugs.
 *
 * O valor vem da URL, e aqui ele escolhe qual componente renderiza — uma lista fechada é o que
 * impede a query de apontar para outro lugar.
 */
export function lerParte(v: unknown): SlugDeParte | null {
  return typeof v === "string" && SLUGS.includes(v) ? (v as SlugDeParte) : null;
}

/** Quantos dos cinco blocos do blueprint já existem. */
function blocosProntos(bp: Blueprint): number {
  return BLOCOS.filter((b) => bp[b]).length;
}

/**
 * Os números que aparecem ao lado do nome.
 *
 * Só dois, e de propósito: Plano e Etapas contam o que a própria linha do projeto já carrega. As
 * outras seis moram em tabelas próprias, e buscá-las custaria seis idas ao banco toda vez que
 * alguém abre a conversa — caro demais para um número numa coluna lateral.
 *
 * O dia em que essas contas vierem numa consulta só, elas entram aqui sem mudar nada da forma.
 */
export function estadoDasPartes(projeto: Projeto): Partial<Record<SlugDeParte, string>> {
  const prontos = blocosProntos(projeto.conteudo);
  return {
    ...(prontos > 0 ? { plano: `${prontos}/${BLOCOS.length}` } : {}),
    ...(projeto.etapasTotal > 0
      ? { etapas: `${projeto.etapasConcluidas}/${projeto.etapasTotal}` }
      : {}),
  };
}
