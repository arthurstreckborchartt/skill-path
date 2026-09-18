import { createFileRoute } from "@tanstack/react-router";
import { lerEnv } from "@/lib/server-env";
import { LIMITES, recusaParaResposta, registrarUso } from "@/lib/limite-uso";
import { lerJsonLimitado, texto } from "@/lib/entrada-segura";
import { completarBlueprint, type Blueprint } from "@/lib/blueprint/contrato";
import { validarModelo } from "@/lib/banco/contrato";
import { validarMapa } from "@/lib/api/contrato";
import { validarPlano } from "@/lib/arquitetura-ia/contrato";
import { gerarResposta } from "@/lib/copilot/gerar";
import { montarContexto, type FontesContexto } from "@/lib/copilot/contexto";
import { rotear, FACETAS, type Faceta } from "@/lib/copilot/roteador";
import { calcularProgresso, calcularProximoPasso } from "@/lib/copilot/proximo-passo";
import { MODOS } from "@/lib/copilot/contrato";

/**
 * POST /api/copilot — uma mensagem do Copilot.
 *
 * O contexto é montado **aqui**, no servidor, a partir do banco. Nunca vem do cliente: um contexto
 * enviado pelo navegador seria um jeito de qualquer pessoa escrever o que o modelo acredita sobre
 * o projeto — inclusive sobre projeto que não é dela.
 *
 * O que o cliente manda é só: qual projeto, o que perguntou, de que tela, e o modo, quando pedido.
 */

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function erro(status: number, mensagem: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ erro: mensagem, ...extra }), {
    status,
    headers: JSON_HEADERS,
  });
}

type Corpo = {
  projetoId?: unknown;
  pergunta?: unknown;
  facetaDaTela?: unknown;
  modo?: unknown;
};

type LinhaDecisao = {
  id: string;
  chave: string;
  titulo: string;
  valor: string;
  motivo: string;
  substitui_decisao_id: string | null;
  confirmado_em: string | null;
  criado_em: string;
};

type LinhaPropostaResumo = { id: string; tipo: string; titulo: string; motivo: string };

type LinhaMensagemResumo = { id: string; papel: string; conteudo: unknown; criado_em: string };

type LinhaProjeto = {
  id: string;
  nome: string;
  conteudo: Blueprint | null;
  respostas: unknown;
  etapas_concluidas: number;
  etapas_total: number;
};

