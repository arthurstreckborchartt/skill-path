import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ChevronRight,
  KeyRound,
  Laptop,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  Btn,
  Chip,
  PageHeader,
  Panel,
  Reveal,
  SectionLabel,
  Skeleton,
} from "@/components/pathly/ui";
import { PontoDeEstado } from "@/components/pathly/vitrine";
import { supabase } from "@/integrations/supabase/client";
import { resumir, useVitrine } from "@/lib/hub/vitrine/usar-vitrine";
import { INTEGRACOES, acharIntegracao, pedeAtencao } from "@/lib/hub/vitrine/catalogo";
import { estadoPorBatida } from "@/lib/hub/ponte/contrato";
import { DEFINICOES } from "@/lib/hub/capacidades";
import type { Capacidade } from "@/lib/hub/capacidades";

export const Route = createFileRoute("/app/central-seguranca")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Central de segurança — Pathly" },
      {
        name: "description",
        content: "Tudo que tem acesso à sua conta, o que cada um pode fazer, e como tirar.",
      },
    ],
  }),
  component: CentralDeSeguranca,
});

/**
 * A Central de segurança.
 *
 * ## Por que ela existe separada da tela de integrações
 *
 * A tela de integrações responde "como eu conecto o Obsidian?". Esta responde a pergunta que se
 * faz num dia ruim: *o que tem acesso à minha conta agora, e como eu tiro?*
 *
 * São perguntas diferentes e merecem telas diferentes. Quem chega aqui com a segunda pergunta não
 * deveria ter que atravessar uma grade de cartões de marketing para chegar ao botão de revogar.
 *
 * ## O que ela não finge saber
 *
 * Sessões de login em outros aparelhos. O Supabase não expõe essa lista para o navegador, e um
 * painel "Seus dispositivos" preenchido com a sessão atual repetida seria pior que nenhum painel:
 * daria a impressão de que alguém está vigiando, quando ninguém está. A seção diz isso e aponta
 * para o único gesto que de fato encerra tudo.
 */
