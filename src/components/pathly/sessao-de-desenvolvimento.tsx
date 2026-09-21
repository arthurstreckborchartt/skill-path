import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  Loader2,
  Play,
  RotateCcw,
  TriangleAlert,
  X,
} from "lucide-react";
import { Btn, Chip, Panel, SectionLabel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Blueprint, Etapa } from "@/lib/blueprint/contrato";
import { useModeloDeDados } from "@/lib/banco/usar-banco";
import { useMapaApi } from "@/lib/api/usar-api";
import { lerDecisoesAtivas, registrarDecisao } from "@/lib/copilot/memoria";
import type { Decisao } from "@/lib/copilot/contrato";
import { acharProvedor, conteudoDoArquivoDeRegras } from "@/lib/hub/ia/catalogo";
import { PROVEDORES_IA } from "@/lib/hub/ia/catalogo";
import { montarPacote } from "@/lib/hub/ia/contexto";
import {
  ROTULO_ORIGEM,
  errosConhecidosDe,
  registrosDaResposta,
  type RegistroDeTrabalho,
} from "@/lib/hub/ia/retorno";
import {
  gravarRegistros,
  lerRegistros,
  useFerramentaDoProjeto,
} from "@/lib/hub/ia/usar-ferramentas";
import {
  ROTULO_PASSO,
  PASSOS_DO_FLUXO,
  explicarPasso,
  posicaoDoPasso,
  type Passo,
} from "@/lib/hub/sessao/contrato";
import {
  briefEmTexto,
  completudeDoBrief,
  montarBrief,
  secoesVaziasDoBrief,
  type ExecutionBrief,
} from "@/lib/hub/sessao/brief";
import {
  CONSEQUENCIA_SAIDA,
  EXPLICACAO_STATUS,
  PASSO_DEPOIS_DA_SAIDA,
  PERGUNTA_DA_SAIDA,
  PERGUNTA_DE_SAIDA,
  RESPOSTAS_DE_SAIDA,
  RESPOSTA_EQUIVALENTE,
  ROTULO_SAIDA,
  ROTULO_STATUS,
  analisarResultado,
  passoDepoisDoResultado,
  registrosDoResultado,
  type ResultadoDaSessao,
  type RespostaDeSaida,
} from "@/lib/hub/sessao/resultado";
import { duracao, montarLinhaDoTempo, voltas } from "@/lib/hub/sessao/linha-do-tempo";
import { lerAprovacoesDaTarefa, useSessao } from "@/lib/hub/sessao/usar-sessao";

/**
 * A Development Session — a tela da orquestração.
 *
 * ## O que esta tela recusa a ser
 *
 * Um botão "fazer". O Pathly orquestra contexto, planejamento e estado; quem escreve código é a
 * ferramenta, e em três dos quatro casos ela roda numa máquina que a nuvem não alcança.
 *
 * Então a tela é uma sequência de passos em que **a pessoa avança cada um**. Nenhum acontece
 * sozinho, nem os inofensivos. Uma sessão que corre até `executar` por conta própria coloca quem
 * usa na posição de interromper o produto em vez de conduzi-lo — e é assim que alguém autoriza
 * sem querer.
 *
 * ## Por que o fluxo tem voltas
 *
 * Porque desenvolvimento tem. Teste que falha devolve para a execução; validação que reprova
 * também. Um fluxo só de ida obrigaria a cancelar e recomeçar — e o histórico diria que a etapa
 * saiu de primeira, apagando exatamente o que a próxima estimativa precisava saber.
 */

// =============================================================================================
// Peças
// =============================================================================================

