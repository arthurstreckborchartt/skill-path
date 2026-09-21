import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { cifragemDisponivel, cifrar, decifrar } from "@/lib/integracoes/cripto";

/**
 * POST /api/ia/chave — guarda e testa a chave da API da Anthropic.
 *
 * ## Por que existe uma rota para isto
 *
 * `authenticated` não escreve em `pathly_conexoes`: `insert` e `update` respondem `42501`, por
 * privilégio. É de propósito — a tabela guarda credencial, e o navegador não deveria conseguir
 * gravar uma. Quem grava é o servidor, com `service_role`, depois de conferir o token da sessão.
 *
 * Isso não é burocracia: a chave chega cifrada ao banco, e a cifragem acontece aqui, com uma
 * chave que só o servidor tem. O navegador nunca vê a versão guardada, e nunca mais vê a que
 * mandou.
 *
 * ## Testar antes de guardar
 *
 * A chave é usada de verdade contra a API da Anthropic antes de qualquer gravação. Guardar
 * primeiro e testar depois produziria uma tela dizendo "conectado" sobre uma chave que não
 * funciona — e a pessoa só descobriria na primeira tarefa, achando que o erro é do Pathly.
 *
 * O teste é a menor chamada possível: um token de saída, uma palavra de entrada. Custa
 * praticamente nada e prova o que precisa — a chave existe, está ativa e tem crédito.
 *
 * ## Duas operações, um método
 *
 * Com `chave` no corpo: testa e guarda. Sem `chave`: testa a que já está guardada — é o botão
 * "Testar conexão". A segunda decifra, usa e descarta; nada da chave volta na resposta.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string) {
  return new Response(JSON.stringify({ erro: mensagem }), { status, headers: JSON_HEADERS });
}

function ok(corpo: Record<string, unknown>) {
  return new Response(JSON.stringify(corpo), { status: 200, headers: JSON_HEADERS });
}

const PROVEDOR = "claude-api";

/**
 * A dica da conta que fica visível.
 *
 * Os últimos quatro caracteres, e nada mais. Servem para a pessoa reconhecer **qual** chave está
 * ali quando tiver duas — e quatro caracteres não reconstroem nada.
 */
function dicaDaChave(chave: string): string {
  return `sk-ant-…${chave.slice(-4)}`;
}

/**
 * A menor chamada que prova que a chave funciona.
 *
 * Distingue os três casos que importam: chave recusada (401/403), conta sem crédito ou sem
 * permissão para o modelo, e serviço fora do ar. As três mandam a pessoa para lugares
 * diferentes, e uma mensagem só para as três mandaria para o lugar errado duas vezes.
 */
async function testar(chave: string): Promise<{ ok: true } | { ok: false; motivo: string }> {
  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-5",
        max_tokens: 1,
        messages: [{ role: "user", content: "oi" }],
      }),
    });
  } catch {
    return { ok: false, motivo: "Não consegui falar com a Anthropic agora. Tente de novo." };
  }

  if (r.ok) return { ok: true };

  if (r.status === 401 || r.status === 403) {
    return { ok: false, motivo: "A Anthropic recusou esta chave. Confira se ela ainda é válida." };
  }
  if (r.status === 400) {
    return {
      ok: false,
      motivo: "A chave respondeu, mas a conta não pôde usar o modelo. Confira créditos e acesso.",
    };
  }
  if (r.status === 429) {
    return { ok: false, motivo: "A Anthropic está limitando sua conta agora. Tente mais tarde." };
  }
  return { ok: false, motivo: "A Anthropic respondeu com um erro. Tente de novo mais tarde." };
}

type Corpo = { chave?: unknown };

export const Route = createFileRoute("/api/ia/chave")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return erro(401, "Faça login para conectar uma ferramenta.");

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

        const chaveNova = texto(corpo.dados.chave, 200);
        const alvo = `${supabaseUrl}/rest/v1/pathly_conexoes?user_id=eq.${encodeURIComponent(userId)}&provedor=eq.${PROVEDOR}`;

        // ---- Testar a que já está guardada -------------------------------------------------
        if (!chaveNova) {
          if (!serviceRole) return erro(500, "Este ambiente não consegue ler a chave guardada.");

          const r = await fetch(`${alvo}&select=token_cifrado&limit=1`, {
            headers: { apikey: serviceRole, Authorization: `Bearer ${serviceRole}` },
          });
          if (!r.ok) return erro(503, "Não consegui ler a conexão agora.");

          const linha = ((await r.json()) as { token_cifrado: string }[])[0];
          if (!linha) return erro(404, "Não há chave guardada para testar.");

          const clara = await decifrar(linha.token_cifrado);
          if (!clara.ok) {
            return erro(500, "A chave guardada não pôde ser lida neste ambiente. Conecte de novo.");
          }

          const t = await testar(clara.valor);
          return t.ok ? ok({ funcionou: true }) : ok({ funcionou: false, motivo: t.motivo });
        }

        // ---- Guardar uma chave nova --------------------------------------------------------
        /*
         * O prefixo é conferido antes da chamada. Não é segurança — é evitar mandar para a
         * Anthropic um texto que claramente não é chave dela, e devolver à pessoa um erro que
         * diz o que está errado em vez de "recusada".
         */
        if (!chaveNova.startsWith("sk-ant-")) {
          return erro(400, "Isto não parece uma chave da Anthropic. Elas começam com sk-ant-.");
        }
        if (!serviceRole) return erro(500, "Este ambiente não consegue guardar a chave.");
        if (!cifragemDisponivel()) {
          return erro(
            500,
            "Falta a chave de cifragem neste ambiente. Sem ela eu não guardo credencial.",
          );
        }

        const t = await testar(chaveNova);
        if (!t.ok) return ok({ funcionou: false, motivo: t.motivo });

        const cifrada = await cifrar(chaveNova);
        if (!cifrada.ok) return erro(500, "Não consegui cifrar a chave. Nada foi guardado.");

        const agora = new Date().toISOString();
        const gravou = await fetch(`${supabaseUrl}/rest/v1/pathly_conexoes`, {
          method: "POST",
          headers: {
            apikey: serviceRole,
            Authorization: `Bearer ${serviceRole}`,
            "Content-Type": "application/json",
            // A pessoa pode reconectar com outra chave: a segunda substitui a primeira, em vez de
            // esbarrar na chave primária (user_id, provedor).
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            user_id: userId,
            provedor: PROVEDOR,
            token_cifrado: cifrada.valor,
            conta: dicaDaChave(chaveNova),
            escopos: [],
            expira_em: null,
            criado_em: agora,
            atualizado_em: agora,
          }),
        });

        if (!gravou.ok)
          return erro(503, "A chave funciona, mas não consegui guardá-la. Tente de novo.");

        return ok({ funcionou: true, conta: dicaDaChave(chaveNova) });
      },
    },
  },
});