function CentralDeSeguranca() {
  const vitrine = useVitrine();
  const [confirmando, setConfirmando] = useState(false);
  const [revogados, setRevogados] = useState<number | null>(null);

  if (vitrine.estado === "carregando") {
    return (
      <div className="space-y-6">
        <PageHeader title="Central de segurança" subtitle="Lendo o que tem acesso à sua conta…" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (vitrine.estado === "erro") {
    return (
      <div className="space-y-6">
        <PageHeader title="Central de segurança" />
        <Panel className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Não consegui ler seus acessos.</p>
            <p className="mt-1 text-sm text-muted-foreground">{vitrine.mensagem}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Enquanto esta tela não carrega, ela não está dizendo que você não tem acessos ativos —
              está dizendo que não conseguiu perguntar.
            </p>
            <Btn
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => void vitrine.recarregar()}
            >
              Tentar de novo
            </Btn>
          </div>
        </Panel>
      </div>
    );
  }

  const r = resumir(vitrine);
  const agora = new Date();
  const comAtencao = INTEGRACOES.filter((i) => {
    const s = vitrine.situacoes[i.id];
    return s && pedeAtencao(s.estado);
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Central de segurança"
        subtitle="Tudo que tem acesso à sua conta, o que cada um pode fazer, e como tirar"
        action={
          <Link
            to="/app/integracoes"
            className="tap inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium coarse:h-11"
          >
            Integrações <ChevronRight className="size-4" />
          </Link>
        }
      />

      {/* ---------- As contas ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Contador rotulo="Integrações ativas" valor={r.ativas} />
        <Contador
          rotulo="Permissões vigentes"
          valor={r.permissoes}
          {...(r.permissoes === 0 ? { nota: "nenhuma concedida" } : {})}
        />
        <Contador rotulo="Credenciais guardadas" valor={r.tokens} />
        <Contador
          rotulo="Pontes online"
          valor={r.pontesOnline}
          {...(r.pontesTotal > r.pontesOnline ? { nota: `de ${r.pontesTotal} pareada(s)` } : {})}
        />
      </div>

      {r.precisamDeAtencao > 0 && (
        <Panel className="border-foreground/25">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {r.precisamDeAtencao} integração(ões) precisam de atenção.
              </p>
              <ul className="mt-2 space-y-1">
                {comAtencao.map((i) => {
                  const s = vitrine.situacoes[i.id];
                  if (!s) return null;
                  return (
                    <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-medium">{i.nome}</span>
                      <PontoDeEstado estado={s.estado} />
                      {s.detalhe && (
                        <span className="text-xs text-muted-foreground">{s.detalhe}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      {/* ---------- Permissões ---------- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Permissões concedidas</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Uma permissão é o que o Pathly pode fazer sem perguntar de novo. Ações que alteram algo
            fora do Pathly continuam pedindo aprovação, mesmo com a permissão concedida.
          </p>
        </div>

        {r.permissoes === 0 ? (
          <Panel>
            <p className="text-sm">Nenhuma permissão concedida.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              O Pathly não pode ler nem alterar nada por conta própria. É o estado mais restrito
              possível, e é onde toda conta começa.
            </p>
          </Panel>
        ) : (
          <Panel>
            <ul className="divide-y divide-border">
              {vitrine.permissoes
                .filter((p) => !p.revogada_em && (!p.expira_em || new Date(p.expira_em) > agora))
                .map((p, n) => {
                  const d = DEFINICOES[p.capacidade as Capacidade];
                  const alvo = acharIntegracao(p.provedor);
                  return (
                    <li key={`${p.provedor}-${p.capacidade}-${n}`} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{alvo?.nome ?? p.provedor}</span>
                        <Chip tone="accent">{d?.rotulo ?? p.capacidade}</Chip>
                        {p.expira_em && (
                          <span className="text-xs text-muted-foreground">
                            vence em {new Date(p.expira_em).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      {d && <p className="mt-1 text-xs text-muted-foreground">{d.oQuePermite}</p>}
                    </li>
                  );
                })}
            </ul>
          </Panel>
        )}
      </section>

      {/* ---------- Credenciais ---------- */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Credenciais guardadas</h2>
        {vitrine.conexoes.length === 0 ? (
          <Panel>
            <p className="text-sm">Nenhuma credencial sua está guardada no Pathly.</p>
          </Panel>
        ) : (
          <Panel>
            <ul className="divide-y divide-border">
              {vitrine.conexoes.map((c) => {
                const vencido = c.expira_em ? new Date(c.expira_em) <= agora : false;
                return (
                  <li key={c.provedor} className="flex flex-wrap items-center gap-2 py-3">
                    <KeyRound className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {acharIntegracao(c.provedor)?.nome ?? c.provedor}
                    </span>
                    {c.conta && <span className="text-xs text-muted-foreground">{c.conta}</span>}
                    <span className="flex-1" />
                    <Chip tone={vencido ? "primary" : "muted"}>
                      {vencido
                        ? "vencida"
                        : c.expira_em
                          ? `vence ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`
                          : "sem vencimento"}
                    </Chip>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              O Pathly nunca mostra uma credencial de volta, nem para você. Ela vai para o servidor
              no momento em que é criada e sai de lá só para falar com a ferramenta.
            </p>
          </Panel>
        )}
      </section>

      {/* ---------- Pontes ---------- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Pontes locais</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O acesso mais amplo que existe no Pathly: um programa rodando na sua máquina. Ele só
            executa as ações do catálogo, e nunca um comando qualquer — mas ainda assim é o que você
            mais deveria olhar aqui.
          </p>
        </div>

        {vitrine.pontes.filter((p) => !p.revogada_em).length === 0 ? (
          <Panel>
            <p className="text-sm">Nenhuma ponte pareada.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Nada está rodando na sua máquina em nome do Pathly.
            </p>
          </Panel>
        ) : (
          <Panel>
            <ul className="divide-y divide-border">
              {vitrine.pontes
                .filter((p) => !p.revogada_em)
                .map((p) => {
                  const est = estadoPorBatida(p.ultima_batida, p.revogada_em, agora);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 py-3">
                      <Laptop className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium">{p.nome}</span>
                      <Chip tone={est === "online" ? "accent" : "muted"}>{est}</Chip>
                      <span className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {(p.adaptadores ?? []).join(", ") || "sem adaptador"}
                      </span>
                    </li>
                  );
                })}
            </ul>
            <Link
              to="/app/pontes"
              className="tap mt-3 inline-flex items-center gap-1 text-sm underline underline-offset-2"
            >
              Gerenciar pontes <ChevronRight className="size-4" />
            </Link>
          </Panel>
        )}
      </section>

      {/* ---------- Sessões ---------- */}
      <SessaoAtual />

      {/* ---------- Ações ---------- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-display text-xl font-semibold">Últimas ações</h2>
          <span className="text-sm text-muted-foreground">
            {r.aprovadas} aprovada(s) · {r.bloqueadas} bloqueada(s)
          </span>
        </div>

        {vitrine.auditoria.length === 0 ? (
          <Panel>
            <p className="text-sm">Nada aconteceu ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando acontecer, aparece aqui — inclusive o que for recusado. Uma tentativa barrada é
              a informação mais útil desta lista.
            </p>
          </Panel>
        ) : (
          <Panel>
            <ul className="divide-y divide-border">
              {vitrine.auditoria.slice(0, 25).map((a, n) => (
                <li key={n} className="flex flex-wrap items-baseline gap-2 py-2.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(a.em).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="text-sm font-medium">
                    {acharIntegracao(a.provedor)?.nome ?? a.provedor}
                  </span>
                  <Chip tone={a.ato === "acesso-negado" ? "primary" : "muted"}>{a.ato}</Chip>
                  {a.detalhe && (
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {a.detalhe}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </section>

      {/* ---------- Revogar tudo ---------- */}
      <Reveal>
        <Panel invertido>
          <ShieldCheck className="size-5" />
          <h2 className="mt-4 max-w-2xl font-display text-2xl font-semibold">Revogar tudo</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/70">
            Tira todas as permissões, apaga todas as credenciais guardadas e desliga todas as
            pontes. O histórico continua — revogar não apaga registro, e você vai querer saber o que
            aconteceu antes.
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/70">
            Reconectar depois é possível, uma integração por vez, e nenhuma permissão volta sozinha.
          </p>

          {revogados !== null ? (
            <p className="mt-5 text-sm font-medium">
              {revogados === 0
                ? "Não havia nada para revogar."
                : `Revoguei ${revogados} acesso(s). Nada mais tem permissão nesta conta.`}
            </p>
          ) : confirmando ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-medium">
                Confirma? Isto desliga tudo de uma vez, inclusive as pontes.
              </p>
              <div className="flex flex-wrap gap-2">
                <Btn
                  size="sm"
                  variant="outline"
                  disabled={vitrine.ocupado}
                  onClick={() => {
                    void (async () => {
                      const n = await vitrine.revogarTudo();
                      setRevogados(n);
                      setConfirmando(false);
                    })();
                  }}
                >
                  {vitrine.ocupado && <Loader2 className="size-4 animate-spin" />}
                  Sim, revogar tudo
                </Btn>
                <Btn
                  size="sm"
                  variant="outline"
                  disabled={vitrine.ocupado}
                  onClick={() => setConfirmando(false)}
                >
                  Cancelar
                </Btn>
              </div>
            </div>
          ) : (
            <Btn size="sm" variant="outline" className="mt-5" onClick={() => setConfirmando(true)}>
              Revogar tudo
            </Btn>
          )}
        </Panel>
      </Reveal>
    </div>
  );
}

function Contador({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <SectionLabel>{rotulo}</SectionLabel>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{valor}</p>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

/**
 * A sessão atual — e a admissão do que não dá para mostrar.
 *
 * `getSession` só conhece a sessão deste navegador. Listar aparelhos exigiria a Admin API, que
 * mora no servidor com a chave de serviço, e não é uma chamada que o navegador possa fazer.
 */
function SessaoAtual() {
  const [info, setInfo] = useState<{ email: string; desde: string } | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo || !data.session) return;
      setInfo({
        email: data.session.user.email ?? "sua conta",
        desde: data.session.user.last_sign_in_at ?? data.session.user.created_at,
      });
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold">Sua sessão</h2>
      <Panel>
        {info ? (
          <>
            <p className="text-sm">
              <span className="font-medium">{info.email}</span>, neste navegador, desde{" "}
              {new Date(info.desde).toLocaleString("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              O Pathly não consegue listar seus outros aparelhos — essa lista não é exposta ao
              navegador, e preenchê-la com suposição seria pior que não ter. Se você suspeita de
              acesso indevido, troque a senha: isso encerra as sessões em todos os lugares.
            </p>
          </>
        ) : (
          <Skeleton className="h-10 rounded-md" />
        )}
      </Panel>
    </section>
  );
}
