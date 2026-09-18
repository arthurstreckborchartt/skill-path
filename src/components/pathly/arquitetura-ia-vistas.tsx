import { useState } from "react";
import { Ban, ChevronDown, Clock, Coins, Radio, ShieldAlert, Sparkles, Wrench } from "lucide-react";
import { Chip } from "./ui";
import { BlocoCopiavel } from "./banco-vistas";
import { cn } from "@/lib/utils";
import {
  ROTULO_NIVEL,
  RESUMO_NIVEL,
  type Descartada,
  type Nivel,
} from "@/lib/arquitetura-ia/contrato";
import { ATUALIZADO_EM, formatarDolar } from "@/lib/arquitetura-ia/modelos";
import type { FuncionalidadeCalculada, ResumoPlano } from "@/lib/arquitetura-ia/derivados";
import type { Conceito } from "@/lib/arquitetura-ia/conceitos";

/**
 * As vistas da arquitetura de IA.
 *
 * O que esta tela mostra primeiro não é a arquitetura: é o veredito. A pergunta que o módulo
 * existe para responder é "eu preciso disso?", e responder isso embaixo de seis cartões de
 * arquitetura seria responder outra coisa.
 */

const COR_NIVEL: Record<Nivel, string> = {
  "sem-ia": "border-primary/30 bg-primary/5",
  "api-pronta": "border-primary/20 bg-primary/[0.03]",
  "llm-simples": "border-border bg-surface/40",
  rag: "border-border bg-surface/40",
  "tool-calling": "border-destructive/20 bg-destructive/[0.03]",
  // O degrau mais caro é o único que a tela pinta como alerta: é onde o dinheiro escapa.
  agente: "border-destructive/40 bg-destructive/5",
};

/** O veredito. É o primeiro conteúdo da tela, sempre. */
export function VistaVeredito({
  precisaDeIa,
  veredito,
  resumo,
}: {
  precisaDeIa: boolean;
  veredito: string;
  resumo: ResumoPlano;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-5",
        precisaDeIa ? "border-border bg-surface/50" : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-2">
        {precisaDeIa ? (
          <Sparkles className="size-4 text-primary" />
        ) : (
          <Ban className="size-4 text-primary" />
        )}
        <h2 className="font-display text-lg font-semibold">
          {precisaDeIa ? "Sim, em parte." : "Você não precisa de IA neste projeto."}
        </h2>
      </div>

      {veredito.split("\n").map((p, i) =>
        p.trim() ? (
          <p key={i} className="mt-3 text-sm leading-relaxed text-foreground/85">
            {p}
          </p>
        ) : null,
      )}

      {precisaDeIa && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip tone="primary">
            {resumo.comIa}{" "}
            {resumo.comIa === 1 ? "funcionalidade usa IA" : "funcionalidades usam IA"}
          </Chip>
          {resumo.semIa > 0 && <Chip tone="muted">{resumo.semIa} resolvida sem IA</Chip>}
          {resumo.custoMensal !== null && (
            <Chip>
              <Coins className="size-3" /> {formatarDolar(resumo.custoMensal)}/mês
            </Chip>
          )}
        </div>
      )}
    </div>
  );
}

/** O que foi cogitado e não virou IA. Vale tanto quanto o que virou. */
export function VistaDescartadas({ descartadas }: { descartadas: Descartada[] }) {
  if (descartadas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nada foi descartado: tudo que entrou na análise ou usa IA ou já estava resolvido de outro
        jeito.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Isto parece IA e não é. Cada linha economiza uma fatura mensal e um sistema para manter.
      </p>
      {descartadas.map((d) => (
        <div key={d.nome} className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <Ban className="size-4 shrink-0 text-primary" />
            <h3 className="text-sm font-medium">{d.nome}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{d.porque}</p>
          <p className="mt-2 text-sm leading-relaxed text-primary">{d.oQueUsarNoLugar}</p>
        </div>
      ))}
    </div>
  );
}

