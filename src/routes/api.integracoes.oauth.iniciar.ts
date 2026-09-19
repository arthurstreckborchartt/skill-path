import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { cifragemDisponivel } from "@/lib/integracoes/cripto";
import { gravarCookie } from "@/lib/integracoes/cookie-oauth";
import { gerarPkce, novoEstado, urlDeAutorizacao } from "@/lib/integracoes/github";
import { acharProvedor } from "@/lib/integracoes/provedores";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";

/**
 * POST /api/integracoes/oauth/iniciar — começa a conexão com um provedor.
 *
 * ## Por que POST, e não um link
 *
 * O jeito óbvio seria um `<a href>` para cá, e ele não funciona: esta rota precisa saber **quem**
 * está conectando, e a sessão do Supabase vive no `localStorage` — o servidor não a vê numa
 * navegação de topo.
 *
 * Então o cliente chama com o `Bearer`, recebe a URL do GitHub em JSON e navega por conta própria.
 * A identidade fica guardada no cookie cifrado que sai daqui, e é o que o callback vai usar.
 *
 * ## O redirect_uri é derivado, não configurado
 *
 * Ele sai da origem desta requisição. Configurá-lo numa variável criaria duas fontes de verdade —
 * a variável e o que está cadastrado no GitHub — e a primeira vez que alguém mudasse de domínio
 * sem mexer na variável, o erro apareceria como "redirect_uri_mismatch", que não diz onde olhar.
 *
 * O GitHub compara com o que está cadastrado, e casamento exato é o padrão. Se o app rodar atrás
 * de um proxy que reescreva o host, é aqui que se conserta.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: JSON_HEADERS });
}

type Corpo = { provedor?: unknown };

export const Route = createFileRoute("/api/integracoes/oauth/iniciar")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const sessao = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!sessao) return erro(401, "Faça login para conectar uma ferramenta.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${sessao}`, apikey: anonKey },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");
        const { id: userId } = (await conferido.json()) as { id: string };

        const corpo = await lerJsonLimitado<Corpo>(request);
        if (!corpo.ok) return erro(400, "Corpo inválido.");

        const provedorId = texto(corpo.dados.provedor, 20);
        const provedor = acharProvedor(provedorId);
        if (!provedor) return erro(400, "Provedor desconhecido.");
        if (provedorId !== "github") {
          return erro(400, "Este provedor não usa OAuth.");
        }

        const clientId = lerEnv("GITHUB_OAUTH_CLIENT_ID");
        const clientSecret = lerEnv("GITHUB_OAUTH_CLIENT_SECRET");
        /*
         * O secret não é usado aqui, mas é conferido aqui: mandar a pessoa para o GitHub, ela
         * autorizar, e só então o callback descobrir que não dá para trocar o código seria pedir
         * permissão para nada. Melhor recusar antes de sair do app.
         */
        if (!clientId || !clientSecret) {
          return erro(503, "A conexão com o GitHub ainda não foi configurada neste ambiente.");
        }
        if (!cifragemDisponivel()) {
          return erro(503, "Falta a chave de cifragem no servidor. Sem ela, não guardo token.");
        }

        const origem = new URL(request.url).origin;
        const redirectUri = `${origem}/api/integracoes/oauth/callback`;
        const seguro = origem.startsWith("https://");

        const estado = novoEstado();
        const { verificador, desafio } = await gerarPkce();

        const cookie = await gravarCookie(
          { estado, verificador, userId, provedor: provedorId },
          seguro,
        );
        if (!cookie) return erro(503, "Não consegui preparar a conexão agora.");

        const url = urlDeAutorizacao({
          clientId,
          redirectUri,
          estado,
          desafio,
          escopos: provedor.escopos,
        });

        return new Response(JSON.stringify({ url }), {
          headers: { ...JSON_HEADERS, "Set-Cookie": cookie },
        });
      },
    },
  },
});
