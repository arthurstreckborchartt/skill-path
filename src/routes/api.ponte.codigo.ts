import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { ALFABETO_CODIGO, TAMANHO_CODIGO, VALIDADE_CODIGO_MIN } from "@/lib/hub/ponte/contrato";

/**
 * `POST /api/ponte/codigo` — gera o código de pareamento.
 *
 * ## Por que no servidor
 *
 * Porque o banco guarda só o hash do código, e a tela precisa ver o código em claro — as duas
 * coisas só acontecem no mesmo lugar se for aqui. Gerar no navegador e mandar o hash daria ao
 * cliente o poder de escolher o código, e um cliente que escolhe o código escolhe um que ele já
 * sabe.
 *
 * O código vale dez minutos e um uso. Depois disso, some — e a pessoa gera outro, que custa um
 * clique.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: JSON_HEADERS });
}

async function sha256(v: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Seis caracteres sorteados com `crypto.getRandomValues`.
 *
 * O módulo simples (`% alfabeto.length`) enviesaria as primeiras letras, porque 256 não divide
 * 31. Aqui os bytes fora da faixa são descartados e sorteados de novo — custa alguns bytes e
 * remove o viés, que num código de pareamento é a diferença entre 31⁶ e bem menos.
 */
function sortearCodigo(): string {
  const limite = Math.floor(256 / ALFABETO_CODIGO.length) * ALFABETO_CODIGO.length;
  const saida: string[] = [];

  while (saida.length < TAMANHO_CODIGO) {
    const bytes = crypto.getRandomValues(new Uint8Array(TAMANHO_CODIGO * 2));
    for (const b of bytes) {
      if (saida.length >= TAMANHO_CODIGO) break;
      if (b < limite) saida.push(ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]!);
    }
  }
  return saida.join("");
}

export const Route = createFileRoute("/api/ponte/codigo")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anon = lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        const servico = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
        if (!url || !anon || !servico) return erro(500, "Ambiente sem configuração de servidor.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para parear uma ponte.");

        const conferido = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anon },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");
        const { id: userId } = (await conferido.json()) as { id: string };

        const codigo = sortearCodigo();
        const expiraEm = new Date(Date.now() + VALIDADE_CODIGO_MIN * 60_000).toISOString();

        const r = await fetch(`${url.replace(/\/+$/, "")}/rest/v1/pathly_ponte_codigos`, {
          method: "POST",
          headers: {
            apikey: servico,
            Authorization: `Bearer ${servico}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            codigo_hash: await sha256(codigo),
            user_id: userId,
            expira_em: expiraEm,
          }),
        });

        if (!r.ok) return erro(503, "Não consegui gerar o código agora.");

        /* O código em claro sai daqui uma vez. O servidor guardou só o hash e não o tem mais. */
        return new Response(
          JSON.stringify({ codigo, expiraEm, validadeMinutos: VALIDADE_CODIGO_MIN }),
          {
            status: 200,
            headers: JSON_HEADERS,
          },
        );
      },
    },
  },
});
