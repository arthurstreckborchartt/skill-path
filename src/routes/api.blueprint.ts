import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { TETOS, lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { gerarBloco } from "@/lib/blueprint/gerar";
import { BLOCOS, blocosProntos, type Bloco, type Blueprint } from "@/lib/blueprint/contrato";
import { lerRespostas, respostasSuficientes } from "@/lib/blueprint/respostas";
import { avisos } from "@/lib/blueprint/regras";

/**
 * POST /api/blueprint — gera um bloco do plano técnico de um projeto.
 *
 * Diferente de `/api/licao`, aqui **não há cache compartilhado**. Uma aula sobre Wireshark é a
 * mesma para todo mundo; um blueprint é o projeto de uma pessoa, e cachear devolveria o plano de
 * outra.
 *
 * Um bloco por chamada, de propósito. As 23 seções numa requisição só levariam mais de dois
 * minutos e qualquer falha jogaria tudo fora — e, mais importante, a ordem dos blocos é a regra
 * do produto: não se escolhe banco de dados antes de saber que dados existem.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { projetoId?: unknown; bloco?: unknown };

type LinhaProjeto = {
  id: string;
  ideia: string;
  conteudo: Blueprint | null;
  respostas: unknown;
};

export const Route = createFileRoute("/api/blueprint")({
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
        if (!token) return erro(401, "Faça login para montar o plano.");

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

        const bloco = texto(corpo.dados.bloco, 20) as Bloco;
        if (!BLOCOS.includes(bloco)) return erro(400, "Bloco desconhecido.");

        const projetoId = texto(corpo.dados.projetoId, 40);
        if (!projetoId) return erro(400, "Faltou o projeto.");

        /**
         * O projeto é lido **com o token da pessoa**, não com a service role.
         *
         * Assim a RLS decide se ela pode ver este projeto, e não uma checagem de `user_id` que eu
         * poderia escrever errado aqui. Projeto de outra pessoa simplesmente não volta na
         * consulta — e um id inventado dá o mesmo resultado que um id alheio, sem revelar qual
         * dos dois é o caso.
         */
        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };
        const consulta = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?select=id,ideia,conteudo,respostas&id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (!consulta.ok) return erro(503, "Não consegui ler o projeto agora.");

        const linhas = (await consulta.json()) as LinhaProjeto[];
        const projeto = linhas[0];
        if (!projeto) return erro(404, "Projeto não encontrado.");

        const blueprint: Blueprint = projeto.conteudo ?? {};

        /**
         * As respostas saem do banco, nunca do corpo da requisição.
         *
         * O cliente poderia mandá-las junto e economizar uma leitura, mas aí bastaria enviar
         * `temPagamentos: true` para forçar arquitetura que a pessoa não pediu. Vindo do banco,
         * elas passaram pela RLS junto com o projeto.
         */
        const respostas = lerRespostas(projeto.respostas);
        if (!respostasSuficientes(respostas)) {
          return erro(409, "Responda o questionário do projeto antes de gerar o plano.", {
            motivo: "questionario-incompleto",
          });
        }

        // Regerar um bloco que já existe é permitido: a pessoa pode querer outra versão. Serve
        // só para não sobrescrever o nome do projeto, que ela pode ter renomeado à mão depois.
        const refazendo = Boolean(blueprint[bloco]);

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "blueprint",
          LIMITES.blueprint.limite,
          LIMITES.blueprint.janelaMinutos,
        );
        if (uso.permitido === false) {
          return erro(429, "Você gerou muitos planos em pouco tempo. Tente de novo mais tarde.", {
            usadas: uso.usadas,
            limite: uso.limite,
          });
        }

        /**
         * O plano sai do banco, nunca do cliente.
         *
         * `usePlan()` guarda o plano no localStorage para a tela não piscar — qualquer pessoa
         * edita aquilo pelo devtools. Se essa decisão viesse de lá, mandar `plano: "pro"` daria
         * acesso ao Claude de graça, na chamada mais cara que o app faz.
         */
        let pro = false;
        const perfil = await fetch(
          `${supabaseUrl}/rest/v1/pathly_profiles?select=plano&user_id=eq.${userId}&limit=1`,
          { headers: comoUsuario },
        );
        if (perfil.ok) {
          const p = (await perfil.json()) as { plano?: string }[];
          pro = p[0]?.plano === "pro";
        }

        const gerado = await gerarBloco(bloco, projeto.ideia, blueprint, respostas, lerEnv, {
          comClaude: pro,
        });

        if (!gerado.ok) {
          const status = gerado.motivo === "invalida" ? 409 : 503;
          return erro(status, "Não consegui montar esta parte do plano agora.", {
            motivo: gerado.motivo,
            detalhe: gerado.detalhe,
          });
        }

        const atualizado: Blueprint = { ...blueprint, [bloco]: gerado.dados };

        /**
         * A gravação também vai com o token da pessoa: a RLS de UPDATE confere a posse de novo,
         * no momento da escrita. Usar a service role aqui trocaria essa garantia por confiança na
         * consulta que fiz acima — e a consulta e a escrita não acontecem no mesmo instante.
         */
        const salvo = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?id=eq.${encodeURIComponent(projetoId)}`,
          {
            method: "PATCH",
            headers: {
              ...comoUsuario,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              conteudo: atualizado,
              atualizado_em: new Date().toISOString(),
              ...(bloco === "fundacao" && !refazendo
                ? { nome: (gerado.dados as { nome?: string }).nome ?? "Projeto sem nome" }
                : {}),
              ...(bloco === "execucao"
                ? { etapas_total: (gerado.dados as { etapas?: unknown[] }).etapas?.length ?? 0 }
                : {}),
            }),
          },
        );

        // A pessoa recebe o bloco mesmo se a gravação falhar: perder um conteúdo já gerado por
        // causa do banco seria o pior dos dois mundos — ela pagou o tempo de espera.
        return new Response(
          JSON.stringify({
            bloco,
            dados: gerado.dados,
            modelo: gerado.modelo,
            salvo: salvo.ok,
            // O que escapou das regras. O filtro não mexe em prosa, e esconder isso faria a
            // pessoa confiar num plano que ainda contraria o que ela respondeu.
            avisos:
              bloco === "tecnico" ? avisos(gerado.dados as Record<string, unknown>, respostas) : [],
            prontos: blocosProntos(atualizado),
            proximo: BLOCOS.find((b) => !atualizado[b]) ?? null,
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
