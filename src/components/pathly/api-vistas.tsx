import { useState } from "react";
import { AlertTriangle, ChevronDown, Lock, Gauge, ScrollText, ShieldCheck } from "lucide-react";
import { Chip } from "./ui";
import { BlocoCopiavel } from "./banco-vistas";
import { cn } from "@/lib/utils";
import {
  EXPLICACAO_AUTENTICACAO,
  EXPLICACAO_METODO,
  type Endpoint,
  type MapaApi,
  type MetodoHttp,
} from "@/lib/api/contrato";
import type { Conceito } from "@/lib/api/conceitos";

/**
 * As vistas do mapa de APIs.
 *
 * O endpoint abre e fecha porque um mapa de 7 rotas com contrato completo não cabe numa tela sem
 * virar um muro de texto. Fechado ele mostra o que identifica a rota; aberto, os doze campos.
 */

/** Cor por método, para o olho achar o verbo antes de ler o caminho. */
const COR_METODO: Record<MetodoHttp, string> = {
  GET: "bg-primary/15 text-primary",
  POST: "bg-accent/15 text-accent",
  PUT: "bg-accent/15 text-accent",
  PATCH: "bg-accent/15 text-accent",
  DELETE: "bg-destructive/15 text-destructive",
};

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {titulo}
      </h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TabelaCampos({
  campos,
  titulo,
}: {
  campos: {
    nome: string;
    tipo: string;
    obrigatorio: boolean;
    validacao: string;
    descricao: string;
    sensivel: boolean;
  }[];
  titulo: string;
}) {
  if (campos.length === 0) return null;
  return (
    <Secao titulo={titulo}>
      <div className="space-y-1.5">
        {campos.map((c) => (
          <div key={c.nome} className="rounded-lg bg-background/40 p-2.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-mono text-sm">{c.nome}</span>
              <span className="text-xs text-muted-foreground">{c.tipo}</span>
              {c.obrigatorio && <Chip tone="muted">obrigatório</Chip>}
              {c.sensivel && (
                <Chip tone="accent">
                  <Lock className="size-3" /> sensível
                </Chip>
              )}
            </div>
            {c.descricao && <p className="mt-1 text-xs text-muted-foreground">{c.descricao}</p>}
            {c.validacao && (
              <p className="mt-0.5 text-xs text-foreground/70">
                <span className="text-muted-foreground">Regra:</span> {c.validacao}
              </p>
            )}
          </div>
        ))}
      </div>
    </Secao>
  );
}

