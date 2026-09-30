import { Link } from "@tanstack/react-router";
import {
  Database,
  ListChecks,
  type LucideIcon,
  Map as MapIcon,
  Plug,
  Rocket,
  ShieldCheck,
  Sparkles,
  SquareCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCOS, type Blueprint } from "@/lib/blueprint/contrato";
import type { Projeto } from "@/lib/blueprint/usar-projetos";

/**
 * As partes de um projeto, numa coluna só.
 *
 * ## O problema que ela resolve
 *
 * Plano, Etapas, Dados, API, Arquitetura de IA, Validação, Segurança e Lançamento eram oito
 * destinos separados, e a única forma de saber o estado de um era abrir. A pessoa não tinha
 * resposta para "o que já está de pé neste projeto?" sem visitar oito telas.
 *
 * Agora as oito ficam numa coluna ao lado da conversa, com o estado escrito ao lado do nome. É a
 * diferença entre uma navegação e um painel: uma leva a algum lugar, o outro **informa** antes de
 * levar.
 *
 * ## Por que só duas mostram número
 *
 * Plano e Etapas contam o que o próprio projeto já carrega — os blocos gerados e o progresso da
 * trilha, os dois lidos de uma única linha que a tela já tinha em mãos. As outras seis moram em
 * tabelas próprias, e buscá-las aqui custaria seis idas ao banco toda vez que alguém abre a
 * conversa.
 *
 * Um número que custa seis requisições para aparecer numa coluna lateral não vale o que atrasa. O
 * dia em que essas contas vierem numa consulta só, elas entram aqui sem mudar nada da forma.
 */

type Parte = {
  rotulo: string;
  icone: LucideIcon;
  rota:
    | "/app/blueprint/$id"
    | "/app/roadmap/$id"
    | "/app/banco/$id"
    | "/app/api/$id"
    | "/app/arquitetura-ia/$id"
    | "/app/validacao/$id"
    | "/app/seguranca/$id"
    | "/app/lancamento/$id";
};

const PARTES: readonly Parte[] = [
  { rotulo: "Plano", icone: MapIcon, rota: "/app/blueprint/$id" },
  { rotulo: "Etapas", icone: ListChecks, rota: "/app/roadmap/$id" },
  { rotulo: "Dados", icone: Database, rota: "/app/banco/$id" },
  { rotulo: "API", icone: Plug, rota: "/app/api/$id" },
  { rotulo: "IA", icone: Sparkles, rota: "/app/arquitetura-ia/$id" },
  { rotulo: "Validação", icone: SquareCheck, rota: "/app/validacao/$id" },
  { rotulo: "Segurança", icone: ShieldCheck, rota: "/app/seguranca/$id" },
  { rotulo: "Publicar", icone: Rocket, rota: "/app/lancamento/$id" },
];

/** Quantos dos cinco blocos do blueprint já existem. */
function blocosProntos(bp: Blueprint): number {
  return BLOCOS.filter((b) => bp[b]).length;
}

export function PartesDoProjeto({ projeto }: { projeto: Projeto }) {
  const prontos = blocosProntos(projeto.conteudo);

  const estado: Record<string, string | null> = {
    Plano: prontos === 0 ? null : `${prontos}/${BLOCOS.length}`,
    Etapas: projeto.etapasTotal === 0 ? null : `${projeto.etapasConcluidas}/${projeto.etapasTotal}`,
  };

  return (
    <nav aria-label="Partes do projeto" className="flex flex-col gap-0.5">
      {PARTES.map(({ rotulo, icone: Icone, rota }) => (
        <Link
          key={rotulo}
          to={rota}
          params={{ id: projeto.id }}
          className="tap flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Icone className="size-4 shrink-0" />
          <span className="truncate">{rotulo}</span>
          {estado[rotulo] && (
            <span
              className={cn(
                "ml-auto shrink-0 font-mono text-xs tabular-nums",
                // O número em si não vira sinal de alarme: é contagem, não estado de erro. O
                // monocromático do produto não deixaria indicar por cor de qualquer forma.
                "text-muted-foreground",
              )}
            >
              {estado[rotulo]}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
