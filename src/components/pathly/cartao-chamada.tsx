/**
 * O cartão de uma chamada de ferramenta MCP sugerida pelo Copilot.
 *
 * Arquivo próprio porque as DUAS superfícies de conversa precisam dele: a tela cheia do projeto e
 * o painel flutuante do app shell. Deixá-lo dentro de uma delas faria a sugestão aparecer numa e
 * desaparecer na outra — o modelo dizendo que a chamada ajuda, e nada na tela.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { Btn, Chip } from "@/components/pathly/ui";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { rotuloImpacto } from "@/lib/integracoes/contrato";
import type { ChamadaSugerida } from "@/lib/copilot/chamada-sugerida";

/**
 * Uma chamada de ferramenta MCP que o Copilot sugeriu.
 *
 * ## Três gestos, e nenhum deles é redundante
 *
 * O Copilot sugere, a pessoa **pede**, a pessoa **aprova**, o Pathly executa. Parece um a mais do
 * que o necessário, e é o contrário: cada um responde uma pergunta diferente. Sugerir é o Copilot
 * achando que ajuda. Pedir é a pessoa querendo. Aprovar é ela tendo lido para onde vai e com quê.
 *
 * O botão aqui faz só o segundo: grava uma ação `pendente`. Nada sai para fora. A aprovação e a
 * execução continuam em Integrações, onde já eram dois gestos — e é lá que o portão vive.
 *
 * ## Por que o botão não aprova
 *
 * Aprovar daqui seria um clique só, e parece melhor. Mas a descrição da ferramenta — texto de quem
 * opera o servidor — é parte do que levou o modelo a sugerir. Um clique que aprova e executa
 * transformaria esse texto em caminho para fora do Pathly. Dois cliques em telas diferentes
 * quebram essa corrente, e o custo é um clique.
 */
export function CartaoChamada({ chamada }: { chamada: ChamadaSugerida }) {
  const [estado, setEstado] = useState<"parado" | "indo" | "pedido">("parado");
  const [erro, setErro] = useState<string | null>(null);

  const host = (() => {
    try {
      return new URL(chamada.servidor).host;
    } catch {
      return chamada.servidor;
    }
  })();

  const args = JSON.stringify(chamada.argumentos, null, 2);
  const temArgs = Object.keys(chamada.argumentos).length > 0;

  async function pedir() {
    setEstado("indo");
    setErro(null);

    const { data: s } = await supabase.auth.getSession();
    const userId = s.session?.user.id;
    if (!userId) {
      setErro("Sua sessão expirou. Entre de novo.");
      setEstado("parado");
      return;
    }

    const { error } = await supabase.from("pathly_acoes_externas").insert({
      user_id: userId,
      provedor: "mcp",
      acao_id: chamada.ferramenta,
      /* A frase que ela lê ao aprovar é nossa. A do servidor fica citada, e marcada como citação. */
      resumo: `Chamar a ferramenta "${chamada.ferramenta}" no servidor MCP conectado.`,
      destino: `${host} → ${chamada.ferramenta}`,
      impacto: chamada.impacto,
      /*
       * Os argumentos vão exatamente como estão no cartão que ela leu. É o que `payload` existe
       * para garantir: aprovar um resumo e enviar outra coisa seria aprovação para o que ela não viu.
       */
      payload: { servidor: chamada.servidor, argumentos: chamada.argumentos as Json },
      estado: "pendente",
    });

    if (error) {
      setErro("Não consegui registrar o pedido.");
      setEstado("parado");
      return;
    }
    setEstado("pedido");
  }

  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={chamada.impacto === "destrutiva" ? "accent" : "muted"}>
          {chamada.impacto === "destrutiva" && <ShieldAlert className="size-3" />}
          {rotuloImpacto(chamada.impacto)}
        </Chip>
        <p className="font-mono text-xs">{chamada.ferramenta}</p>
        <span className="text-xs text-muted-foreground">em {host}</span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{chamada.motivo}</p>

      {temArgs && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Argumentos que seriam enviados
          </summary>
          <pre className="mt-1 overflow-x-auto rounded border border-border bg-surface-1 p-2 text-[11px] leading-relaxed">
            {args}
          </pre>
        </details>
      )}

      {estado === "pedido" ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Pedido registrado.{" "}
          <Link to="/app/integracoes" className="underline">
            Aprove em Integrações
          </Link>{" "}
          para que a chamada aconteça.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Btn
            size="sm"
            variant="outline"
            disabled={estado === "indo"}
            onClick={() => void pedir()}
          >
            Pedir aprovação
          </Btn>
          <span className="text-xs text-muted-foreground">
            Isto não chama nada: registra o pedido para você aprovar.
          </span>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}
