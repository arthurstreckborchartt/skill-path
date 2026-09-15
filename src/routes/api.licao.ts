import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { gerarLicao, type ContextoLicao } from "@/lib/ia/gerar-licao";

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

        let contexto: ContextoLicao;
        try {
          contexto = (await request.json()) as ContextoLicao;
        } catch {
          return erro(400, "Corpo inválido.");
        }
        if (!contexto?.tarefa?.trim() || !contexto?.etapa?.trim()) {
          return erro(400, "Faltou a tarefa ou a etapa.");
        }
        contexto.habilidades = Array.isArray(contexto.habilidades) ? contexto.habilidades : [];
        contexto.area = contexto.area || "tecnologia";
        contexto.objetivoEtapa = contexto.objetivoEtapa || "";

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
            return new Response(JSON.stringify({ licao: linhas[0].conteudo, doCache: true }), {
              headers: JSON_HEADERS,
            });
          }
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
            headers: {
              apikey: serviceRole,
              Authorization: `Bearer ${serviceRole}`,
              "Content-Type": "application/json",
              Prefer: "resolution=ignore-duplicates,return=minimal",
            },
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
          JSON.stringify({ licao: gerada.licao, doCache: false, cacheado: !!serviceRole }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
