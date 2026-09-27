import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, Lock, Play, Plus, ShieldCheck, TriangleAlert, X } from "lucide-react";
import {
  Btn,
  Chip,
  PageHeader,
  Panel,
  Reveal,
  SectionLabel,
  Skeleton,
} from "@/components/pathly/ui";
import { cn } from "@/lib/utils";
import {
  AdicionarIntegracao,
  CartaoIntegracao,
  DetalheIntegracao,
} from "@/components/pathly/vitrine";
import { useIntegracoes } from "@/lib/integracoes/usar-integracoes";
import {
  ROTULO_ESTADO_ACAO,
  ROTULO_IMPACTO,
  ROTULO_PROVEDOR,
  type AcaoExterna,
  type Impacto,
  type Provedor,
} from "@/lib/integracoes/contrato";
import { PROVEDORES_DISPONIVEIS } from "@/lib/integracoes/provedores";
import { useVitrine } from "@/lib/hub/vitrine/usar-vitrine";
import {
  CATEGORIAS,
  EXPLICACAO_CATEGORIA,
  ROTULO_CATEGORIA,
  acharIntegracao,
  porCategoria,
  type Aba,
  type IntegracaoDaVitrine,
} from "@/lib/hub/vitrine/catalogo";
import { useProjetos } from "@/lib/blueprint/usar-projetos";
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
 * O recado da volta do OAuth.
 *
 * Lido do endereço e **apagado dele** em seguida: sem isso, recarregar a página mostraria
 * "conectado" de novo, e um endereço compartilhado carregaria um recado que não é sobre quem o
 * abriu. O `replaceState` também tira o parâmetro do histórico.
 *
 * A lista é fechada, a mesma do callback. Nada de texto vindo da URL chega à tela — é o que
 * impede a query de escrever a mensagem que quiser no seu app.
 */
const RECADOS: Record<string, string> = {
  conectado: "Conta conectada. Nenhuma ação sai daqui sem a sua aprovação.",
  recusado: "Você cancelou a autorização. Nada foi conectado.",
  "estado-invalido": "A volta não conferiu e não conectei. Tente começar de novo.",
  falhou: "Não consegui concluir a conexão. Tente de novo.",
  "sem-config": "A conexão não está configurada neste ambiente.",
};

function useRecadoOauth(aoConectar: () => void) {
  const [recado, setRecado] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("oauth");
    if (!p) return;

    setRecado(RECADOS[p] ?? null);
    window.history.replaceState({}, "", window.location.pathname);
    if (p === "conectado") aoConectar();
  }, [aoConectar]);

  return recado;
}

/**
 * A tela de integrações.
 *
 * ## A ordem desta página é uma decisão, não um acaso
 *
 * O que espera por você vem primeiro. Uma ação pendente é trabalho parado — enterrá-la abaixo de
 * uma grade de cartões faria a pessoa descobrir dias depois que o Pathly estava esperando.
 *
 * Depois vêm as categorias. Elas não organizam por tecnologia (OAuth aqui, API key ali), porque
 * ninguém procura integração por método de autenticação. Organizam por para que servem.
 *
 * ## O que esta tela recusa a fazer
 *
 * Nenhum botão conecta em um clique. Todo caminho para conectar passa pela explicação do método —
 * a mesma frase, no cartão de adicionar e na aba de configuração. "Conectar sua conta" sem dizer
 * o que isso significa é a frase que esta tela existe para não escrever.
 */
