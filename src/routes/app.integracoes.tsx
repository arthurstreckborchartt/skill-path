import { createFileRoute } from "@tanstack/react-router";
import { Check, Lock, Plug, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { useIntegracoes } from "@/lib/integracoes/usar-integracoes";
import {
  ROTULO_ESTADO_ACAO,
  ROTULO_IMPACTO,
  ROTULO_PROVEDOR,
  type AcaoExterna,
  type Impacto,
} from "@/lib/integracoes/contrato";
import { PROVEDORES_DISPONIVEIS } from "@/lib/integracoes/provedores";
import { Spinner } from "@/components/ui/spell-spinner";

export const Route = createFileRoute("/app/integracoes")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Integrações — Pathly" },
      {
        name: "description",
        content: "Conecte as ferramentas usadas para construir e operar seus projetos.",
      },
      { property: "og:title", content: "Integrações — Pathly" },
      {
        property: "og:description",
        content: "Ferramentas de código, conteúdo e operação conectadas ao seu projeto.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IntegrationsPage,
});

/**
 * A tela de integrações.
 *
 * ## O que ela mostra, e por quê
 *
 * Antes de aprovar, a pessoa lê **o que vai acontecer** e **para onde vai**. Um botão "autorizar"
 * sem essas duas coisas é um botão que se aprende a clicar sem ler — e esta tela existe
 * justamente para o contrário.
 *
 * Ação destrutiva aparece invertida, como os bloqueios da validação: num monocromático, inverter
 * é o que o olho acha primeiro.
 */
