import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plug, ShieldAlert, Trash2 } from "lucide-react";
import { Btn, Chip, PageHeader, Panel, Skeleton } from "@/components/pathly/ui";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/mcp")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Servidores MCP — Pathly" },
      {
        name: "description",
        content: "Conecte servidores MCP e veja quais ferramentas eles oferecem.",
      },
    ],
  }),
  component: TelaMcp,
});

/**
 * Servidores MCP conectados, e o que cada um oferece.
 *
 * ## Esta tela não executa nada
 *
 * Fase 1 de `docs/MCP-CLIENTE.md`: conectar, descobrir e mostrar. Não há botão de chamar
 * ferramenta, porque não existe `tools/call` no código ainda — chamar é a fase 2, e passa pelo
 * portão de aprovação de `pathly_acoes_externas`.
 *
 * ## A regra visual que esta tela existe para cumprir
 *
 * Em todo o resto do Pathly, a frase que a pessoa lê antes de aprovar é escrita por nós. Aqui não:
 * a descrição de cada ferramenta vem de quem opera o servidor. Então ela **nunca** aparece como se
 * fosse palavra do Pathly — vem recuada, com a barra lateral e a atribuição, do mesmo jeito que
 * uma citação. Quem lê precisa saber de quem é a frase para saber quanto ela vale.
 */

type Ferramenta = {
  servidor: string;
  nome: string;
  descricao_do_servidor: string;
  impacto: string;
  impressao: string;
};

type Servidor = {
  endereco: string;
  nome: string;
  versao: string;
  protocolo: string;
};

type Estado =
  | { fase: "carregando" }
  | { fase: "pronta"; servidores: Servidor[]; ferramentas: Ferramenta[] }
  | { fase: "erro"; motivo: string };

/**
 * Acesso destipado às duas tabelas novas — e isto é honestidade de tipo, não preguiça.
 *
 * `src/integrations/supabase/types.ts` é **gerado a partir do banco**, e só vai conhecer
 * `pathly_mcp_servidores` e `pathly_mcp_ferramentas` depois que o SQL rodar de verdade.
 *
 * A saída fácil seria acrescentá-las lá à mão. O `CLAUDE.md` avisa exatamente contra isso: fazer
 * isso deixa o app compilar como se a tabela existisse, e aí `tsc` limpo passa a provar coerência
 * com o que eu **declarei**, nunca com o que o banco **tem**. Prefiro o cast aqui, visível e
 * comentado, a uma afirmação falsa no arquivo cuja função é descrever o banco.
 *
 * Quando o SQL rodar, o `types.ts` é regerado, as tabelas aparecem, e este helper pode sumir.
 */
type Resposta<T> = { data: T[] | null; error: { code?: string } | null };
type TabelaNova<T> = {
  select: (colunas: string) => Promise<Resposta<T>>;
  delete: () => { eq: (coluna: string, valor: string) => Promise<{ error: unknown }> };
};
function tabelaNova<T>(nome: string): TabelaNova<T> {
  return (supabase as unknown as { from: (t: string) => TabelaNova<T> }).from(nome);
}

const ROTULO_IMPACTO: Record<string, string> = {
  leitura: "Só leitura",
  escrita: "Escreve",
  destrutiva: "Destrutiva",
};

