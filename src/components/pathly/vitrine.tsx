import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Boxes,
  Check,
  ChevronRight,
  FileCode,
  FolderOpen,
  Github,
  Laptop,
  Loader2,
  type LucideIcon,
  PenTool,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { Btn, Chip, Panel, SectionLabel } from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import { DEFINICOES } from "@/lib/hub/capacidades";
import {
  ABAS,
  ACAO_DO_ESTADO,
  COMO_FUNCIONA,
  EXPLICACAO_ESTADO,
  PRE_REQUISITO,
  ROTULO_ABA,
  ROTULO_ESTADO,
  ROTULO_METODO,
  TOM_DO_ESTADO,
  buscar,
  type Aba,
  type Estado,
  type IntegracaoDaVitrine,
  type Tom,
} from "@/lib/hub/vitrine/catalogo";
import type { AtoDeAuditoria, Situacao } from "@/lib/hub/vitrine/usar-vitrine";

/**
 * A vitrine de integrações.
 *
 * ## O que faz isto parecer parte do Pathly, e não um painel técnico
 *
 * Um cartão só, igual para todas. A pessoa aprende a ler um e sabe ler os onze — inclusive os que
 * ainda não existem. O que muda entre eles é o conteúdo, nunca a forma.
 *
 * E nenhum jargão no lugar onde a decisão acontece. "OAuth" aparece, mas acompanhado da frase que
 * diz o que ele significa para quem vai clicar: onde a senha vai, onde o token fica, como revogar.
 *
 * ## O ponto de estado é o elemento mais importante da tela
 *
 * É o que responde a única pergunta que a pessoa faz ao abrir esta página: *está tudo bem?* Por
 * isso ele tem quatro tons e não dois — "não conectada" e "token vencido" são situações muito
 * diferentes, e pintar as duas de cinza esconderia a segunda.
 */

const CORES_DO_TOM: Record<Tom, string> = {
  neutro: "bg-muted-foreground/40",
  bom: "bg-primary",
  atencao: "bg-amber-500",
  ruim: "bg-destructive",
};

const ICONES: Record<string, LucideIcon> = {
  "claude-api": Sparkles,
  "claude-code": FileCode,
  codex: FileCode,
  cursor: FileCode,
  vscode: FileCode,
  github: Github,
  gitlab: Github,
  obsidian: FolderOpen,
  revit: PenTool,
  ponte: Laptop,
};

export function PontoDeEstado({ estado }: { estado: Estado }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          CORES_DO_TOM[TOM_DO_ESTADO[estado]],
          estado === "carregando" && "animate-pulse",
        )}
        aria-hidden
      />
      {ROTULO_ESTADO[estado]}
    </span>
  );
}

// =============================================================================================
// O cartão
// =============================================================================================

export function CartaoIntegracao({
  integracao,
  situacao,
  aoGerenciar,
}: {
  integracao: IntegracaoDaVitrine;
  situacao: Situacao;
  aoGerenciar: () => void;
}) {
  const Icone = ICONES[integracao.id] ?? Boxes;
  const acao = ACAO_DO_ESTADO[situacao.estado];

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
          <Icone className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-base font-semibold">{integracao.nome}</h3>
            <PontoDeEstado estado={situacao.estado} />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{integracao.subtitulo}</p>

          {/*
            As capacidades como palavras curtas, não como nomes de permissão. `READ_PROJECT` é
            verdade e não diz nada para quem está decidindo se conecta.
          */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {integracao.capacidades.map((c) => (
              <Chip key={c} tone="accent">
                {c}
              </Chip>
            ))}
          </div>

          {situacao.detalhe && (
            <p className="mt-2 text-xs text-muted-foreground">{situacao.detalhe}</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Btn
          variant={situacao.estado === "conectada" ? "ghost" : "primary"}
          size="sm"
          onClick={aoGerenciar}
        >
          {acao ?? "Ver detalhes"}
        </Btn>
        {situacao.concedidas.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {situacao.concedidas.length} permissão(ões) · {situacao.projetos.length || "todos os"}{" "}
            projeto(s)
          </span>
        )}
      </div>
    </Panel>
  );
}

// =============================================================================================
// Como a conexão funciona
// =============================================================================================

/**
 * A explicação do método, mostrada **antes** de qualquer botão de conectar.
 *
 * É a regra que você nomeou: nunca "conectar sua conta" sem dizer o que acontece. Ela aparece no
 * fluxo de adicionar e de novo na aba de configuração, porque quem volta seis meses depois
 * merece a mesma explicação de quem chegou agora.
 */
export function ComoFunciona({ integracao }: { integracao: IntegracaoDaVitrine }) {
  const pre = PRE_REQUISITO[integracao.metodo];
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SectionLabel>Como esta conexão funciona</SectionLabel>
        <Chip tone="muted">{ROTULO_METODO[integracao.metodo]}</Chip>
      </div>
      <p className="mt-2 text-sm">{COMO_FUNCIONA[integracao.metodo]}</p>
      {pre && (
        <p className="mt-2 text-xs text-muted-foreground">
          <strong>Você vai precisar de:</strong> {pre}
        </p>
      )}
      {!integracao.disponivel && integracao.oQueFalta && (
        <p className="mt-2 flex gap-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>{integracao.oQueFalta}</span>
        </p>
      )}
    </div>
  );
}

