import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, GraduationCap, Loader2, Network, RefreshCw, Wrench } from "lucide-react";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import { BlocoCopiavel, VistaChecklist, VistaPrompts } from "@/components/pathly/banco-vistas";
import { VistaConceitos, VistaMapa } from "@/components/pathly/api-vistas";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import { useDerivadosApi, useMapaApi } from "@/lib/api/usar-api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/api/$id")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "API — Pathly" }] }),
  component: TelaApi,
});

const ABAS = [
  { id: "mapa", texto: "Endpoints" },
  { id: "conceitos", texto: "Conceitos" },
  { id: "openapi", texto: "OpenAPI" },
  { id: "prompts", texto: "Prompts" },
  { id: "testes", texto: "Testes" },
  { id: "docs", texto: "Documentação" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

type Modo = "aprender" | "gerar";

function TelaApi() {
  const { id } = Route.useParams();
  const { estado: estadoProjeto } = useProjeto(id);
  const { estado, gerando, gerar, alternarTeste } = useMapaApi(id);
  const [modo, setModo] = useState<Modo>("aprender");
  const [aba, setAba] = useState<Aba>("mapa");

  const projeto = estadoProjeto.estado === "pronto" ? estadoProjeto.projeto : null;
  const mapa = estado.estado === "pronto" ? estado.mapa : null;

  const d = useDerivadosApi(
    mapa,
    projeto?.respostas ?? ({} as never),
    projeto?.nome ?? "projeto",
    projeto?.conteudo.tecnico?.stack.backend ?? "",
  );

  function escolherModo(novo: Modo) {
    setModo(novo);
    // O modo decide onde a pessoa cai, não o que existe. Quem quer aprender começa pelos
    // conceitos; quem quer construir começa pelas rotas.
    setAba(novo === "aprender" ? "conceitos" : "mapa");
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
      <h1 className="mt-3 font-display text-2xl font-semibold sm:text-3xl">API — {projeto.nome}</h1>
    </div>
  );

  if (estado.estado === "vazio" || estado.estado === "erro") {
    const semProduto = estado.estado === "erro" && estado.motivo === "sem-produto";
    return (
      <div className="space-y-6">
        {cabecalho}
        <Panel className="text-center">
          <Network className="mx-auto size-8 text-muted-foreground" />
          {estado.estado === "erro" ? (
            <p className="mt-3 text-sm text-destructive">{estado.mensagem}</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-foreground/90">Vamos projetar a API deste projeto.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada endpoint com finalidade, contrato, erros e segurança — e os conceitos
                explicados no seu caso.
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
                  <Network className="size-4" /> Projetar a API
                </>
              )}
            </Btn>
          )}
        </Panel>
      </div>
    );
  }

  if (!mapa || !d) return null;

  const autenticados = mapa.endpoints.filter((e) => e.autenticacao !== "nenhuma").length;

  return (
    <div className="space-y-6">
      {cabecalho}

      <Reveal>
        <Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="primary">
                <Network className="size-3" /> {mapa.endpoints.length} endpoints
              </Chip>
              <Chip>
                {mapa.grupos.filter((g) => mapa.endpoints.some((e) => e.grupo === g.nome)).length}{" "}
                grupos
              </Chip>
              {autenticados > 0 && <Chip>{autenticados} protegidos</Chip>}
              <Chip tone="muted">{d.conceitos.length} conceitos</Chip>
            </div>
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

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(
              [
                {
                  id: "aprender" as const,
                  titulo: "Quero aprender",
                  resumo: "Entender o que é cada conceito, no contexto deste projeto.",
                  icone: GraduationCap,
                },
                {
                  id: "gerar" as const,
                  titulo: "Quero gerar a implementação",
                  resumo: "OpenAPI, prompts e checklist de testes prontos.",
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
            </button>
          ))}
        </div>
      </Reveal>

      <Reveal delay={120}>
        {aba === "mapa" && (
          <VistaMapa mapa={mapa} exemplos={d.exemplos} ensinando={modo === "aprender"} />
        )}

        {aba === "conceitos" && (
          <VistaConceitos
            conceitos={d.conceitos}
            noProjeto={mapa.conceitosNoProjeto}
            fora={d.conceitosFora}
          />
        )}

        {aba === "openapi" && (
          <Panel>
            <BlocoCopiavel
              texto={d.openapi}
              rotulo="OpenAPI 3.1 — abre no Swagger, Insomnia ou Postman"
            />
          </Panel>
        )}

        {aba === "prompts" && (
          <Panel>
            <VistaPrompts prompts={d.prompts} />
          </Panel>
        )}

        {aba === "testes" && (
          <Panel>
            {estado.erroPersistencia && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                {estado.erroPersistencia}
              </p>
            )}
            <VistaChecklist
              itens={d.checklist}
              feitos={estado.testesFeitos}
              aoAlternar={(i) => void alternarTeste(i)}
            />
          </Panel>
        )}

        {aba === "docs" && (
          <Panel>
            <BlocoCopiavel texto={d.documentacao} rotulo="Documentação da API, em Markdown" />
          </Panel>
        )}
      </Reveal>
    </div>
  );
}
