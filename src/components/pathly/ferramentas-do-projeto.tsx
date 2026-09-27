import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CircleCheck,
  FileText,
  GitBranch,
  Play,
  Settings2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { Btn, Chip, Panel, SectionLabel, Skeleton } from "@/components/pathly/ui";
import { useProjeto } from "@/lib/blueprint/usar-projetos";
import { contarProgresso, ondeEstou, useProgresso, useRoadmap } from "@/lib/blueprint/usar-roadmap";
import { useFerramentaDoProjeto } from "@/lib/hub/ia/usar-ferramentas";
import { PROVEDORES_IA, executaDoPathly } from "@/lib/hub/ia/catalogo";
import { PAPEIS, ROTULO_PAPEL, type Papel } from "@/lib/hub/ia/contrato";
import { lerSessoesDoProjeto } from "@/lib/hub/sessao/usar-sessao";
import { ROTULO_PASSO, terminou, type DevelopmentSession } from "@/lib/hub/sessao/contrato";
import { lerDecisoesAtivas } from "@/lib/copilot/memoria";
import { Spinner } from "@/components/ui/spell-spinner";

/**
 * Projeto → Ferramentas, e o botão de continuar.
 *
 * ## Por que este painel não abre uma sessão
 *
 * A sessão de desenvolvimento inteira — os doze passos, o brief, o resultado, as voltas — já
 * mora no painel da etapa, dentro do roadmap. Um segundo lugar que também abrisse sessões
 * produziria duas verdades sobre o mesmo trabalho, e um dia elas discordariam.
 *
 * Então "Continuar desenvolvimento" faz a coisa mais útil que não duplica nada: **descobre onde
 * você parou** e leva você até lá, dizendo antes o que encontrou. É a pergunta que se faz ao
 * voltar depois de três dias — "onde eu estava?" — respondida sem abrir o plano inteiro.
 *
 * ## O que ele mostra antes de qualquer botão
 *
 * O que foi analisado, em números. Etapa, decisões ativas, erros anotados, sessões em aberto, e
 * qual ferramenta recebe. Sem isso, "continuar" seria um botão de confiança — e o resto do Pathly
 * passou o tempo todo evitando exatamente esse tipo de botão.
 */

const ICONE_DO_PAPEL: Record<Papel, typeof Wrench> = {
  principal: Wrench,
  secundaria: Settings2,
  documentacao: FileText,
  git: GitBranch,
};

type Analise = {
  etapa: { ordem: number; titulo: string; fase: string; entrega: string } | null;
  feitas: number;
  total: number;
  decisoes: number;
  erros: number;
  sessaoViva: DevelopmentSession | null;
  sessoesVivas: number;
};