// =============================================================================================
// O detalhe
// =============================================================================================

export function DetalheIntegracao({
  integracao,
  situacao,
  auditoria,
  nomesDeProjeto,
  ocupado,
  abaInicial = "visao-geral",
  extraConfiguracao,
  aoRevogar,
  aoFechar,
}: {
  integracao: IntegracaoDaVitrine;
  situacao: Situacao;
  auditoria: AtoDeAuditoria[];
  nomesDeProjeto: Record<string, string>;
  ocupado: boolean;
  /** Abre direto na aba onde está o que a pessoa veio fazer. */
  abaInicial?: Aba;
  /**
   * Os controles específicos desta integração, na aba de configuração.
   *
   * Existe porque conectar o GitHub não se parece com escolher uma pasta do Obsidian, e fingir
   * que se parecem produziria um formulário genérico que não serve direito para nenhum dos dois.
   */
  extraConfiguracao?: ReactNode;
  aoRevogar: () => void;
  aoFechar: () => void;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [confirmando, setConfirmando] = useState(false);
  const Icone = ICONES[integracao.id] ?? Boxes;
  const doProvedor = auditoria.filter((a) => a.provedor === integracao.id);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20">
      <div className="mx-auto min-h-full w-full max-w-2xl px-4 py-6 sm:py-10">
        <Panel>
          <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
                <Icone className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold">{integracao.nome}</h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <PontoDeEstado estado={situacao.estado} />
                  <span className="text-xs text-muted-foreground">{integracao.subtitulo}</span>
                </div>
              </div>
            </div>
            <Btn variant="ghost" size="sm" onClick={aoFechar} title="Fechar">
              <X className="size-4" />
            </Btn>
          </div>

          {/* As abas. `revogar` fica separada — é a única irreversível. */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ABAS.filter((a) => a !== "revogar").map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAba(a)}
                className={cn(
                  "tap rounded-full px-3 py-1.5 text-xs",
                  aba === a
                    ? "border border-foreground/15 bg-foreground font-medium text-background"
                    : "border border-border bg-surface text-foreground/80",
                )}
              >
                {ROTULO_ABA[a]}
              </button>
            ))}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setAba("revogar")}
              className={cn(
                "tap rounded-full border px-3 py-1.5 text-xs",
                aba === "revogar"
                  ? "border-destructive bg-destructive/10 font-medium text-destructive"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              {ROTULO_ABA.revogar}
            </button>
          </div>

          <div className="mt-4">
            {aba === "visao-geral" && (
              <>
                <p className="text-sm">{EXPLICACAO_ESTADO[situacao.estado]}</p>
                {situacao.detalhe && (
                  <p className="mt-2 text-sm text-muted-foreground">{situacao.detalhe}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {integracao.capacidades.map((c) => (
                    <Chip key={c} tone="accent">
                      {c}
                    </Chip>
                  ))}
                </div>
                {situacao.conectadaEm && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Conectada em {new Date(situacao.conectadaEm).toLocaleDateString("pt-BR")}.
                  </p>
                )}
                <div className="mt-4">
                  <ComoFunciona integracao={integracao} />
                </div>
              </>
            )}

            {aba === "permissoes" && (
              <>
                {integracao.capacidadesDoHub.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Esta integração não consome permissão nenhuma. O Pathly não executa nada por ela
                    — quem age é você, na ferramenta.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {integracao.capacidadesDoHub.map((c) => {
                      const tem = situacao.concedidas.includes(c);
                      const d = DEFINICOES[c];
                      return (
                        <li key={c} className="flex items-start gap-3 py-3">
                          <span
                            className={cn(
                              "mt-0.5 grid size-5 shrink-0 place-items-center rounded border",
                              tem
                                ? "border-foreground bg-foreground text-background"
                                : "border-border",
                            )}
                          >
                            {tem && <Check className="size-3.5" />}
                          </span>
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
                <p className="mt-3 text-xs text-muted-foreground">
                  Conceder e revogar acontece na tela da integração, onde o contexto da decisão
                  está.{" "}
                  <Link to={integracao.rota} className="underline underline-offset-2">
                    Abrir
                  </Link>
                </p>
              </>
            )}

            {aba === "projetos" && (
              <>
                {situacao.projetos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {situacao.concedidas.length > 0
                      ? "As permissões desta integração valem para todos os seus projetos. Para limitar a um, conceda dentro do projeto."
                      : "Nenhum projeto usa esta integração ainda."}
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {situacao.projetos.map((p) => (
                      <li key={p} className="text-sm">
                        {nomesDeProjeto[p] ?? p}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}

            {aba === "historico" && (
              <>
                {doProvedor.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nada aconteceu por esta integração ainda. O histórico registra tudo — inclusive
                    o que foi recusado.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {doProvedor.slice(0, 20).map((a, i) => (
                      <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="font-mono text-xs text-muted-foreground">
                          {new Date(a.em).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
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
                )}
              </>
            )}

            {aba === "configuracao" && (
              <>
                <ComoFunciona integracao={integracao} />
                {extraConfiguracao && <div className="mt-4">{extraConfiguracao}</div>}
                {/* Sem link para a própria página onde o painel já está aberto. */}
                {integracao.rota !== "/app/integracoes" && (
                  <Link
                    to={integracao.rota}
                    className="tap mt-3 inline-flex items-center gap-1 text-sm underline underline-offset-2"
                  >
                    Abrir a tela desta integração <ChevronRight className="size-4" />
                  </Link>
                )}
              </>
            )}

            {aba === "revogar" && (
              <>
                <p className="text-sm">
                  Revogar tira todas as permissões desta integração e apaga a credencial que o
                  Pathly guardava.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  O que já aconteceu continua no histórico — revogar não apaga registro. E se a
                  ferramenta roda na sua máquina, o Pathly não consegue encerrá-la: o que ele faz é
                  parar de responder.
                </p>

                {confirmando ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn size="sm" onClick={aoRevogar} disabled={ocupado}>
                      {ocupado ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                      Revogar {integracao.nome}
                    </Btn>
                    <Btn variant="ghost" size="sm" onClick={() => setConfirmando(false)}>
                      Cancelar
                    </Btn>
                  </div>
                ) : (
                  <Btn
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={() => setConfirmando(true)}
                  >
                    Revogar esta integração
                  </Btn>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// =============================================================================================
// Adicionar
// =============================================================================================

export function AdicionarIntegracao({
  situacoes,
  aoEscolher,
  aoFechar,
}: {
  situacoes: Record<string, Situacao>;
  aoEscolher: (i: IntegracaoDaVitrine) => void;
  aoFechar: () => void;
}) {
  const [termo, setTermo] = useState("");
  const [escolhida, setEscolhida] = useState<IntegracaoDaVitrine | null>(null);
  const achadas = buscar(termo);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20">
      <div className="mx-auto min-h-full w-full max-w-lg px-4 py-6 sm:py-10">
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-semibold">Adicionar integração</h2>
            <Btn variant="ghost" size="sm" onClick={aoFechar} title="Fechar">
              <X className="size-4" />
            </Btn>
          </div>

          {escolhida ? (
            <>
              <button
                type="button"
                onClick={() => setEscolhida(null)}
                className="tap mt-3 text-sm underline underline-offset-2"
              >
                ← voltar para a lista
              </button>

              <div className="mt-3">
                <p className="font-display text-lg font-semibold">{escolhida.nome}</p>
                <p className="text-sm text-muted-foreground">{escolhida.subtitulo}</p>
              </div>

              {/* A explicação vem ANTES do botão. É o ponto inteiro deste fluxo. */}
              <div className="mt-3">
                <ComoFunciona integracao={escolhida} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Btn
                  size="sm"
                  onClick={() => aoEscolher(escolhida)}
                  disabled={!escolhida.disponivel}
                >
                  {escolhida.disponivel ? "Entendi, continuar" : "Ainda não disponível"}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={aoFechar}>
                  Agora não
                </Btn>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Buscar: git, anotação, modelo, editor…"
                  autoFocus
                  className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                />
              </div>

              {achadas.length === 0 ? (
                <div className="mt-4">
                  <p className="text-sm">Nada com esse nome.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Se a ferramenta que você usa roda no seu computador, o caminho costuma ser o
                    Pathly Bridge — ele conecta o que estiver instalado, desde que exista um
                    adaptador.
                  </p>
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-border">
                  {achadas.map((i) => {
                    const Icone = ICONES[i.id] ?? Boxes;
                    const s = situacoes[i.id];
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => setEscolhida(i)}
                          className="tap flex w-full items-center gap-3 py-3 text-left"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2">
                            <Icone className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{i.nome}</span>
                            <span className="block text-xs text-muted-foreground">
                              {i.subtitulo} · {ROTULO_METODO[i.metodo]}
                            </span>
                          </span>
                          {s && s.estado === "conectada" ? (
                            <Chip tone="accent">já conectada</Chip>
                          ) : (
                            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
