import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { gerarLicao, type ContextoLicao } from "@/lib/ia/gerar-licao";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { TETOS, lerJsonLimitado, listaDeTextos, texto } from "@/lib/entrada-segura";
import { cabecalhosServico } from "@/lib/supabase-servidor";

/**
 * POST /api/licao — o conteúdo de uma aula, gerado sob demanda e guardado.
 *
 * Sob demanda porque uma rota tem 30 a 40 tarefas: gerar tudo no fim do onboarding custaria 40
 * chamadas para um conteúdo que a pessoa talvez nunca abra.
 *
 * E o cache é **compartilhado entre pessoas**, não por usuário. Duas pessoas com a tarefa
 * "Analisar tráfego de rede com o Wireshark" recebem a mesma aula — o assunto não muda de dono.
 * Isso derruba o custo de forma desproporcional: quanto mais gente usa, menos se gera.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

/** Chave estável do conteúdo: mesma tarefa no mesmo contexto, mesma aula. */
async function chaveDe(c: ContextoLicao): Promise<string> {
  const base = [c.tarefa, c.etapa, [...c.habilidades].sort().join("|"), c.area]
    .map((p) => p.trim().toLowerCase())
    .join("::");
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(base));
  return [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 48);
}

async function usuarioValido(token: string, url: string, anon: string): Promise<boolean> {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  });
  return r.ok;
}

export const Route = createFileRoute("/api/licao")({
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
        if (!token) return erro(401, "Faça login para abrir a aula.");
        if (!(await usuarioValido(token, supabaseUrl, anonKey))) {
          return erro(401, "Sessão expirada. Entre de novo.");
        }

        const corpo = await lerJsonLimitado<Partial<ContextoLicao>>(request);
        if (!corpo.ok) {
          return erro(
            400,
            corpo.motivo === "grande" ? "Requisição grande demais." : "Corpo inválido.",
          );
        }

        /**
         * Todo campo é cortado no teto antes de virar prompt.
         *
         * Sem isto, o corpo da requisição é o prompt: qualquer pessoa autenticada mandaria
         * megabytes de texto como "tarefa" e usaria as chaves de IA do projeto como serviço
         * próprio. O custo de uma chamada é proporcional ao que se manda.
         */
        const contexto: ContextoLicao = {
          tarefa: texto(corpo.dados.tarefa, TETOS.tarefa),
          etapa: texto(corpo.dados.etapa, TETOS.etapa),
          objetivoEtapa: texto(corpo.dados.objetivoEtapa, TETOS.objetivo),
          habilidades: listaDeTextos(corpo.dados.habilidades, TETOS.habilidades, TETOS.habilidade),
          area: texto(corpo.dados.area, TETOS.area) || "tecnologia",
        };
        if (!contexto.tarefa || !contexto.etapa) {
          return erro(400, "Faltou a tarefa ou a etapa.");
        }

        const chave = await chaveDe(contexto);
        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };

        // Cache primeiro: a maioria das aberturas não deve gerar nada.
        const cache = await fetch(
          `${supabaseUrl}/rest/v1/pathly_licoes?select=conteudo&chave=eq.${chave}&limit=1`,
          { headers: comoUsuario },
        );
        if (cache.ok) {
          const linhas = (await cache.json()) as { conteudo?: unknown }[];
          if (linhas[0]?.conteudo) {
            return new Response(
              // A chave volta junto: e por ela que o cliente registra qual PERGUNTA foi errada,
              // sem precisar recalcular o hash no navegador.
              JSON.stringify({ licao: linhas[0].conteudo, chave, doCache: true }),
              { headers: JSON_HEADERS },
            );
          }
        }

        /**
         * O limite é conferido só AQUI, depois do cache.
         *
         * Ler do cache não chama provedor nenhum e não custa nada — cobrar cota por isso puniria
         * justamente o caminho barato, e empurraria a pessoa a evitar reabrir a aula.
         */
        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "licao",
          LIMITES.licao.limite,
          LIMITES.licao.janelaMinutos,
        );
        if (uso.permitido === false) {
          return erro(
            429,
            "Você abriu muitas aulas novas em pouco tempo. Tente de novo mais tarde.",
            {
              usadas: uso.usadas,
              limite: uso.limite,
            },
          );
        }

        const gerada = await gerarLicao(contexto, lerEnv);
        if (!gerada.ok) {
          return erro(503, "A aula não está disponível agora.", {
            motivo: gerada.motivo,
            detalhe: gerada.detalhe,
          });
        }

        // Guarda com a service role: `pathly_licoes` não tem política de escrita de propósito —
        // se `authenticated` pudesse inserir, uma pessoa escreveria a aula que as outras leem.
        const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
        if (serviceRole) {
          await fetch(`${supabaseUrl}/rest/v1/pathly_licoes`, {
            method: "POST",
            headers: cabecalhosServico(serviceRole, {
              "Content-Type": "application/json",
              Prefer: "resolution=ignore-duplicates,return=minimal",
            }),
            body: JSON.stringify({
              chave,
              tarefa: contexto.tarefa,
              etapa: contexto.etapa,
              habilidades: contexto.habilidades,
              conteudo: gerada.licao,
              modelo: gerada.modelo,
            }),
          }).catch(() => undefined);
        }

        // Sem service role a aula ainda vai para a tela: perder um conteúdo já gerado por causa
        // do cache seria o pior dos dois mundos.
        return new Response(
          JSON.stringify({ licao: gerada.licao, chave, doCache: false, cacheado: !!serviceRole }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