function Trilho({ passo }: { passo: Passo }) {
  const atual = posicaoDoPasso(passo);
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {PASSOS_DO_FLUXO.map((p, i) => (
        <span
          key={p}
          title={ROTULO_PASSO[p]}
          className={cn(
            "h-1 flex-1 rounded-full",
            i < atual ? "bg-foreground" : i === atual ? "bg-foreground/60" : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function Campo({ titulo, itens }: { titulo: string; itens: readonly string[] }) {
  if (itens.length === 0) return null;
  return (
    <div className="mt-3">
      <SectionLabel>{titulo}</SectionLabel>
      <ul className="mt-1 space-y-1">
        {itens.map((x) => (
          <li key={x} className="text-sm text-muted-foreground">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LinhaDoTempo({ eventos }: { eventos: ReturnType<typeof montarLinhaDoTempo> }) {
  if (eventos.length === 0) return null;
  return (
    <ol className="mt-3 space-y-0">
      {eventos.map((e, i) => (
        <li key={`${e.em}-${i}`} className="grid grid-cols-[3.2rem_auto_minmax(0,1fr)] gap-x-3">
          <span className="pt-2 font-mono text-xs text-muted-foreground">{e.hora}</span>
          {/* A régua: ponto e fio. O fio some no último, senão a lista parece continuar. */}
          <span className="relative flex justify-center">
            <span
              className={cn(
                "mt-2.5 size-2 shrink-0 rounded-full",
                e.ruim ? "bg-destructive" : "bg-foreground/40",
              )}
            />
            {i < eventos.length - 1 && <span className="absolute top-5 bottom-0 w-px bg-border" />}
          </span>
          <div className="pt-1.5 pb-3">
            <p className={cn("text-sm", e.ruim && "text-destructive")}>
              {e.titulo}
              {e.origem && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({ROTULO_ORIGEM[e.origem]})
                </span>
              )}
            </p>
            {e.detalhe && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{e.detalhe}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// =============================================================================================
// Receber o resultado
// =============================================================================================

function ReceberResultado({
  aoResultado,
  aoResponder,
  ocupado,
}: {
  aoResultado: (r: ResultadoDaSessao) => void;
  aoResponder: (r: RespostaDeSaida, texto: string) => void;
  ocupado: boolean;
}) {
  /*
   * Colar é o padrão, inclusive para ferramenta remota: enquanto o Pathly não executa ninguém de
   * fato, todo resultado chega pela mão de quem trabalhou. Quando a execução por API existir, o
   * caminho dela não passa por esta tela — chega em `registrarResultado` com origem `ferramenta`.
   */
  const [modo, setModo] = useState<"colar" | "perguntas">("colar");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [escolha, setEscolha] = useState<RespostaDeSaida | null>(null);
  const [resposta, setResposta] = useState("");

  function analisar() {
    /*
     * `colado` e não `ferramenta`: o texto é da ferramenta, mas quem o trouxe foi a pessoa, e o
     * Pathly não viu acontecer. O histórico guarda essa diferença porque é ela que decide quanto
     * vale um "os testes passaram" daqui a seis semanas.
     */
    const a = analisarResultado(texto, "colado");
    if (!a.ok) return setErro(a.motivo);
    setErro(null);
    aoResultado(a.resultado);
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModo("colar")}
          className={cn(
            "tap rounded-full px-3 py-1.5 text-xs",
            modo === "colar"
              ? "border border-foreground/15 bg-foreground font-medium text-background"
              : "border border-border bg-surface text-foreground/80",
          )}
        >
          Colar o bloco de resultado
        </button>
        <button
          type="button"
          onClick={() => setModo("perguntas")}
          className={cn(
            "tap rounded-full px-3 py-1.5 text-xs",
            modo === "perguntas"
              ? "border border-foreground/15 bg-foreground font-medium text-background"
              : "border border-border bg-surface text-foreground/80",
          )}
        >
          Responder quatro perguntas
        </button>
      </div>

      {modo === "colar" ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            O brief pediu à ferramenta um bloco com STATUS, CHANGES, FILES, TESTS, ERRORS, DECISIONS
            e NEXT_STEP. Cole aqui o que ela escreveu — o Pathly separa os campos.
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={6}
            placeholder={"STATUS: sucesso\nCHANGES: ...\nFILES: ..."}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-foreground"
          />
          <Btn size="sm" onClick={analisar} disabled={ocupado || !texto.trim()}>
            {ocupado ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Clipboard className="size-4" />
            )}
            Ler o resultado
          </Btn>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-sm font-medium">{PERGUNTA_DE_SAIDA}</p>
          <div className="flex flex-wrap gap-2">
            {RESPOSTAS_DE_SAIDA.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setEscolha(escolha === r ? null : r)}
                title={CONSEQUENCIA_SAIDA[r]}
                className={cn(
                  "tap rounded-full px-3 py-1.5 text-xs",
                  escolha === r
                    ? "border border-foreground/15 bg-foreground font-medium text-background"
                    : "border border-border bg-surface text-foreground/80",
                )}
              >
                {ROTULO_SAIDA[r]}
              </button>
            ))}
          </div>

          {escolha && (
            <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
              <p className="text-xs text-muted-foreground">{CONSEQUENCIA_SAIDA[escolha]}</p>
              <label className="block text-sm font-medium" htmlFor="resposta-saida">
                {PERGUNTA_DA_SAIDA[escolha]}
              </label>
              <textarea
                id="resposta-saida"
                value={resposta}
                onChange={(e) => setResposta(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground"
              />
              <Btn size="sm" onClick={() => aoResponder(escolha, resposta)} disabled={ocupado}>
                {ocupado ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Registrar
              </Btn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================================
// A sessão
// =============================================================================================

export function SessaoDeDesenvolvimento({
  projetoId,
  nomeProjeto,
  blueprint,
  etapa,
  etapasConcluidas,
  etapasTotal,
}: {
  projetoId: string;
  nomeProjeto: string;
  blueprint: Blueprint;
  etapa: Etapa;
  etapasConcluidas: number;
  etapasTotal: number;
}) {
  const taskId = `etapa:${etapa.ordem}`;
  const s = useSessao(projetoId, taskId);
  const banco = useModeloDeDados(projetoId);
  const api = useMapaApi(projetoId);
  const preferencias = useFerramentaDoProjeto(projetoId);

  const [decisoes, setDecisoes] = useState<Decisao[]>([]);
  const [registros, setRegistros] = useState<RegistroDeTrabalho[]>([]);
  const [aprovacoes, setAprovacoes] = useState<
    { id: string; action: string; status: string; approved_at: string | null }[]
  >([]);
  const [copiado, setCopiado] = useState(false);
  const [criteriosOk, setCriteriosOk] = useState<number[]>([]);

  const recarregarApoio = useCallback(async () => {
    const [d, r, a] = await Promise.all([
      lerDecisoesAtivas(projetoId),
      lerRegistros(projetoId, 40),
      lerAprovacoesDaTarefa(taskId),
    ]);
    setDecisoes(d);
    setRegistros(r ?? []);
    setAprovacoes(a);
  }, [projetoId, taskId]);

  useEffect(() => {
    void recarregarApoio();
  }, [recarregarApoio]);

  const sessao = s.estado === "pronto" ? s.sessao : null;
  const instalado = s.estado === "pronto" ? s.instalado : true;

  const provedorPreferido =
    preferencias.estado === "pronto" ? preferencias.preferencias.principal : null;
  const provedorId = sessao?.provider ?? provedorPreferido;
  const provedor = provedorId ? acharProvedor(provedorId) : null;

  /*
   * O brief vivo, recalculado do estado atual. Diferente de `context_snapshot`, que é o congelado
   * — e a diferença entre os dois é justamente o que mudou desde a entrega.
   */
  const briefVivo: ExecutionBrief = useMemo(
    () =>
      montarBrief({
        nomeProjeto,
        blueprint,
        modelo: banco.estado.estado === "pronto" ? banco.estado.modelo : null,
        api: api.estado.estado === "pronto" ? api.estado.mapa : null,
        decisoes,
        etapa,
        etapasConcluidas,
        etapasTotal,
        errosConhecidos: errosConhecidosDe(registros),
        pedirResultadoEstruturado: true,
      }),
    [nomeProjeto, blueprint, banco, api, decisoes, etapa, etapasConcluidas, etapasTotal, registros],
  );

  /*
   * Dois briefs, e a distinção só aparece depois da primeira volta.
   *
   * `brief` é o **registro**: o congelado, que responde "o que a ferramenta sabia quando fez
   * isso?". É o que a tela mostra e o que fica no banco.
   *
   * `briefVivo` é o que vai para a ferramenta agora. Depois de um teste falhar, os dois divergem —
   * e é justamente aí que importa: reenviar o congelado mandaria de volta um brief sem o erro que
   * acabou de acontecer, anulando a seção `KNOWN ERRORS` na única hora em que ela vale alguma
   * coisa.
   */
  const brief = (sessao?.contextSnapshot as ExecutionBrief | null) ?? briefVivo;
  const textoDoBrief = briefEmTexto(brief);
  const textoVivo = briefEmTexto(briefVivo);
  const briefMudou = textoVivo !== textoDoBrief;
  const completude = completudeDoBrief(brief);
  const vazias = secoesVaziasDoBrief(brief).filter(
    (k) => k !== "KNOWN_ERRORS" && k !== "EXPECTED_RESULT",
  );

  const linha = sessao
    ? montarLinhaDoTempo({ sessao, registros, aprovacoes, nomeDoProvedor: provedor?.nome ?? null })
    : [];

  async function copiar(vivo = false) {
    await navigator.clipboard.writeText(vivo ? textoVivo : textoDoBrief);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  }

  function baixarRegras() {
    if (!provedor?.arquivoDeRegras) return;
    const pacote = montarPacote({
      nomeProjeto,
      blueprint,
      modelo: banco.estado.estado === "pronto" ? banco.estado.modelo : null,
      api: api.estado.estado === "pronto" ? api.estado.mapa : null,
      decisoes,
      etapa,
      etapasConcluidas,
      etapasTotal,
      errosConhecidos: errosConhecidosDe(registros),
    });
    const url = URL.createObjectURL(
      new Blob([conteudoDoArquivoDeRegras(provedor, pacote, nomeProjeto)], {
        type: "text/markdown",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = provedor.arquivoDeRegras.caminho.split("/").pop() ?? "pathly.md";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function aoResultado(r: ResultadoDaSessao) {
    await gravarRegistros(
      registrosDoResultado(r, provedorId ?? "sem-ferramenta"),
      projetoId,
      etapa.ordem,
    );
    await s.registrarResultado(r, passoDepoisDoResultado(r.status));
    await recarregarApoio();
  }

  async function aoResponder(resposta: RespostaDeSaida, texto: string) {
    const equivalente = RESPOSTA_EQUIVALENTE[resposta];
    if (equivalente) {
      const novos = registrosDaResposta(
        { resposta: equivalente, texto },
        provedorId ?? "sem-ferramenta",
      );
      await gravarRegistros(novos, projetoId, etapa.ordem);
    }
    await s.avancar(PASSO_DEPOIS_DA_SAIDA[resposta]);
    await recarregarApoio();
  }

  /** As decisões da sessão viram decisões do projeto. É o passo `atualizar-blueprint`. */
  async function levarDecisoesParaOPlano() {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) {
      for (const [i, d] of sessao!.technicalDecisions.entries()) {
        await registrarDecisao(projetoId, userId, {
          chave: `sessao:${taskId}:${i}`,
          titulo: `Decisão da etapa ${etapa.ordem}`,
          valor: d,
          motivo: `Tomada durante a execução de "${etapa.titulo}".`,
          origem: "usuario",
          /*
           * Não nasce confirmada. A decisão veio de uma ferramenta trabalhando, não de alguém
           * escolhendo — e o Copilot trata decisão confirmada como assunto encerrado.
           */
          confirmada: false,
        });
      }
    }
    await s.avancar("concluida");
    await recarregarApoio();
  }

  // ---- Sem tabela ----------------------------------------------------------------------------

  if (!instalado) {
    return (
      <section className="mt-6 border-t border-border pt-5">
        <div className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">A orquestração ainda não está instalada aqui.</p>
            <p className="mt-1 text-muted-foreground">
              Falta rodar <code className="font-mono">supabase/pathly_hub_sessoes.sql</code> no SQL
              Editor do Supabase. Até lá dá para copiar o contexto, mas a sessão não abre.
            </p>
            <Btn variant="ghost" size="sm" className="mt-3" onClick={() => void copiar()}>
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar o Execution Brief"}
            </Btn>
          </div>
        </div>
      </section>
    );
  }

  // ---- Sem sessão aberta ---------------------------------------------------------------------

  if (!sessao) {
    const anteriores = s.estado === "pronto" ? s.anteriores : [];
    return (
      <section className="mt-6 border-t border-border pt-5">
        <SectionLabel>Sessão de desenvolvimento</SectionLabel>
        <p className="mt-2 text-sm text-muted-foreground">
          Uma sessão acompanha esta etapa do planejamento ao blueprint atualizado: prepara o
          contexto, registra o que a ferramenta fez, guarda o que falhou e leva as decisões para o
          plano. O Pathly não executa nada — ele segura o fio.
        </p>

        {anteriores.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {anteriores.length} sessão(ões) anterior(es) nesta etapa. A última terminou em{" "}
            {ROTULO_PASSO[anteriores[0]!.currentStep].toLowerCase()}.
          </p>
        )}

        {/*
          O histórico continua visível sem sessão aberta. Ele é o que faz alguém que voltou depois
          de duas semanas lembrar onde parou — e some justamente quando some a sessão, que é o pior
          momento possível para sumir.
        */}
        {registros.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {registros.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(r.em).toLocaleDateString("pt-BR")}
                </span>
                <span className="min-w-0 flex-1">{r.texto}</span>
                <span className="text-xs text-muted-foreground">({ROTULO_ORIGEM[r.origem]})</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Btn size="sm" onClick={() => void s.abrir()} disabled={s.ocupado}>
            {s.ocupado ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Começar a trabalhar nesta etapa
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => void copiar()}>
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado" : "Só copiar o contexto"}
          </Btn>
        </div>
        {s.aviso && <p className="mt-2 text-sm text-destructive">{s.aviso}</p>}
      </section>
    );
  }

  // ---- A sessão em andamento -------------------------------------------------------------------

  const passo = sessao.currentStep;
  const resultado = sessao.result as ResultadoDaSessao | null;
  const criterios = brief.ACCEPTANCE_CRITERIA;

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Sessão de desenvolvimento</SectionLabel>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{duracao(sessao)}</span>
          {voltas(sessao) > 0 && (
            <Chip tone="muted">
              {voltas(sessao)} volta{voltas(sessao) === 1 ? "" : "s"}
            </Chip>
          )}
        </div>
      </div>

      <div className="mt-3">
        <Trilho passo={passo} />
        <p className="mt-2 text-sm font-medium">{ROTULO_PASSO[passo]}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{explicarPasso(passo, provedor)}</p>
      </div>

      <div className="mt-4">
        {/* ---- 1. planejar ---------------------------------------------------------------- */}
        {passo === "planejar" && (
          <>
            <p className="text-sm">
              Etapa {etapa.ordem} de {etapasTotal}: <strong>{etapa.titulo}</strong>
            </p>
            {etapa.entrega && (
              <p className="mt-1 text-sm text-muted-foreground">Entrega: {etapa.entrega}</p>
            )}
            {etapa.dependeDe?.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Depende de: etapa {etapa.dependeDe.join(", ")}
              </p>
            )}
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.avancar("gerar-tarefa")}
              disabled={s.ocupado}
            >
              Gerar a tarefa <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 2. gerar-tarefa ------------------------------------------------------------ */}
        {passo === "gerar-tarefa" && (
          <>
            <p className="text-sm whitespace-pre-line">{brief.TASK}</p>
            {brief.OBJECTIVE && (
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                {brief.OBJECTIVE}
              </p>
            )}
            <Campo titulo="Critérios de aceitação" itens={criterios} />
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.avancar("preparar-contexto")}
              disabled={s.ocupado}
            >
              Preparar o contexto <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 3. preparar-contexto ------------------------------------------------------- */}
        {passo === "preparar-contexto" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={completude >= 70 ? "accent" : "muted"}>
                {completude}% do brief preenchido
              </Chip>
            </div>
            {vazias.length > 0 && (
              <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Vai sem: {vazias.map((k) => k.replace(/_/g, " ")).join(", ")}. A ferramenta
                  trabalha assim mesmo, com mais chute.
                </span>
              </p>
            )}
            <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs whitespace-pre-wrap">
              {textoDoBrief}
            </pre>
            <p className="mt-2 text-xs text-muted-foreground">
              Ao avançar, este brief é congelado. Daqui em diante ele não muda — é assim que, três
              dias depois, dá para responder o que a ferramenta sabia quando fez o que fez.
            </p>
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.congelarContexto(briefVivo)}
              disabled={s.ocupado}
            >
              {s.ocupado ? <Loader2 className="size-4 animate-spin" /> : null}
              Congelar e escolher a ferramenta <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 4. escolher-ferramenta ------------------------------------------------------ */}
        {passo === "escolher-ferramenta" && (
          <>
            <div className="flex flex-wrap gap-2">
              {PROVEDORES_IA.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void s.escolherFerramenta(p.id, null)}
                  disabled={s.ocupado}
                  className={cn(
                    "tap rounded-full px-3 py-1.5 text-xs",
                    sessao.provider === p.id
                      ? "border border-foreground/15 bg-foreground font-medium text-background"
                      : "border border-border bg-surface text-foreground/80",
                  )}
                >
                  {p.nome}
                </button>
              ))}
            </div>
            {provedorPreferido && !sessao.provider && (
              <p className="mt-2 text-xs text-muted-foreground">
                A principal deste projeto é {acharProvedor(provedorPreferido)?.nome}.{" "}
                <Link to="/app/ferramentas" className="underline underline-offset-2">
                  mudar
                </Link>
              </p>
            )}
            {provedor && (
              <p className="mt-2 text-sm text-muted-foreground">{provedor.limitacoes[0]}</p>
            )}
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.avancar("solicitar-execucao")}
              disabled={s.ocupado || !sessao.provider}
            >
              Solicitar a execução <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 5. solicitar-execucao ------------------------------------------------------- */}
        {passo === "solicitar-execucao" && (
          <>
            {provedor && !provedor.local ? (
              <p className="text-sm">
                O Pathly vai chamar {provedor.nome} com o brief congelado. Nada sai antes de você
                autorizar, e a autorização vale uma execução.
              </p>
            ) : (
              <p className="text-sm">
                Nada sai do Pathly. {provedor?.nome ?? "A ferramenta"} roda na sua máquina — o que o
                Pathly faz aqui é entregar o brief e anotar que o trabalho começou.
              </p>
            )}
            <Campo titulo="O que esta tarefa proíbe" itens={brief.DO_NOT.slice(0, 4)} />
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.avancar("autorizar")}
              disabled={s.ocupado}
            >
              Pedir autorização <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 6. autorizar ---------------------------------------------------------------- */}
        {passo === "autorizar" && (
          <>
            <Panel invertido>
              <p className="text-sm">
                {provedor && !provedor.local
                  ? `Autorizar o Pathly a enviar esta tarefa para ${provedor.nome}?`
                  : `Começar esta tarefa no ${provedor?.nome ?? "sua ferramenta"}?`}
              </p>
              <p className="mt-1 text-xs opacity-80">
                {provedor && !provedor.local
                  ? "O brief congelado sai daqui. O Pathly não faz commit, não faz push e não apaga arquivo."
                  : "O Pathly não consegue iniciar nem impedir nada na sua máquina. Ele registra que começou, para a linha do tempo fazer sentido depois."}
              </p>
            </Panel>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => void s.avancar("executar")} disabled={s.ocupado}>
                <Check className="size-4" />
                {provedor && !provedor.local ? "Autorizar e executar" : "Comecei"}
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => void s.cancelar()} disabled={s.ocupado}>
                <X className="size-4" /> Cancelar a sessão
              </Btn>
            </div>
          </>
        )}

        {/* ---- 7. executar ----------------------------------------------------------------- */}
        {passo === "executar" && (
          <>
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => void copiar(true)}>
                {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copiado ? "Copiado" : "Copiar o brief"}
              </Btn>
              {provedor?.arquivoDeRegras && (
                <Btn variant="ghost" size="sm" onClick={baixarRegras}>
                  <Download className="size-4" /> Baixar {provedor.arquivoDeRegras.caminho}
                </Btn>
              )}
            </div>
            {briefMudou && (
              <p className="mt-2 text-xs text-muted-foreground">
                Este brief está mais novo que o congelado: ele leva o que aconteceu desde o primeiro
                envio. O congelado continua guardado, para saber depois o que a ferramenta sabia na
                primeira tentativa.
              </p>
            )}
            <Campo titulo="O que já falhou nesta etapa" itens={briefVivo.KNOWN_ERRORS} />
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void s.avancar("receber-resultado")}
              disabled={s.ocupado}
            >
              Recebi o resultado <ChevronRight className="size-4" />
            </Btn>
          </>
        )}

        {/* ---- 8. receber-resultado -------------------------------------------------------- */}
        {passo === "receber-resultado" && (
          <ReceberResultado
            aoResultado={(r) => void aoResultado(r)}
            aoResponder={(r, t) => void aoResponder(r, t)}
            ocupado={s.ocupado}
          />
        )}

        {/* ---- 9. testar ------------------------------------------------------------------- */}
        {passo === "testar" && (
          <>
            {resultado && (
              <>
                <Chip tone="accent">{ROTULO_STATUS[resultado.status]}</Chip>
                <p className="mt-2 text-sm text-muted-foreground">
                  {EXPLICACAO_STATUS[resultado.status]}
                </p>
                <Campo titulo="Testes" itens={resultado.tests} />
                <Campo titulo="Arquivos" itens={resultado.files} />
                {resultado.camposAusentes.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    A ferramenta não escreveu: {resultado.camposAusentes.join(", ")}.
                  </p>
                )}
              </>
            )}
            {(!resultado || resultado.tests.length === 0) && (
              <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                <span>
                  Nenhum teste foi reportado. Rodar agora custa menos que descobrir na etapa 12.
                </span>
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => void s.avancar("validar")} disabled={s.ocupado}>
                <Check className="size-4" /> Os testes passaram
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => void s.avancar("executar")}
                disabled={s.ocupado}
              >
                <RotateCcw className="size-4" /> Falharam — voltar para a ferramenta
              </Btn>
            </div>
          </>
        )}

        {/* ---- 10. validar ----------------------------------------------------------------- */}
        {passo === "validar" && (
          <>
            <p className="text-sm text-muted-foreground">
              Teste verde não é critério atendido. Marque o que de fato está de pé.
            </p>
            {criterios.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Esta etapa não tem critério de aceitação escrito. Sem ele, "pronto" é opinião — vale
                escrever um antes da próxima.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {criterios.map((c, i) => (
                  <li key={c}>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={criteriosOk.includes(i)}
                        onChange={() =>
                          setCriteriosOk((a) =>
                            a.includes(i) ? a.filter((x) => x !== i) : [...a, i],
                          )
                        }
                        className="mt-1 size-4"
                      />
                      <span>{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn
                size="sm"
                onClick={() => void s.avancar("atualizar-blueprint")}
                disabled={
                  s.ocupado || (criterios.length > 0 && criteriosOk.length < criterios.length)
                }
              >
                <Check className="size-4" /> Atende aos critérios
              </Btn>
              <Btn
                variant="ghost"
                size="sm"
                onClick={() => void s.avancar("executar")}
                disabled={s.ocupado}
              >
                <RotateCcw className="size-4" /> Não atende — voltar
              </Btn>
            </div>
            {criterios.length > 0 && criteriosOk.length < criterios.length && (
              <p className="mt-2 text-xs text-muted-foreground">
                Faltam {criterios.length - criteriosOk.length} critério(s).
              </p>
            )}
          </>
        )}

        {/* ---- 11. atualizar-blueprint ------------------------------------------------------ */}
        {passo === "atualizar-blueprint" && (
          <>
            {sessao.technicalDecisions.length > 0 ? (
              <>
                <p className="text-sm">
                  Estas decisões vão para o plano e entram no contexto de todas as etapas seguintes:
                </p>
                <Campo titulo="Decisões" itens={sessao.technicalDecisions} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma decisão técnica saiu desta sessão. O plano segue como estava.
              </p>
            )}
            <Btn
              size="sm"
              className="mt-3"
              onClick={() => void levarDecisoesParaOPlano()}
              disabled={s.ocupado}
            >
              {s.ocupado ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Concluir a etapa
            </Btn>
          </>
        )}
      </div>

      {s.aviso && (
        <p className="mt-3 text-sm text-destructive">
          {s.aviso}{" "}
          <button type="button" onClick={s.limparAviso} className="underline underline-offset-2">
            ok
          </button>
        </p>
      )}

      {/* ---- A linha do tempo ------------------------------------------------------------- */}
      {linha.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <SectionLabel>Linha do tempo</SectionLabel>
          <LinhaDoTempo eventos={linha} />
        </div>
      )}

      {passo !== "autorizar" && (
        <Btn
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => void s.cancelar()}
          disabled={s.ocupado}
        >
          <X className="size-4" /> Cancelar a sessão
        </Btn>
      )}
    </section>
  );
}
