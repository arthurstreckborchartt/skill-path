import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronRight,
  Eye,
  FolderOpen,
  Loader2,
  Pencil,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Reveal, SectionLabel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
import { lerDecisoesAtivas } from "@/lib/copilot/memoria";
import { lerRegistros } from "@/lib/hub/ia/usar-ferramentas";
import {
  CONTEUDO_SINCRONIA,
  DEFINICOES_MECANISMO,
  DIRECOES,
  EXPLICACAO_DIRECAO,
  EXPLICACAO_PASSO_CONEXAO,
  PASSOS_DA_CONEXAO,
  ROTULO_CONFLITO,
  CONSEQUENCIA_CONFLITO,
  ROTULO_DIRECAO,
  ROTULO_EVENTO,
  ROTULO_PASSO_CONEXAO,
  ROTULO_SINCRONIA,
  SAIDAS_DE_CONFLITO,
  TIPOS_DE_SINCRONIA,
  type Direcao,
  type PastaAutorizada,
  type RegistroDeEvento,
  type SaidaDeConflito,
  type TipoDeSincronia,
} from "@/lib/hub/obsidian/contrato";
import { PASTAS_PROPOSTAS, caminhoDe, comoPasta } from "@/lib/hub/obsidian/estrutura";
import { diferenca } from "@/lib/hub/obsidian/nota";
import type { AcaoDeEscrita, DadosDoProjeto } from "@/lib/hub/obsidian/sincronizacao";
import { emConflito, prontasParaEscrever, resumoDoPlano } from "@/lib/hub/obsidian/sincronizacao";
import { lerEventos, useObsidian } from "@/lib/hub/obsidian/usar-obsidian";
import type { Entrada } from "@/lib/hub/obsidian/pasta";

export const Route = createFileRoute("/app/obsidian")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Obsidian — Pathly" },
      {
        name: "description",
        content: "Leve o plano, as decisões e o histórico do projeto para o seu vault.",
      },
    ],
  }),
  component: TelaObsidian,
});

/**
 * A tela do Obsidian.
 *
 * ## O que ela diz antes de qualquer botão
 *
 * Que o conteúdo do vault não sai do navegador. Não é marketing: é o que a File System Access API
 * torna verdade, e é a informação que decide se alguém conecta uma base de conhecimento pessoal a
 * um produto. Esconder isso no rodapé seria desperdiçar a melhor característica da integração.
 *
 * ## Nada vem marcado
 *
 * Nenhuma pasta autorizada, nenhum tipo ligado, sincronização automática desligada. Cada uma
 * dessas é uma decisão que a pessoa toma, com a consequência escrita ao lado — e um padrão
 * generoso aqui seria conceder acesso ao vault de alguém por omissão.
 */

// =============================================================================================
// Conexão
// =============================================================================================