function IntegrationsPage() {
  const { estado, ocupado, pedir, decidir, desconectar } = useIntegracoes();

  if (estado.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando suas integrações…</p>;
  }

  if (estado.estado === "erro") {
    return (
      <Panel className="text-center">
        <p className="text-sm">{estado.mensagem}</p>
      </Panel>
    );
  }

  const conectados = new Set(estado.conexoes.map((c) => c.provedor));
  const pendentes = estado.acoes.filter((a) => a.estado === "pendente");
  const historico = estado.acoes.filter((a) => a.estado !== "pendente");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrações"
        subtitle="Conecte as ferramentas que o Pathly poderá coordenar para você"
        action={
          <Chip tone="muted">
            <ShieldCheck className="size-3" /> Sempre com aprovação
          </Chip>
        }
      />

      {!estado.instalado && (
        <Panel className="border-foreground/25">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">As integrações ainda não estão instaladas aqui.</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                As tabelas <code className="font-mono text-xs">pathly_conexoes</code> e{" "}
                <code className="font-mono text-xs">pathly_acoes_externas</code> não existem neste
                ambiente. O script está em{" "}
                <code className="font-mono text-xs">supabase/pathly_integracoes.sql</code> e precisa
                ser executado no Supabase. Até lá, nada nesta tela grava.
              </p>
            </div>
          </div>
        </Panel>
      )}

      {estado.erro && (
        <p
          role="alert"
          className="rounded-md border border-foreground/25 bg-surface-2 px-4 py-3 text-sm font-medium"
        >
          {estado.erro}
        </p>
      )}

      <Reveal>
        <Panel invertido>
          <Plug className="size-5" />
          <h2 className="mt-4 max-w-2xl font-display text-2xl font-semibold">
            Nenhuma ação externa sai daqui sem você aprovar antes.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-background/70">
            Você vê o que será enviado e para onde, e aprova uma por uma. A aprovação fica
            registrada, vale uma execução só, e o que foi recusado continua visível.
          </p>
        </Panel>
      </Reveal>

      {/* ---------- Pendentes ---------- */}
      {pendentes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Esperando você {pendentes.length > 1 && `(${pendentes.length})`}
          </h2>
          {pendentes.map((acao) => (
            <CartaoAcao
              key={acao.id}
              acao={acao}
              ocupado={ocupado === acao.id}
              onAprovar={() => void decidir(acao, "aprovada")}
              onRecusar={() => void decidir(acao, "recusada")}
            />
          ))}
        </section>
      )}

      {/* ---------- Provedores ---------- */}
      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Ferramentas</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {PROVEDORES_DISPONIVEIS.map((p, i) => {
            const conectado = conectados.has(p.id);
            const conexao = estado.conexoes.find((c) => c.provedor === p.id);

            return (
              <Reveal key={p.id} delay={i * 70}>
                <Panel className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold">{p.nome}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {p.descricao}
                      </p>
                    </div>
                    {conectado ? (
                      <Chip tone="primary">
                        <Check className="size-3" /> Conectado
                      </Chip>
                    ) : (
                      <Chip tone="muted">Não conectado</Chip>
                    )}
                  </div>

                  {conexao?.conta && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Conta: <span className="font-medium text-foreground">{conexao.conta}</span>
                      {conexao.escopos.length > 0 && ` · ${conexao.escopos.join(", ")}`}
                    </p>
                  )}

                  <div className="mt-auto pt-5">
                    {p.exigeCredencial && !conectado ? (
                      /*
                        Um botão "Conectar" que não conecta ensina a pessoa a não confiar no que a
                        tela diz. Enquanto falta a credencial no ambiente, a tela fala a verdade.
                      */
                      <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                        <Lock className="mt-0.5 size-3.5 shrink-0" />
                        Falta registrar o aplicativo OAuth e guardar o segredo no servidor. Até isso
                        existir, conectar não funcionaria — então o botão não aparece.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {p.acoes.map((a) => (
                          <Btn
                            key={a.id}
                            variant="outline"
                            size="sm"
                            disabled={!estado.instalado}
                            onClick={() => void pedir(p.id, a.id)}
                          >
                            {a.rotulo}
                          </Btn>
                        ))}
                        {conectado && (
                          <Btn variant="ghost" size="sm" onClick={() => void desconectar(p.id)}>
                            Desconectar
                          </Btn>
                        )}
                      </div>
                    )}
                  </div>
                </Panel>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ---------- Histórico ---------- */}
      {historico.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">O que já foi decidido</h2>
          <p className="text-sm text-muted-foreground">
            Inclui o que foi recusado. Saber o que o Pathly quis fazer e foi barrado é tão útil
            quanto saber o que ele fez.
          </p>
          <div className="space-y-2">
            {historico.map((acao) => (
              <CartaoAcao key={acao.id} acao={acao} ocupado={false} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const PESO_IMPACTO: Record<Impacto, string> = {
  leitura: "border-border bg-surface",
  escrita: "border-foreground/20 bg-surface-2",
  destrutiva: "border-foreground/20 bg-foreground text-background",
};

function CartaoAcao({
  acao,
  ocupado,
  onAprovar,
  onRecusar,
}: {
  acao: AcaoExterna;
  ocupado: boolean;
  onAprovar?: () => void;
  onRecusar?: () => void;
}) {
  const pendente = acao.estado === "pendente";
  const invertido = acao.impacto === "destrutiva";

  return (
    <div className={cn("rounded-md border p-4", PESO_IMPACTO[acao.impacto])}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
            invertido ? "bg-background/20" : "bg-muted text-foreground/75",
          )}
        >
          {ROTULO_IMPACTO[acao.impacto]}
        </span>
        <span className="text-sm font-medium">{ROTULO_PROVEDOR[acao.provedor]}</span>
        {!pendente && (
          <span
            className={cn("text-xs", invertido ? "text-background/65" : "text-muted-foreground")}
          >
            · {ROTULO_ESTADO_ACAO[acao.estado]}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm leading-relaxed">{acao.resumo}</p>

      {/* O destino em fonte monoespaçada: é endereço, e endereço se confere caractere a caractere. */}
      <p
        className={cn(
          "mt-2 font-mono text-xs break-all",
          invertido ? "text-background/70" : "text-muted-foreground",
        )}
      >
        {acao.destino}
      </p>

      {acao.resultado && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{acao.resultado}</p>
      )}
      {acao.erro && <p className="mt-2 text-xs leading-relaxed font-medium">{acao.erro}</p>}

      {pendente && onAprovar && onRecusar && (
        <div className="mt-4 flex gap-2">
          <Btn size="sm" disabled={ocupado} onClick={onAprovar}>
            {ocupado ? <Spinner className="size-4" /> : <Check className="size-4" />}
            Aprovar
          </Btn>
          <Btn variant="ghost" size="sm" disabled={ocupado} onClick={onRecusar}>
            <X className="size-4" /> Recusar
          </Btn>
        </div>
      )}
    </div>
  );
}
