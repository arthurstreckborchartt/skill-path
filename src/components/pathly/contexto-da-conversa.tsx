import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Skeleton } from "./ui";
import { PARTES, type SlugDeParte } from "./partes";
import { useModeloDeDados } from "@/lib/banco/usar-banco";
import { useMapaApi } from "@/lib/api/usar-api";
import { rotear, type Faceta } from "@/lib/copilot/roteador";
import type { Blueprint } from "@/lib/blueprint/contrato";

/**
 * O painel que reage ao assunto da conversa.
 *
 * ## O mecanismo já existia e nunca tinha chegado à tela
 *
 * `rotear()` pontua a pergunta contra onze facetas — banco, api, auth, segurança, ia, roadmap,
 * deploy, erro, stack, produto — e existe desde o começo do Copilot. Até aqui ele servia só para
 * escolher o que entra no prompt do modelo. A pessoa nunca viu o resultado.
 *
 * Agora a mesma função roda no cliente sobre a última coisa que ela escreveu, e o painel da
 * direita mostra o que o Pathly já sabe sobre aquele assunto. Chamar a função em dois lugares não
 * é duas fontes de verdade: é a mesma função pura, com a mesma entrada.
 *
 * ## A regra é aparecer pouco
 *
 * Cinco das onze facetas não têm painel: `erro`, `geral` e as que não têm o que mostrar devolvem
 * `null` e nada aparece. Um painel que aparece sempre deixa de ser contexto e vira decoração —
 * e a tela volta a ser o dashboard que a reformulação existe para tirar.
 *
 * Por isso também a ordem: só o **primeiro** assunto vira painel. Uma pergunta que toca em banco
 * e em API é uma pergunta sobre banco com uma menção — mostrar os dois empilhados seria devolver
 * a sensação de cards que ninguém pediu.
 */

/** O que o painel mostra: um título, um valor em destaque, e alguns itens conferidos. */
type Conteudo = {
  rotulo: string;
  valor: string;
  itens: string[];
  /** Para onde o "ver" leva. `null` quando aquele assunto não tem uma parte própria. */
  parte: SlugDeParte | null;
};

/** Um texto que vale a pena mostrar — descarta o que a IA escreve quando não sabe. */
function util(v: string | undefined | null): string | null {
  const t = v?.trim() ?? "";
  if (t.length < 2) return null;
  return ["n/a", "-", "nenhum", "não definido", "nao definido", "a definir"].includes(
    t.toLowerCase(),
  )
    ? null
    : t;
}

/**
 * O conteúdo de cada faceta, tirado do blueprint que a tela já carregou.
 *
 * Zero consulta a mais: `banco` e `api` são as únicas que precisam de uma, e elas a fazem dentro
 * do próprio painel — só quando aparecem.
 */
function doBlueprint(faceta: Faceta, bp: Blueprint): Conteudo | null {
  const t = bp.tecnico;

  if (faceta === "auth") {
    const a = t?.autenticacao;
    if (!a?.necessaria) return null;
    const metodo = util(a.metodo);
    if (!metodo) return null;
    return {
      rotulo: "Autenticação",
      valor: metodo,
      itens: [util(a.sessao), ...a.papeis.slice(0, 3).map((p) => p.nome)].filter((x): x is string =>
        Boolean(x),
      ),
      parte: "seguranca",
    };
  }

  if (faceta === "stack") {
    const s = t?.stack;
    const valor = util(s?.frontend);
    if (!valor) return null;
    return {
      rotulo: "Stack",
      valor,
      itens: [util(s?.backend), util(s?.banco), util(s?.hospedagem)].filter((x): x is string =>
        Boolean(x),
      ),
      parte: "plano",
    };
  }

  if (faceta === "deploy") {
    const d = bp.operacao?.deploy;
    const valor = util(d?.estrategia);
    if (!valor) return null;
    return { rotulo: "Deploy", valor, itens: d?.ambientes.slice(0, 4) ?? [], parte: "publicar" };
  }

  if (faceta === "ia") {
    const valor = util(t?.ia);
    if (!valor) return null;
    return { rotulo: "IA no produto", valor, itens: [], parte: "ia" };
  }

  if (faceta === "seguranca") {
    const s = t?.seguranca ?? [];
    if (s.length === 0) return null;
    return {
      rotulo: "Segurança",
      valor: `${s.length} ${s.length === 1 ? "medida" : "medidas"} no plano`,
      itens: s.slice(0, 4),
      parte: "seguranca",
    };
  }

  if (faceta === "produto") {
    const mvp = bp.produto?.funcionalidades.filter((f) => f.prioridade === "mvp") ?? [];
    if (mvp.length === 0) return null;
    return {
      rotulo: "MVP",
      valor: `${mvp.length} ${mvp.length === 1 ? "funcionalidade" : "funcionalidades"}`,
      itens: mvp.slice(0, 4).map((f) => f.nome),
      parte: "plano",
    };
  }

  if (faceta === "roadmap") {
    const e = bp.execucao;
    if (!e || e.etapas.length === 0) return null;
    return {
      rotulo: "Roadmap",
      valor: `${e.etapas.length} etapas em ${e.fases.length} fases`,
      itens: e.etapas.slice(0, 3).map((x) => x.titulo),
      parte: "etapas",
    };
  }

  return null;
}