function Conectar({
  suportado,
  ocupado,
  aoConectar,
}: {
  suportado: boolean;
  ocupado: boolean;
  aoConectar: () => void;
}) {
  const [passo, setPasso] = useState(0);
  const atual = PASSOS_DA_CONEXAO[passo]!;
  const ultimo = passo === PASSOS_DA_CONEXAO.length - 1;

  return (
    <Panel>
      <SectionLabel>Conectar o seu vault</SectionLabel>

      <div className="mt-3 flex items-center gap-1" aria-hidden>
        {PASSOS_DA_CONEXAO.map((p, i) => (
          <span
            key={p}
            className={cn("h-1 flex-1 rounded-full", i <= passo ? "bg-foreground" : "bg-border")}
          />
        ))}
      </div>

      <p className="mt-3 text-sm font-medium">
        {passo + 1}. {ROTULO_PASSO_CONEXAO[atual]}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{EXPLICACAO_PASSO_CONEXAO[atual]}</p>

      {atual === "detectar" && (
        <p className={cn("mt-3 text-sm", suportado ? "" : "text-destructive")}>
          {suportado
            ? "Este navegador abre o seletor de pasta. Dá para conectar."
            : "Este navegador não abre o seletor de pasta. Abra o Pathly no Chrome, Edge, Brave ou Opera para conectar o vault."}
        </p>
      )}

      {atual === "conferir-mecanismo" && (
        <ul className="mt-3 space-y-2">
          {Object.values(DEFINICOES_MECANISMO).map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-surface px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{m.nome}</span>
                <Chip tone={m.alcancavel ? "accent" : "muted"}>
                  {m.alcancavel ? "o Pathly alcança" : "fora do alcance"}
                </Chip>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{m.comoFunciona}</p>
              {m.porqueNao && <p className="mt-1 text-xs text-muted-foreground">{m.porqueNao}</p>}
            </li>
          ))}
        </ul>
      )}

      {ultimo ? (
        <Btn size="sm" className="mt-4" onClick={aoConectar} disabled={!suportado || ocupado}>
          {ocupado ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FolderOpen className="size-4" />
          )}
          Escolher a pasta do vault
        </Btn>
      ) : (
        <Btn
          size="sm"
          className="mt-4"
          variant={atual === "detectar" && !suportado ? "ghost" : "primary"}
          onClick={() => setPasso((p) => p + 1)}
          disabled={atual === "detectar" && !suportado}
        >
          Continuar <ChevronRight className="size-4" />
        </Btn>
      )}
    </Panel>
  );
}

// =============================================================================================
// Pastas
// =============================================================================================

