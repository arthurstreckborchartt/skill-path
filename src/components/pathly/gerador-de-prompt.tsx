import { useMemo, useState } from "react";
import { ArrowLeft, FileCode } from "lucide-react";
import { Chip } from "./ui";
import { BlocoCopiavel } from "./banco-vistas";
import { cn } from "@/lib/utils";
import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { Decisao } from "@/lib/copilot/contrato";
import type { ResumoBanco } from "@/lib/copilot/estado-banco";
import {
  DESTINOS,
  ROTULO_DESTINO,
  ROTULO_TIPO,
  TIPOS_PROMPT,
  etapaAlvo,
  etapasConcluidas,
  montarPrompt,
  type Destino,
  type TipoPrompt,
} from "@/lib/copilot/prompt-builder";

/**
 * O gerador de prompt de implementação.
 *
 * ## Por que é uma tela e não uma pergunta ao Copilot
 *
 * Antes, o botão "Gerar prompt" mandava a pergunta para a IA: "gere um prompt para implementar
 * X". Isso gastava uma chamada, demorava vinte segundos e devolvia um prompt diferente a cada vez
 * — enquanto o app já tem a stack, as tabelas, os endpoints, as decisões e a etapa atual na mão.
 *
 * Aqui o prompt é montado por código. Sai instantâneo, é idêntico entre gerações, e carrega o que
 * um modelo esqueceria: quais etapas já estão entregues e não devem ser refeitas.
 */

export type FontesPrompt = {
  nomeProjeto: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  decisoes: Decisao[];
  estadoBanco: ResumoBanco | null;
  jaExiste: string[];
  etapaAtual: number;
  qtdEtapasConcluidas: number;
  progresso: number;
};