function IntegrationsPage() {
  const { estado, ocupado, pedir, decidir, executar, conectar, desconectar, recarregar } =
    useIntegracoes();
  const vitrine = useVitrine();
  const projetos = useProjetos();
  // Recarrega ao voltar conectado: a linha foi gravada pelo servidor, e o hook não sabe disso.
  const recado = useRecadoOauth(() => {
    recarregar();
    void vitrine.recarregar();
  });

  const [aberta, setAberta] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);

  const nomesDeProjeto = useMemo(() => {
    const m: Record<string, string> = {};
    if (projetos.estado === "pronta") for (const p of projetos.projetos) m[p.id] = p.nome;
    return m;
  }, [projetos]);

  const pendentes =
    estado.estado === "pronto" ? estado.acoes.filter((a) => a.estado === "pendente") : [];
  /*
   * `aprovada` tem seção própria, entre as pendentes e o histórico, porque é o único estado em que
   * a pessoa ainda precisa fazer algo. Misturá-lo ao histórico esconderia trabalho por fazer numa
   * lista chamada "o que já foi decidido" — decidido está, feito não.
   */
  const aprovadas =
    estado.estado === "pronto" ? estado.acoes.filter((a) => a.estado === "aprovada") : [];
  const historico =
    estado.estado === "pronto"
      ? estado.acoes.filter((a) => a.estado !== "pendente" && a.estado !== "aprovada")
      : [];

  const integracaoAberta = aberta ? acharIntegracao(aberta) : null;
  const situacaoAberta =
    integracaoAberta && vitrine.estado === "pronto"
      ? vitrine.situacoes[integracaoAberta.id]
      : undefined;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrações"
        subtitle="As ferramentas que o Pathly coordena com você — e o alcance real de cada uma"
        action={
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" onClick={() => setAdicionando(true)}>
              <Plus className="size-4" /> Adicionar
            </Btn>
            <Link
              to="/app/central-seguranca"
              className="tap inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-medium coarse:h-11"
            >
              <ShieldCheck className="size-4" /> Central de segurança
            </Link>
          </div>
        }
      />

      {/* ---------- O que espera por você ---------- */}
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

      {aprovadas.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Aprovadas, esperando execução {aprovadas.length > 1 && `(${aprovadas.length})`}
          </h2>
          <p className="text-sm text-muted-foreground">
            Aprovar e executar são dois gestos de propósito. Uma aprovação vale uma execução só.
          </p>
          {aprovadas.map((acao) => (
            <CartaoAcao
              key={acao.id}
              acao={acao}
              ocupado={ocupado === acao.id}
              onExecutar={() => void executar(acao)}
            />
          ))}
        </section>
      )}

      {recado && (
        <Panel className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm leading-relaxed">{recado}</p>
        </Panel>
      )}

      {estado.estado === "pronto" && estado.erro && (
        <p
          role="alert"
          className="rounded-md border border-foreground/25 bg-surface-2 px-4 py-3 text-sm font-medium"
        >
          {estado.erro}
        </p>
      )}

      {/* ---------- A vitrine ---------- */}
      {vitrine.estado === "carregando" && (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-44 rounded-lg" />
          ))}
        </div>
      )}

      {vitrine.estado === "erro" && (
        <Panel className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">Não consegui ler suas integrações.</p>
            <p className="mt-1 text-sm text-muted-foreground">{vitrine.mensagem}</p>
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
      )}

      {vitrine.estado === "pronto" && (
        <>
          {vitrine.semTabela.length > 0 && (
            <Panel className="border-foreground/25">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Parte do Hub ainda não foi instalada neste ambiente.
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    As tabelas de{" "}
                    <span className="font-medium text-foreground">
                      {vitrine.semTabela.join(", ")}
                    </span>{" "}
                    não existem no banco. Os scripts estão em{" "}
                    <code className="font-mono text-xs">supabase/</code> e precisam ser executados
                    no Supabase. Até lá, essas integrações aparecem aqui mas nada nelas grava.
                  </p>
                </div>
              </div>
            </Panel>
          )}

          {CATEGORIAS.map((categoria) => {
            const lista = porCategoria(categoria);
            if (lista.length === 0) return null;

            return (
              <section key={categoria} className="space-y-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">
                    {ROTULO_CATEGORIA[categoria]}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {EXPLICACAO_CATEGORIA[categoria]}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {lista.map((i, n) => {
                    const situacao = vitrine.situacoes[i.id];
                    if (!situacao) return null;
                    return (
                      <Reveal key={i.id} delay={n * 60}>
                        <CartaoIntegracao
                          integracao={i}
                          situacao={situacao}
                          aoGerenciar={() => setAberta(i.id)}
                        />
                      </Reveal>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

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

      {/* ---------- Sobreposições ---------- */}
      {integracaoAberta && situacaoAberta && vitrine.estado === "pronto" && (
        <DetalheIntegracao
          integracao={integracaoAberta}
          situacao={situacaoAberta}
          auditoria={vitrine.auditoria}
          nomesDeProjeto={nomesDeProjeto}
          ocupado={vitrine.ocupado}
          abaInicial={abaDeEntrada(situacaoAberta.estado)}
          extraConfiguracao={
            <ControlesDoProvedor
              integracao={integracaoAberta}
              instalado={estado.estado === "pronto" ? estado.instalado : false}
              conectado={
                estado.estado === "pronto"
                  ? estado.conexoes.some((c) => c.provedor === integracaoAberta.id)
                  : false
              }
              aoConectar={(id) => void conectar(id)}
              aoDesconectar={(id) => void desconectar(id)}
              aoPedir={(id, acaoId) => void pedir(id, acaoId)}
            />
          }
          aoRevogar={() => {
            void (async () => {
              await vitrine.revogar(integracaoAberta.id);
              setAberta(null);
            })();
          }}
          aoFechar={() => setAberta(null)}
        />
      )}

      {adicionando && vitrine.estado === "pronto" && (
        <AdicionarIntegracao
          situacoes={vitrine.situacoes}
          aoEscolher={(i) => {
            setAdicionando(false);
            setAberta(i.id);
          }}
          aoFechar={() => setAdicionando(false)}
        />
      )}
    </div>
  );
}

/**
 * Em que aba o detalhe abre.
 *
 * Quem clica em "Conectar" quer conectar; abrir na visão geral obrigaria um clique a mais para
 * chegar onde a ação está. Quem clica num cartão já conectado quer ver como ele está.
 */
function abaDeEntrada(estado: string): Aba {
  const paraConfiguracao = [
    "nao-conectada",
    "token-expirado",
    "permissao-expirada",
    "oauth-cancelado",
    "revogada",
    "conflito",
  ];
  return paraConfiguracao.includes(estado) ? "configuracao" : "visao-geral";
}

/**
 * Os controles de um provedor OAuth, dentro da aba de configuração.
 *
 * Só aparecem para as integrações que `PROVEDORES_DISPONIVEIS` conhece — hoje o GitHub e o
 * provedor de demonstração. Para as outras, a configuração vive na tela própria delas, e este
 * componente devolve `null` em vez de inventar um formulário que não liga em nada.
 */
function ControlesDoProvedor({
  integracao,
  instalado,
  conectado,
  aoConectar,
  aoDesconectar,
  aoPedir,
}: {
  integracao: IntegracaoDaVitrine;
  instalado: boolean;
  conectado: boolean;
  /*
   * Os três recebem o id do provedor, e não o fecham por cima: o tipo estreito (`Provedor`) é
   * conhecido aqui dentro, onde o catálogo foi consultado, e não lá fora, onde o id ainda é um
   * `string` qualquer da vitrine.
   */
  aoConectar: (id: Provedor) => void;
  aoDesconectar: (id: Provedor) => void;
  aoPedir: (id: Provedor, acaoId: string) => void;
}) {
  const p = PROVEDORES_DISPONIVEIS.find((x) => x.id === integracao.id);
  if (!p) return null;

  if (!instalado) {
    return (
      <p className="text-sm text-muted-foreground">
        As tabelas de integrações não existem neste ambiente, então conectar aqui não gravaria nada.
        O script é <code className="font-mono text-xs">supabase/pathly_integracoes.sql</code>.
      </p>
    );
  }

  if (p.exigeCredencial && !conectado) {
    return (
      <div className="space-y-3">
        <Btn size="sm" onClick={() => aoConectar(p.id)}>
          <Lock className="size-4" /> Conectar {p.nome}
        </Btn>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Você autoriza no {p.nome} e volta para cá. O Pathly pede {p.escopos.join(" e ")} — e mesmo
          conectado, nenhuma ação sai sem a sua aprovação.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionLabel>Pedir uma ação</SectionLabel>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Pedir não executa. A ação entra na fila de aprovação no topo desta página, com o destino à
        vista, e só sai de lá se você aprovar.
      </p>
      <div className="flex flex-wrap gap-2">
        {p.acoes.map((a) => (
          <Btn key={a.id} variant="outline" size="sm" onClick={() => aoPedir(p.id, a.id)}>
            {a.rotulo}
          </Btn>
        ))}
        {conectado && (
          <Btn variant="ghost" size="sm" onClick={() => aoDesconectar(p.id)}>
            Desconectar
          </Btn>
        )}
      </div>
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
  onExecutar,
}: {
  acao: AcaoExterna;
  ocupado: boolean;
  onAprovar?: () => void;
  onRecusar?: () => void;
  onExecutar?: () => void;
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

      {/*
        A cor do texto secundário segue a do cartão, e não o token do tema: num cartão invertido,
        `text-muted-foreground` é cinza médio sobre fundo claro. Mesma armadilha do painel
        invertido, e ela reaparece em todo lugar onde o fundo deixa de ser o do tema.
      */}
      {acao.resultado && (
        <p
          className={cn(
            "mt-2 text-xs leading-relaxed",
            invertido ? "text-background/70" : "text-muted-foreground",
          )}
        >
          {acao.resultado}
        </p>
      )}
      {acao.erro && <p className="mt-2 text-xs leading-relaxed font-medium">{acao.erro}</p>}

      {onExecutar && acao.estado === "aprovada" && (
        <div className="mt-4">
          <Btn size="sm" disabled={ocupado} onClick={onExecutar}>
            {ocupado ? <Spinner className="size-4" /> : <Play className="size-4" />}
            Executar agora
          </Btn>
        </div>
      )}

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
