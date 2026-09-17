import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Key,
  Link2,
  Lock,
  ShieldAlert,
  Table2,
} from "lucide-react";
import { Btn, Chip } from "./ui";
import { cn } from "@/lib/utils";
import { ROTULO_TIPO, type Entidade, type ModeloDeDados } from "@/lib/banco/contrato";
import type { Achado, Gravidade } from "@/lib/banco/diagnostico";
import type { ItemValidacao, PromptPronto } from "@/lib/banco/prompts";

/**
 * As vistas do modelo de dados.
 *
 * Todas leem o mesmo modelo. O que muda entre "Quero aprender" e "Quero gerar" não é o conteúdo —
 * é o que aparece primeiro e o que fica recolhido. Gerar duas versões custaria duas chamadas para
 * dizer a mesma coisa, e o toggle deixaria de ser instantâneo.
 */

export function BlocoCopiavel({
  texto,
  rotulo,
  linguagem,
}: {
  texto: string;
  rotulo?: string;
  linguagem?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [falhou, setFalhou] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
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
        {rotulo ? (
          <p className="text-sm text-muted-foreground">{rotulo}</p>
        ) : (
          <span className="font-mono text-xs uppercase text-muted-foreground">
            {linguagem ?? ""}
          </span>
        )}
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
      <pre className="mt-2.5 max-h-[28rem] select-text overflow-auto whitespace-pre rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-foreground/90">
        {texto}
      </pre>
      {falhou && (
        <p className="mt-2 text-xs text-muted-foreground">
          Não consegui copiar automaticamente. Selecione o texto e copie à mão.
        </p>
      )}
    </div>
  );
}

function Tabela({
  entidade,
  modelo,
  ensinando,
}: {
  entidade: Entidade;
  modelo: ModeloDeDados;
  ensinando: boolean;
}) {
  const fks = new Set(modelo.relacoes.filter((r) => r.de === entidade.nome).map((r) => r.coluna));

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Table2 className="size-4 text-primary" />
          <h3 className="font-mono text-base font-semibold text-primary">{entidade.nome}</h3>
          <Chip tone="muted">{entidade.colunas.length} colunas</Chip>
          {entidade.temSoftDelete && <Chip tone="accent">soft delete</Chip>}
          {entidade.temAuditoria && <Chip tone="accent">auditoria</Chip>}
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">{entidade.descricao}</p>
      </header>

      {/*
        "Você precisa de uma tabela X porque…" é o coração do modo aprender, então ele ganha
        destaque visual em vez de virar mais uma linha de texto.
      */}
      {ensinando && entidade.porqueExiste && (
        <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground/90">
          {entidade.porqueExiste}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {entidade.colunas.map((c) => {
          const ehPk = entidade.chavePrimaria.includes(c.nome);
          const ehFk = fks.has(c.nome);
          return (
            <div key={c.nome} className="rounded-lg bg-background/40 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-sm text-foreground">{c.nome}</span>
                <span className="text-xs text-muted-foreground">{ROTULO_TIPO[c.tipoLogico]}</span>
                {ehPk && (
                  <Chip tone="primary">
                    <Key className="size-3" /> chave
                  </Chip>
                )}
                {ehFk && (
                  <Chip tone="accent">
                    <Link2 className="size-3" /> aponta
                  </Chip>
                )}
                {c.unica && !ehPk && <Chip tone="muted">única</Chip>}
                {c.obrigatoria && !ehPk && <Chip tone="muted">obrigatória</Chip>}
                {c.sensivel && (
                  <Chip tone="accent">
                    <Lock className="size-3" /> sensível
                  </Chip>
                )}
              </div>

              {c.enumValores.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.enumValores.map((v) => (
                    <code key={v} className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                      {v}
                    </code>
                  ))}
                </div>
              )}

              {c.descricao && <p className="mt-1.5 text-xs text-muted-foreground">{c.descricao}</p>}
              {ensinando && c.porque && (
                <p className="mt-1.5 text-xs leading-relaxed text-foreground/70">{c.porque}</p>
              )}
            </div>
          );
        })}
      </div>

      {ensinando && entidade.temSoftDelete && entidade.porqueSoftDelete && (
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Por que soft delete:</span>{" "}
          {entidade.porqueSoftDelete}
        </p>
      )}
      {ensinando && entidade.temAuditoria && entidade.porqueAuditoria && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Por que auditoria:</span>{" "}
          {entidade.porqueAuditoria}
        </p>
      )}
    </div>
  );
}