function Pastas({
  pastas,
  entradas,
  aoMudar,
  aoAbrir,
  carregando,
}: {
  pastas: PastaAutorizada[];
  entradas: Entrada[];
  aoMudar: (p: PastaAutorizada[]) => void;
  aoAbrir: (caminho: string) => void;
  carregando: boolean;
}) {
  const achar = (caminho: string) => pastas.find((p) => p.caminho === caminho);

  function alternar(caminho: string, campo: "ler" | "escrever") {
    const atual = achar(caminho) ?? { caminho, ler: false, escrever: false };
    const novo = { ...atual, [campo]: !atual[campo] };
    /* Escrever sem ler seria escrever às cegas. Marcar escrita marca leitura junto. */
    if (campo === "escrever" && novo.escrever) novo.ler = true;
    if (campo === "ler" && !novo.ler) novo.escrever = false;

    const resto = pastas.filter((p) => p.caminho !== caminho);
    aoMudar(novo.ler || novo.escrever ? [...resto, novo] : resto);
  }

  return (
    <Panel>
      <SectionLabel>Pastas que o Pathly pode usar</SectionLabel>
      <p className="mt-1 text-sm text-muted-foreground">
        Nenhuma vem marcada. Subpasta herda da pasta acima, e o que você não marcar continua
        invisível para o Pathly.
      </p>

      {carregando ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Lendo o vault…
        </p>
      ) : entradas.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Nada para mostrar. Reabra o vault nesta aba para navegar pelas pastas.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {entradas
            .filter((e) => e.tipo === "pasta")
            .map((e) => {
              const p = achar(e.caminho);
              return (
                <li key={e.caminho} className="flex flex-wrap items-center gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => aoAbrir(e.caminho)}
                    className="tap min-w-0 flex-1 text-left text-sm"
                  >
                    <FolderOpen className="mr-1.5 inline size-3.5 text-muted-foreground" />
                    {e.caminho}
                  </button>
                  <button
                    type="button"
                    onClick={() => alternar(e.caminho, "ler")}
                    className={cn(
                      "tap rounded-full border px-2.5 py-1 text-xs",
                      p?.ler
                        ? "border-foreground/15 bg-foreground font-medium text-background"
                        : "border-border bg-surface text-foreground/80",
                    )}
                  >
                    <Eye className="mr-1 inline size-3" /> Ler
                  </button>
                  <button
                    type="button"
                    onClick={() => alternar(e.caminho, "escrever")}
                    className={cn(
                      "tap rounded-full border px-2.5 py-1 text-xs",
                      p?.escrever
                        ? "border-foreground/15 bg-foreground font-medium text-background"
                        : "border-border bg-surface text-foreground/80",
                    )}
                  >
                    <Pencil className="mr-1 inline size-3" /> Escrever
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {pastas.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sem nenhuma pasta marcada, o Pathly não lê nem escreve nada. A estrutura que ele propõe
          usa {PASTAS_PROPOSTAS.slice(0, 3).join(", ")} e mais {PASTAS_PROPOSTAS.length - 3} — mas
          você pode apontar para as suas.
        </p>
      )}
    </Panel>
  );
}

// =============================================================================================
// Conflito
// =============================================================================================

function Conflito({
  acao,
  noDisco,
  aoDecidir,
  aoFechar,
}: {
  acao: AcaoDeEscrita;
  noDisco: string;
  aoDecidir: (s: SaidaDeConflito) => void;
  aoFechar: () => void;
}) {
  const [comparando, setComparando] = useState(false);
  const linhas = comparando ? diferenca(noDisco, acao.texto ?? "") : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20">
      <div className="mx-auto min-h-full w-full max-w-2xl px-4 py-6 sm:py-10">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-lg font-semibold">
                Essa nota foi modificada desde a última sincronização.
              </p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">{acao.caminho}</p>
            </div>
            <Btn variant="ghost" size="sm" onClick={aoFechar}>
              <X className="size-4" />
            </Btn>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            Você mexeu nela no Obsidian e o Pathly também tem novidade. Escolher sozinho apagaria o
            trabalho de um dos dois.
          </p>

          {comparando && (
            <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs">
              {linhas.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    l.tipo === "so-a" && "bg-destructive/10 text-destructive",
                    l.tipo === "so-b" && "bg-primary/10",
                  )}
                >
                  {l.tipo === "igual" ? "  " : l.tipo === "so-a" ? "− " : "+ "}
                  {l.texto || " "}
                </div>
              ))}
              {linhas.length === 0 && "As duas versões são iguais linha a linha."}
            </pre>
          )}
          {comparando && (
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="text-destructive">−</span> está no vault ·{" "}
              <span className="text-primary">+</span> o Pathly escreveria
            </p>
          )}

          <div className="mt-4 space-y-2">
            {SAIDAS_DE_CONFLITO.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => (s === "comparar" ? setComparando(true) : aoDecidir(s))}
                className="tap block w-full rounded-xl border border-border bg-surface px-3 py-2 text-left"
              >
                <span className="text-sm font-medium">{ROTULO_CONFLITO[s]}</span>
                <span className="block text-xs text-muted-foreground">
                  {CONSEQUENCIA_CONFLITO[s]}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// =============================================================================================
// A página
// =============================================================================================

