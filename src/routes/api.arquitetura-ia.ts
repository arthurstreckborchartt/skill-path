import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { gerarPlanoIa } from "@/lib/arquitetura-ia/gerar";
import { validarModelo } from "@/lib/banco/contrato";
import { validarMapa } from "@/lib/api/contrato";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas, respostasSuficientes } from "@/lib/blueprint/respostas";

/**
 * POST /api/arquitetura-ia — decide se o projeto precisa de IA e, se precisar, projeta.
 *
 * O plano guardado é devolvido sem chamada nenhuma. Só `refazer: true` gasta uma geração, pelo
 * mesmo motivo do banco e da API: um projeto tem uma arquitetura de IA, e quem abre a tela de
 * novo quer ler a que já existe.
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

export const Route = createFileRoute("/api/arquitetura-ia")({
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
        if (!token) return erro(401, "Faça login para projetar a arquitetura de IA.");

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

        const respostas = lerRespostas(projeto.respostas);
        if (!respostasSuficientes(respostas)) {
          return erro(409, "Responda o questionário do projeto antes de projetar a IA.", {
            motivo: "questionario-incompleto",
          });
        }

        const blueprint = completarBlueprint(projeto.conteudo ?? {});

        /**
         * O bloco Produto é a dependência dura.
         *
         * Sem as funcionalidades do MVP não há o que triar: a pergunta "isto precisa de IA?" só
         * existe quando há um "isto". Devolver um plano genérico aqui seria pior que recusar.
         */
        if (!blueprint.produto) {
          return erro(409, "Gere o bloco Produto do plano antes de projetar a IA.", {
            motivo: "sem-produto",
          });
        }

        const salvoUrl = `${supabaseUrl}/rest/v1/pathly_arquitetura_ia?select=plano&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`;
        const salvo = await fetch(salvoUrl, { headers: comoUsuario });
        const existente = salvo.ok ? ((await salvo.json()) as { plano?: unknown }[])[0] : undefined;

        if (existente?.plano && !refazer) {
          return new Response(JSON.stringify({ plano: existente.plano, doCache: true }), {
            headers: JSON_HEADERS,
          });
        }

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

        const modelo = doBanco.ok
          ? validarModelo(((await doBanco.json()) as { modelo?: unknown }[])[0]?.modelo)
          : null;
        const api = daApi.ok
          ? validarMapa(((await daApi.json()) as { mapa?: unknown }[])[0]?.mapa)
          : null;

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "arquitetura-ia",
          LIMITES.arquiteturaIa.limite,
          LIMITES.arquiteturaIa.janelaMinutos,
        );
        if (uso.permitido === false) {
          return erro(429, "Você projetou muitas vezes em pouco tempo. Tente de novo mais tarde.", {
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

        const gerado = await gerarPlanoIa(blueprint, modelo, api, respostas, lerEnv, {
          comClaude: pro,
        });

        /**
         * Aqui a falha da IA **é** erro da rota, ao contrário do módulo de segurança.
         *
         * Lá o catálogo existia sem a IA e o relatório fazia sentido sozinho. Aqui não sobra nada:
         * a triagem inteira é o julgamento do modelo sobre as funcionalidades deste projeto.
         * Devolver um plano vazio seria devolver um "você não precisa de IA" que ninguém decidiu.
         */
        if (!gerado.ok) {
          const status = gerado.motivo === "sem-chave" ? 500 : 503;
          return erro(
            status,
            gerado.motivo === "sem-chave"
              ? "A geração por IA não está configurada."
              : "Os serviços de IA estão congestionados. Toque em tentar de novo.",
            { motivo: gerado.motivo },
          );
        }

        const plano = gerado.dados;

        const guardado = await (existente !== undefined
          ? fetch(
              `${supabaseUrl}/rest/v1/pathly_arquitetura_ia?projeto_id=eq.${encodeURIComponent(projetoId)}`,
              {
                method: "PATCH",
                headers: {
                  ...comoUsuario,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({ plano, atualizado_em: new Date().toISOString() }),
              },
            )
          : fetch(`${supabaseUrl}/rest/v1/pathly_arquitetura_ia`, {
              method: "POST",
              headers: {
                ...comoUsuario,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({ projeto_id: projetoId, user_id: userId, plano }),
            }));

        return new Response(
          JSON.stringify({ plano, doCache: false, salvo: guardado.ok, modelo: gerado.modelo }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
