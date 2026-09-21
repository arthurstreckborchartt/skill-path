import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy, Loader2, Plug, TriangleAlert, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal, SectionLabel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { DEFINICOES } from "@/lib/hub/capacidades";
import {
  ACOES,
  ADAPTADORES,
  FERRAMENTAS_FUTURAS,
  SITUACAO_ADAPTADOR,
  acoesDoAdaptador,
} from "@/lib/hub/ponte/acoes";
import {
  CONSEQUENCIA_SAIDA,
  MOTIVO_RECUSA,
  ROTULO_ESTADO,
  ROTULO_SAIDA,
  SAIDAS_DA_SIMULACAO,
  VALIDADE_PLANO_MIN,
  type EstadoPonte,
  type Plano,
  type RecusaDaPonte,
} from "@/lib/hub/ponte/contrato";
import {
  estadoDe,
  planosPendentes,
  tituloDaAcao,
  usePontes,
  type TarefaNaTela,
} from "@/lib/hub/ponte/usar-pontes";

export const Route = createFileRoute("/app/pontes")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Pontes locais — Pathly" },
      {
        name: "description",
        content: "Conecte ferramentas que rodam na sua máquina, com permissão por ação.",
      },
    ],
  }),
  component: TelaPontes,
});

/**
 * A tela das pontes locais.
 *
 * ## O que ela precisa deixar claro antes de qualquer botão
 *
 * Que a ponte é um programa que roda na máquina da pessoa, com acesso ao que ela autorizar — e
 * que ela **não executa comando**. Quem instala um agente no próprio computador merece essa frase
 * antes de instalar, não depois.
 *
 * ## O diálogo de simulação é o centro
 *
 * "Serão criados 14 elementos no modelo" com três saídas. `Visualizar` mostra item a item, e
 * existe porque aprovar um número não é aprovar uma mudança.
 */

const COR_ESTADO: Record<EstadoPonte, "primary" | "accent" | "muted" | "neutral"> = {
  online: "primary",
  ocioso: "accent",
  offline: "muted",
  revogada: "neutral",
};

// =============================================================================================
// Simulação
// =============================================================================================

