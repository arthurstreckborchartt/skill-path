import { useState } from "react";
import { AlertTriangle, BookOpen, Check, Lightbulb, ListOrdered, Target, X } from "lucide-react";
import { Btn, Chip, Panel } from "@/components/pathly/ui";
import type { Licao, Pergunta } from "@/lib/ia/licao-contrato";
import { cn } from "@/lib/utils";

/**
 * A aula de verdade.
 *
 * O que havia antes era template: "Ao final, você vai conseguir explicar e aplicar {tarefa} no
 * contexto de {etapa}" — preenchimento de lacuna, que não ensina ninguém. E o quiz usava como
 * alternativas os objetivos das outras etapas, com a resposta certa escrita no topo da própria
 * tela e igual para todas as tarefas da etapa.
 *
 * Aqui o conteúdo vem da IA e é sobre o assunto: explicação, exemplo concreto, passo a passo,
 * armadilhas e perguntas com distratores plausíveis.
 */

function PerguntaCard({
  pergunta,
  numero,
  onResposta,
}: {
  pergunta: Pergunta;
  numero: number;
  onResposta: (acertou: boolean) => void;
}) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const respondida = escolhida !== null;

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-4">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        Pergunta {numero}
      </p>
      <p className="mt-2 text-sm font-medium">{pergunta.enunciado}</p>

      <div className="mt-3 space-y-2">
        {pergunta.alternativas.map((alt, i) => {
          const selecionada = escolhida === i;
          // Depois de responder, a correta aparece mesmo que não tenha sido a escolhida: errar e
          // não descobrir a resposta é o pior desfecho possível de um exercício.
          const revelar = respondida && (selecionada || alt.correta);
          return (
            <button
              key={alt.texto}
              disabled={respondida}
              onClick={() => {
                setEscolhida(i);
                onResposta(alt.correta);
              }}
              className={cn(
                "tap block w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                !respondida && "border-border hover:border-primary/40",
                respondida && !revelar && "border-border/50 opacity-50",
                revelar && alt.correta && "border-primary/50 bg-primary/10",
                revelar && !alt.correta && "border-destructive/50 bg-destructive/10",
              )}
            >
              <span className="flex items-start gap-2">
                {revelar && (
                  <span className="mt-0.5 shrink-0">
                    {alt.correta ? (
                      <Check className="size-4 text-primary" />
                    ) : (
                      <X className="size-4 text-destructive" />
                    )}
                  </span>
                )}
                <span>
                  <span className="block">{alt.texto}</span>
                  {revelar && (
                    <span className="mt-1.5 block text-xs text-muted-foreground">{alt.porque}</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
        {icone}
        {titulo}
      </p>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function LicaoConteudo({ licao, onConcluir }: { licao: Licao; onConcluir?: () => void }) {
  const [acertos, setAcertos] = useState(0);
  const [respondidas, setRespondidas] = useState(0);
  const todasRespondidas = respondidas >= licao.perguntas.length;

  return (
    <div className="space-y-7">
      <Secao icone={<BookOpen className="size-3" />} titulo="Entenda">
        <div className="space-y-3">
          {licao.explicacao.map((p) => (
            <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-muted-foreground">
              {p}
            </p>
          ))}
        </div>
      </Secao>

      {licao.exemplo && (
        <Secao icone={<Lightbulb className="size-3" />} titulo="Na prática">
          <p className="rounded-2xl border border-border bg-surface-2/40 p-4 text-sm leading-relaxed">
            {licao.exemplo}
          </p>
        </Secao>
      )}

      {licao.passos.length > 0 && (
        <Secao icone={<ListOrdered className="size-3" />} titulo="Como fazer">
          <ol className="space-y-2">
            {licao.passos.map((passo, i) => (
              <li key={passo.slice(0, 40)} className="flex gap-3 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{passo}</span>
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {licao.armadilhas.length > 0 && (
        <Secao icone={<AlertTriangle className="size-3" />} titulo="Onde as pessoas erram">
          <ul className="space-y-2">
            {licao.armadilhas.map((a) => (
              <li key={a.slice(0, 40)} className="flex gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-accent" />
                {a}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {licao.perguntas.length > 0 && (
        <Secao icone={<Target className="size-3" />} titulo="Teste o que entendeu">
          <div className="space-y-3">
            {licao.perguntas.map((p, i) => (
              <PerguntaCard
                key={p.enunciado}
                pergunta={p}
                numero={i + 1}
                onResposta={(acertou) => {
                  setRespondidas((n) => n + 1);
                  if (acertou) setAcertos((n) => n + 1);
                }}
              />
            ))}
          </div>
          {todasRespondidas && (
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {acertos}/{licao.perguntas.length} certas.{" "}
              {acertos === licao.perguntas.length
                ? "Pode seguir."
                : "Vale reler a explicação antes de aplicar."}
            </p>
          )}
        </Secao>
      )}

      {licao.pratica && (
        <Panel className="border-primary/30 bg-primary/[0.05]">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
            Agora faça
          </p>
          <p className="mt-2 text-sm leading-relaxed">{licao.pratica}</p>
          {onConcluir && (
            <Btn size="lg" className="mt-4 w-full" onClick={onConcluir}>
              <Check className="size-4" /> Concluí esta tarefa
            </Btn>
          )}
        </Panel>
      )}
    </div>
  );
}

export function LicaoCarregando() {
  return (
    <div className="space-y-4">
      <Chip tone="muted">Preparando a aula…</Chip>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-4 animate-pulse rounded-full bg-surface-2"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
      <p className="text-xs text-muted-foreground">
        Escrevendo o conteúdo desta tarefa. Leva alguns segundos na primeira vez — depois fica
        guardado.
      </p>
    </div>
  );
}

export function LicaoIndisponivel({ motivo }: { motivo: string }) {
  return (
    <Panel>
      <p className="text-sm font-medium">A aula não carregou agora.</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {motivo === "sem-chave"
          ? "A geração de conteúdo ainda não está configurada."
          : "Pode ser congestionamento do serviço. Tente abrir de novo em alguns instantes — o resto da etapa continua disponível."}
      </p>
    </Panel>
  );
}