function TelaMcp() {
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });
  const [endereco, setEndereco] = useState("");
  const [token, setToken] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    const [s, f] = await Promise.all([
      tabelaNova<Servidor>("pathly_mcp_servidores").select("endereco,nome,versao,protocolo"),
      tabelaNova<Ferramenta>("pathly_mcp_ferramentas").select(
        "servidor,nome,descricao_do_servidor,impacto,impressao",
      ),
    ]);

    if (s.error || f.error) {
      /*
       * Enquanto o SQL da fase 1 não tiver rodado, as tabelas não existem e o PostgREST devolve
       * `PGRST205`. Dizer "ainda não executado" é a verdade; dizer "erro ao carregar" mandaria
       * alguém procurar defeito onde não há.
       */
      const codigo = s.error?.code ?? f.error?.code;
      setEstado({
        fase: "erro",
        motivo:
          codigo === "PGRST205"
            ? "As tabelas do MCP ainda não foram criadas no banco."
            : "Não consegui carregar os servidores agora.",
      });
      return;
    }

    setEstado({ fase: "pronta", servidores: s.data ?? [], ferramentas: f.data ?? [] });
  }

  useEffect(() => {
    void carregar();
  }, []);

  async function conectar(e: React.FormEvent) {
    e.preventDefault();
    if (!endereco.trim() || ocupado) return;
    setOcupado(true);
    setErro(null);
    setAviso(null);

    const sessao = (await supabase.auth.getSession()).data.session;
    if (!sessao) {
      setErro("Sessão expirada. Entre de novo.");
      setOcupado(false);
      return;
    }

    const r = await fetch("/api/mcp/conectar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessao.access_token}`,
      },
      body: JSON.stringify({ endereco: endereco.trim(), token: token.trim() || undefined }),
    });

    const corpo = (await r.json()) as { erro?: string; guardado?: boolean; aviso?: string };
    if (!r.ok) {
      setErro(corpo.erro ?? "Não consegui conectar.");
      setOcupado(false);
      return;
    }

    if (corpo.guardado === false) setAviso(corpo.aviso ?? null);
    setEndereco("");
    setToken("");
    await carregar();
    setOcupado(false);
  }

  async function desconectar(servidor: string) {
    await tabelaNova<Servidor>("pathly_mcp_servidores").delete().eq("endereco", servidor);
    await carregar();
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Servidores MCP"
        subtitle="Conecte um servidor e veja o que ele oferece. Nada é executado nesta tela."
      />

      <Panel className="mt-6 p-5">
        <form className="space-y-3" onSubmit={conectar}>
          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Endereço do servidor
            </span>
            <input
              type="url"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="https://servidor.exemplo.com/mcp"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              disabled={ocupado}
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Credencial, se o servidor pedir
            </span>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="opcional"
              autoComplete="off"
              className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              disabled={ocupado}
            />
            {/* Dito aqui, e não numa página de ajuda: é na hora de colar que a dúvida aparece. */}
            <span className="mt-1 block text-xs text-muted-foreground">
              Guardada cifrada. Não volta para o navegador depois de salva.
            </span>
          </label>

          {erro && (
            <p role="alert" className="text-sm font-medium">
              {erro}
            </p>
          )}
          {aviso && <p className="text-sm text-muted-foreground">{aviso}</p>}

          <Btn type="submit" disabled={ocupado || !endereco.trim()}>
            <Plug className="size-4" />
            {ocupado ? "Conectando…" : "Conectar"}
          </Btn>
        </form>
      </Panel>

      {estado.fase === "carregando" && (
        <div className="mt-6 space-y-2">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
      )}

      {estado.fase === "erro" && (
        <Panel className="mt-6 p-5">
          <p className="text-sm text-muted-foreground">{estado.motivo}</p>
        </Panel>
      )}

      {estado.fase === "pronta" && estado.servidores.length === 0 && (
        <Panel className="mt-6 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum servidor conectado. Cole um endereço acima para ver o que ele oferece.
          </p>
        </Panel>
      )}

      {estado.fase === "pronta" &&
        estado.servidores.map((s) => {
          const minhas = estado.ferramentas.filter((f) => f.servidor === s.endereco);
          return (
            <Panel key={s.endereco} className="mt-6 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.nome || "Servidor sem nome"}</p>
                  <p className="truncate text-xs text-muted-foreground">{s.endereco}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    versão {s.versao || "?"} · protocolo {s.protocolo || "?"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void desconectar(s.endereco)}
                  aria-label={`Desconectar ${s.nome || s.endereco}`}
                  className="tap grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <p className="mt-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {minhas.length} {minhas.length === 1 ? "ferramenta" : "ferramentas"}
              </p>

              <ul className="mt-2 space-y-2">
                {minhas.map((f) => (
                  <li key={f.nome} className="rounded-lg border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{f.nome}</span>
                      <Chip tone={f.impacto === "destrutiva" ? "accent" : "muted"}>
                        {f.impacto === "destrutiva" && <ShieldAlert className="size-3" />}
                        {ROTULO_IMPACTO[f.impacto] ?? f.impacto}
                      </Chip>
                    </div>

                    {f.descricao_do_servidor && (
                      /*
                       * Recuado e atribuído, como citação.
                       *
                       * Esta frase é do servidor, não nossa. Em qualquer outro lugar do app o
                       * texto que explica uma ação foi escrito por nós e revisado; aqui ele chega
                       * de um terceiro que pode estar mentindo. Apresentá-lo com a mesma cara do
                       * resto seria emprestar a nossa credibilidade para a palavra dele.
                       */
                      <blockquote className="mt-2 border-l-2 border-border pl-3">
                        <p className="text-sm text-muted-foreground">{f.descricao_do_servidor}</p>
                        <footer className="mt-1 text-xs text-muted-foreground">
                          — descrição escrita pelo servidor
                        </footer>
                      </blockquote>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          );
        })}
    </div>
  );
}
