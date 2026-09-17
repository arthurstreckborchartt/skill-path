import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  GitBranch,
  Hammer,
  ListChecks,
  Sparkles,
  Target,
  Wrench,
} from "lucide-react";
import { Btn, Chip } from "./ui";
import { cn } from "@/lib/utils";
import type { ConteudoEtapa } from "@/lib/blueprint/etapa-contrato";

/**
 * Os doze campos de uma etapa, na tela.
 *
 * A ordem não é a do contrato — é a de quem executa: primeiro o que e por quê (objetivo,
 * explicação), depois o que preciso saber antes, depois o fazer (tarefas e as duas trilhas), e
 * só então as formas de provar que acabou (checklist, critérios, validação). Riscos ficam perto
 * do fazer, porque é onde eles acontecem.
 */

function Secao({
  titulo,
  icone: Icone,
  children,
  destaque,
}: {
  titulo: string;
  icone: typeof Target;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  return (
    <section
      className={cn(
        "mt-5 first:mt-0",
        destaque && "rounded-xl border border-border bg-surface/50 p-4 sm:p-5",
      )}
    >
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Icone className="size-3.5" />
        {titulo}
      </h3>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function Lista({ itens, numerada }: { itens: string[]; numerada?: boolean }) {
  if (numerada) {
    return (
      <ol className="space-y-2">
        {itens.map((x, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground/90">
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
              {i + 1}
            </span>
            <span>{x}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ul className="space-y-1.5">
      {itens.map((x, i) => (
        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * O prompt, com botão de copiar.
 *
 * `navigator.clipboard` falha em contexto não seguro e quando a aba perde o foco. O `catch` deixa
 * o texto selecionável na tela como saída — melhor que um botão que não faz nada e não diz nada.
 */
function BlocoPrompt({ prompt }: { prompt: string }) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setFalhou(false);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setFalhou(true);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Cole no Claude, ChatGPT, Cursor ou Lovable. Ele já carrega o contexto do seu projeto.
        </p>
        <Btn variant="outline" size="sm" onClick={() => void copiar()}>
          {copiado ? (
            <>
              <Check className="size-4" /> Copiado
            </>
          ) : (
            <>
              <Copy className="size-4" /> Copiar
            </>
          )}
        </Btn>
      </div>

      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground/90 select-text">
        {prompt}
      </pre>

      {falhou && (
        <p className="mt-2 text-xs text-muted-foreground">
          Não consegui copiar automaticamente. Selecione o texto acima e copie à mão.
        </p>
      )}
    </div>
  );
}

export function DetalheEtapa({
  conteudo,
  checklistFeito,
  aoAlternarItem,
}: {
  conteudo: ConteudoEtapa;
  checklistFeito: number[];
  aoAlternarItem: (indice: number) => void;
}) {
  const [trilha, setTrilha] = useState<"ia" | "manual">("ia");
  const feitos = new Set(checklistFeito);

  return (
    <div>
      <Secao titulo="Objetivo" icone={Target} destaque>
        <p className="text-base leading-relaxed text-foreground">{conteudo.objetivo}</p>
      </Secao>

      <Secao titulo="Por que isto existe" icone={BookOpen}>
        <div className="space-y-3">
          {conteudo.explicacao.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed text-foreground/90">
              {p}
            </p>
          ))}
        </div>
      </Secao>

      <Secao titulo="O que você precisa saber antes" icone={BookOpen}>
        <Lista itens={conteudo.conhecimentoNecessario} />
      </Secao>

      <Secao titulo={`Tarefas — ${conteudo.tarefas.length}`} icone={ListChecks}>
        <div className="space-y-2.5">
          {conteudo.tarefas.map((t, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
              <p className="text-sm font-medium text-foreground">{t.texto}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.porque}</p>
            </div>
          ))}
        </div>
      </Secao>

      {/*
        As duas trilhas como abas, não uma abaixo da outra.
        O produto promete funcionar sem IA; empilhar as duas faria o modo manual parecer apêndice
        do prompt, que é exatamente a leitura errada.
      */}
      <Secao titulo="Como fazer" icone={Hammer} destaque>
        <div className="flex gap-1.5">
          {(
            [
              { id: "ia" as const, texto: "Com IA", icone: Sparkles },
              { id: "manual" as const, texto: "À mão", icone: Wrench },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setTrilha(o.id)}
              className={cn(
                "tap inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm transition-colors",
                trilha === o.id
                  ? "bg-primary/15 font-medium text-primary"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground",
              )}
            >
              <o.icone className="size-4" />
              {o.texto}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {trilha === "ia" ? (
            <BlocoPrompt prompt={conteudo.prompt} />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                O caminho completo sem IA nenhuma.
              </p>
              <Lista itens={conteudo.modoManual} numerada />
            </>
          )}
        </div>
      </Secao>

      {conteudo.decisoesTecnicas.length > 0 && (
        <Secao titulo="Decisões que você precisa tomar aqui" icone={GitBranch}>
          <div className="space-y-3">
            {conteudo.decisoesTecnicas.map((d, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface/40 p-3">
                <p className="text-sm font-medium">{d.decisao}</p>
                <p className="mt-1.5 text-sm text-foreground/90">
                  <span className="text-primary">Recomendo:</span> {d.recomendacao}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Quando não vale: {d.quandoNaoVale}
                </p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      <Secao titulo="O que costuma dar errado" icone={AlertTriangle}>
        <Lista itens={conteudo.riscos} />
      </Secao>

      <Secao titulo="Checklist" icone={ListChecks} destaque>
        <p className="mb-3 text-sm text-muted-foreground">
          Marque conforme for fazendo. Fica salvo.
        </p>
        <div className="space-y-1">
          {conteudo.checklist.map((texto, i) => {
            const feito = feitos.has(i);
            return (
              <button
                key={i}
                onClick={() => aoAlternarItem(i)}
                className="tap flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-surface/60"
              >
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2 transition-colors",
                    feito ? "border-primary bg-primary" : "border-border",
                  )}
                >
                  {feito && <Check className="size-3 text-primary-foreground" />}
                </span>
                <span
                  className={cn(
                    "text-sm leading-relaxed",
                    feito ? "text-muted-foreground line-through" : "text-foreground/90",
                  )}
                >
                  {texto}
                </span>
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao titulo="Como saber que acabou" icone={CheckCircle2}>
        <Lista itens={conteudo.criteriosDeConclusao} />
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Validação
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90">{conteudo.validacao}</p>
        </div>
      </Secao>

      {conteudo.recursos.length > 0 && (
        <Secao titulo="Onde aprender mais" icone={BookOpen}>
          <div className="space-y-2">
            {conteudo.recursos.map((r, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="font-medium text-foreground/90">{r.titulo}</span>
                <Chip tone="muted">{r.tipo}</Chip>
                <span className="text-muted-foreground">— {r.porque}</span>
              </div>
            ))}
          </div>
        </Secao>
      )}
    </div>
  );
}
