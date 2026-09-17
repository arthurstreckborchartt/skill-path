import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import { Chip } from "./ui";
import { cn } from "@/lib/utils";
import {
  ROTULO_CATEGORIA,
  type Achado,
  type Analise,
  type Gravidade,
  type Risco,
} from "@/lib/seguranca/riscos";
import type { RiscoExtra } from "@/lib/seguranca/extras";
import type { ItemSeguranca } from "@/lib/seguranca/checklist";
import { chaveDoItem } from "@/lib/seguranca/usar-seguranca";

/**
 * As vistas da análise de segurança.
 *
 * A ordem da tela é a ordem do risco real: primeiro o que tem evidência no plano da pessoa, depois
 * o que se aplica sem evidência, e só então o que não se aplica. Listar as cinco categorias em
 * ordem alfabética daria uma tela organizada e uma prioridade errada.
 */

const COR_GRAVIDADE: Record<Gravidade, string> = {
  critico: "border-destructive/40 bg-destructive/5",
  alto: "border-destructive/25 bg-destructive/[0.03]",
  medio: "border-border bg-surface/40",
};

const ROTULO_GRAVIDADE: Record<Gravidade, string> = {
  critico: "crítico",
  alto: "alto",
  medio: "médio",
};

function tomDaGravidade(g: Gravidade) {
  return g === "medio" ? ("muted" as const) : ("accent" as const);
}