export function CartaoEndpoint({
  endpoint,
  exemplos,
  ensinando,
}: {
  endpoint: Endpoint;
  exemplos: { curl: string; resposta: string } | undefined;
  ensinando: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const e = endpoint;

  return (
    <div className="rounded-xl border border-border bg-surface/40">
      <button
        onClick={() => setAberto((x) => !x)}
        className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-0.5 font-mono text-xs font-semibold",
                COR_METODO[e.metodo],
              )}
            >
              {e.metodo}
            </span>
            <span className="font-mono text-sm text-foreground">{e.caminho}</span>
            {e.autenticacao !== "nenhuma" && (
              <Chip tone="muted">
                <Lock className="size-3" /> {e.autenticacao}
              </Chip>
            )}
            {e.limiteUso.temLimite && (
              <Chip tone="muted">
                <Gauge className="size-3" /> limite
              </Chip>
            )}
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{e.finalidade}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            aberto && "rotate-180",
          )}
        />
      </button>

      {aberto && (
        <div className="border-t border-border p-4">
          {/* No modo aprender, o significado do método vem antes do contrato. */}
          {ensinando && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <p className="text-sm text-foreground/90">
                <span className="font-mono font-semibold text-primary">{e.metodo}</span> —{" "}
                {EXPLICACAO_METODO[e.metodo]}
              </p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {EXPLICACAO_AUTENTICACAO[e.autenticacao]}
              </p>
            </div>
          )}

          {e.autorizacao && (
            <Secao titulo="Quem pode chamar">
              <p className="text-sm text-foreground/90">{e.autorizacao}</p>
            </Secao>
          )}

          <TabelaCampos campos={e.parametrosRota} titulo="Parâmetros na URL" />
          <TabelaCampos campos={e.parametrosConsulta} titulo="Parâmetros de busca" />
          <TabelaCampos campos={e.corpoRequisicao} titulo="Corpo da requisição" />

          <Secao titulo="Exemplo">
            <BlocoCopiavel texto={exemplos?.curl ?? ""} rotulo="Cole no terminal" />
          </Secao>

          <Secao titulo={`Resposta ${e.respostaSucesso.status}`}>
            <p className="mb-2 text-sm text-muted-foreground">{e.respostaSucesso.quando}</p>
            <pre className="max-h-64 select-text overflow-auto rounded-lg border border-border bg-background p-3 font-mono text-xs text-foreground/90">
              {exemplos?.resposta ?? ""}
            </pre>
          </Secao>

          <Secao titulo={`Erros — ${e.erros.length}`}>
            <div className="space-y-1.5">
              {e.erros.map((x, i) => (
                <div key={i} className="rounded-lg bg-background/40 p-2.5">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold text-destructive">
                      {x.status}
                    </span>
                    <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
                      {x.codigo}
                    </code>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{x.quando}</p>
                  <p className="mt-0.5 text-xs text-foreground/70">
                    <span className="text-muted-foreground">A pessoa lê:</span> “{x.mensagem}”
                  </p>
                </div>
              ))}
            </div>
          </Secao>

          {e.limiteUso.temLimite && (
            <Secao titulo="Limite de chamadas">
              <p className="text-sm text-foreground/90">{e.limiteUso.quanto}</p>
              {e.limiteUso.porque && (
                <p className="mt-1 text-xs text-muted-foreground">{e.limiteUso.porque}</p>
              )}
            </Secao>
          )}

          {e.logs.length > 0 && (
            <Secao titulo="O que registrar em log">
              <ul className="space-y-1">
                {e.logs.map((l, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <ScrollText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </Secao>
          )}

          {e.seguranca.length > 0 && (
            <Secao titulo="Segurança">
              <ul className="space-y-1">
                {e.seguranca.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm text-foreground/90">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
            </Secao>
          )}
        </div>
      )}
    </div>
  );
}

export function VistaMapa({
  mapa,
  exemplos,
  ensinando,
}: {
  mapa: MapaApi;
  exemplos: Map<string, { curl: string; resposta: string }>;
  ensinando: boolean;
}) {
  return (
    <div className="space-y-6">
      {mapa.convencoes.length > 0 && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            Regras que valem para toda a API
          </h3>
          <ul className="mt-2.5 space-y-1.5">
            {mapa.convencoes.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mapa.grupos.map((g) => {
        const daqui = mapa.endpoints.filter((e) => e.grupo === g.nome);
        if (daqui.length === 0) return null;
        return (
          <section key={g.nome}>
            <header>
              <h3 className="font-display text-lg font-semibold">{g.nome}</h3>
              {g.descricao && <p className="mt-0.5 text-sm text-muted-foreground">{g.descricao}</p>}
            </header>
            <div className="mt-3 space-y-2">
              {daqui.map((e) => (
                <CartaoEndpoint
                  key={e.id}
                  endpoint={e}
                  exemplos={exemplos.get(e.id)}
                  ensinando={ensinando}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Os conceitos, com a definição canônica e a ponte para o projeto.
 *
 * A definição vem do app; o "como aparece aqui" vem da IA. Separar deixa claro o que é teoria
 * estável e o que é leitura do projeto dela.
 */
export function VistaConceitos({
  conceitos,
  noProjeto,
  fora,
}: {
  conceitos: Conceito[];
  noProjeto: { conceito: string; comoApareceAqui: string }[];
  fora: { conceito: Conceito; porque: string }[];
}) {
  const ponte = new Map(noProjeto.map((x) => [x.conceito.toLowerCase(), x.comoApareceAqui]));

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Os conceitos que o seu projeto usa de verdade. Cada um com o que é, onde aparece aqui, e o
        erro que quase todo mundo comete.
      </p>

      {conceitos.map((c) => (
        <details key={c.id} className="rounded-xl border border-border bg-surface/40 p-4">
          <summary className="tap cursor-pointer list-none">
            <span className="font-display text-base font-semibold">{c.nome}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{c.resumo}</span>
          </summary>

          <div className="mt-4 space-y-3">
            {c.explicacao.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-foreground/90">
                {p}
              </p>
            ))}

            {ponte.has(c.id) && (
              <div className="rounded-lg border-l-2 border-primary/40 bg-primary/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  No seu projeto
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground/90">{ponte.get(c.id)}</p>
              </div>
            )}

            <div className="flex gap-2 rounded-lg bg-background/40 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
              <p className="text-sm leading-relaxed text-foreground/85">{c.armadilha}</p>
            </div>
          </div>
        </details>
      ))}

      {fora.length > 0 && (
        <div className="rounded-lg border border-dashed border-border p-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Conceitos que seu projeto não usa
          </h3>
          <div className="mt-3 space-y-1.5">
            {fora.map(({ conceito, porque }) => (
              <p key={conceito.id} className="text-sm">
                <span className="text-foreground/70">{conceito.nome}</span>
                <span className="text-muted-foreground"> — {porque}</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