export function VistaEntidades({
  modelo,
  ensinando,
}: {
  modelo: ModeloDeDados;
  ensinando: boolean;
}) {
  return (
    <div className="space-y-4">
      {ensinando && modelo.notas.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Por que este modelo é assim
          </h3>
          <ul className="mt-2.5 space-y-1.5">
            {modelo.notas.map((n, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {modelo.entidades.map((e) => (
        <Tabela key={e.nome} entidade={e} modelo={modelo} ensinando={ensinando} />
      ))}

      {modelo.relacoes.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Link2 className="size-3.5" /> Relacionamentos
          </h3>
          <div className="mt-3 space-y-3">
            {modelo.relacoes.map((r, i) => (
              <div key={i} className="rounded-lg bg-background/40 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">
                    {r.de} <span className="text-muted-foreground">→</span> {r.para}
                  </span>
                  <Chip tone="primary">{r.cardinalidade}</Chip>
                  <Chip tone="muted">ao apagar: {r.aoApagarPai}</Chip>
                </div>
                {ensinando && r.porque && (
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">{r.porque}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(modelo.indices.length > 0 || modelo.restricoes.length > 0) && (
        <div className="rounded-xl border border-border bg-surface/40 p-4 sm:p-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Índices e regras de valor
          </h3>
          <div className="mt-3 space-y-2">
            {modelo.indices.map((ix, i) => (
              <div key={`i${i}`} className="text-sm">
                <span className="font-mono text-xs text-primary">
                  {ix.unico ? "único " : "índice "}
                </span>
                <span className="font-mono text-xs">
                  {ix.tabela} ({ix.colunas.join(", ")})
                </span>
                {ensinando && ix.porque && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{ix.porque}</p>
                )}
              </div>
            ))}
            {modelo.restricoes.map((r, i) => (
              <div key={`r${i}`} className="text-sm">
                <span className="font-mono text-xs text-accent">regra </span>
                <span className="font-mono text-xs">
                  {r.tabela}: {r.expressao}
                </span>
                {ensinando && r.porque && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.porque}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const COR_GRAVIDADE: Record<Gravidade, string> = {
  alto: "border-destructive/40 bg-destructive/5",
  medio: "border-accent/30 bg-accent/5",
  baixo: "border-border bg-surface/40",
};

export function VistaDiagnostico({ achados }: { achados: Achado[] }) {
  if (achados.length === 0) {
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 text-center">
        <Check className="mx-auto size-8 text-primary" />
        <p className="mt-3 font-display text-lg font-semibold">Nada a corrigir.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          As checagens de chave, índice, dado sensível e complexidade passaram todas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {achados.map((a, i) => (
        <div key={i} className={cn("rounded-xl border p-4", COR_GRAVIDADE[a.gravidade])}>
          <div className="flex flex-wrap items-center gap-2">
            {a.gravidade === "alto" ? (
              <ShieldAlert className="size-4 text-destructive" />
            ) : (
              <AlertTriangle className="size-4 text-muted-foreground" />
            )}
            <h3 className="text-sm font-medium">{a.titulo}</h3>
            <Chip tone={a.gravidade === "alto" ? "accent" : "muted"}>{a.gravidade}</Chip>
            {a.tabela && <Chip tone="muted">{a.tabela}</Chip>}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{a.consequencia}</p>
          <p className="mt-2 text-sm leading-relaxed text-primary">{a.correcao}</p>
        </div>
      ))}
    </div>
  );
}

export function VistaPrompts({ prompts }: { prompts: PromptPronto[] }) {
  const [aberto, setAberto] = useState(prompts[0]?.id ?? "");

  return (
    <div>
      <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {prompts.map((p) => (
          <button
            key={p.id}
            onClick={() => setAberto(p.id)}
            className={cn(
              "tap shrink-0 rounded-lg px-4 py-2 text-sm transition-colors",
              aberto === p.id
                ? "bg-primary/15 font-medium text-primary"
                : "bg-surface-2 text-muted-foreground hover:text-foreground",
            )}
          >
            {p.titulo}
          </button>
        ))}
      </div>

      {prompts
        .filter((p) => p.id === aberto)
        .map((p) => (
          <div key={p.id} className="mt-4">
            <BlocoCopiavel texto={p.texto} rotulo={p.para} />
          </div>
        ))}
    </div>
  );
}

export function VistaChecklist({
  itens,
  feitos,
  aoAlternar,
}: {
  itens: ItemValidacao[];
  feitos: number[];
  aoAlternar: (i: number) => void;
}) {
  const marcados = new Set(feitos);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Cada item se confere rodando alguma coisa, não relendo o schema. Fica salvo.
      </p>
      <div className="mt-4 space-y-1">
        {itens.map((item, i) => {
          const feito = marcados.has(i);
          return (
            <button
              key={i}
              onClick={() => aoAlternar(i)}
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
                <span
                  className={cn(
                    "block text-sm font-medium",
                    feito ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {item.texto}
                </span>
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

export function ResumoModelo({ modelo }: { modelo: ModeloDeDados }) {
  const sensiveis = modelo.entidades.reduce(
    (n, e) => n + e.colunas.filter((c) => c.sensivel).length,
    0,
  );

  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="primary">
        <Database className="size-3" /> {modelo.entidades.length} tabelas
      </Chip>
      <Chip>{modelo.relacoes.length} relações</Chip>
      <Chip>{modelo.indices.length} índices</Chip>
      {modelo.restricoes.length > 0 && <Chip>{modelo.restricoes.length} regras</Chip>}
      {sensiveis > 0 && (
        <Chip tone="accent">
          <Lock className="size-3" /> {sensiveis} sensíveis
        </Chip>
      )}
    </div>
  );
}
