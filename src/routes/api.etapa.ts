import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { gerarEtapa } from "@/lib/blueprint/gerar-etapa";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas } from "@/lib/blueprint/respostas";

/**
 * POST /api/etapa — escreve o passo a passo de uma etapa do roadmap.
 *
 * Sob demanda, e guardado em `pathly_etapas`. São doze campos por etapa e um roadmap tem de 10 a
 * 30 delas: gerar tudo junto seria um JSON que nenhum modelo entrega, para um conteúdo que a
 * pessoa em boa parte nunca abriria.
 *
 * Sem cache compartilhado, ao contrário de `/api/licao`: uma aula sobre migrations é a mesma para
 * todo mundo, mas esta etapa cita as tabelas, a stack e as entregas anteriores DESTE projeto.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { projetoId?: unknown; ordem?: unknown };

type LinhaProjeto = { id: string; conteudo: Blueprint | null; respostas: unknown };

export const Route = createFileRoute("/api/etapa")({
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
        if (!token) return erro(401, "Faça login para abrir a etapa.");

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
        const ordem = Number(corpo.dados.ordem);
        if (!projetoId) return erro(400, "Faltou o projeto.");
        if (!Number.isInteger(ordem) || ordem < 1 || ordem > 60)
          return erro(400, "Etapa inválida.");

        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };

        // Lido com o token da pessoa: a RLS decide a posse, não uma checagem que eu escreveria aqui.
        const consulta = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?select=id,conteudo,respostas&id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (!consulta.ok) return erro(503, "Não consegui ler o projeto agora.");

        const projeto = ((await consulta.json()) as LinhaProjeto[])[0];
        if (!projeto) return erro(404, "Projeto não encontrado.");

        const blueprint = completarBlueprint(projeto.conteudo ?? {});
        const etapas = blueprint.execucao?.etapas ?? [];
        const etapa = etapas.find((e) => e.ordem === ordem);
        if (!etapa) return erro(409, "Esta etapa não existe no roadmap do projeto.");

        /**
         * Cache primeiro, e por projeto.
         *
         * A maioria das aberturas é releitura: a pessoa volta na etapa que está fazendo várias
         * vezes por dia. Cobrar geração por isso puniria justamente o uso normal do produto.
         */
        const salvaUrl = `${supabaseUrl}/rest/v1/pathly_etapas?select=conteudo&projeto_id=eq.${encodeURIComponent(projetoId)}&ordem=eq.${ordem}&limit=1`;
        const salva = await fetch(salvaUrl, { headers: comoUsuario });

        /**
         * A linha pode existir sem conteúdo: ela nasce quando a pessoa marca a etapa como
         * "fazendo" antes de abrir o texto. Guardar as duas informações separadas importa, porque
         * uma decide se devolvemos do cache e a outra decide entre INSERT e PATCH na gravação.
         */
        let linhaExiste = false;
        if (salva.ok) {
          const linhas = (await salva.json()) as { conteudo?: unknown }[];
          linhaExiste = linhas.length > 0;
          if (linhas[0]?.conteudo) {
            return new Response(JSON.stringify({ conteudo: linhas[0].conteudo, doCache: true }), {
              headers: JSON_HEADERS,
            });
          }
        }

        // O limite só conta depois do cache: reabrir uma etapa não chama provedor nenhum.
        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "etapa",
          LIMITES.etapa.limite,
          LIMITES.etapa.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você abriu muitas etapas novas em pouco tempo. Tente de novo mais tarde.",
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

        const gerado = await gerarEtapa(
          etapa,
          etapas,
          blueprint,
          lerRespostas(projeto.respostas),
          lerEnv,
          { comClaude: pro },
        );

        if (!gerado.ok) {
          return erro(503, "Não consegui escrever esta etapa agora.", {
            motivo: gerado.motivo,
            detalhe: gerado.detalhe,
          });
        }

        /**
         * Grava sem tocar em `status` nem em `checklist_feito`.
         *
         * `on_conflict` com `merge-duplicates` atualizaria a linha inteira, apagando o progresso
         * de quem já tinha marcado itens e mandou regerar o texto. O `PATCH` quando a linha já
         * existe escreve só o conteúdo — que é a única coisa que a geração produz.
         */
        const gravacao = linhaExiste
          ? fetch(
              `${supabaseUrl}/rest/v1/pathly_etapas?projeto_id=eq.${encodeURIComponent(projetoId)}&ordem=eq.${ordem}`,
              {
                method: "PATCH",
                headers: {
                  ...comoUsuario,
                  "Content-Type": "application/json",
                  Prefer: "return=minimal",
                },
                body: JSON.stringify({
                  conteudo: gerado.dados,
                  atualizado_em: new Date().toISOString(),
                }),
              },
            )
          : fetch(`${supabaseUrl}/rest/v1/pathly_etapas`, {
              method: "POST",
              headers: {
                ...comoUsuario,
                "Content-Type": "application/json",
                Prefer: "return=minimal",
              },
              body: JSON.stringify({
                projeto_id: projetoId,
                user_id: userId,
                ordem,
                conteudo: gerado.dados,
              }),
            });

        const guardado = await gravacao;

        // A etapa vai para a tela mesmo se a gravação falhar: a pessoa já pagou a espera.
        return new Response(
          JSON.stringify({
            conteudo: gerado.dados,
            modelo: gerado.modelo,
            salvo: guardado.ok,
            doCache: false,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
