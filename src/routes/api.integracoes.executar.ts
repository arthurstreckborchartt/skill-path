import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { liberadaParaExecutar, validarAcao, type AcaoExterna } from "@/lib/integracoes/contrato";
import { executarAcao } from "@/lib/integracoes/executor";

/**
 * POST /api/integracoes/executar — executa uma ação **já aprovada**.
 *
 * ## O portão
 *
 * Esta rota é o único lugar de onde uma ação externa sai do Pathly, e ela recusa tudo que não
 * esteja `aprovada`. Três defesas, e nenhuma depende das outras:
 *
 *   1. `liberadaParaExecutar` confere o estado lido do banco.
 *   2. A **reserva** (abaixo) é condicional: duas chamadas simultâneas, uma executa.
 *   3. O gatilho no banco barra qualquer transição inválida, inclusive vinda daqui.
 *
 * A primeira é conveniência, a terceira é a garantia, e a segunda existe porque entre ler e
 * escrever cabe outra requisição.
 *
 * ## O corpo desta requisição não carrega a ação
 *
 * Só o `acaoId`. Tudo que vai sair — destino, payload — é lido da linha gravada no momento da
 * aprovação. Aceitar payload do cliente aqui anularia o portão inteiro: bastaria aprovar algo
 * inofensivo e mandar outra coisa na hora de executar.
 *
 * ## A rota lê como a pessoa, não como o banco
 *
 * As consultas vão com o token dela, então a RLS continua valendo e ninguém executa ação alheia
 * nem por engano de filtro. `service_role` entra só quando houver token de provedor para decifrar
 * — o que chega junto com o OAuth.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { acaoId?: unknown };

type LinhaAcao = {
  id: string;
  provedor: string;
  acao_id: string;
  projeto_id: string | null;
  resumo: string;
  destino: string;
  impacto: string;
  payload: unknown;
  estado: string;
  criado_em: string;
  decidido_em: string | null;
  executado_em: string | null;
  resultado: string | null;
  erro: string | null;
};

function daLinha(linha: LinhaAcao): AcaoExterna | null {
  return validarAcao({
    ...linha,
    acaoId: linha.acao_id,
    projetoId: linha.projeto_id,
    criadoEm: linha.criado_em,
    decididoEm: linha.decidido_em,
    executadoEm: linha.executado_em,
  });
}

/** O que vai para o banco e para a tela nunca é maior que isto. */
const TETO_RESULTADO = 400;