export function GeradorDePrompt({
  fontes,
  aoVoltar,
}: {
  fontes: FontesPrompt;
  aoVoltar: () => void;
}) {
  const [destino, setDestino] = useState<Destino>("claude");
  const [tipo, setTipo] = useState<TipoPrompt>("implementacao");
  const [tarefaLivre, setTarefaLivre] = useState("");

  // Memoizado porque o `?? []` cria um array novo a cada render, e ele é dependência do useMemo
  // que monta o prompt — sem isto, o prompt seria remontado em toda renderização.
  const todasEtapas = useMemo(
    () => fontes.blueprint.execucao?.etapas ?? [],
    [fontes.blueprint.execucao?.etapas],
  );

  /**
   * A etapa é escolhível, com a atual como padrão.
   *
   * Descobri isto com dado real: a etapa atual do projeto de teste era "Entrevistar potenciais
   * clientes" — descoberta, não código. Um prompt de implementação para aquilo é ruído, e travar
   * o recurso na etapa atual obrigaria a pessoa a escrever a tarefa à mão justamente quando ela
   * quer o contrário: o prompt já pronto da etapa que ela vai codar.
   */
  const [ordemEscolhida, setOrdemEscolhida] = useState<number | null>(null);

  const etapa = useMemo(() => {
    if (ordemEscolhida !== null) {
      return todasEtapas.find((x) => x.ordem === ordemEscolhida) ?? null;
    }
    return etapaAlvo(fontes.blueprint, fontes.etapaAtual);
  }, [ordemEscolhida, todasEtapas, fontes.blueprint, fontes.etapaAtual]);

  const concluidas = useMemo(
    () => etapasConcluidas(fontes.blueprint, fontes.qtdEtapasConcluidas),
    [fontes.blueprint, fontes.qtdEtapasConcluidas],
  );

  /**
   * A etapa manda, a menos que a pessoa escreva outra coisa.
   *
   * O padrão é a etapa porque é o que torna o prompt específico. Texto livre existe para quem
   * quer outra tarefa — e é exatamente o caminho que produz prompt genérico, então não é o padrão.
   */
  const prompt = useMemo(() => {
    const alvo =
      tarefaLivre.trim().length > 0
        ? ({ tipo: "livre", tarefa: tarefaLivre.trim() } as const)
        : etapa
          ? ({ tipo: "etapa", etapa } as const)
          : null;

    if (!alvo) return null;

    return montarPrompt({
      destino,
      tipo,
      alvo,
      nomeProjeto: fontes.nomeProjeto,
      blueprint: fontes.blueprint,
      modelo: fontes.modelo,
      api: fontes.api,
      decisoes: fontes.decisoes,
      estadoBanco: fontes.estadoBanco,
      jaExiste: fontes.jaExiste,
      etapasConcluidas: concluidas,
      progresso: fontes.progresso,
    });
  }, [destino, tipo, tarefaLivre, etapa, concluidas, fontes]);

  return (
    <div className="space-y-4">
      <button
        onClick={aoVoltar}
        className="tap inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar para a conversa
      </button>

      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <FileCode className="size-4 text-primary" />
          Prompt de implementação
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Montado a partir do seu plano, sem passar por IA. Sai igual toda vez.
        </p>
      </div>

      {todasEtapas.length > 1 && (
        <Seletor
          titulo="Etapa"
          opcoes={todasEtapas.map((x) => ({
            id: String(x.ordem),
            rotulo: `${x.ordem}. ${x.titulo}`,
          }))}
          valor={String(etapa?.ordem ?? "")}
          aoEscolher={(v) => setOrdemEscolhida(Number(v))}
        />
      )}

      {etapa ? (
        <div className="rounded-xl border border-border bg-surface/40 p-3">
          <p className="text-xs text-muted-foreground">
            {etapa.ordem === fontes.etapaAtual ? "Etapa atual" : "Etapa escolhida"}
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {etapa.ordem}. {etapa.titulo}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{etapa.entrega}</p>
          {concluidas.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {concluidas.length}{" "}
              {concluidas.length === 1 ? "etapa concluída entra" : "etapas concluídas entram"} no
              prompt como &ldquo;não refaça&rdquo;.
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Este projeto ainda não tem trilha de execução. Gere o bloco Execução do plano para o
          prompt sair da etapa certa — ou escreva a tarefa abaixo.
        </p>
      )}

      <Seletor
        titulo="Para qual IA"
        opcoes={DESTINOS.map((d) => ({ id: d, rotulo: ROTULO_DESTINO[d] }))}
        valor={destino}
        aoEscolher={(v) => setDestino(v as Destino)}
      />

      <Seletor
        titulo="Tipo de trabalho"
        opcoes={TIPOS_PROMPT.map((t) => ({ id: t, rotulo: ROTULO_TIPO[t] }))}
        valor={tipo}
        aoEscolher={(v) => setTipo(v as TipoPrompt)}
      />

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Outra tarefa (opcional)
        </p>
        <input
          value={tarefaLivre}
          onChange={(e) => setTarefaLivre(e.target.value)}
          maxLength={300}
          placeholder={etapa ? "Deixe vazio para usar a etapa atual" : "Descreva a tarefa"}
          className="mt-2 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary/40"
        />
      </div>

      {prompt ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            <Chip tone="primary">{ROTULO_DESTINO[destino]}</Chip>
            <Chip tone="muted">{ROTULO_TIPO[tipo]}</Chip>
            <Chip tone="muted">{prompt.split("\n## ").length - 1} seções</Chip>
          </div>
          <BlocoCopiavel texto={prompt} rotulo="Cole na sua IA de codificação" />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Escreva a tarefa acima para gerar o prompt.</p>
      )}
    </div>
  );
}

function Seletor({
  titulo,
  opcoes,
  valor,
  aoEscolher,
}: {
  titulo: string;
  opcoes: { id: string; rotulo: string }[];
  valor: string;
  aoEscolher: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opcoes.map((o) => (
          <button
            key={o.id}
            onClick={() => aoEscolher(o.id)}
            className={cn(
              "tap rounded-full px-3 py-1.5 text-xs transition-colors",
              valor === o.id
                ? "bg-primary/15 font-medium text-primary"
                : "bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
