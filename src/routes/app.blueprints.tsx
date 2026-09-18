import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Blocks, Loader2, Plus, X } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import { Questionario, ResumoRespostas } from "@/components/pathly/questionario";
import { BLOCOS, blocosProntos } from "@/lib/blueprint/contrato";
import { RESPOSTAS_VAZIAS, respostasSuficientes, type Respostas } from "@/lib/blueprint/respostas";
import { criarProjeto, useProjetos } from "@/lib/blueprint/usar-projetos";

export const Route = createFileRoute("/app/blueprints")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Seus projetos — Pathly" },
      {
        name: "description",
        content: "Transforme uma ideia em um plano técnico completo, pronto para executar.",
      },
    ],
  }),
  component: TelaProjetos,
});

function TelaProjetos() {
  const navigate = useNavigate();
  const lista = useProjetos();
  const [abrindo, setAbrindo] = useState(false);
  const [respostas, setRespostas] = useState<Respostas>(RESPOSTAS_VAZIAS);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pronto = respostasSuficientes(respostas);

  async function criar() {
    if (!pronto || criando) return;
    setCriando(true);
    setErro(null);

    const r = await criarProjeto(respostas);
    if ("erro" in r) {
      setErro(r.erro);
      setCriando(false);
      return;
    }
    // Sem `setCriando(false)`: a navegação desmonta esta tela, e desligar o estado antes faria o
    // botão voltar ao normal por um instante — parecendo que nada aconteceu.
    void navigate({ to: "/app/projeto/$id", params: { id: r.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projetos"
        subtitle="Cada SaaS reúne conversa, decisões, plano técnico e execução"
        action={
          lista.estado === "pronta" && lista.projetos.length > 0 && !abrindo ? (
            <Chip tone="primary">
              <Blocks className="size-3.5" /> {lista.projetos.length}
            </Chip>
          ) : undefined
        }
      />

      {!abrindo && (
        <Reveal>
          <Btn className="w-full sm:w-auto" onClick={() => setAbrindo(true)}>
            <Plus className="size-4" /> Novo projeto
          </Btn>
        </Reveal>
      )}

      {abrindo && (
        <Reveal>
          <Panel>
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold">Vamos entender o projeto</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  São três minutos. O que você responder aqui define o plano inteiro — inclusive o
                  que ele NÃO vai incluir.
                </p>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setAbrindo(false)} title="Fechar">
                <X className="size-4" />
              </Btn>
            </header>

            <div className="mt-6">
              <Questionario respostas={respostas} aoMudar={setRespostas} />
            </div>

            {erro && <p className="mt-4 text-sm text-destructive">{erro}</p>}

            <div className="mt-6 border-t border-border pt-5">
              <Btn
                className="w-full sm:w-auto"
                disabled={!pronto || criando}
                onClick={() => void criar()}
              >
                {criando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Criando…
                  </>
                ) : (
                  <>
                    <Plus className="size-4" /> Criar projeto
                  </>
                )}
              </Btn>
              {!pronto && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Responda pelo menos o que quer criar, para quem, e qual problema resolve.
                </p>
              )}
            </div>
          </Panel>
        </Reveal>
      )}

      {lista.estado === "carregando" && (
        <p className="text-sm text-muted-foreground">Carregando seus projetos…</p>
      )}

      {lista.estado === "erro" && (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Não consegui carregar seus projetos agora. Recarregue a página.
          </p>
        </Panel>
      )}

      {lista.estado === "pronta" && lista.projetos.length === 0 && !abrindo && (
        <Panel className="text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não tem projetos. Crie o primeiro acima.
          </p>
        </Panel>
      )}

      {lista.estado === "pronta" && lista.projetos.length > 0 && (
        <div className="divide-y divide-border border-y border-border">
          {lista.projetos.map((p, i) => {
            const prontos = blocosProntos(p.conteudo);
            const completo = prontos.length === BLOCOS.length;
            return (
              <Reveal key={p.id} delay={i * 60}>
                <button
                  onClick={() =>
                    void navigate({ to: "/app/projeto/$id", params: { id: p.id } })
                  }
                  className="tap grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-5 text-left"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-semibold">{p.nome}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.ideia}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Chip tone={completo ? "primary" : "muted"}>
                        {prontos.length} de {BLOCOS.length} partes
                      </Chip>
                      {p.etapasTotal > 0 && (
                        <Chip>
                          {p.etapasConcluidas} de {p.etapasTotal} etapas
                        </Chip>
                      )}
                    </div>
                    <div className="mt-2">
                      <ResumoRespostas respostas={p.respostas} />
                    </div>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                </button>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
