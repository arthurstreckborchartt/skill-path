import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { gerarModelo } from "@/lib/banco/gerar";
import { dialetoDaStack } from "@/lib/banco/dialetos";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas, respostasSuficientes } from "@/lib/blueprint/respostas";

/**
 * POST /api/banco — projeta o modelo de dados do projeto.
 *
 * Uma geração por projeto, guardada. O que muda depois — dialeto, checklist marcado — é escolha
 * da pessoa e não custa chamada nenhuma: o SQL de MySQL sai do mesmo modelo que o de Postgres,
 * por código.
 *
 * `refazer: true` regenera. Sem isso, a segunda chamada devolve o que já existe, porque abrir a
 * tela do banco não pode custar uma geração toda vez.
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

export const Route = createFileRoute("/api/banco")({
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
        if (!token) return erro(401, "Faça login para projetar o banco.");

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
          return erro(409, "Responda o questionário do projeto antes de projetar o banco.", {
            motivo: "questionario-incompleto",
          });
        }

        /**
         * O modelo de dados sai do MVP e dos requisitos funcionais.
         *
         * Sem o bloco de produto, a IA modelaria para uma ideia solta e inventaria tabelas — é
         * exatamente o erro que este produto existe para evitar. Recusar aqui é mais honesto que
         * gerar algo plausível e errado.
         */
        if (!blueprint.produto) {
          return erro(
            409,
            "Gere a parte de Produto do plano antes: o modelo de dados sai do MVP.",
            {
              motivo: "sem-produto",
            },
          );
        }

        const salvoUrl = `${supabaseUrl}/rest/v1/pathly_modelos_dados?select=modelo,dialeto&projeto_id=eq.${encodeURIComponent(projetoId)}&limit=1`;
        const salvo = await fetch(salvoUrl, { headers: comoUsuario });

        let existe = false;
        let dialetoSalvo: string | undefined;
        if (salvo.ok) {
          const linhas = (await salvo.json()) as { modelo?: unknown; dialeto?: string }[];
          existe = linhas.length > 0;
          dialetoSalvo = linhas[0]?.dialeto;
          if (linhas[0]?.modelo && !refazer) {
            return new Response(
              JSON.stringify({
                modelo: linhas[0].modelo,
                dialeto: linhas[0].dialeto ?? "postgres",
                doCache: true,
              }),
              { headers: JSON_HEADERS },
            );
          }
        }

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "banco",
          LIMITES.banco.limite,
          LIMITES.banco.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você projetou muitos bancos em pouco tempo. Tente de novo mais tarde.",
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

        const gerado = await gerarModelo(blueprint, respostas, lerEnv, { comClaude: pro });
        if (!gerado.ok) {
          return erro(503, "Não consegui projetar o banco agora.", {
            motivo: gerado.motivo,
            detalhe: gerado.detalhe,
          });
        }

        // O dialeto sai da stack só na primeira vez: depois disso a escolha é da pessoa, e
        // sobrescrevê-la a cada regeração desfaria a troca que ela fez na tela.
        const dialeto =
          existe && dialetoSalvo
            ? dialetoSalvo
            : dialetoDaStack(blueprint.tecnico?.stack.banco ?? "");

        const gravacao = existe
          ? fetch(
              `${supabaseUrl}/rest/v1/pathly_modelos_dados?projeto_id=eq.${encodeURIComponent(projetoId)}`,
              {
                method: "PATCH",
                headers: {
                  ...comoUsuario,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  modelo: gerado.dados,
                  atualizado_em: new Date().toISOString(),
                }),
              },
            )
          : fetch(`${supabaseUrl}/rest/v1/pathly_modelos_dados`, {
              method: "POST",
              headers: {
                ...comoUsuario,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                projeto_id: projetoId,
                user_id: userId,
                modelo: gerado.dados,
                dialeto,
              }),
            });

        const guardado = await gravacao;

        return new Response(
          JSON.stringify({
            modelo: gerado.dados,
            dialeto,
            modeloIa: gerado.modelo,
            salvo: guardado.ok,
            doCache: false,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
