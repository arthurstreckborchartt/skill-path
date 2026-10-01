import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { cifrar } from "@/lib/integracoes/cripto";
import { validarDestino } from "@/lib/integracoes/destino";
import { descobrir } from "@/lib/mcp/cliente/protocolo";
import { impactoDe } from "@/lib/mcp/cliente/contrato";

/**
 * POST /api/mcp/conectar — conecta a um servidor MCP e lista o que ele oferece.
 *
 * Fase 1 de `docs/MCP-CLIENTE.md`. **Esta rota não chama ferramenta nenhuma.** Ela se apresenta ao
 * servidor, pergunta o catálogo e guarda. Executar é a fase 2, e passa por
 * `pathly_acoes_externas` — não por aqui.
 *
 * ## Por que a descoberta é do servidor, e não do navegador
 *
 * Três motivos, e cada um sozinho já bastaria:
 *
 * 1. **A guarda de destino não pode morar no cliente.** Validar no navegador é pedir licença a
 *    quem está tentando entrar: o devtools reescreve a chamada. É do servidor que o `fetch` sai, e
 *    é no servidor que ele é contido.
 * 2. **A credencial não passa pelo navegador depois de gravada.** Ela chega uma vez, aqui, e sai
 *    cifrada para o banco, numa coluna que `authenticated` não lê.
 * 3. **A impressão digital tem que ser calculada por quem viu a resposta.** Se o navegador
 *    mandasse a lista pronta, alguém mandaria a lista que quisesse — e a impressão de uma linha
 *    forjada é a impressão de uma mentira.
 *
 * ## O que volta para a tela
 *
 * O catálogo e os dados do servidor. Nunca o token — nem o que a pessoa acabou de colar.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = { endereco?: unknown; token?: unknown };

export const Route = createFileRoute("/api/mcp/conectar")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
        const anonKey =
          lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
        if (!supabaseUrl || !anonKey) return erro(500, "Supabase não está configurado.");

        const auth = request.headers.get("Authorization") ?? "";
        const sessao = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!sessao) return erro(401, "Faça login para conectar um servidor.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${sessao}`, apikey: anonKey },
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

        const endereco = texto(corpo.dados.endereco, 500);
        if (!endereco) return erro(400, "Faltou o endereço do servidor.");
        const tokenDoServidor = texto(corpo.dados.token, 4000) || null;

        /*
         * A guarda antes do limite de uso, de propósito.
         *
         * Endereço inválido não deve consumir a cota de quem errou de digitação — e, mais
         * importante, não deve virar um jeito barato de gastar a cota de outra pessoa.
         */
        const destino = validarDestino(endereco);
        if (!destino.ok) return erro(400, destino.motivo);

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          sessao,
          "mcp_conectar",
          LIMITES.mcpConectar.limite,
          LIMITES.mcpConectar.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você conectou servidores demais em pouco tempo. Tente de novo mais tarde.",
          );
          return erro(recusa.status, recusa.mensagem, { usadas: uso.usadas, limite: uso.limite });
        }

        // --- A conversa com o servidor MCP ----------------------------------------------------
        const achado = await descobrir(endereco, tokenDoServidor);
        if (!achado.ok) return erro(502, achado.motivo);

        // --- Gravar -------------------------------------------------------------------------
        const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
        if (!serviceRole) {
          /*
           * Sem a chave de serviço não dá para gravar: as duas tabelas recusam escrita de
           * `authenticated` por construção, e isso é a proteção funcionando.
           *
           * Devolvo o catálogo mesmo assim, com o aviso. A pessoa vê o que o servidor oferece —
           * que é metade do valor da fase 1 — e a tela diz que não ficou guardado, em vez de
           * mentir que conectou.
           */
          return new Response(
            JSON.stringify({
              servidor: achado.servidor,
              ferramentas: achado.ferramentas.map((f) => ({
                nome: f.nome,
                descricaoDoServidor: f.descricao,
                impacto: impactoDe(f),
              })),
              guardado: false,
              aviso: "Consegui falar com o servidor, mas não consegui guardar a conexão.",
            }),
            { status: 200, headers: JSON_HEADERS },
          );
        }

        const comoServico = {
          apikey: serviceRole,
          Authorization: `Bearer ${serviceRole}`,
          "Content-Type": "application/json",
        };

        let cifrado: string | null = null;
        if (tokenDoServidor) {
          const r = await cifrar(tokenDoServidor);
          if (!r.ok) return erro(500, "Não consegui guardar a credencial com segurança.");
          cifrado = r.valor;
        }

        const gravouServidor = await fetch(`${supabaseUrl}/rest/v1/pathly_mcp_servidores`, {
          method: "POST",
          headers: { ...comoServico, Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({
            user_id: userId,
            endereco,
            nome: achado.servidor.nome,
            versao: achado.servidor.versao,
            protocolo: achado.servidor.protocolo,
            // Reconectar sem token não apaga o token de antes: `undefined` sai do JSON.
            ...(cifrado ? { token_cifrado: cifrado } : {}),
            atualizado_em: new Date().toISOString(),
          }),
        });
        if (!gravouServidor.ok) return erro(503, "Não consegui guardar a conexão agora.");

        /*
         * As ferramentas que sumiram do servidor saem daqui.
         *
         * Sem isto, uma ferramenta removida continuaria listada para sempre — e, pior, continuaria
         * aprovável na fase 2. O `delete` antes do `insert` deixa o banco com o que o servidor
         * oferece HOJE, que é a única lista que significa alguma coisa.
         */
        await fetch(
          `${supabaseUrl}/rest/v1/pathly_mcp_ferramentas` +
            `?user_id=eq.${userId}&servidor=eq.${encodeURIComponent(endereco)}`,
          { method: "DELETE", headers: comoServico },
        );

        if (achado.ferramentas.length > 0) {
          const gravouFerramentas = await fetch(`${supabaseUrl}/rest/v1/pathly_mcp_ferramentas`, {
            method: "POST",
            headers: comoServico,
            body: JSON.stringify(
              achado.ferramentas.map((f) => ({
                user_id: userId,
                servidor: endereco,
                nome: f.nome,
                descricao_do_servidor: f.descricao,
                entrada: f.entrada,
                impressao: f.impressao,
                impacto: impactoDe(f),
              })),
            ),
          });
          if (!gravouFerramentas.ok) {
            return erro(503, "Falei com o servidor, mas não consegui guardar as ferramentas.");
          }
        }

        return new Response(
          JSON.stringify({
            servidor: achado.servidor,
            ferramentas: achado.ferramentas.map((f) => ({
              nome: f.nome,
              descricaoDoServidor: f.descricao,
              impacto: impactoDe(f),
            })),
            guardado: true,
          }),
          { status: 200, headers: JSON_HEADERS },
        );
      },
    },
  },
});
