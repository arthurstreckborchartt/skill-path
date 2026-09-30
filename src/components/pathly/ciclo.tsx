import { cn } from "@/lib/utils";
import {
  CICLO,
  ROTULO_CICLO,
  cicloDoPasso,
  type EtapaDoCiclo,
  type Passo,
} from "@/lib/hub/sessao/contrato";

/**
 * O ciclo de trabalho, em uma linha.
 *
 * ## O que ele é
 *
 * Planejar → implementar → testar → validar → atualizar o plano → próximo. Seis paradas, e a
 * marca de onde a etapa atual está.
 *
 * ## Por que ele aparece mesmo sem sessão aberta
 *
 * Sem nenhuma etapa em andamento, a linha continua ali, apagada. Ela não está reportando estado —
 * está dizendo como o trabalho funciona aqui. Quem abre o Pathly pela primeira vez aprende o ciclo
 * antes de precisar dele, e quem volta depois de um mês lembra sem ter que abrir nada.
 *
 * Esconder até existir uma sessão faria o ciclo aparecer justamente quando já não há tempo de
 * aprendê-lo.
 *
 * ## O que ele não é
 *
 * Não é um fluxograma, e não desenha as voltas. A máquina de estados tem três — testar volta para
 * executar, validar volta para executar, receber-resultado volta para executar — e desenhá-las
 * transformaria seis pontos numa teia. As voltas aparecem onde importam: no contador de voltas da
 * própria sessão.
 */
export function Ciclo({ passo }: { passo: Passo | null }) {
  const atual: EtapaDoCiclo | null = passo ? cicloDoPasso(passo) : null;
  const indiceAtual = atual ? CICLO.indexOf(atual) : -1;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-center gap-1" aria-label="Ciclo de trabalho">
        {CICLO.map((etapa, i) => {
          const passou = indiceAtual >= 0 && i < indiceAtual;
          const agora = i === indiceAtual;

          return (
            <li key={etapa} className="flex items-center gap-1">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] whitespace-nowrap transition-colors",
                  agora
                    ? "bg-foreground font-medium text-background"
                    : passou
                      ? "text-foreground/70"
                      : "text-muted-foreground/60",
                )}
                {...(agora ? { "aria-current": "step" as const } : {})}
              >
                {/*
                  O ponto muda de forma, não de cor: cheio no que passou e no atual, vazado no que
                  falta. Num produto monocromático a cor não está disponível para dizer estado, e
                  a forma diz melhor de qualquer jeito — enxerga-se sem enxergar cor.
                */}
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    agora
                      ? "bg-background"
                      : passou
                        ? "bg-foreground/70"
                        : "border border-muted-foreground/50",
                  )}
                  aria-hidden
                />
                {ROTULO_CICLO[etapa]}
              </span>
              {i < CICLO.length - 1 && (
                <span className="text-muted-foreground/40" aria-hidden>
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
