import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Brain, Check, RotateCcw, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel } from "@/components/pathly/ui";
import type { Pergunta } from "@/lib/ia/licao-contrato";
import {
  perguntasDaLicao,
  proximoIntervaloDias,
  registrarResposta,
  revisoesDevidas,
  type RevisaoDevida,
} from "@/lib/revisao";
import { cn } from "@/lib/utils";

/**
 * Revisão espaçada.
 *
 * Traz de volta a PERGUNTA que a pessoa errou, não a lição inteira. Reler o que já se sabe é o
 * desperdício clássico de quem estuda — o ganho de memória está em recuperar justamente o que
 * está prestes a ser esquecido.
 *
 * As perguntas não são regeradas: vêm da lição já guardada em `pathly_licoes`, pela chave. Gerar
 * de novo custaria uma chamada e, pior, produziria uma pergunta diferente da que foi errada.
 */

export const Route = createFileRoute("/app/revisar")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Revisar — Pathly" },
      {
        name: "description",
        content: "As perguntas que você errou, de volta na hora certa de lembrar.",
      },
    ],
  }),
  component: RevisarPage,
});

type Item = RevisaoDevida & { pergunta: Pergunta };

function CardRevisao({ item, onResposta }: { item: Item; onResposta: (ok: boolean) => void }) {
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const respondida = escolhida !== null;
  const acertou = respondida && item.pergunta.alternativas[escolhida]?.correta === true;

  return (
    <Panel>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone="muted">{item.tarefa}</Chip>
        {item.totalErros > 0 && (
          <Chip tone="accent">
            {item.totalErros} {item.totalErros === 1 ? "erro" : "erros"}
          </Chip>
        )}
      </div>

      <p className="mt-3 text-sm font-medium">{item.pergunta.enunciado}</p>

      <div className="mt-3 space-y-2">
        {item.pergunta.alternativas.map((alt, i) => {
          const revelar = respondida && (escolhida === i || alt.correta);
          return (
            <button
              key={alt.texto}
              disabled={respondida}
              onClick={() => {
                setEscolhida(i);
                onResposta(alt.correta === true);
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

      {respondida && (
        <p className="mt-3 text-xs text-muted-foreground">
          {acertou
            ? `Volta em ${proximoIntervaloDias(0, true)} dias ou mais, conforme você for acertando.`
            : "Volta amanhã. A escada recomeça do começo."}
        </p>
      )}
    </Panel>
  );
}

function RevisarPage() {
  const [itens, setItens] = useState<Item[] | null>(null);
  const [feitas, setFeitas] = useState(0);
  const [acertos, setAcertos] = useState(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const devidas = await revisoesDevidas();
      // As perguntas vêm da lição guardada. Uma lição apagada simplesmente some da fila em vez
      // de virar um card quebrado.
      const montados: Item[] = [];
      const cache = new Map<string, Pergunta[]>();
      for (const d of devidas) {
        let perguntas = cache.get(d.chaveLicao);
        if (!perguntas) {
          perguntas = await perguntasDaLicao(d.chaveLicao);
          cache.set(d.chaveLicao, perguntas);
        }
        const pergunta = perguntas[d.indicePergunta];
        if (pergunta) montados.push({ ...d, pergunta });
      }
      if (vivo) setItens(montados);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (itens === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Revisar" subtitle="Buscando o que está na hora de lembrar…" />
      </div>
    );
  }

  if (itens.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Revisar" subtitle="Nada para revisar agora." />
        <Panel className="text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Brain className="size-6" />
          </span>
          <p className="mt-4 text-sm text-muted-foreground">
            As perguntas que você responder nas aulas voltam aqui na hora certa — antes de você
            esquecer, não antes disso. Errou, volta amanhã; acertou, o intervalo cresce.
          </p>
          <Link to="/app/rota" className="mt-5 inline-block">
            <Btn>Ir para a rota</Btn>
          </Link>
        </Panel>
      </div>
    );
  }

  const terminou = feitas >= itens.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisar"
        subtitle={`${itens.length} ${itens.length === 1 ? "pergunta" : "perguntas"} na hora de voltar. As que você mais errou vêm primeiro.`}
        action={
          <Chip tone="primary">
            <RotateCcw className="size-3.5" /> {feitas}/{itens.length}
          </Chip>
        }
      />

      <div className="space-y-4">
        {itens.map((item) => (
          <CardRevisao
            key={`${item.chaveLicao}:${item.indicePergunta}`}
            item={item}
            onResposta={(ok) => {
              setFeitas((n) => n + 1);
              if (ok) setAcertos((n) => n + 1);
              void registrarResposta({
                chaveLicao: item.chaveLicao,
                indicePergunta: item.indicePergunta,
                tarefa: item.tarefa,
                acertou: ok,
              });
            }}
          />
        ))}
      </div>

      {terminou && (
        <Panel className="text-center">
          <p className="font-display text-lg font-semibold">
            {acertos}/{itens.length} certas
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {acertos === itens.length
              ? "Tudo lembrado. Essas perguntas voltam bem mais para a frente."
              : "As que você errou voltam amanhã — é assim que elas param de escapar."}
          </p>
        </Panel>
      )}
    </div>
  );
}