function TelaObsidian() {
  const o = useObsidian();
  const projetos = useProjetos();
  const [projetoId, setProjetoId] = useState<string | null>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [navegando, setNavegando] = useState("");
  const [lendoPastas, setLendoPastas] = useState(false);
  const [plano, setPlano] = useState<AcaoDeEscrita[] | null>(null);
  const [conflito, setConflito] = useState<{ acao: AcaoDeEscrita; noDisco: string } | null>(null);
  const [eventos, setEventos] = useState<RegistroDeEvento[]>([]);
  const [recado, setRecado] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);

  const lista = projetos.estado === "pronta" ? projetos.projetos : [];
  const alvo = projetoId ?? lista[0]?.id ?? null;
  if (projetoId === null && alvo !== null) setProjetoId(alvo);
  const projeto = lista.find((p) => p.id === alvo) ?? null;

  const conexao = o.estado === "pronto" ? o.conexao : null;
  const aberto = o.estado === "pronto" ? o.aberto : false;

  const navegar = useCallback(
    async (caminho: string) => {
      setLendoPastas(true);
      setNavegando(caminho);
      setEntradas(await o.listar(caminho));
      setLendoPastas(false);
    },
    [o],
  );

  useEffect(() => {
    if (aberto) void navegar("");
    void lerEventos(20).then(setEventos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  async function conectar() {
    const r = await o.conectar();
    setRecado(
      r.ok
        ? (r.aviso ??
            `Vault "${r.vault}" conectado. Agora escolha as pastas — nenhuma vem marcada.`)
        : r.motivo,
    );
    if (r.ok) await navegar("");
  }

  async function sincronizar() {
    if (!projeto) return;
    setRecado(null);

    const [decisoes, registros] = await Promise.all([
      lerDecisoesAtivas(projeto.id),
      lerRegistros(projeto.id, 60),
    ]);

    const dados: DadosDoProjeto = {
      nome: projeto.nome,
      blueprint: projeto.conteudo,
      decisoes,
      etapas: projeto.conteudo.execucao?.etapas ?? [],
      etapasConcluidas: [],
      total: projeto.etapasTotal,
      proximoPasso: null,
      registros: registros ?? [],
    };

    const r = await o.planejarSincronia(dados, projeto.id);
    if (!r.ok) return setRecado(r.motivo);
    setPlano(r.acoes);
  }

  async function escrever() {
    if (!plano || !projeto) return;
    const r = await o.aplicar(prontasParaEscrever(plano), projeto.id);
    setRecado(
      r.falhas.length
        ? `${r.escritas} nota(s) escrita(s). Falhou: ${r.falhas.join("; ")}`
        : `${r.escritas} nota(s) escrita(s) no vault.`,
    );
    setPlano(null);
    void lerEventos(20).then(setEventos);
  }

  async function abrirConflito(a: AcaoDeEscrita) {
    const atual = await o.lerNota(a.caminho);
    setConflito({ acao: a, noDisco: atual ?? "" });
  }

  async function decidirConflito(s: SaidaDeConflito) {
    if (!conflito || !projeto) return;
    if (s === "usar-pathly") {
      const r = await o.aplicar([conflito.acao], projeto.id);
      setRecado(
        r.escritas ? "Nota reescrita com os blocos do Pathly." : (r.falhas[0] ?? "Não escrevi."),
      );
    } else if (s === "usar-obsidian") {
      setRecado("Mantive o que está no vault. O Pathly não escreveu nada nesta nota.");
    } else {
      setRecado("Abra a nota no Obsidian e ajuste — o Pathly não vai escrever nela agora.");
    }
    setConflito(null);
    setPlano(null);
    void lerEventos(20).then(setEventos);
  }

  if (o.estado === "carregando") {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }
  if (o.estado === "erro") {
    return (
      <Panel>
        <p className="text-sm text-destructive">{o.mensagem}</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Obsidian"
        subtitle="O plano, as decisões e o histórico do projeto, no seu vault"
      />

      {/* A informação que decide se alguém conecta. Não fica no rodapé. */}
      <Reveal>
        <Panel>
          <p className="text-sm">
            <strong>O conteúdo do vault não sai do seu navegador.</strong> O Pathly lê, compara e
            escreve os arquivos aqui mesmo. O servidor guarda o caminho de cada nota e uma impressão
            digital de 8 caracteres — o bastante para saber se algo mudou, e insuficiente para
            reconstruir uma linha de texto. Nada do vault vai para IA nenhuma.
          </p>
        </Panel>
      </Reveal>

      {!o.instalado && (
        <Reveal delay={40}>
          <Panel>
            <div className="flex gap-3">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium">A integração ainda não está instalada aqui.</p>
                <p className="mt-1 text-muted-foreground">
                  Falta rodar <code className="font-mono">supabase/pathly_obsidian.sql</code> no SQL
                  Editor do Supabase.
                </p>
              </div>
            </div>
          </Panel>
        </Reveal>
      )}

      {recado && (
        <Reveal delay={50}>
          <Panel>
            <p className="text-sm">{recado}</p>
          </Panel>
        </Reveal>
      )}

      {!conexao ? (
        <Reveal delay={60}>
          <Conectar
            suportado={o.suportado}
            ocupado={o.ocupado}
            aoConectar={() => void conectar()}
          />
        </Reveal>
      ) : (
        <>
          <Reveal delay={60}>
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">
                    Vault <span className="font-medium">{conexao.vault}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {aberto
                      ? "Pasta aberta nesta aba."
                      : "A pasta não está aberta nesta aba — o navegador esquece a permissão ao fechar."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!aberto && (
                    <Btn size="sm" onClick={() => void o.reabrir()}>
                      <FolderOpen className="size-4" /> Reabrir o vault
                    </Btn>
                  )}
                  <Btn variant="ghost" size="sm" onClick={() => void o.desconectar()}>
                    <X className="size-4" /> Desconectar
                  </Btn>
                </div>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={80}>
            <Pastas
              pastas={conexao.pastas}
              entradas={entradas}
              carregando={lendoPastas}
              aoMudar={(p) => void o.definirPastas(p)}
              aoAbrir={(c) => void navegar(c === navegando ? "" : c)}
            />
          </Reveal>

          <Reveal delay={100}>
            <Panel>
              <SectionLabel>O que sincronizar</SectionLabel>
              <p className="mt-1 text-sm text-muted-foreground">
                Um interruptor por tipo. Todos desligados até você ligar.
              </p>
              <ul className="mt-3 divide-y divide-border">
                {TIPOS_DE_SINCRONIA.map((t) => (
                  <li key={t} className="flex items-start gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => void o.alternarTipo(t, !conexao.tipos[t])}
                      className={cn(
                        "tap mt-0.5 size-5 shrink-0 rounded border",
                        conexao.tipos[t]
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-surface",
                      )}
                      aria-label={ROTULO_SINCRONIA[t]}
                    >
                      {conexao.tipos[t] && <Check className="size-4" />}
                    </button>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ROTULO_SINCRONIA[t]}</p>
                      <p className="text-xs text-muted-foreground">{CONTEUDO_SINCRONIA[t]}</p>
                      {projeto && (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {caminhoDe(o.mapeamento, t, projeto.nome)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Reveal>

          <Reveal delay={120}>
            <Panel>
              <SectionLabel>Direção</SectionLabel>
              <div className="mt-2 space-y-2">
                {DIRECOES.map((d: Direcao) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => void o.definirDirecao(d)}
                    className={cn(
                      "tap block w-full rounded-xl border px-3 py-2 text-left",
                      conexao.direcao === d ? "border-foreground" : "border-border",
                    )}
                  >
                    <span className="text-sm font-medium">{ROTULO_DIRECAO[d]}</span>
                    <span className="block text-xs text-muted-foreground">
                      {EXPLICACAO_DIRECAO[d]}
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-4 border-t border-border pt-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={conexao.automatica}
                    onChange={(e) => void o.definirAutomatica(e.target.checked)}
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Sincronizar automaticamente</span>
                    <span className="block text-xs text-muted-foreground">
                      {conexao.automatica
                        ? `Ligada. A cada mudança no projeto, o Pathly escreve: ${
                            TIPOS_DE_SINCRONIA.filter((t) => conexao.tipos[t])
                              .map((t) => ROTULO_SINCRONIA[t].toLowerCase())
                              .join(", ") || "nada, porque nenhum tipo está ligado"
                          }. Conflito nunca é resolvido sozinho — ele para e pergunta.`
                        : "Desligada. O Pathly só escreve quando você mandar. Se ligar, ele explica aqui exatamente o que passará a escrever."}
                    </span>
                  </span>
                </label>
              </div>
            </Panel>
          </Reveal>

          <Reveal delay={140}>
            <Panel>
              <div className="flex flex-wrap items-center gap-3">
                <SectionLabel>Sincronizar agora</SectionLabel>
                {lista.length > 0 && (
                  <select
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
                )}
              </div>

              {projeto && (
                <p className="mt-2 text-xs text-muted-foreground">
                  As notas caem em <code className="font-mono">{comoPasta(projeto.nome)}</code>{" "}
                  dentro das pastas mapeadas.
                </p>
              )}

              <Btn
                size="sm"
                className="mt-3"
                onClick={() => void sincronizar()}
                disabled={!aberto || !projeto || o.ocupado}
              >
                {o.ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Ver o que mudaria
              </Btn>

              {plano && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-sm font-medium">{resumoDoPlano(plano)}</p>
                  <ul className="mt-2 space-y-1.5">
                    {plano.map((a) => (
                      <li key={a.caminho} className="flex flex-wrap items-center gap-2 text-sm">
                        <Chip
                          tone={
                            a.estado === "conflito"
                              ? "primary"
                              : a.estado === "nova"
                                ? "accent"
                                : "muted"
                          }
                        >
                          {a.estado}
                        </Chip>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs">
                          {a.caminho}
                        </span>
                        {a.estado === "conflito" && (
                          <Btn variant="ghost" size="sm" onClick={() => void abrirConflito(a)}>
                            Resolver
                          </Btn>
                        )}
                        {a.motivo && (
                          <span className="w-full text-xs text-muted-foreground">{a.motivo}</span>
                        )}
                        {a.blocosAusentes.length > 0 && (
                          <span className="w-full text-xs text-muted-foreground">
                            Marcadores apagados: {a.blocosAusentes.join(", ")}. O Pathly não os
                            recria sozinho.
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      size="sm"
                      onClick={() => void escrever()}
                      disabled={prontasParaEscrever(plano).length === 0}
                    >
                      <Check className="size-4" /> Escrever {prontasParaEscrever(plano).length}{" "}
                      nota(s)
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setPlano(null)}>
                      Cancelar
                    </Btn>
                  </div>
                  {emConflito(plano).length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      As notas em conflito ficam de fora até você decidir cada uma.
                    </p>
                  )}
                </div>
              )}
            </Panel>
          </Reveal>

          {eventos.length > 0 && (
            <Reveal delay={160}>
              <Panel>
                <SectionLabel>O que o Pathly fez no seu vault</SectionLabel>
                <ul className="mt-2 space-y-1.5">
                  {eventos.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(e.em).toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <span>{ROTULO_EVENTO[e.evento]}</span>
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                        {e.caminho}
                      </span>
                      {e.evento !== "NOTE_DELETED" && (
                        <button
                          type="button"
                          onClick={() => setApagando(e.caminho)}
                          className="tap text-xs text-muted-foreground underline underline-offset-2"
                        >
                          apagar
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            </Reveal>
          )}
        </>
      )}

      {conflito && (
        <Conflito
          acao={conflito.acao}
          noDisco={conflito.noDisco}
          aoDecidir={(s) => void decidirConflito(s)}
          aoFechar={() => setConflito(null)}
        />
      )}

      {/*
        Apagar tem tela própria, por nota, sempre. Uma autorização de apagar nunca vale para a
        próxima — é o único nível isolado desta integração.
      */}
      {apagando && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4">
          <Panel className="max-w-md">
            <p className="text-sm font-medium">Apagar esta nota do seu vault?</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{apagando}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              O Pathly não desfaz isso. Se o seu vault tiver lixeira ou versionamento, a recuperação
              é por lá.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn
                size="sm"
                onClick={async () => {
                  const r = await o.apagarNota(apagando, projeto?.id ?? null);
                  setRecado(r.ok ? "Nota apagada." : (r.motivo ?? "Não consegui apagar."));
                  setApagando(null);
                  void lerEventos(20).then(setEventos);
                }}
              >
                <X className="size-4" /> Apagar esta nota
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setApagando(null)}>
                Cancelar
              </Btn>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
