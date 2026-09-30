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
import type { Faceta } from "@/lib/copilot/roteador";
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
  { slug: "plano", rotulo: "Plano", icone: MapIcon, faceta: "produto" },
  { slug: "decisoes", rotulo: "Decisões", icone: Lightbulb, faceta: "stack" },
  { slug: "etapas", rotulo: "Etapas", icone: ListChecks, faceta: "roadmap" },
  { slug: "dados", rotulo: "Dados", icone: Database, faceta: "banco" },
  { slug: "api", rotulo: "API", icone: Plug, faceta: "api" },
  { slug: "ia", rotulo: "IA", icone: Sparkles, faceta: "ia" },
  { slug: "validacao", rotulo: "Validação", icone: SquareCheck, faceta: "seguranca" },
  { slug: "seguranca", rotulo: "Segurança", icone: ShieldCheck, faceta: "seguranca" },
  { slug: "publicar", rotulo: "Publicar", icone: Rocket, faceta: "deploy" },
] as const satisfies readonly {
  slug: string;
  rotulo: string;
  icone: LucideIcon;
  /**
   * O assunto que esta parte representa para o Copilot.
   *
   * Existe porque `rotear(pergunta, facetaDaTela)` usa a faceta da tela para entender perguntas
   * que não dizem o assunto — "não entendi essa parte" só funciona se o servidor souber que parte
   * é essa. O chat mandava `"produto"` fixo, então a pergunta feita olhando o painel de Dados
   * chegava ao modelo como se fosse sobre funcionalidades.
   */
  faceta: Faceta;
}[];

/** O assunto da parte aberta, para o chat contar ao servidor. `produto` é o padrão da conversa. */
export function facetaDaParte(slug: SlugDeParte | null | undefined): Faceta {
  return PARTES.find((p) => p.slug === slug)?.faceta ?? "produto";
}

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
 * ## Por que Etapas vem de fora
 *
 * `Plano` sai do próprio blueprint: contar blocos gerados é olhar o objeto que a tela já tem.
 *
 * `Etapas` **não pode** sair de `projeto.etapasConcluidas` / `etapasTotal`. Medido em produção:
 * as colunas diziam `0/15` enquanto o projeto tinha 2 etapas concluídas e 13 no roadmap. A de
 * concluídas nunca é atualizada, e a de total conta as etapas do blueprint em vez das que
 * sobrevivem à filtragem de fases.
 *
 * O sintoma era a sidebar dizendo `Etapas 0/15` com o painel logo ao lado dizendo `2/13`. Agora a
 * contagem chega por `contagem`, de `useContagens` — a mesma fonte que a home usa.
 *
 * As outras sete partes não mostram número: moram em tabelas próprias, e buscá-las custaria sete
 * idas ao banco toda vez que alguém abre a conversa.
 */
export function estadoDasPartes(
  projeto: Projeto,
  contagem?: { feitas: number; total: number } | null,
): Partial<Record<SlugDeParte, string>> {
  const prontos = blocosProntos(projeto.conteudo);
  return {
    ...(prontos > 0 ? { plano: `${prontos}/${BLOCOS.length}` } : {}),
    ...(contagem && contagem.total > 0 ? { etapas: `${contagem.feitas}/${contagem.total}` } : {}),
  };
}