export const Route = createFileRoute("/api/integracoes/executar")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para executar uma ação.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");

        const corpo = await lerJsonLimitado<Corpo>(request);
        if (!corpo.ok) {
          return erro(
            400,
            corpo.motivo === "grande" ? "Requisição grande demais." : "Corpo inválido.",
          );
        }

        const acaoId = texto(corpo.dados.acaoId, 40);
        if (!acaoId) return erro(400, "Faltou a ação.");

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "integracoes",
          LIMITES.integracoes.limite,
          LIMITES.integracoes.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você executou muitas ações em pouco tempo. Tente de novo mais tarde.",
          );
          return erro(recusa.status, recusa.mensagem, { usadas: uso.usadas, limite: uso.limite });
        }

        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };
        const alvo = `${supabaseUrl}/rest/v1/pathly_acoes_externas?id=eq.${encodeURIComponent(acaoId)}`;

        const consulta = await fetch(`${alvo}&select=*&limit=1`, { headers: comoUsuario });
        if (!consulta.ok) return erro(503, "Não consegui ler a ação agora.");

        const linha = ((await consulta.json()) as LinhaAcao[])[0];
        // Ação de outra pessoa cai aqui também, porque a RLS a esconde da leitura. "Não existe" e
        // "não é sua" são a mesma resposta de propósito: a diferença entre elas conta a quem
        // pergunta que a ação existe.
        if (!linha) return erro(404, "Ação não encontrada.");

        const acao = daLinha(linha);
        if (!acao) return erro(422, "Esta ação está malformada e não pode ser executada.");

        if (!liberadaParaExecutar(acao)) {
          return erro(409, "Esta ação não está aprovada.", { estado: acao.estado });
        }

        /*
         * A reserva.
         *
         * `executado_em` é escrito ANTES de a chamada sair, com a condição de ainda estar nulo e
         * o estado ainda ser `aprovada`. Quem conseguir escrever executa; quem chegar depois
         * encontra zero linhas e para aqui. É o que faz uma aprovação valer uma execução só mesmo
         * com duas abas abertas.
         *
         * Escolhi marcar uma coluna existente em vez de criar um estado `executando`: um estado a
         * mais na máquina precisaria entrar no gatilho, nas transições e na tela, e a garantia
         * seria a mesma. O custo é que `executado_em` passa a significar "quando saiu", e não
         * "quando terminou" — está dito aqui e no comentário da coluna.
         *
         * O `estado` não muda nesta escrita, então o gatilho de transição não se opõe: ele só
         * examina mudança de estado e de conteúdo.
         */
        const reserva = await fetch(`${alvo}&estado=eq.aprovada&executado_em=is.null`, {
          method: "PATCH",
          headers: {
            ...comoUsuario,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ executado_em: new Date().toISOString() }),
        });
        if (!reserva.ok) return erro(503, "Não consegui reservar a execução agora.");

        const reservadas = (await reserva.json()) as LinhaAcao[];
        if (reservadas.length === 0) {
          return erro(409, "Esta ação já foi executada, ou não está mais aprovada.");
        }

        /*
         * Daqui para baixo a ação está reservada, e é por isso que o `catch` existe: sem ele, uma
         * exceção deixaria a linha reservada e `aprovada` para sempre — sem resultado e sem poder
         * ser retomada, porque a reserva é definitiva.
         *
         * Se ainda assim o processo morrer entre a reserva e a gravação, a ação fica presa em
         * `aprovada` com `executado_em` preenchido, e nunca mais executa. Falha fechada: para um
         * portão que existe para nada sair sem aprovação, não sair é o lado certo de errar.
         */
        let resultado: Awaited<ReturnType<typeof executarAcao>>;
        try {
          resultado = await executarAcao(acao, { token: null });
        } catch (e) {
          resultado = {
            ok: false,
            motivo: e instanceof Error ? e.message.slice(0, 160) : "Falha inesperada.",
            permanente: false,
          };
        }

        const gravado = await fetch(`${alvo}&estado=eq.aprovada`, {
          method: "PATCH",
          headers: {
            ...comoUsuario,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify(
            resultado.ok
              ? { estado: "executada", resultado: resultado.resumo.slice(0, TETO_RESULTADO) }
              : { estado: "falhou", erro: resultado.motivo.slice(0, TETO_RESULTADO) },
          ),
        });

        /*
         * A execução já aconteceu. Se a gravação falhar, dizer "não deu certo" seria mentira — e
         * uma mentira que convida a tentar de novo, o que é exatamente o que este portão existe
         * para impedir. Então a resposta conta as duas coisas separadas.
         */
        if (!gravado.ok) {
          return new Response(
            JSON.stringify({
              executou: resultado.ok,
              registrado: false,
              aviso: "A ação foi executada, mas não consegui gravar o resultado.",
              resultado: resultado.ok ? resultado.resumo : null,
              motivo: resultado.ok ? null : resultado.motivo,
            }),
            { status: 207, headers: JSON_HEADERS },
          );
        }

        const finalizada = daLinha(((await gravado.json()) as LinhaAcao[])[0] as LinhaAcao);

        return new Response(
          JSON.stringify({
            executou: resultado.ok,
            registrado: true,
            estado: finalizada?.estado ?? (resultado.ok ? "executada" : "falhou"),
            resultado: resultado.ok ? resultado.resumo : null,
            motivo: resultado.ok ? null : resultado.motivo,
            permanente: resultado.ok ? null : resultado.permanente,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