/** Um cartão por funcionalidade: fechado mostra a decisão; aberto, os treze campos. */
export function VistaFuncionalidades({ calculadas }: { calculadas: FuncionalidadeCalculada[] }) {
  if (calculadas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma funcionalidade entrou na arquitetura — veja a aba &ldquo;Sem IA&rdquo; para o que
        foi descartado e o que usar no lugar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {calculadas.map((c) => (
        <CartaoFuncionalidade key={c.f.id} c={c} />
      ))}
    </div>
  );
}

function CartaoFuncionalidade({ c }: { c: FuncionalidadeCalculada }) {
  const [aberto, setAberto] = useState(false);
  const { f, modelo, custo, latencia, observabilidade } = c;

  return (
    <div className={cn("rounded-xl border", COR_NIVEL[f.nivel])}>
      <button
        onClick={() => setAberto((x) => !x)}
        className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{f.nome}</h3>
            <Chip tone={f.nivel === "agente" ? "accent" : "muted"}>{ROTULO_NIVEL[f.nivel]}</Chip>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{f.problema}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {custo.porMes !== null && (
              <Chip tone="muted">
                <Coins className="size-3" /> {formatarDolar(custo.porMes)}/mês
              </Chip>
            )}
            <Chip tone="muted">
              <Clock className="size-3" /> {latencia.faixa}
            </Chip>
            {latencia.streaming && (
              <Chip tone="primary">
                <Radio className="size-3" /> streaming
              </Chip>
            )}
            {modelo && <Chip tone="muted">{modelo.nome}</Chip>}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="space-y-4 border-t border-border/60 px-4 py-4">
          <Campo titulo="Por que esta abordagem" texto={f.porqueEsseNivel} />
          {f.oQueNaoBasta && (
            <Campo titulo="O que o degrau abaixo não resolve" texto={f.oQueNaoBasta} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo titulo="Entra" texto={f.input} />
            <Campo titulo="Sai" texto={f.output} />
          </div>

          <Lista titulo="Contexto da chamada" itens={f.contexto} />

          <div>
            <Rotulo>Custo</Rotulo>
            <p className="mt-1 text-sm">
              <span className="font-medium">{formatarDolar(custo.porMes)} por mês</span>
              {custo.porChamada !== null && (
                <span className="text-muted-foreground">
                  {" "}
                  · {formatarDolar(custo.porChamada)} por chamada
                </span>
              )}
            </p>
            <ul className="mt-2 space-y-1">
              {custo.premissas.map((p, i) => (
                <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                  {p}
                </li>
              ))}
            </ul>
          </div>

          <Campo titulo="Latência" texto={`${latencia.faixa}. ${latencia.porque}`} />

          <Lista titulo="Segurança" itens={f.seguranca} tom="destrutivo" />
          <Lista titulo="Privacidade" itens={f.privacidade} tom="destrutivo" />
          {f.fallback && <Campo titulo="Quando a IA falhar" texto={f.fallback} />}
          <Lista titulo="Como avaliar" itens={f.comoAvaliar} />
          <Lista titulo="O que registrar" itens={observabilidade} />

          {f.promptSistema && (
            <div>
              <Rotulo>Prompt de sistema</Rotulo>
              <div className="mt-2">
                <BlocoCopiavel texto={f.promptSistema} rotulo="Guarde num arquivo versionado" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h4>
  );
}

function Campo({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div>
      <Rotulo>{titulo}</Rotulo>
      <p className="mt-1 text-sm leading-relaxed text-foreground/85">{texto}</p>
    </div>
  );
}

function Lista({ titulo, itens, tom }: { titulo: string; itens: string[]; tom?: "destrutivo" }) {
  if (itens.length === 0) return null;

  return (
    <div>
      <Rotulo>{titulo}</Rotulo>
      <ul className="mt-2 space-y-1.5">
        {itens.map((x, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 text-sm leading-relaxed",
              tom === "destrutivo" ? "text-destructive" : "text-foreground/80",
            )}
          >
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
            <span className="min-w-0">{x}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Os prompts de implementação, um por funcionalidade. */
export function VistaPromptsIa({ calculadas }: { calculadas: FuncionalidadeCalculada[] }) {
  const comIa = calculadas.filter((c) => c.f.nivel !== "sem-ia");
  const [aberto, setAberto] = useState(comIa[0]?.f.id ?? "");

  if (comIa.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma funcionalidade usa IA — não há prompt de implementação para gerar.
      </p>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Cada prompt já conhece a sua stack, as suas tabelas, os seus endpoints e a sua autenticação.
        Cole numa IA de codificação.
      </p>

      <div className="-mx-4 no-scrollbar mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {comIa.map((c) => (
          <button
            key={c.f.id}
            onClick={() => setAberto(c.f.id)}
            className={cn(
              "tap shrink-0 rounded-lg px-4 py-2 text-sm transition-colors",
              aberto === c.f.id
                ? "bg-primary/15 font-medium text-primary"
                : "bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {c.f.nome}
          </button>
        ))}
      </div>

      {comIa
        .filter((c) => c.f.id === aberto)
        .map((c) => (
          <div key={c.f.id} className="mt-4">
            <BlocoCopiavel
              texto={c.promptImplementacao}
              rotulo={`${ROTULO_NIVEL[c.f.nivel]} — ${RESUMO_NIVEL[c.f.nivel]}`}
            />
          </div>
        ))}
    </div>
  );
}

/** Os conceitos relevantes a este plano, e a lista do que ficou de fora com o motivo. */
export function VistaConceitosIa({
  conceitos,
  fora,
}: {
  conceitos: Conceito[];
  fora: { conceito: Conceito; porque: string }[];
}) {
  const [aberto, setAberto] = useState<string | null>(conceitos[0]?.id ?? null);

  /**
   * Nenhum conceito e nenhum descartado significa que o plano concluiu que não há IA.
   *
   * Sem esta mensagem a aba abre em branco, e aba em branco parece tela quebrada — a pessoa fica
   * procurando o que deu errado num resultado que está correto.
   */
  if (conceitos.length === 0 && fora.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">
        Não há conceito de IA para aprender aqui: a análise concluiu que este projeto não precisa de
        IA. Se isso mudar — e a aba &ldquo;Sem IA&rdquo; diz o que teria mudado —, os conceitos
        aparecem junto.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {conceitos.map((c) => {
        const estaAberto = aberto === c.id;
        return (
          <div key={c.id} className="rounded-xl border border-border bg-surface/40">
            <button
              onClick={() => setAberto(estaAberto ? null : c.id)}
              className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left"
            >
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{c.nome}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.resumo}</p>
              </div>
              <ChevronDown
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                  estaAberto && "rotate-180",
                )}
              />
            </button>

            {estaAberto && (
              <div className="border-t border-border/60 px-4 py-4">
                {c.explicacao.map((p, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-foreground/85 first:mt-0">
                    {p}
                  </p>
                ))}
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.03] p-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <p className="text-sm leading-relaxed text-foreground/85">
                    <span className="font-medium">A armadilha: </span>
                    {c.armadilha}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {fora.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-surface/30 p-4">
          <div className="flex items-center gap-2">
            <Wrench className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">O que ficou de fora de propósito</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Estes conceitos existem e você vai ouvir falar deles. Não estão aqui porque este plano
            não os usa — e aprender IA pelo que você não precisa é o caminho mais rápido para
            construir o que não precisava.
          </p>
          <ul className="mt-3 space-y-1.5">
            {fora.map(({ conceito, porque }) => (
              <li key={conceito.id} className="text-sm">
                <span className="font-medium">{conceito.nome}</span>
                <span className="text-muted-foreground"> — {porque}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A nota de validade do catálogo. Preço de IA cai rápido. */
export function NotaDoCatalogo() {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      Custos calculados com os preços de {ATUALIZADO_EM}, sem cache de prompt. Preço de IA muda
      rápido — confirme na página do provedor antes de decidir pelo número.
    </p>
  );
}
