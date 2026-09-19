import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { cifrar } from "@/lib/integracoes/cripto";
import { apagarCookie, lerCookie, mesmoEstado } from "@/lib/integracoes/cookie-oauth";
import { contaDe, trocarCodigo } from "@/lib/integracoes/github";
import { acharProvedor } from "@/lib/integracoes/provedores";

/**
 * GET /api/integracoes/oauth/callback — a volta do GitHub.
 *
 * ## Esta rota nunca redireciona para onde mandarem
 *
 * O destino é fixo, escrito aqui. A tentação num callback é aceitar um `?next=` e levar a pessoa
 * de volta para onde ela estava — e é assim que se constrói um redirecionamento aberto num
 * endereço que o GitHub acabou de autorizar. O que varia é só a mensagem, por um parâmetro que
 * esta rota mesma escolhe de uma lista fechada.
 *
 * ## Por que `service_role`
 *
 * `authenticated` não pode escrever em `pathly_conexoes` — o script de privilégio dá a ele
 * `select` de algumas colunas e `delete`, nada mais. Isso é deliberado: quem grava token é o
 * servidor, porque é o único que tem a chave para cifrar.
 *
 * O custo é que esta rota roda com uma chave que ignora RLS. Por isso ela escreve **uma linha
 * só**, com o `user_id` vindo do cookie cifrado — nunca da query, nunca do corpo.
 *
 * ## O que nunca aparece
 *
 * Token e `client_secret` não vão para log, nem para a URL de volta, nem para a mensagem de erro.
 * O que a pessoa lê é "não consegui conectar"; o motivo técnico morre aqui.
 */

const DESTINO = "/app/integracoes";

/** Lista fechada. A URL de volta só carrega uma destas, nunca texto vindo de fora. */
type Aviso = "conectado" | "recusado" | "estado-invalido" | "falhou" | "sem-config";

function voltar(aviso: Aviso, cookie: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      Location: `${DESTINO}?oauth=${aviso}`,
      "Set-Cookie": cookie,
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/integracoes/oauth/callback")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const seguro = url.origin.startsWith("https://");
        const limpar = apagarCookie(seguro);

        /*
         * O cookie é lido e apagado em todos os caminhos, inclusive nos de erro. Deixar um estado
         * de OAuth vivo depois de uma tentativa falha é deixar um `state` válido esperando por
         * quem quiser tentar de novo com ele.
         */
        const guardado = await lerCookie(request.headers.get("Cookie"));
        if (!guardado) return voltar("estado-invalido", limpar);

        // A pessoa clicou em "cancelar" na tela do GitHub. Não é falha, é resposta.
        if (url.searchParams.get("error")) return voltar("recusado", limpar);

        const codigo = url.searchParams.get("code") ?? "";
        const estadoVindo = url.searchParams.get("state") ?? "";
        if (!codigo || !estadoVindo) return voltar("estado-invalido", limpar);
        if (!mesmoEstado(estadoVindo, guardado.estado)) return voltar("estado-invalido", limpar);

        const provedor = acharProvedor(guardado.provedor);
        if (!provedor) return voltar("falhou", limpar);

        const clientId = lerEnv("GITHUB_OAUTH_CLIENT_ID");
        const clientSecret = lerEnv("GITHUB_OAUTH_CLIENT_SECRET");
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
        if (!clientId || !clientSecret || !supabaseUrl || !serviceRole) {
          return voltar("sem-config", limpar);
        }

        const credencial = await trocarCodigo({
          clientId,
          clientSecret,
          codigo,
          redirectUri: `${url.origin}/api/integracoes/oauth/callback`,
          verificador: guardado.verificador,
        });
        if (!credencial.ok) return voltar("falhou", limpar);

        // O login é o que a pessoa vê na tela para reconhecer qual conta conectou.
        const conta = await contaDe(credencial.valor.acesso);

        const cifrado = await cifrar(JSON.stringify(credencial.valor));
        if (!cifrado.ok) return voltar("falhou", limpar);

        /*
         * `on_conflict` na chave (user_id, provedor): reconectar substitui o token velho em vez de
         * acumular linha. É o que a chave primária da tabela já dizia; aqui é só honrá-la.
         */
        const gravado = await fetch(
          `${supabaseUrl}/rest/v1/pathly_conexoes?on_conflict=user_id,provedor`,
          {
            method: "POST",
            headers: {
              apikey: serviceRole,
              Authorization: `Bearer ${serviceRole}`,
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify({
              user_id: guardado.userId,
              provedor: guardado.provedor,
              token_cifrado: cifrado.valor,
              escopos: provedor.escopos,
              conta: conta.ok ? conta.valor : "",
              expira_em: credencial.valor.expiraEm,
              atualizado_em: new Date().toISOString(),
            }),
          },
        );

        if (!gravado.ok) return voltar("falhou", limpar);
        return voltar("conectado", limpar);
      },
    },
  },
});
