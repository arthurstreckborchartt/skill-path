import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Database, GraduationCap, Loader2, RefreshCw, Wrench } from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import {
  BlocoCopiavel,
  ResumoModelo,
  VistaChecklist,
  VistaDiagnostico,
  VistaEntidades,
  VistaPrompts,
} from "@/components/pathly/banco-vistas";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import { useDerivados, useModeloDeDados, type Modo } from "@/lib/banco/usar-banco";
import { DIALETOS, ROTULO_DIALETO } from "@/lib/banco/dialetos";
import { contarPorGravidade } from "@/lib/banco/diagnostico";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/banco/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Banco de dados — Pathly" }] }),
  component: TelaBanco,
});

/**
 * As abas do módulo.
 *
 * `modelo` e `diagnostico` são para entender; `sql`, `migration`, `prompts` e `docs` são para
 * executar. O modo escolhido decide qual aba abre primeiro — não qual existe. Esconder abas faria
 * quem escolheu "aprender" precisar trocar de modo para copiar o SQL, e a ideia é o contrário:
 * ensinar e construir ao mesmo tempo.
 */
const ABAS = [
  { id: "modelo", texto: "Tabelas" },
  { id: "diagnostico", texto: "Problemas" },
  { id: "sql", texto: "SQL" },
  { id: "migration", texto: "Migration" },
  { id: "prompts", texto: "Prompts" },
  { id: "validar", texto: "Validar" },
  { id: "docs", texto: "Documentação" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function TelaBanco() {
  const { id } = Route.useParams();
  const { estado: estadoProjeto } = useProjeto(id);
  const { estado, gerando, gerar, trocarDialeto, alternarChecklist } = useModeloDeDados(id);
  const [modo, setModo] = useState<Modo>("aprender");
  const [aba, setAba] = useState<Aba>("modelo");

  const projeto = estadoProjeto.estado === "pronto" ? estadoProjeto.projeto : null;
  const modelo = estado.estado === "pronto" ? estado.modelo : null;
  const dialeto = estado.estado === "pronto" ? estado.dialeto : "postgres";

  const d = useDerivados(
    modelo,
    dialeto,
    projeto?.respostas ?? ({} as never),
    projeto?.nome ?? "projeto",
  );

  function escolherModo(novo: Modo) {
    setModo(novo);
    // O modo não esconde nada: só decide onde a pessoa cai primeiro.
    setAba(novo === "aprender" ? "modelo" : "sql");
  }

  if (estadoProjeto.estado === "carregando" || estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (!projeto) {
    return (
      <Panel className="text-center">
        <p className="text-sm text-muted-foreground">Não consegui carregar este projeto.</p>
        <Link
          to="/app/blueprints"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          Voltar para seus projetos
        </Link>
      </Panel>
    );
  }

  const cabecalho = (
    <div>
      <Link
        to="/app/blueprint/$id"
        params={{ id }}
        className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Plano do projeto
      </Link>
      <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">
        Banco de dados — {projeto.nome}
      </h1>
    </div>
  );

  if (estado.estado === "vazio" || estado.estado === "erro") {
    const semProduto = estado.estado === "erro" && estado.motivo === "sem-produto";
    return (
      <div className="space-y-6">
        {cabecalho}
        <Panel className="text-center">
          <Database className="mx-auto size-8 text-muted-foreground" />

          {estado.estado === "erro" ? (
            <p className="mt-3 text-sm text-destructive">{estado.mensagem}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-foreground/90">
                Vamos projetar o banco deste projeto.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Entidades, relacionamentos, índices e regras — com a explicação de cada decisão.
              </p>
            </>
          )}

          {semProduto ? (
            <Link
              to="/app/blueprint/$id"
              params={{ id }}
              className="mt-4 inline-block text-sm text-primary hover:underline"
            >
              Ir para o plano
            </Link>
          ) : (
            <Btn className="mt-5" disabled={gerando} onClick={() => void gerar(false)}>
              {gerando ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Projetando — leva até dois minutos
                </>
              ) : (
                <>
                  <Database className="size-4" /> Projetar o banco
                </>
              )}
            </Btn>
          )}
        </Panel>
      </div>
    );
  }

  if (!modelo || !d) return null;
  const contagem = contarPorGravidade(d.achados);

  return (
    <div className="space-y-6">
      {cabecalho}

      <Reveal>
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <ResumoModelo modelo={modelo} />
            <Btn
              variant="ghost"
              size="sm"
              disabled={gerando}
              onClick={() => void gerar(true)}
              title="Projetar de novo"
            >
              {gerando ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
            </Btn>
          </div>

          {/* A escolha que você pediu. Muda a ênfase, não o que está disponível. */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "aprender" as const,
                  titulo: "Quero aprender",
                  resumo: "Entender por que cada tabela, campo e relação existe.",
                  icone: GraduationCap,
                },
                {
                  id: "gerar" as const,
                  titulo: "Quero gerar a implementação",
                  resumo: "SQL, migration e prompts prontos para colar.",
                  icone: Wrench,
                },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                onClick={() => escolherModo(o.id)}
                className={cn(
                  "tap rounded-xl border p-4 text-left transition-colors",
                  modo === o.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-border bg-surface/40 hover:border-primary/20",
                )}
              >
                <div className="flex items-center gap-2">
                  <o.icone
                    className={cn(
                      "size-4",
                      modo === o.id ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <span className="text-sm font-medium">{o.titulo}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{o.resumo}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Banco escolhido</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DIALETOS.map((x) => (
                <button
                  key={x}
                  onClick={() => void trocarDialeto(x)}
                  className={cn(
                    "tap rounded-lg px-3.5 py-2 text-sm transition-colors",
                    dialeto === x
                      ? "bg-primary/15 font-medium text-primary"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ROTULO_DIALETO[x]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Trocar é instantâneo: o SQL é reescrito a partir do mesmo modelo, sem gerar de novo.
            </p>
            {estado.erroPersistencia && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {estado.erroPersistencia}
              </p>
            )}
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={60}>
        <div className="-mx-4 no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          {ABAS.map((x) => (
            <button
              key={x.id}
              onClick={() => setAba(x.id)}
              className={cn(
                "tap shrink-0 rounded-full px-4 py-2 text-sm transition-colors",
                aba === x.id
                  ? "bg-primary/15 font-medium text-primary"
                  : "bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {x.texto}
              {x.id === "diagnostico" && contagem.alto > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive/20 px-1.5 text-xs text-destructive">
                  {contagem.alto}
                </span>
              )}
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        {aba === "modelo" && <VistaEntidades modelo={modelo} ensinando={modo === "aprender"} />}

        {aba === "diagnostico" && <VistaDiagnostico achados={d.achados} />}

        {aba === "sql" && (
          <Panel>
            {d.avisos.length > 0 && (
              <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">
                  O que muda no {ROTULO_DIALETO[dialeto]}
                </p>
                <ul className="mt-2 space-y-1.5">
                  {d.avisos.map((a, i) => (
                    <li key={i} className="text-sm leading-relaxed text-foreground/85">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <BlocoCopiavel texto={d.sql} rotulo={`Schema completo em ${ROTULO_DIALETO[dialeto]}`} />
          </Panel>
        )}

        {aba === "migration" && (
          <Panel>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="primary">{d.nomeMigration}</Chip>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Uma migration sem volta é uma migration que ninguém tem coragem de rodar. As duas
              partes estão abaixo.
            </p>
            <div className="mt-4">
              <BlocoCopiavel texto={d.sql} rotulo="Subida — cria tudo" />
            </div>
            <div className="mt-5">
              <BlocoCopiavel texto={d.desfazer} rotulo="Descida — desfaz na ordem inversa" />
            </div>
          </Panel>
        )}

        {aba === "prompts" && (
          <Panel>
            <VistaPrompts prompts={d.prompts} />
          </Panel>
        )}

        {aba === "validar" && (
          <Panel>
            {estado.erroPersistencia && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {estado.erroPersistencia}
              </p>
            )}
            <VistaChecklist
              itens={d.checklist}
              feitos={estado.checklistFeito}
              aoAlternar={(i) => void alternarChecklist(i)}
            />
          </Panel>
        )}

        {aba === "docs" && (
          <Panel>
            <div>
              <BlocoCopiavel
                texto={d.erd}
                rotulo="Diagrama em Mermaid — cole num README e o GitHub desenha"
              />
            </div>
            <div className="mt-5">
              <BlocoCopiavel
                texto={d.documentacao}
                rotulo="Documentação das tabelas, em Markdown"
              />
            </div>
          </Panel>
        )}
      </Reveal>
    </div>
  );
}
