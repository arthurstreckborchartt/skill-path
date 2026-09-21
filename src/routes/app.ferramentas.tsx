import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Check,
  Cloud,
  Database,
  ExternalLink,
  Laptop,
  Loader2,
  Plug,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal, SectionLabel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
import { useFerramentas, useFerramentaDoProjeto } from "@/lib/hub/ia/usar-ferramentas";
import { PROVEDORES_IA, comoEstaFerramentaRecebe, executaDoPathly } from "@/lib/hub/ia/catalogo";
import {
  EXPLICACAO_ENTREGA,
  EXPLICACAO_PAPEL,
  PAPEIS,
  ROTULO_CAPACIDADE_IA,
  ROTULO_ENTREGA,
  ROTULO_PAPEL,
  type AiDevelopmentProvider,
  type Papel,
} from "@/lib/hub/ia/contrato";
import { DEFINICOES } from "@/lib/hub/capacidades";

export const Route = createFileRoute("/app/ferramentas")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Ferramentas de desenvolvimento — Pathly" },
      {
        name: "description",
        content: "Escolha a ferramenta de IA que constrói cada projeto, e saiba o que ela faz.",
      },
    ],
  }),
  component: FerramentasPage,
});

/**
 * Configurações → Integrações → Ferramentas de desenvolvimento.
 *
 * ## A decisão de design desta tela
 *
 * Toda tela de integração que eu já vi mostra uma lista de logos com um botão "Conectar", e todas
 * prometem a mesma coisa sobre ferramentas que fazem coisas muito diferentes. Aqui, três das
 * quatro ferramentas rodam na máquina de quem usa, e o Pathly não as alcança. Se a tela não
 * disser isso, ela mente.
 *
 * Então cada cartão abre com **uma frase sobre o alcance real** — "o Pathly chama esta
 * ferramenta" ou "quem executa é você" — antes de qualquer capacidade. E o bloco de limitações
 * não fica escondido atrás de um "saiba mais": fica aberto, no mesmo tamanho do resto.
 *
 * O botão "Conectar" só aparece onde há o que conectar. Onde não há, o lugar dele é ocupado pelo
 * arquivo de regras, que é o que de fato faz o contexto chegar.
 */

function quando(iso: string | null): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

// =============================================================================================
// Conectar a chave da Anthropic
// =============================================================================================

function ConectarChave({
  conectado,
  conta,
  aoMudar,
}: {
  conectado: boolean;
  conta: string | null;
  aoMudar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [chave, setChave] = useState("");
  const [ocupado, setOcupado] = useState<null | "salvar" | "testar" | "revogar">(null);
  const [recado, setRecado] = useState<{ bom: boolean; texto: string } | null>(null);

  async function chamar(corpo: Record<string, unknown>) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { erro: "Sessão expirada. Entre de novo." };

    const r = await fetch("/api/ia/chave", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    return (await r.json()) as { funcionou?: boolean; motivo?: string; erro?: string };
  }

  async function salvar() {
    setOcupado("salvar");
    setRecado(null);
    const resposta = await chamar({ chave });
    setOcupado(null);

    if (resposta.erro) return setRecado({ bom: false, texto: resposta.erro });
    if (!resposta.funcionou) {
      return setRecado({ bom: false, texto: resposta.motivo ?? "A chave não funcionou." });
    }
    /*
     * A chave sai da memória da tela assim que é aceita. Ela já está cifrada no banco, e manter a
     * versão em claro num estado do React só cria uma segunda cópia para vazar.
     */
    setChave("");
    setAberto(false);
    setRecado({ bom: true, texto: "Chave testada contra a Anthropic e guardada cifrada." });
    aoMudar();
  }

  async function testarGuardada() {
    setOcupado("testar");
    setRecado(null);
    const resposta = await chamar({});
    setOcupado(null);

    if (resposta.erro) return setRecado({ bom: false, texto: resposta.erro });
    setRecado(
      resposta.funcionou
        ? { bom: true, texto: "A chave respondeu. A conexão está de pé." }
        : { bom: false, texto: resposta.motivo ?? "A chave não respondeu." },
    );
  }

  async function revogar() {
    setOcupado("revogar");
    const { error } = await supabase.from("pathly_conexoes").delete().eq("provedor", "claude-api");
    setOcupado(null);
    if (error) return setRecado({ bom: false, texto: "Não consegui apagar a chave." });
    setRecado({
      bom: true,
      texto: "Chave apagada do Pathly. Revogue também no painel da Anthropic.",
    });
    aoMudar();
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-surface p-3">
      {conectado ? (
        <>
          <p className="text-sm">
            Conectado com <span className="font-medium">{conta ?? "uma chave"}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Btn variant="ghost" size="sm" onClick={testarGuardada} disabled={ocupado !== null}>
              {ocupado === "testar" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plug className="size-4" />
              )}
              Testar conexão
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => setAberto(true)}
              disabled={ocupado !== null}
            >
              Reconectar com outra chave
            </Btn>
            <Btn variant="ghost" size="sm" onClick={revogar} disabled={ocupado !== null}>
              {ocupado === "revogar" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
              Revogar
            </Btn>
          </div>
        </>
      ) : (
        !aberto && (
          <Btn size="sm" onClick={() => setAberto(true)}>
            <Plug className="size-4" /> Conectar com uma chave da Anthropic
          </Btn>
        )
      )}

      {aberto && (
        <div className="space-y-2">
          <label className="block text-xs text-muted-foreground" htmlFor="chave-anthropic">
            Chave da API. Ela é testada antes de ser guardada, e fica cifrada — o Pathly não a
            mostra de volta depois.
          </label>
          <input
            id="chave-anthropic"
            type="password"
            value={chave}
            onChange={(e) => setChave(e.target.value)}
            placeholder="sk-ant-…"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-foreground"
          />
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" onClick={salvar} disabled={ocupado !== null || chave.trim().length < 10}>
              {ocupado === "salvar" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Testar e guardar
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                setChave("");
                setAberto(false);
              }}
            >
              Cancelar
            </Btn>
          </div>
          <p className="text-xs text-muted-foreground">
            O consumo é cobrado na sua conta da Anthropic, não na Pathly.
          </p>
        </div>
      )}

      {recado && (
        <p className={recado.bom ? "text-sm text-foreground" : "text-sm text-destructive"}>
          {recado.texto}
        </p>
      )}
    </div>
  );
}

