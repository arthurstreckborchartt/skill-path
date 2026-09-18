import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { analisar, type ContextoSeguranca } from "@/lib/seguranca/riscos";
import { gerarExtras } from "@/lib/seguranca/extras";
import { validarModelo } from "@/lib/banco/contrato";
import { validarMapa } from "@/lib/api/contrato";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas, respostasSuficientes } from "@/lib/blueprint/respostas";

/**
 * POST /api/seguranca — busca os riscos específicos deste projeto.
 *
 * Só os **extras** passam por aqui. A análise estática roda no cliente, a partir dos artefatos
 * que ele já carregou, e não custa chamada nenhuma — é o que garante que o relatório exista
 * mesmo com todo provedor de IA fora do ar.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { projetoId?: unknown };
type LinhaProjeto = { id: string; conteudo: Blueprint | null; respostas: unknown };

export const Route = createFileRoute("/api/seguranca")({
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
        if (!token) return erro(401, "Faça login para analisar a segurança.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");
        const { id: userId } = (await conferido.json()) as { id: string };

        const corpo = await lerJsonLimitado<Corpo>(request);
        if (!corpo.ok) {
          return erro(
            400,
            corpo.motivo === "grande" ? "Requisição grande demais." : "Corpo inválido.",
          );
        }

        const projetoId = texto(corpo.dados.projetoId, 40);
        if (!projetoId) return erro(400, "Faltou o projeto.");

        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };

        const consulta = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?select=id,conteudo,respostas&id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (!consulta.ok) return erro(503, "Não consegui ler o projeto agora.");

        const projeto = ((await consulta.json()) as LinhaProjeto[])[0];
        if (!projeto) return erro(404, "Projeto não encontrado.");

        const respostas = lerRespostas(projeto.respostas);
        if (!respostasSuficientes(respostas)) {
          return erro(409, "Responda o questionário do projeto antes de analisar a segurança.", {
            motivo: "questionario-incompleto",
          });
        }

        // Os dois artefatos entram quando existem. A ausência não impede nada: a análise estática
        // roda com o que houver, e a tela diz o que ficou fora do alcance.
        const [doBanco, daApi] = await Promise.all([
          fetch(
            `${supabaseUrl}/rest/v1/pathly_modelos_dados?select=modelo&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`,
            { headers: comoUsuario },
          ),
          fetch(
            `${supabaseUrl}/rest/v1/pathly_apis?select=mapa&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`,
            { headers: comoUsuario },
          ),
        ]);

        const contexto: ContextoSeguranca = {
          respostas,
          blueprint: completarBlueprint(projeto.conteudo ?? {}),
          modelo: doBanco.ok
            ? validarModelo(((await doBanco.json()) as { modelo?: unknown }[])[0]?.modelo)
            : null,
          api: daApi.ok
            ? validarMapa(((await daApi.json()) as { mapa?: unknown }[])[0]?.mapa)
            : null,
        };

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "seguranca",
          LIMITES.seguranca.limite,
          LIMITES.seguranca.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você analisou muitas vezes em pouco tempo. Tente de novo mais tarde.",
          );
          return erro(recusa.status, recusa.mensagem, {
            usadas: uso.usadas,
            limite: uso.limite,
          });
        }

        let pro = false;
        const perfil = await fetch(
          `${supabaseUrl}/rest/v1/pathly_profiles?select=plano&user_id=eq.${userId}&limit=1`,
          { headers: comoUsuario },
        );
        if (perfil.ok) {
          const p = (await perfil.json()) as { plano?: string }[];
          pro = p[0]?.plano === "pro";
        }

        const analise = analisar(contexto);
        const gerado = await gerarExtras(contexto, analise, lerEnv, { comClaude: pro });

        /**
         * A falha da IA **não** é erro desta rota.
         *
         * O relatório de segurança precisa existir com todo provedor fora do ar — é justamente
         * quando as coisas estão ruins que alguém vai querer conferir se pode lançar. Devolver 503
         * aqui esconderia os 26 riscos do catálogo por causa de um extra que não veio.
         */
        const extras = gerado.ok ? gerado.dados.riscos : [];

        const salvoUrl = `${supabaseUrl}/rest/v1/pathly_seguranca?select=projeto_id&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`;
        const salvo = await fetch(salvoUrl, { headers: comoUsuario });
        const existe = salvo.ok && ((await salvo.json()) as unknown[]).length > 0;

        const guardado = await (existe
          ? fetch(
              `${supabaseUrl}/rest/v1/pathly_seguranca?projeto_id=eq.${encodeURIComponent(projetoId)}`,
              {
                method: "PATCH",
                headers: {
                  ...comoUsuario,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({ extras, atualizado_em: new Date().toISOString() }),
              },
            )
          : fetch(`${supabaseUrl}/rest/v1/pathly_seguranca`, {
              method: "POST",
              headers: {
                ...comoUsuario,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ projeto_id: projetoId, user_id: userId, extras }),
            }));

        return new Response(
          JSON.stringify({
            extras,
            extrasVieram: gerado.ok,
            motivoExtras: gerado.ok ? null : gerado.motivo,
            salvo: guardado.ok,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