export function FerramentasDoProjeto({ projetoId }: { projetoId: string }) {
  const { estado } = useProjeto(projetoId);
  const { porOrdem } = useProgresso(projetoId);
  const preferencias = useFerramentaDoProjeto(projetoId);

  const projeto = estado.estado === "pronto" ? estado.projeto : null;
  const { fases } = useRoadmap(
    projeto?.conteudo ?? {},
    projeto?.respostas ?? ({} as never),
    porOrdem,
  );

  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [falhou, setFalhou] = useState(false);

  /**
   * A análise.
   *
   * Lê tudo em paralelo e não deixa uma tabela ausente derrubar o painel: sem `pathly_hub_sessoes`
   * instalada, a análise ainda responde onde você parou na trilha — que é a metade que não depende
   * do Hub.
   */
  const analisar = useCallback(async () => {
    setAnalisando(true);
    setFalhou(false);

    /*
     * `finally` e não só o caminho felizazul: se algo aqui estourar, sem ele `analisando` fica
     * preso em `true` e o painel mostra "Vendo onde você parou…" para sempre — um carregando
     * eterno, que é a pior forma de falhar porque não se parece com falha.
     */
    try {
      const atual = ondeEstou(fases);
      const numeros = contarProgresso(fases);

      const [decisoes, sessoes] = await Promise.all([
        lerDecisoesAtivas(projetoId).catch(() => []),
        lerSessoesDoProjeto(projetoId, 30).catch(() => null),
      ]);

      const vivas = (sessoes ?? []).filter((s) => !terminou(s.currentStep));
      const daEtapa = atual
        ? (vivas.find((s) => s.taskId === `etapa:${atual.ordem}`) ?? null)
        : null;

      setAnalise({
        etapa: atual
          ? { ordem: atual.ordem, titulo: atual.titulo, fase: atual.fase, entrega: atual.entrega }
          : null,
        feitas: numeros.feitas,
        total: numeros.total,
        decisoes: decisoes.length,
        // Erros anotados nas sessões desta trilha. Eles entram no próximo brief.
        erros: (sessoes ?? []).reduce((n, s) => n + s.errors.length, 0),
        sessaoViva: daEtapa,
        sessoesVivas: vivas.length,
      });
    } catch {
      setFalhou(true);
    } finally {
      setAnalisando(false);
    }
  }, [fases, projetoId]);

  // Analisa quando o projeto termina de carregar, para o painel já chegar com resposta.
  useEffect(() => {
    if (estado.estado === "pronto" && fases.length > 0 && !analise && !analisando && !falhou) {
      void analisar();
    }
  }, [estado.estado, fases.length, analise, analisando, falhou, analisar]);

  if (estado.estado === "carregando") {
    return <Skeleton className="h-40 rounded-lg" />;
  }

  if (estado.estado === "erro" || !projeto) {
    return null;
  }

  const prefs = preferencias.estado === "pronto" ? preferencias.preferencias : null;
  const principal = prefs?.principal
    ? (PROVEDORES_IA.find((p) => p.id === prefs.principal) ?? null)
    : null;

  return (
    <Panel className="space-y-5">
      {/* ---------- As ferramentas ---------- */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Ferramentas deste projeto</h2>
          <Link to="/app/ferramentas" className="tap text-sm underline underline-offset-2">
            Escolher
          </Link>
        </div>

        {preferencias.estado === "carregando" ? (
          <Skeleton className="mt-3 h-20 rounded-md" />
        ) : preferencias.estado === "erro" ? (
          <p className="mt-2 text-sm text-muted-foreground">{preferencias.mensagem}</p>
        ) : !preferencias.instalado ? (
          <p className="mt-2 text-sm text-muted-foreground">
            A tabela de escolha por projeto ainda não existe neste ambiente, então a escolha não
            grava. O script é{" "}
            <code className="font-mono text-xs">supabase/pathly_hub_ferramentas.sql</code>.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PAPEIS.map((papel) => {
              const Icone = ICONE_DO_PAPEL[papel];
              const escolhido = prefs?.[papel]
                ? PROVEDORES_IA.find((p) => p.id === prefs[papel])
                : null;
              return (
                <li
                  key={papel}
                  className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <Icone className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted-foreground">
                      {ROTULO_PAPEL[papel]}
                    </span>
                    <span className="block truncate text-sm font-medium">
                      {escolhido?.nome ?? "nenhuma escolhida"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------- Continuar ---------- */}
      <div className="border-t border-border pt-5">
        {falhou ? (
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Não consegui analisar onde você parou.</p>
              <Btn variant="ghost" size="sm" className="mt-2" onClick={() => void analisar()}>
                Tentar de novo
              </Btn>
            </div>
          </div>
        ) : analisando || !analise ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Vendo onde você parou…
          </div>
        ) : (
          <ProximaTarefa
            projetoId={projetoId}
            analise={analise}
            nomeDaFerramenta={principal?.nome ?? null}
            ferramentaExecutaDoPathly={principal ? executaDoPathly(principal) : false}
          />
        )}
      </div>
    </Panel>
  );
}

/**
 * A próxima tarefa, e os dois botões.
 *
 * `[Revisar contexto]` e `[Executar com X]` levam ao mesmo lugar — o painel da etapa — e isso é
 * de propósito: lá estão o brief completo e o passo a passo. A diferença é a intenção declarada,
 * e ela fica registrada no que a pessoa clicou.
 */
function ProximaTarefa({
  projetoId,
  analise,
  nomeDaFerramenta,
  ferramentaExecutaDoPathly,
}: {
  projetoId: string;
  analise: Analise;
  nomeDaFerramenta: string | null;
  ferramentaExecutaDoPathly: boolean;
}) {
  // Trilha terminada, ou projeto sem plano: dois vazios diferentes, e a diferença importa.
  if (!analise.etapa) {
    return analise.total > 0 ? (
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">Nenhuma etapa pendente.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            As {analise.total} etapas da trilha estão concluídas ou puladas. Se ainda há trabalho,
            ele não está no plano — vale abrir o roadmap e ver o que ficou de fora.
          </p>
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            className="tap mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-2"
          >
            Abrir o roadmap <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    ) : (
      <div>
        <p className="text-sm font-medium">Este projeto ainda não tem uma trilha de etapas.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sem etapas não há próxima tarefa para preparar. O plano é o que dá ao Pathly o que colocar
          num contexto.
        </p>
        <Link
          to="/app/blueprint/$id"
          params={{ id: projetoId }}
          className="tap mt-2 inline-flex items-center gap-1 text-sm underline underline-offset-2"
        >
          Abrir o plano <ArrowRight className="size-4" />
        </Link>
      </div>
    );
  }

  const s = analise.sessaoViva;
  const naFaseDeResultado =
    s && ["receber-resultado", "testar", "validar", "atualizar-blueprint"].includes(s.currentStep);

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>{naFaseDeResultado ? "Resultado a conferir" : "Próxima tarefa"}</SectionLabel>
        <p className="mt-1 font-display text-lg font-semibold">
          Etapa {String(analise.etapa.ordem).padStart(2, "0")} · {analise.etapa.titulo}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{analise.etapa.entrega}</p>
      </div>

      {/* O que foi analisado. Números, não adjetivos. */}
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="muted">{analise.etapa.fase}</Chip>
        <Chip tone="accent">
          {analise.feitas}/{analise.total} etapas
        </Chip>
        <Chip tone="accent">{analise.decisoes} decisão(ões) ativa(s)</Chip>
        {analise.erros > 0 && <Chip tone="primary">{analise.erros} erro(s) anotado(s)</Chip>}
        {s && <Chip tone="muted">sessão em {ROTULO_PASSO[s.currentStep].toLowerCase()}</Chip>}
      </div>

      {analise.sessoesVivas > 1 && (
        <p className="flex gap-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Há {analise.sessoesVivas} sessões abertas neste projeto. Trabalho espalhado em várias
            etapas ao mesmo tempo costuma virar retrabalho — vale fechar as que já acabaram.
          </span>
        </p>
      )}

      {/* A permissão pedida, dita antes de qualquer clique. */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <SectionLabel>Permissão desta execução</SectionLabel>
        {ferramentaExecutaDoPathly ? (
          <p className="mt-1 text-sm">
            <strong>Ler o projeto.</strong> O Pathly envia o contexto desta etapa para{" "}
            {nomeDaFerramenta} e recebe a resposta. Nada é escrito no seu código, e nenhum commit
            acontece — o Pathly não tem permissão para isso e não vai pedir por aqui.
          </p>
        ) : (
          <p className="mt-1 text-sm">
            <strong>Nenhuma.</strong> {nomeDaFerramenta ?? "A ferramenta escolhida"} roda na sua
            máquina, fora do alcance do Pathly. Ele monta o contexto, você entrega, e quem executa é
            você.
          </p>
        )}
      </div>

      {!nomeDaFerramenta && (
        <p className="text-xs text-muted-foreground">
          Nenhuma ferramenta principal escolhida ainda. Dá para revisar o contexto assim mesmo — o
          brief é o mesmo para todas.
        </p>
      )}

      {/* ---------- Os botões ---------- */}
      {naFaseDeResultado ? (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            search={{ etapa: analise.etapa.ordem }}
          >
            <Btn size="sm">
              <CircleCheck className="size-4" /> Validar
            </Btn>
          </Link>
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            search={{ etapa: analise.etapa.ordem }}
          >
            <Btn variant="outline" size="sm">
              <TriangleAlert className="size-4" /> Relatar erro
            </Btn>
          </Link>
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            search={{ etapa: analise.etapa.ordem }}
          >
            <Btn variant="ghost" size="sm">
              Revisar alterações
            </Btn>
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            search={{ etapa: analise.etapa.ordem }}
          >
            <Btn variant="outline" size="sm">
              Revisar contexto
            </Btn>
          </Link>
          <Link
            to="/app/roadmap/$id"
            params={{ id: projetoId }}
            search={{ etapa: analise.etapa.ordem }}
          >
            <Btn size="sm">
              <Play className="size-4" />
              {nomeDaFerramenta ? `Executar com ${nomeDaFerramenta}` : "Preparar a sessão"}
            </Btn>
          </Link>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Os dois levam ao painel da etapa, onde o brief completo e os passos da sessão estão. O
        Pathly não executa nada ao chegar lá.
      </p>
    </div>
  );
}
