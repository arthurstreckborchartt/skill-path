import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, FolderKanban, Loader2, Plus, ShieldCheck } from "lucide-react";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { PathlyMark } from "@/components/pathly/project-chat";
import { Btn, Chip, Panel, Reveal } from "@/components/pathly/ui";
import { criarProjeto, useProjetos } from "@/lib/blueprint/usar-projetos";
import { RESPOSTAS_VAZIAS } from "@/lib/blueprint/respostas";

export const Route = createFileRoute("/app/")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Criar um SaaS — Pathly" },
    { name: "description", content: "Descreva sua ideia e transforme-a em um plano de SaaS executável." },
    { property: "og:title", content: "Criar um SaaS — Pathly" },
    { property: "og:description", content: "Planejamento, decisões e execução coordenada em uma conversa." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CreateWorkspace,
});

function CreateWorkspace() {
  const navigate = useNavigate();
  const projects = useProjetos();
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [problem, setProblem] = useState("");
  const [step, setStep] = useState<"idea" | "details">("idea");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, [step]);

  async function create() {
    if (idea.trim().length < 15 || audience.trim().length < 5 || problem.trim().length < 15 || busy) return;
    setBusy(true);
    setError(null);
    const result = await criarProjeto({ ...RESPOSTAS_VAZIAS, oQue: idea.trim(), paraQuem: audience.trim(), problema: problem.trim() });
    if ("erro" in result) { setError(result.erro); setBusy(false); return; }
    void navigate({ to: "/app/projeto/$id", params: { id: result.id } });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12 py-4 sm:py-8">
      <section className="mx-auto max-w-3xl text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-md border border-border bg-foreground text-background"><PathlyMark className="size-5" /></span>
        <h1 className="mt-5 font-display text-3xl font-semibold text-balance sm:text-5xl">O que vamos construir?</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Descreva o SaaS com suas palavras. O Pathly organiza produto, tecnologia, segurança e execução.</p>

        <div className="chat-composer-frame mt-7 rounded-lg p-px text-left">
          <PromptInput onSubmit={({ text }) => { if (text.trim().length >= 15) { setIdea(text.trim()); setStep("details"); } }} className="border-0 bg-surface shadow-[var(--shadow-lift)]">
            <PromptInputTextarea ref={inputRef} value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ex.: Quero construir um ERP simples para pequenas indústrias…" className="min-h-28 text-base" />
            <PromptInputFooter className="justify-between">
              <span className="px-1 text-xs text-muted-foreground">Você mantém o controle de cada decisão.</span>
              <PromptInputSubmit status="ready" disabled={idea.trim().length < 15} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>

      {step === "details" && (
        <Reveal>
          <Panel className="mx-auto max-w-3xl text-left">
            <div className="flex items-start gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2"><PathlyMark className="size-4" /></span>
              <div><h2 className="font-display text-xl font-semibold">Só preciso confirmar duas coisas</h2><p className="mt-1 text-sm text-muted-foreground">Isso evita um plano genérico e define o primeiro recorte do produto.</p></div>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium">Para quem é?<textarea value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Ex.: gestores de pequenas indústrias" className="mt-2 min-h-24 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
              <label className="text-sm font-medium">Qual problema resolve?<textarea value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="Ex.: estoque, produção e pedidos ficam espalhados em planilhas" className="mt-2 min-h-24 w-full resize-none rounded-md border border-input bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Btn variant="ghost" onClick={() => setStep("idea")} disabled={busy}>Voltar</Btn>
              <Btn onClick={() => void create()} disabled={busy || audience.trim().length < 5 || problem.trim().length < 15}>{busy ? <><Loader2 className="size-4 animate-spin" /> Criando projeto…</> : <>Criar espaço do projeto <ArrowRight className="size-4" /></>}</Btn>
            </div>
          </Panel>
        </Reveal>
      )}

      <section>
        <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
          <div><p className="text-xs font-semibold uppercase text-muted-foreground">Continuar</p><h2 className="mt-1 font-display text-2xl font-semibold">Seus projetos</h2></div>
          <Link to="/app/blueprints"><Btn variant="ghost" size="sm">Ver todos <ArrowRight className="size-4" /></Btn></Link>
        </div>
        {projects.estado === "carregando" && <p className="py-6 text-sm text-muted-foreground">Carregando projetos…</p>}
        {projects.estado === "erro" && <p className="py-6 text-sm text-destructive">Não foi possível carregar seus projetos.</p>}
        {projects.estado === "pronta" && projects.projetos.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground"><Plus className="mx-auto mb-2 size-5" />Seu primeiro projeto começa na conversa acima.</div>
        )}
        {projects.estado === "pronta" && projects.projetos.length > 0 && (
          <div className="divide-y divide-border">
            {projects.projetos.slice(0, 4).map((project) => (
              <Link key={project.id} to="/app/projeto/$id" params={{ id: project.id }} className="tap grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 py-4">
                <span className="grid size-10 place-items-center rounded-md border border-border bg-surface"><FolderKanban className="size-4" /></span>
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{project.nome}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{project.ideia}</span></span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Abrir</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}