import { useEffect, useState } from "react";
import { History, Lightbulb } from "lucide-react";
import { Chip, SectionLabel, Skeleton } from "./ui";
import { lerDecisoesAtivas } from "@/lib/copilot/memoria";
import { ROTULO_ORIGEM, type Decisao } from "@/lib/copilot/contrato";

/**
 * As decisões técnicas do projeto.
 *
 * ## Por que esta tela não existia
 *
 * As decisões eram gravadas, versionadas e mandadas para o prompt do Copilot desde sempre — mas
 * nunca apareceram para a pessoa. Ela dizia "vou usar PostgreSQL porque tenho relações
 * complexas", o Pathly registrava, e o registro só voltava indiretamente, dentro de outra
 * resposta.
 *
 * O que faz uma decisão valer mais que uma linha no blueprint é o **motivo**. "Banco: PostgreSQL"
 * é um fato que qualquer ferramenta guarda; "porque as relações são complexas" é o que impede
 * você — ou uma IA daqui a três meses — de trocar sem entender o que quebra.
 *
 * ## Só as ativas
 *
 * Uma decisão superada não some do banco: ela fica com `substituiDecisaoId` apontando para a que
 * a aposentou. Mas a lista mostra o estado **atual**, porque a pergunta que ela responde é "o que
 * vale hoje?". O histórico completo é outra pergunta, e ainda não tem tela.
 */
export function DecisoesDoProjeto({ projetoId }: { projetoId: string }) {
  const [estado, setEstado] = useState<
    { fase: "carregando" } | { fase: "pronto"; decisoes: Decisao[] } | { fase: "erro" }
  >({ fase: "carregando" });

  useEffect(() => {
    let vivo = true;
    void lerDecisoesAtivas(projetoId)
      .then((d) => vivo && setEstado({ fase: "pronto", decisoes: d }))
      .catch(() => vivo && setEstado({ fase: "erro" }));
    return () => {
      vivo = false;
    };
  }, [projetoId]);

  if (estado.fase === "carregando") {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  if (estado.fase === "erro") {
    return <p className="text-sm text-muted-foreground">Não consegui carregar as decisões.</p>;
  }

  if (estado.decisoes.length === 0) {
    return (
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm">Nenhuma decisão registrada ainda.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Quando você escolher um banco, um jeito de autenticar ou uma hospedagem — e disser o
            porquê — a escolha fica registrada aqui, com o motivo. É o motivo que impede alguém de
            trocar daqui a três meses sem saber o que quebra.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {estado.decisoes.map((d) => (
        <article key={d.id} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel>{d.titulo}</SectionLabel>
            <Chip tone="muted">{ROTULO_ORIGEM[d.origem]}</Chip>
            {d.substituiDecisaoId && <Chip tone="accent">substituiu uma anterior</Chip>}
          </div>

          <p className="mt-2 font-display text-lg font-semibold">{d.valor}</p>

          {/* O motivo em destaque, e não numa nota de rodapé: é o que a decisão carrega de único. */}
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.motivo}</p>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <History className="size-3.5" />
            {new Date(d.confirmadoEm ?? d.criadoEm).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
        </article>
      ))}
    </div>
  );
}