export const Route = createFileRoute("/api/copilot")({
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
        if (!token) return erro(401, "Faça login para conversar com o copiloto.");

        const conferido = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
        });
        if (!conferido.ok) return erro(401, "Sessão expirada. Entre de novo.");
        const { id: userId } = (await conferido.json()) as { id: string };

        const corpo = await lerJsonLimitado<Corpo>(request);
        if (!corpo.ok) {
          return erro(
            400,
            corpo.motivo === "grande" ? "Mensagem grande demais." : "Corpo inválido.",
          );
        }

        const projetoId = texto(corpo.dados.projetoId, 40);
        if (!projetoId) return erro(400, "Faltou o projeto.");

        /**
         * Teto de 2000 caracteres na pergunta.
         *
         * `lerJsonLimitado` já barra corpo gigante, mas esse teto é do corpo inteiro. Aqui o que
         * interessa é o texto que vira prompt: sem limite próprio, alguém cola um livro e paga a
         * conta de IA do projeto com uma chamada só.
         */
        const pergunta = texto(corpo.dados.pergunta, 2000);
        if (!pergunta) return erro(400, "Escreva a sua pergunta.");

        const facetaDaTela = (FACETAS as readonly string[]).includes(
          String(corpo.dados.facetaDaTela),
        )
          ? (corpo.dados.facetaDaTela as Faceta)
          : undefined;

        const modo = (MODOS as readonly string[]).includes(String(corpo.dados.modo))
          ? String(corpo.dados.modo)
          : null;

        const comoUsuario = { Authorization: `Bearer ${token}`, apikey: anonKey };
        const doProjeto = (tabela: string, colunas: string) =>
          fetch(
            `${supabaseUrl}/rest/v1/${tabela}?select=${colunas}&projeto_id=eq.${encodeURIComponent(projetoId)}`,
            { headers: comoUsuario },
          );

        const consulta = await fetch(
          `${supabaseUrl}/rest/v1/pathly_projetos?select=id,nome,conteudo,respostas,etapas_concluidas,etapas_total&id=eq.${encodeURIComponent(projetoId)}&limit=1`,
          { headers: comoUsuario },
        );
        if (!consulta.ok) return erro(503, "Não consegui ler o projeto agora.");

        const projeto = ((await consulta.json()) as LinhaProjeto[])[0];
        // A RLS já garante que só o dono enxerga; o 404 aqui é o caso de projeto inexistente.
        if (!projeto) return erro(404, "Projeto não encontrado.");

        const uso = await registrarUso(
          supabaseUrl,
          anonKey,
          token,
          "copilot",
          LIMITES.copilot.limite,
          LIMITES.copilot.janelaMinutos,
        );
        if (uso.permitido === false) {
          const recusa = recusaParaResposta(
            uso,
            "Você conversou muito em pouco tempo. Tente de novo mais tarde.",
          );
          return erro(recusa.status, recusa.mensagem, {
            usadas: uso.usadas,
            limite: uso.limite,
          });
        }

        /**
         * As fatias são buscadas todas de uma vez, e não só as que o roteador pediu.
         *
         * Parece desperdício e não é: são consultas por chave primária no mesmo banco, em
         * paralelo, e custam milissegundos. Buscar sob demanda economizaria isso e traria de
         * volta a decisão de "e se o roteador errou?" — que é justamente o que a fatia da tela
         * existe para cobrir. O orçamento de tokens continua valendo: o que não entra no contexto
         * não é enviado, só não foi buscado à toa.
         */
        const [rBanco, rApi, rIa, rDecisoes, rPropostas, rMensagens] = await Promise.all([
          doProjeto("pathly_modelos_dados", "modelo"),
          doProjeto("pathly_apis", "mapa"),
          doProjeto("pathly_arquitetura_ia", "plano"),
          fetch(
            `${supabaseUrl}/rest/v1/pathly_copilot_decisoes?select=id,chave,titulo,valor,motivo,status,substitui_decisao_id,origem,confirmado_em,criado_em&projeto_id=eq.${encodeURIComponent(projetoId)}&status=eq.ativa`,
            { headers: comoUsuario },
          ),
          fetch(
            `${supabaseUrl}/rest/v1/pathly_copilot_propostas?select=id,tipo,titulo,motivo,status&projeto_id=eq.${encodeURIComponent(projetoId)}&status=eq.pendente`,
            { headers: comoUsuario },
          ),
          fetch(
            `${supabaseUrl}/rest/v1/pathly_copilot_mensagens?select=id,papel,conteudo,criado_em&projeto_id=eq.${encodeURIComponent(projetoId)}&order=criado_em.desc&limit=6`,
            { headers: comoUsuario },
          ),
        ]);

        const primeiro = async <T>(r: Response, campo: string): Promise<T | null> => {
          if (!r.ok) return null;
          const linhas = (await r.json()) as Record<string, unknown>[];
          const valor = linhas[0]?.[campo];
          return (valor as T) ?? null;
        };

        const modelo = validarModelo(await primeiro(rBanco, "modelo"));
        const api = validarMapa(await primeiro(rApi, "mapa"));
        const planoIa = validarPlano(await primeiro(rIa, "plano"));

        const decisoes = rDecisoes.ok
          ? ((await rDecisoes.json()) as LinhaDecisao[]).map((d) => ({
              id: d.id,
              chave: d.chave,
              titulo: d.titulo,
              valor: d.valor,
              motivo: d.motivo,
              status: "ativa" as const,
              substituiDecisaoId: d.substitui_decisao_id,
              origem: "usuario" as const,
              confirmadoEm: d.confirmado_em,
              criadoEm: d.criado_em,
            }))
          : [];

        const propostasPendentes = rPropostas.ok
          ? ((await rPropostas.json()) as LinhaPropostaResumo[]).map((p) => ({
              id: p.id,
              tipo: p.tipo as never,
              titulo: p.titulo,
              descricao: "",
              campoAfetado: null,
              valorAtual: null,
              valorProposto: null,
              motivo: p.motivo,
              impactos: [],
              status: "pendente" as const,
              decisaoId: null,
              criadoEm: "",
              confirmadoEm: null,
            }))
          : [];

        const mensagensRecentes = rMensagens.ok
          ? ((await rMensagens.json()) as LinhaMensagemResumo[])
              .map((m) => {
                const c = (m.conteudo ?? {}) as { texto?: unknown };
                return {
                  id: m.id,
                  papel: (m.papel === "copilot" ? "copilot" : "usuario") as "copilot" | "usuario",
                  texto: typeof c.texto === "string" ? c.texto : "",
                  resposta: null,
                  criadoEm: m.criado_em,
                };
              })
              .reverse()
          : [];

        const blueprint = completarBlueprint(projeto.conteudo ?? {});
        const estado = {
          blueprint,
          temModelo: modelo !== null,
          temApi: api !== null,
          temSeguranca: false,
          temArquiteturaIa: planoIa !== null,
          etapasConcluidas: projeto.etapas_concluidas,
          etapasTotal: projeto.etapas_total,
          questionarioCompleto: true,
        };

        const roteamento = rotear(pergunta, facetaDaTela);

        const fontes: FontesContexto = {
          nome: projeto.nome,
          blueprint,
          modelo,
          api,
          planoIa,
          decisoes,
          propostasPendentes,
          mudancasRecentes: [],
          mensagensRecentes,
          /**
           * O estado real do banco não é sondado aqui.
           *
           * A sonda roda no navegador, com a sessão da pessoa — do servidor eu teria que assumir
           * que o schema do Supabase é o mesmo para todos, e essa suposição é falsa: o projeto
           * dela pode apontar para outro banco. O cliente manda o resumo quando tiver.
           */
          estadoBanco: null,
          proximoPasso: calcularProximoPasso(projetoId, estado),
          progresso: calcularProgresso(estado),
          etapaAtual: facetaDaTela ?? null,
        };

        const contexto = montarContexto(fontes, roteamento.facetas);

        let pro = false;
        const perfil = await fetch(
          `${supabaseUrl}/rest/v1/pathly_profiles?select=plano&user_id=eq.${userId}&limit=1`,
          { headers: comoUsuario },
        );
        if (perfil.ok) {
          const p = (await perfil.json()) as { plano?: string }[];
          pro = p[0]?.plano === "pro";
        }

        const gerado = await gerarResposta(contexto.texto, pergunta, modo, lerEnv, {
          comClaude: pro,
        });

        if (!gerado.ok) {
          return erro(
            gerado.motivo === "sem-chave" ? 500 : 503,
            gerado.motivo === "sem-chave"
              ? "O copiloto não está configurado."
              : "Os serviços de IA estão congestionados. Tente de novo.",
            { motivo: gerado.motivo },
          );
        }

        /**
         * As duas mensagens são gravadas aqui, no servidor.
         *
         * Se o cliente gravasse, uma aba fechada no meio da resposta perderia a pergunta e a
         * resposta — que já foi paga. Gravar aqui também mantém a conversa consistente entre
         * aparelhos sem nenhum trabalho extra.
         */
        const gravar = (papel: string, conteudo: unknown, metadata: unknown) =>
          fetch(`${supabaseUrl}/rest/v1/pathly_copilot_mensagens`, {
            method: "POST",
            headers: {
              ...comoUsuario,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              projeto_id: projetoId,
              user_id: userId,
              papel,
              conteudo,
              metadata,
            }),
          });

        await gravar("usuario", { texto: pergunta }, { facetas: roteamento.facetas });
        await gravar(
          "copilot",
          { texto: gerado.dados.blocos[0] ?? "", resposta: gerado.dados },
          {
            modelo: gerado.modelo,
            facetas: roteamento.facetas,
            tokensContexto: contexto.tokensEstimados,
            fatias: contexto.fatiasIncluidas,
            fatiasCortadas: contexto.fatiasCortadas,
          },
        );

        return new Response(
          JSON.stringify({
            resposta: gerado.dados,
            diagnostico: {
              modelo: gerado.modelo,
              facetas: roteamento.facetas,
              tokensContexto: contexto.tokensEstimados,
              fatias: contexto.fatiasIncluidas,
              fatiasCortadas: contexto.fatiasCortadas,
            },
          }),
          { headers: JSON_HEADERS },
        );
      },
    },
  },
});