// =============================================================================================
// Os dois que precisam de consulta
// =============================================================================================

function PainelDoBanco({ projetoId }: { projetoId: string }) {
  const { estado } = useModeloDeDados(projetoId);
  if (estado.estado === "carregando") return <Carregando />;
  if (estado.estado !== "pronto" || !estado.modelo) return null;

  const entidades = estado.modelo.entidades ?? [];
  if (entidades.length === 0) return null;

  return (
    <Cartao
      conteudo={{
        rotulo: "Banco de dados",
        valor: estado.dialeto,
        itens: entidades.slice(0, 5).map((e) => e.nome),
        parte: "dados",
      }}
      projetoId={projetoId}
      restantes={Math.max(0, entidades.length - 5)}
    />
  );
}

function PainelDaApi({ projetoId }: { projetoId: string }) {
  const { estado } = useMapaApi(projetoId);
  if (estado.estado === "carregando") return <Carregando />;
  if (estado.estado !== "pronto" || !estado.mapa) return null;

  const eps = estado.mapa.endpoints ?? [];
  if (eps.length === 0) return null;

  return (
    <Cartao
      conteudo={{
        rotulo: "API",
        valor: `${eps.length} ${eps.length === 1 ? "endpoint" : "endpoints"}`,
        itens: eps.slice(0, 5).map((e) => `${e.metodo} ${e.caminho}`),
        parte: "api",
      }}
      projetoId={projetoId}
      restantes={Math.max(0, eps.length - 5)}
    />
  );
}

// =============================================================================================
// A casca
// =============================================================================================

function Carregando() {
  return <Skeleton className="h-36 rounded-lg" />;
}

function Cartao({
  conteudo,
  projetoId,
  restantes = 0,
}: {
  conteudo: Conteudo;
  projetoId: string;
  restantes?: number;
}) {
  const nomeDaParte = PARTES.find((p) => p.slug === conteudo.parte)?.rotulo;

  return (
    <aside className="rounded-lg border border-border bg-surface p-4">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {conteudo.rotulo}
      </p>
      <p className="mt-1.5 text-sm font-medium break-words">{conteudo.valor}</p>

      {conteudo.itens.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {conteudo.itens.map((i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0" />
              <span className="min-w-0 break-words">{i}</span>
            </li>
          ))}
          {restantes > 0 && (
            <li className="pl-5 text-xs text-muted-foreground">e mais {restantes}</li>
          )}
        </ul>
      )}

      {conteudo.parte && nomeDaParte && (
        <Link
          to="/app/projeto/$id"
          params={{ id: projetoId }}
          search={{ parte: conteudo.parte }}
          className="tap mt-4 inline-block text-xs underline underline-offset-2"
        >
          Ver {nomeDaParte.toLowerCase()}
        </Link>
      )}
    </aside>
  );
}

/**
 * O painel de contexto da conversa.
 *
 * `null` quando não há assunto detectado, quando o assunto não tem painel, ou quando o painel não
 * tem o que mostrar. Os três casos são silenciosos de propósito: a ausência de painel não é uma
 * falha a explicar, é o estado normal.
 */
export function ContextoDaConversa({
  projetoId,
  blueprint,
  ultimaPergunta,
}: {
  projetoId: string;
  blueprint: Blueprint;
  ultimaPergunta: string | null;
}) {
  if (!ultimaPergunta) return null;

  const faceta = rotear(ultimaPergunta).facetas[0];
  if (!faceta) return null;

  if (faceta === "banco") return <PainelDoBanco projetoId={projetoId} />;
  if (faceta === "api") return <PainelDaApi projetoId={projetoId} />;

  const conteudo = doBlueprint(faceta, blueprint);
  return conteudo ? <Cartao conteudo={conteudo} projetoId={projetoId} /> : null;
}
