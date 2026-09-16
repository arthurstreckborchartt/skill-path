import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Blocks, Loader2, Plus } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal } from "@/components/pathly/ui";
import { BLOCOS, blocosProntos } from "@/lib/blueprint/contrato";
import { criarProjeto, useProjetos } from "@/lib/blueprint/usar-projetos";
import { TETOS } from "@/lib/entrada-segura";

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

/** Piso curto de propósito: "um app" não dá para planejar, e a IA inventaria o resto sozinha. */
const MINIMO_IDEIA = 15;

function TelaProjetos() {
  const navigate = useNavigate();
  const lista = useProjetos();
  const [ideia, setIdeia] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const curta = ideia.trim().length < MINIMO_IDEIA;

  async function criar() {
    if (curta || criando) return;
    setCriando(true);
    setErro(null);

    const r = await criarProjeto(ideia);
    if ("erro" in r) {
      setErro(r.erro);
      setCriando(false);
      return;
    }
    // Sem `setCriando(false)`: a navegação desmonta esta tela, e desligar o estado antes faria o
    // botão voltar ao normal por um instante — parecendo que nada aconteceu.
    void navigate({ to: "/app/blueprint/$id", params: { id: r.id } });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seus projetos"
        subtitle="De uma ideia solta a um plano técnico que dá para executar"
        action={
          lista.estado === "pronta" && lista.projetos.length > 0 ? (
            <Chip tone="primary">
              <Blocks className="size-3.5" /> {lista.projetos.length}
            </Chip>
          ) : undefined
        }
      />

      <Reveal>
        <Panel>
          <label className="block text-sm font-medium" htmlFor="ideia">
            O que você quer construir?
          </label>
          <textarea
            id="ideia"
            value={ideia}
            onChange={(e) => setIdeia(e.target.value.slice(0, TETOS.ideia))}
            rows={3}
            placeholder="Quero criar um SaaS para gerenciamento de academias"
            className="mt-2 w-full resize-none rounded-lg border border-input bg-background p-4 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Escreva com suas palavras. Quanto mais específico, melhor o plano — mas uma frase já
            basta para começar.
          </p>

          {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}

          <Btn
            className="mt-4 w-full sm:w-auto"
            disabled={curta || criando}
            onClick={() => void criar()}
          >
            {criando ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Criando…
              </>
            ) : (
              <>
                <Plus className="size-4" /> Montar o plano
              </>
            )}
          </Btn>
        </Panel>
      </Reveal>

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

      {lista.estado === "pronta" && lista.projetos.length === 0 && (
        <Panel className="text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não tem projetos. Escreva uma ideia acima para começar.
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
                  onClick={() => void navigate({ to: "/app/blueprint/$id", params: { id: p.id } })}
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
