import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { gerarMapaApi } from "@/lib/api/gerar";
import { validarModelo, type ModeloDeDados } from "@/lib/banco/contrato";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas, respostasSuficientes } from "@/lib/blueprint/respostas";

/**
 * POST /api/apis — projeta o mapa de APIs do projeto.
 *
 * Lê o modelo de dados junto quando ele existe: com as tabelas em mãos a IA desenha endpoints
 * sobre os campos que realmente vão existir, em vez de inventar nomes que depois não batem com o
 * banco. Sem o modelo ela ainda funciona, só com menos precisão.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { projetoId?: unknown; refazer?: unknown };
type LinhaProjeto = { id: string; conteudo: Blueprint | null; respostas: unknown };

export const Route = createFileRoute("/api/apis")({
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
        if (!token) return erro(401, "Faça login para projetar a API.");

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
        const refazer = corpo.dados.refazer === true;

        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };

        const consulta = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?select=id,conteudo,respostas&id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (!consulta.ok) return erro(503, "Não consegui ler o projeto agora.");

        const projeto = ((await consulta.json()) as LinhaProjeto[])[0];
        if (!projeto) return erro(404, "Projeto não encontrado.");

        const blueprint = completarBlueprint(projeto.conteudo ?? {});
        const respostas = lerRespostas(projeto.respostas);

        if (!respostasSuficientes(respostas)) {
          return erro(409, "Responda o questionário do projeto antes de projetar a API.", {
            motivo: "questionario-incompleto",
          });
        }
        if (!blueprint.produto) {
          return erro(
            409,
            "Gere a parte de Produto do plano antes: a API existe para as funcionalidades do MVP.",
            {
              motivo: "sem-produto",
            },
          );
        }

        const salvoUrl = `${supabaseUrl}/rest/v1/pathly_apis?select=mapa&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`;
        const salvo = await fetch(salvoUrl, { headers: comoUsuario });

        let existe = false;
        if (salvo.ok) {
          const linhas = (await salvo.json()) as { mapa?: unknown }[];
          existe = linhas.length > 0;
          if (linhas[0]?.mapa && !refazer) {
            return new Response(JSON.stringify({ mapa: linhas[0].mapa, doCache: true }), {
              headers: JSON_HEADERS,
            });
          }
        }

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "api",
          LIMITES.api.limite,
          LIMITES.api.janelaMinutos,
        );
        if (uso.permitido === false) {
          return erro(429, "Você projetou muitas APIs em pouco tempo. Tente de novo mais tarde.", {
            usadas: uso.usadas,
            limite: uso.limite,
          });
        }

        /**
         * O modelo de dados entra na geração quando já existe.
         *
         * A falha aqui é silenciosa de propósito: sem ele a API ainda é projetada, só sem os
         * nomes reais das colunas. Recusar seria pior — obrigaria a pessoa a projetar o banco
         * antes mesmo de querer olhar a API.
         */
        let modelo: ModeloDeDados | null = null;
        const doBanco = await fetch(
          `${supabaseUrl}/rest/v1/pathly_modelos_dados?select=modelo&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (doBanco.ok) {
          const linhas = (await doBanco.json()) as { modelo?: unknown }[];
          if (linhas[0]?.modelo) modelo = validarModelo(linhas[0].modelo);
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

        const gerado = await gerarMapaApi(blueprint, modelo, respostas, lerEnv, { comClaude: pro });
        if (!gerado.ok) {
          return erro(503, "Não consegui projetar a API agora.", {
            motivo: gerado.motivo,
            detalhe: gerado.detalhe,
          });
        }

        const gravacao = existe
          ? fetch(
              `${supabaseUrl}/rest/v1/pathly_apis?projeto_id=eq.${encodeURIComponent(projetoId)}`,
              {
                method: "PATCH",
                headers: {
                  ...comoUsuario,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  mapa: gerado.dados,
                  atualizado_em: new Date().toISOString(),
                }),
              },
            )
          : fetch(`${supabaseUrl}/rest/v1/pathly_apis`, {
              method: "POST",
              headers: {
                ...comoUsuario,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ projeto_id: projetoId, user_id: userId, mapa: gerado.dados }),
            });

        const guardado = await gravacao;

        return new Response(
          JSON.stringify({
            mapa: gerado.dados,
            modeloIa: gerado.modelo,
            usouModeloDeDados: modelo !== null,
            salvo: guardado.ok,
            doCache: false,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