function DialogoDeSimulacao({
  tarefa,
  plano,
  ocupado,
  aoDecidir,
}: {
  tarefa: TarefaNaTela;
  plano: Plano;
  ocupado: boolean;
  aoDecidir: (s: (typeof SAIDAS_DA_SIMULACAO)[number]) => void;
}) {
  const [vendo, setVendo] = useState(false);
  const restam = Math.max(
    0,
    Math.round((new Date(plano.expiraEm).getTime() - Date.now()) / 60_000),
  );

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold">{plano.resumo}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {tituloDaAcao(tarefa.acaoId)} · simulado agora, nada foi alterado
          </p>
        </div>
        <Chip tone="muted">vence em {restam} min</Chip>
      </div>

      {vendo && (
        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border bg-surface">
          <ul className="divide-y divide-border">
            {plano.mudancas.map((m, i) => (
              <li key={i} className="px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{m.operacao}</span>{" "}
                {m.alvo}
                {m.de !== undefined && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    <span className="line-through">{m.de}</span> → <strong>{m.para}</strong>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {plano.total > plano.mudancas.length && (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Mostrando {plano.mudancas.length} de {plano.total}. A execução aplica todas.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {SAIDAS_DA_SIMULACAO.map((s) => (
          <Btn
            key={s}
            size="sm"
            variant={s === "autorizar" ? "primary" : "ghost"}
            title={CONSEQUENCIA_SAIDA[s]}
            disabled={ocupado}
            onClick={() => (s === "visualizar" ? setVendo(true) : aoDecidir(s))}
          >
            {ocupado && s === "autorizar" ? <Loader2 className="size-4 animate-spin" /> : null}
            {ROTULO_SAIDA[s]}
          </Btn>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{CONSEQUENCIA_SAIDA.autorizar}</p>
    </Panel>
  );
}

// =============================================================================================
// A página
// =============================================================================================

function TelaPontes() {
  const p = usePontes();
  const [codigo, setCodigo] = useState<{ codigo: string; expiraEm: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [confirmandoRevogacao, setConfirmandoRevogacao] = useState<string | null>(null);

  if (p.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (p.estado === "erro") {
    return (
      <Panel>
        <p className="text-sm text-destructive">{p.mensagem}</p>
      </Panel>
    );
  }

  const pendentes = planosPendentes(p.tarefas);

  async function gerar() {
    const r = await p.gerarCodigo();
    if (r.ok) setCodigo({ codigo: r.codigo, expiraEm: r.expiraEm });
  }

  async function copiar(texto: string) {
    await navigator.clipboard.writeText(texto);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pontes locais"
        subtitle="Ferramentas que rodam na sua máquina, onde a nuvem não alcança"
      />

      <Reveal>
        <Panel>
          <p className="text-sm">
            Uma ponte é um programa que roda no seu computador e <strong>procura</strong> o Pathly —
            ele nunca alcança você. Ela <strong>não executa comando</strong>: só as ações que ela já
            conhece, cada uma com permissão própria, e nada que altere acontece sem você ver antes o
            que mudaria.
          </p>
        </Panel>
      </Reveal>

      {!p.instalado && (
        <Reveal delay={40}>
          <Panel>
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">As pontes ainda não estão instaladas aqui.</p>
                <p className="mt-1 text-muted-foreground">
                  Falta rodar <code className="font-mono">supabase/pathly_pontes.sql</code> no SQL
                  Editor do Supabase.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      )}

      {p.aviso && (
        <Reveal delay={50}>
          <Panel>
            <p className="text-sm">
              {p.aviso}{" "}
              <button
                type="button"
                onClick={p.limparAviso}
                className="underline underline-offset-2"
              >
                ok
              </button>
            </p>
          </Panel>
        </Reveal>
      )}

      {/* ---- Simulações esperando decisão ------------------------------------------------- */}
      {pendentes.length > 0 && (
        <Reveal delay={60}>
          <div className="space-y-3">
            <SectionLabel>Esperando a sua decisão</SectionLabel>
            {pendentes.map((t) => (
              <DialogoDeSimulacao
                key={t.id}
                tarefa={t}
                plano={t.resultado!.plano!}
                ocupado={p.ocupado}
                aoDecidir={(s) => {
                  if (s === "cancelar") void p.cancelarTarefa(t.id);
                  if (s === "autorizar") {
                    void p.autorizarPlano(
                      t.ponteId,
                      t.acaoId,
                      t.parametros,
                      t.resultado!.plano!,
                      t.id,
                      null,
                    );
                  }
                }}
              />
            ))}
          </div>
        </Reveal>
      )}

      {/* ---- Parear --------------------------------------------------------------------------- */}
      <Reveal delay={80}>
        <Panel>
          <SectionLabel>Conectar uma ponte</SectionLabel>
          {codigo ? (
            <>
              <p className="mt-2 text-sm">Rode isto na máquina onde a ferramenta está:</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm">
                  node pathly-bridge.mjs parear {codigo.codigo}
                </code>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => void copiar(`node pathly-bridge.mjs parear ${codigo.codigo}`)}
                >
                  {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                  {copiado ? "Copiado" : "Copiar"}
                </Btn>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                O código vale {VALIDADE_PLANO_MIN} minutos e um uso só. Depois de parear,{" "}
                <strong>nenhuma permissão vem concedida</strong> — você autoriza ação por ação aqui
                embaixo.
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                O Pathly gera um código, você digita na ponte, e ela recebe um token que só ela tem.
                O Pathly guarda apenas o hash dele.
              </p>
              <Btn size="sm" className="mt-3" onClick={() => void gerar()} disabled={p.ocupado}>
                {p.ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plug className="size-4" />
                )}
                Gerar código de pareamento
              </Btn>
            </>
          )}
        </Panel>
      </Reveal>

      {/* ---- As pontes -------------------------------------------------------------------------- */}
      {p.pontes.map((ponte, i) => {
        const estado = estadoDe(ponte);
        const concedidas = p.permissoes[ponte.id] ?? [];
        const relevantes = ponte.adaptadores.length
          ? ponte.adaptadores.flatMap((a) => acoesDoAdaptador(a))
          : ACOES;

        return (
          <Reveal key={ponte.id} delay={100 + i * 30}>
            <Panel>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">{ponte.nome}</h3>
                    <Chip tone={COR_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Chip>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ponte.plataforma} · v{ponte.versao} ·{" "}
                    {ponte.adaptadores.join(", ") || "nenhum adaptador"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{ponte.id}</p>
                </div>
                {!ponte.revogadaEm && (
                  <Btn variant="ghost" size="sm" onClick={() => setConfirmandoRevogacao(ponte.id)}>
                    <X className="size-4" /> Revogar
                  </Btn>
                )}
              </div>

              {confirmandoRevogacao === ponte.id && (
                <div className="mt-3 rounded-xl border border-border bg-surface p-3">
                  <p className="text-sm font-medium">Revogar esta ponte?</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Ela descobre na próxima vez que perguntar por tarefa, e sai sozinha. O Pathly
                    não consegue encerrar um programa na sua máquina — o que ele faz é parar de
                    responder.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      size="sm"
                      onClick={() => {
                        void p.revogarPonte(ponte.id);
                        setConfirmandoRevogacao(null);
                      }}
                    >
                      Revogar
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setConfirmandoRevogacao(null)}>
                      Cancelar
                    </Btn>
                  </div>
                </div>
              )}

              {!ponte.revogadaEm && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setAberta(aberta === ponte.id ? null : ponte.id)}
                    className="tap text-sm underline underline-offset-2"
                  >
                    {concedidas.length} de {relevantes.length + 1} ações autorizadas —{" "}
                    {aberta === ponte.id ? "fechar" : "ver e mudar"}
                  </button>

                  {aberta === ponte.id && (
                    <ul className="mt-3 divide-y divide-border">
                      {[
                        { id: "__conectar", capacidade: "BRIDGE_CONNECT" as const },
                        ...relevantes,
                      ].map((a) => {
                        const cap = a.capacidade;
                        const tem = concedidas.includes(cap);
                        const d = DEFINICOES[cap];
                        return (
                          <li key={cap} className="flex items-start gap-3 py-3">
                            <button
                              type="button"
                              onClick={() => void p.alternarPermissao(ponte.id, cap, !tem)}
                              className={cn(
                                "tap mt-0.5 size-5 shrink-0 rounded border",
                                tem
                                  ? "border-foreground bg-foreground text-background"
                                  : "border-border bg-surface",
                              )}
                              aria-label={d.rotulo}
                            >
                              {tem && <Check className="size-4" />}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{d.rotulo}</p>
                              <p className="text-xs text-muted-foreground">{d.oQuePermite}</p>
                              {d.naoPermite && (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  Não permite: {d.naoPermite}
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </Panel>
          </Reveal>
        );
      })}

      {/* ---- Adaptadores ------------------------------------------------------------------------ */}
      <Reveal delay={200}>
        <Panel>
          <SectionLabel>Adaptadores</SectionLabel>
          <ul className="mt-2 space-y-3">
            {ADAPTADORES.map((a) => {
              const s = SITUACAO_ADAPTADOR[a];
              return (
                <li key={a}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{a}</span>
                    <Chip tone={s?.pronto ? "accent" : "muted"}>
                      {s?.pronto ? "pronto" : "não implementado"}
                    </Chip>
                    <span className="text-xs text-muted-foreground">
                      {acoesDoAdaptador(a).length} ação(ões)
                    </span>
                  </div>
                  {s?.oQueFalta && (
                    <p className="mt-1 text-xs text-muted-foreground">{s.oQueFalta}</p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              O mesmo protocolo atende {FERRAMENTAS_FUTURAS.map((f) => f.nome).join(", ")} quando
              alguém escrever o adaptador — o que muda é o programa do outro lado, não a ponte nem a
              simulação.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* ---- Histórico ---------------------------------------------------------------------------- */}
      {p.tarefas.length > 0 && (
        <Reveal delay={220}>
          <Panel>
            <SectionLabel>O que passou pelas pontes</SectionLabel>
            <ul className="mt-2 space-y-1.5">
              {p.tarefas.slice(0, 12).map((t) => (
                <li key={t.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(t.criadaEm).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span>{tituloDaAcao(t.acaoId)}</span>
                  <Chip tone={t.estado === "concluida" ? "accent" : "muted"}>{t.estado}</Chip>
                  {t.modo === "simulacao" && (
                    <span className="text-xs text-muted-foreground">simulação</span>
                  )}
                  {t.recusa && (
                    <span className="w-full text-xs text-muted-foreground">
                      {MOTIVO_RECUSA[t.recusa as RecusaDaPonte] ?? t.recusa}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      )}
    </div>
  );
}