// =============================================================================================
// O cartão de uma ferramenta
// =============================================================================================

function Cartao({
  p,
  conectado,
  conta,
  ultimoUso,
  papeis,
  aoEscolher,
  salvando,
  podeEscolher,
  travado,
  aoMudarConexao,
}: {
  p: AiDevelopmentProvider;
  conectado: boolean;
  conta: string | null;
  ultimoUso: string | null;
  papeis: Papel[];
  aoEscolher: (papel: Papel, marcar: boolean) => void;
  salvando: Papel | null;
  podeEscolher: boolean;
  /** Sem a tabela no banco, os botões aparecem apagados em vez de aceitarem e desfazerem sozinhos. */
  travado: boolean;
  aoMudarConexao: () => void;
}) {
  const chama = executaDoPathly(p);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg font-semibold">{p.nome}</h3>
            {p.local ? (
              <Chip tone="muted">
                <Laptop className="size-3" /> Roda na sua máquina
              </Chip>
            ) : (
              <Chip tone="accent">
                <Cloud className="size-3" /> Serviço remoto
              </Chip>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>
        </div>

        {chama &&
          (conectado ? (
            <Chip tone="primary">
              <Check className="size-3" /> Conectado
            </Chip>
          ) : (
            <Chip tone="neutral">Não conectado</Chip>
          ))}
      </div>

      {/* A frase sobre o alcance real, antes de qualquer capacidade. */}
      <p className="mt-3 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
        {comoEstaFerramentaRecebe(p)}
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <SectionLabel>Como o contexto chega</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-sm">
            {p.entregas.map((e) => (
              <li key={e}>
                <span className="font-medium">{ROTULO_ENTREGA[e]}</span>
                <span className="block text-xs text-muted-foreground">{EXPLICACAO_ENTREGA[e]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionLabel>O que ela sabe fazer</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.capacidades.map((c) => (
              <Chip key={c} tone="accent">
                {ROTULO_CAPACIDADE_IA[c]}
              </Chip>
            ))}
          </div>

          <div className="mt-4">
            <SectionLabel>Permissões que ela consome</SectionLabel>
          </div>
          {p.capacidadesDoHub.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhuma. O Pathly não executa nada por ela, então não há o que autorizar — quem
              autoriza cada ação é você, dentro da própria ferramenta.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.capacidadesDoHub.map((c) => (
                <Chip key={c} tone="neutral">
                  <ShieldCheck className="size-3" /> {DEFINICOES[c].rotulo}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Limitações abertas, no mesmo tamanho do resto. */}
      <div className="mt-4">
        <SectionLabel>O que ela não faz pelo Pathly</SectionLabel>
        <ul className="mt-2 space-y-1.5">
          {p.limitacoes.map((l) => (
            <li key={l} className="flex gap-2 text-sm text-muted-foreground">
              <X className="mt-0.5 size-4 shrink-0" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Última utilização: {quando(ultimoUso)}</span>
        <a
          href={p.mecanismo.fonte}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 underline underline-offset-2"
        >
          Como isto foi verificado <ExternalLink className="size-3" />
        </a>
        <span>Conferido em {p.mecanismo.verificadoEm}</span>
      </div>

      {chama && <ConectarChave conectado={conectado} conta={conta} aoMudar={aoMudarConexao} />}

      {p.arquivoDeRegras && (
        <p className="mt-3 text-xs text-muted-foreground">
          Arquivo de regras: <code className="font-mono">{p.arquivoDeRegras.caminho}</code> —{" "}
          {p.arquivoDeRegras.comoUsar}
        </p>
      )}

      {podeEscolher && (
        <div className="mt-4 border-t border-border pt-3">
          <SectionLabel>Usar esta ferramenta neste projeto</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {PAPEIS.map((papel) => {
              const marcado = papeis.includes(papel);
              return (
                <button
                  key={papel}
                  type="button"
                  onClick={() => aoEscolher(papel, !marcado)}
                  disabled={salvando !== null || travado}
                  title={EXPLICACAO_PAPEL[papel]}
                  className={cn(
                    "tap rounded-full px-3 py-1.5 text-xs",
                    marcado
                      ? "border border-foreground/15 bg-foreground font-medium text-background"
                      : "border border-border bg-surface text-foreground/80",
                    travado && "opacity-50",
                  )}
                >
                  {salvando === papel ? "…" : ROTULO_PAPEL[papel]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Cada papel pertence a uma ferramenta só — escolher aqui tira de quem estava antes.
            Principal: {EXPLICACAO_PAPEL.principal.toLowerCase()} Secundária:{" "}
            {EXPLICACAO_PAPEL.secundaria.toLowerCase()}
          </p>
        </div>
      )}
    </Panel>
  );
}

// =============================================================================================
// A página
// =============================================================================================

function FerramentasPage() {
  const projetos = useProjetos();
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const ferramentas = useFerramentas();
  const preferencias = useFerramentaDoProjeto(projetoId);

  const lista = projetos.estado === "pronta" ? projetos.projetos : [];

  /* O primeiro projeto entra selecionado: com um projeto só, escolher seria um clique inútil. */
  const alvo = projetoId ?? lista[0]?.id ?? null;
  if (projetoId === null && alvo !== null) setProjetoId(alvo);

  const prefs = preferencias.estado === "pronto" ? preferencias.preferencias : null;

  const papeisDe = (id: string): Papel[] =>
    prefs ? PAPEIS.filter((papel) => prefs[papel] === id) : [];

  async function escolher(id: string, papel: Papel, marcar: boolean) {
    await preferencias.escolher(papel, marcar ? id : null);
  }

  const semTabela =
    (ferramentas.estado === "pronto" && !ferramentas.instalado) ||
    (preferencias.estado === "pronto" && !preferencias.instalado);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ferramentas de desenvolvimento"
        subtitle="Quem escreve o código do seu projeto, e o que o Pathly consegue fazer por cada uma"
      />

      {semTabela && (
        <Reveal>
          <Panel>
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">O banco ainda não guarda estas escolhas.</p>
                <p className="mt-1 text-muted-foreground">
                  Falta rodar <code className="font-mono">supabase/pathly_hub_ferramentas.sql</code>{" "}
                  no SQL Editor do Supabase. Até lá dá para ler esta página e conectar a chave da
                  Anthropic, mas escolher a ferramenta de um projeto não vai salvar.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      )}

      {lista.length > 0 && (
        <Reveal delay={60}>
          <Panel>
            <div className="flex flex-wrap items-center gap-3">
              <Database className="size-4 shrink-0 text-muted-foreground" />
              <label htmlFor="projeto-alvo" className="text-sm">
                Escolhendo para o projeto
              </label>
              <select
                id="projeto-alvo"
                value={alvo ?? ""}
                onChange={(e) => setProjetoId(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              >
                {lista.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
          </Panel>
        </Reveal>
      )}

      {PROVEDORES_IA.map((p, i) => {
        const s = ferramentas.estado === "pronto" ? ferramentas.situacao[p.id] : undefined;
        return (
          <Reveal key={p.id} delay={80 + i * 40}>
            <Cartao
              p={p}
              conectado={s?.conectado ?? false}
              conta={s?.conta ?? null}
              ultimoUso={s?.ultimoUso ?? null}
              papeis={papeisDe(p.id)}
              salvando={preferencias.salvando}
              podeEscolher={alvo !== null}
              travado={semTabela}
              aoEscolher={(papel, marcar) => void escolher(p.id, papel, marcar)}
              aoMudarConexao={ferramentas.recarregar}
            />
          </Reveal>
        );
      })}
    </div>
  );
}