/** O cartão de um risco. Fechado mostra o problema; aberto, o que fazer. */
function CartaoRisco({
  titulo,
  categoria,
  gravidade,
  oQuePodeAcontecer,
  porqueImporta,
  comoPrevenir,
  comoValidar,
  evidencias,
  abertoInicial,
}: {
  titulo: string;
  categoria?: string;
  gravidade: Gravidade;
  oQuePodeAcontecer: string;
  porqueImporta: string;
  comoPrevenir: string[];
  comoValidar: string[];
  evidencias: string[];
  abertoInicial: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);

  return (
    <div className={cn("rounded-xl border", COR_GRAVIDADE[gravidade])}>
      <button
        onClick={() => setAberto((x) => !x)}
        className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {gravidade === "medio" ? (
              <AlertTriangle className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ShieldAlert className="size-4 shrink-0 text-destructive" />
            )}
            <h3 className="text-sm font-medium">{titulo}</h3>
            <Chip tone={tomDaGravidade(gravidade)}>{ROTULO_GRAVIDADE[gravidade]}</Chip>
            {categoria && <Chip tone="muted">{categoria}</Chip>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{oQuePodeAcontecer}</p>

          {evidencias.length > 0 && (
            <ul className="mt-3 space-y-1">
              {evidencias.map((e, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-destructive">
                  <Eye className="mt-0.5 size-3 shrink-0" />
                  <span className="leading-relaxed">{e}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="border-t border-border/60 px-4 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">{porqueImporta}</p>

          <Secao titulo="Como prevenir" itens={comoPrevenir} tom="primary" />
          <Secao titulo="Como validar" itens={comoValidar} tom="muted" />
        </div>
      )}
    </div>
  );
}

function Secao({
  titulo,
  itens,
  tom,
}: {
  titulo: string;
  itens: string[];
  tom: "primary" | "muted";
}) {
  if (itens.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </h4>
      <ul className="mt-2 space-y-1.5">
        {itens.map((x, i) => (
          <li
            key={i}
            className={cn(
              "flex items-start gap-2 text-sm leading-relaxed",
              tom === "primary" ? "text-primary" : "text-foreground/80",
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

function deRisco(r: Risco) {
  return {
    titulo: r.titulo,
    categoria: ROTULO_CATEGORIA[r.categoria],
    gravidade: r.gravidade,
    oQuePodeAcontecer: r.oQuePodeAcontecer,
    porqueImporta: r.porqueImporta,
    comoPrevenir: r.comoPrevenir,
    comoValidar: r.comoValidar,
  };
}

/** O que a análise encontrou no plano, com a evidência de cada achado. */
export function VistaConfirmados({ achados }: { achados: Achado[] }) {
  if (achados.length === 0) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 text-center">
        <ShieldCheck className="mx-auto size-8 text-primary" />
        <p className="mt-3 font-display text-lg font-semibold">
          Nenhum achado automático no seu plano.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Isso não quer dizer que está seguro — quer dizer que a análise não viu nada no que ela
          consegue ler. A lista &ldquo;A conferir&rdquo; continua valendo inteira.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {achados.map((a) => (
        <CartaoRisco
          key={a.risco.id}
          {...deRisco(a.risco)}
          evidencias={a.evidencias}
          // O que tem evidência abre sozinho: é o que já se sabe que está errado.
          abertoInicial
        />
      ))}
    </div>
  );
}

/** Os riscos que se aplicam sem evidência automática, e os específicos que a IA encontrou. */
export function VistaParaConferir({
  achados,
  extras,
}: {
  achados: Achado[];
  extras: RiscoExtra[];
}) {
  return (
    <div className="space-y-3">
      {extras.length > 0 && (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Específicos deste projeto
          </p>
          {extras.map((e, i) => (
            <CartaoRisco
              key={`extra-${i}`}
              titulo={e.titulo}
              gravidade={e.gravidade}
              oQuePodeAcontecer={e.oQuePodeAcontecer}
              porqueImporta={e.porqueImporta}
              comoPrevenir={e.comoPrevenir}
              comoValidar={e.comoValidar}
              evidencias={[]}
              abertoInicial={false}
            />
          ))}
          <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Do catálogo
          </p>
        </>
      )}

      {achados.map((a) => (
        <CartaoRisco key={a.risco.id} {...deRisco(a.risco)} evidencias={[]} abertoInicial={false} />
      ))}
    </div>
  );
}

/** O que não se aplica, com o motivo. Existe para a lista principal não virar ruído. */
export function VistaForaDoProjeto({ fora }: { fora: { risco: Risco; porque: string }[] }) {
  if (fora.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Estes riscos existem, mas não neste projeto. Ficam registrados para o dia em que ele
        crescer.
      </p>
      {fora.map(({ risco, porque }) => (
        <div key={risco.id} className="rounded-lg border border-border/60 bg-surface/30 p-3">
          <p className="text-sm">
            <span className="font-medium">{risco.titulo}</span>
            <span className="text-muted-foreground"> — {porque}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/** O que a análise alcança e o que não alcança. Nunca sai da tela. */
export function VistaLimites({ limites }: { limites: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <h3 className="text-sm font-medium">O que esta análise vê — e o que não vê</h3>
      <ul className="mt-2 space-y-1.5">
        {limites.map((l, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/80">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current" />
            <span className="min-w-0">{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * O checklist.
 *
 * A marcação é por chave, não por posição: regerar os extras muda a ordem da lista, e um checklist
 * indexado por posição marcaria o item errado depois disso.
 */
export function VistaChecklistSeguranca({
  itens,
  feitos,
  aoAlternar,
}: {
  itens: ItemSeguranca[];
  feitos: string[];
  aoAlternar: (chave: string) => void;
}) {
  const marcados = new Set(feitos);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Cada item se confere olhando o projeto, não relendo esta lista. Fica salvo.
      </p>
      <div className="mt-4 space-y-1">
        {itens.map((item) => {
          const chave = chaveDoItem(item);
          const feito = marcados.has(chave);

          return (
            <button
              key={chave}
              onClick={() => aoAlternar(chave)}
              className="tap flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface/60"
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2 transition-colors",
                  feito ? "border-primary bg-primary" : "border-border",
                )}
              >
                {feito && <Check className="size-3 text-primary-foreground" />}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      feito ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {item.texto}
                  </span>
                  <Chip tone={tomDaGravidade(item.gravidade)}>
                    {ROTULO_GRAVIDADE[item.gravidade]}
                  </Chip>
                </span>
                {item.evidencia && (
                  <span className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                    <Eye className="mt-0.5 size-3 shrink-0" />
                    <span className="leading-relaxed">{item.evidencia}</span>
                  </span>
                )}
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {item.como}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
