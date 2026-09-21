import { defineTool, type ToolContext, type ToolDefinition } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { LIMITES, registrarUso } from "@/lib/limite-uso";
import { lerEnv } from "@/lib/server-env";
import { montarBrief, briefEmTexto } from "@/lib/hub/sessao/brief";
import { completarBlueprint } from "@/lib/blueprint/contrato";
import type { Decisao } from "@/lib/copilot/contrato";
import { FERRAMENTAS, acharFerramenta, type FerramentaDeclarada } from "./catalogo";
import { passarPeloPortao, type PedidoMcp } from "./portao";
import * as dados from "./dados";

/**
 * A fábrica de ferramentas do MCP Gateway.
 *
 * ## Por que uma fábrica, e não dezessete arquivos
 *
 * Porque o portão precisa ser **inescapável**. Com dezessete handlers escritos à mão, passar pelo
 * portão vira uma convenção — e convenção é o que alguém esquece na décima oitava ferramenta,
 * exatamente a que precisava mais.
 *
 * Aqui não há caminho para definir uma ferramenta sem o portão: `construir()` é a única porta, e
 * ela chama `passarPeloPortao` antes de qualquer `executar`. Uma ferramenta nova é uma linha no
 * catálogo e um caso no `executar` — e ambos já nascem atrás do portão.
 *
 * ## O que o handler faz, em ordem
 *
 * 1. Lê a identidade verificada do `ToolContext` — usuário, integração, token.
 * 2. Conta a chamada no limite de uso.
 * 3. Lê permissões e pedidos vivos **com o token da pessoa** (a RLS vale por baixo).
 * 4. Passa pelo portão.
 * 5. Audita — sempre, inclusive a recusa.
 * 6. Só então executa, ou grava o pedido e devolve `APPROVAL_REQUIRED`.
 *
 * O passo 5 vem antes do 6 de propósito: uma execução que falhar depois ainda deixa registrado
 * que foi autorizada e tentada.
 */

// =============================================================================================
// Entradas
// =============================================================================================

const projeto = {
  project_id: z
    .string()
    .optional()
    .describe("Id do projeto. Quando omitido, o Pathly usa o projeto mais recente."),
};

const ENTRADAS: Record<string, z.ZodRawShape> = {
  pathly_get_project: projeto,
  pathly_get_blueprint: projeto,
  pathly_get_current_task: projeto,
  pathly_get_technical_decisions: projeto,
  pathly_get_project_context: projeto,
  pathly_get_errors: projeto,
  pathly_get_task_history: {
    ...projeto,
    limit: z.number().int().min(1).max(100).optional().describe("Quantos registros. Padrão 20."),
  },

  pathly_update_task: {
    ...projeto,
    order: z.number().int().min(1).describe("A ordem da etapa, como aparece na trilha."),
    status: z
      .enum(["pendente", "fazendo", "concluida", "pulada"])
      .describe("O novo estado da etapa."),
  },
  pathly_report_error: {
    ...projeto,
    message: z.string().min(3).describe("O que falhou. Inclua a mensagem de erro, se houver."),
    step: z.number().int().optional().describe("A etapa em que aconteceu."),
  },
  pathly_add_decision: {
    ...projeto,
    key: z
      .string()
      .min(2)
      .describe(
        "O assunto da decisão, ex. 'auth'. Decidir de novo o mesmo assunto aposenta a anterior.",
      ),
    title: z.string().min(2).describe("O nome da decisão, ex. 'Autenticação'."),
    value: z.string().min(2).describe("O que foi escolhido."),
    reason: z.string().min(3).describe("Por que essa escolha, e não a alternativa."),
  },
  pathly_report_implementation: {
    ...projeto,
    summary: z.string().min(3).describe("O que foi implementado."),
    files: z.array(z.string()).optional().describe("Os caminhos alterados."),
    tests: z.string().optional().describe("O comando de teste e o resultado."),
    step: z.number().int().optional().describe("A etapa correspondente."),
  },
  pathly_update_blueprint: {
    ...projeto,
    block: z
      .enum(["fundacao", "produto", "tecnico", "execucao", "operacao"])
      .describe("Qual bloco do plano a proposta afeta."),
    proposal: z.string().min(10).describe("A mudança proposta, e por quê."),
  },

  pathly_request_file_change: {
    ...projeto,
    path: z.string().min(1).describe("O caminho do arquivo."),
    change: z.string().min(1).describe("O que mudar, e por quê."),
  },
  pathly_request_command: {
    ...projeto,
    command: z.string().min(1).describe("O comando exato a executar."),
    why: z.string().min(3).describe("Por que ele precisa rodar."),
  },
  pathly_request_commit: {
    ...projeto,
    message: z.string().min(3).describe("A mensagem do commit."),
    files: z.array(z.string()).optional().describe("Os arquivos a incluir."),
  },
  pathly_request_push: {
    ...projeto,
    branch: z.string().min(1).describe("A branch de destino."),
  },
  pathly_request_deploy: {
    ...projeto,
    environment: z.string().min(1).describe("O ambiente, ex. 'produção'."),
  },
};

// =============================================================================================
// Resposta
// =============================================================================================

/*
 * `JsonValueInput` é o tipo que o SDK aceita em `structuredContent`, e `Record<string, unknown>`
 * não se encaixa nele — `unknown` poderia ser um `Date` ou uma função. O `JSON.parse(stringify)`
 * não é cosmético: ele **prova** que o que sai é serializável, e derruba aqui qualquer valor que
 * o cliente MCP não conseguiria ler.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json | undefined };

function responder(payload: Record<string, unknown>) {
  const limpo = JSON.parse(JSON.stringify(payload)) as Json;
  return {
    content: [{ type: "text" as const, text: JSON.stringify(limpo, null, 2) }],
    structuredContent: limpo,
  };
}

// =============================================================================================
// Execução
// =============================================================================================

function idDoProjeto(args: Record<string, unknown>): string | null {
  const v = args["project_id"];
  return typeof v === "string" && v.trim() ? v : null;
}

/** Só as leituras e escritas chegam aqui. Solicitação nunca — ela para no portão. */
async function executar(
  f: FerramentaDeclarada,
  args: Record<string, unknown>,
  token: string,
  userId: string,
  integrationId: string,
): Promise<Record<string, unknown>> {
  const p = await dados.lerProjeto(token, idDoProjeto(args));
  if (!p.ok) return { error: p.motivo };

  const proj = p.dados;
  const blueprint = completarBlueprint((proj.conteudo ?? {}) as never);
  const etapas = blueprint.execucao?.etapas ?? [];
  const feitas = await dados.lerEtapas(token, proj.id);
  const concluidas = feitas.filter((e) => e.status === "concluida").map((e) => e.ordem);
  const atual = etapas.find((e) => !concluidas.includes(e.ordem)) ?? null;

  switch (f.nome) {
    case "pathly_get_project":
      return {
        project_id: proj.id,
        name: proj.nome,
        idea: proj.ideia,
        status: proj.status,
        steps_done: concluidas.length,
        steps_total: proj.etapas_total,
        current_phase: atual?.fase ?? null,
        updated_at: proj.atualizado_em,
      };

    case "pathly_get_blueprint":
      return { project_id: proj.id, blueprint };

    case "pathly_get_current_task":
      return atual
        ? {
            project_id: proj.id,
            order: atual.ordem,
            title: atual.titulo,
            deliverable: atual.entrega,
            phase: atual.fase,
            depends_on: atual.dependeDe,
          }
        : { project_id: proj.id, current_task: null, note: "A trilha ainda não foi gerada." };

    case "pathly_get_technical_decisions": {
      const ds = await dados.lerDecisoes(token, proj.id);
      return {
        project_id: proj.id,
        active: ds
          .filter((d) => d.status === "ativa")
          .map((d) => ({ key: d.chave, title: d.titulo, value: d.valor, reason: d.motivo })),
        superseded: ds
          .filter((d) => d.status === "substituida")
          .map((d) => ({ key: d.chave, title: d.titulo, value: d.valor })),
      };
    }

    case "pathly_get_errors": {
      const rs = await dados.lerRegistrosDoProjeto(token, proj.id);
      return {
        project_id: proj.id,
        errors: rs
          .filter(
            (r) => r.tipo === "erro" || (r.tipo === "testes-executados" && /falhou/i.test(r.texto)),
          )
          /* A origem vai junto: verificado, colado ou relatado valem coisas diferentes. */
          .map((r) => ({ text: r.texto, origin: r.origem, step: r.etapa_ordem, at: r.criado_em })),
      };
    }

    case "pathly_get_task_history": {
      const limite = typeof args["limit"] === "number" ? args["limit"] : 20;
      const rs = await dados.lerRegistrosDoProjeto(token, proj.id, limite);
      return {
        project_id: proj.id,
        history: rs.map((r) => ({
          kind: r.tipo,
          origin: r.origem,
          text: r.texto,
          items: r.itens ?? [],
          step: r.etapa_ordem,
          at: r.criado_em,
        })),
      };
    }

    case "pathly_get_project_context": {
      const [ds, rs] = await Promise.all([
        dados.lerDecisoes(token, proj.id),
        dados.lerRegistrosDoProjeto(token, proj.id),
      ]);
      const brief = montarBrief({
        nomeProjeto: proj.nome,
        blueprint,
        modelo: null,
        api: null,
        decisoes: ds.map((d) => ({
          ...d,
          status: d.status,
          titulo: d.titulo,
          valor: d.valor,
          motivo: d.motivo,
        })) as unknown as Decisao[],
        etapa: atual,
        etapasConcluidas: concluidas.length,
        etapasTotal: proj.etapas_total,
        errosConhecidos: rs.filter((r) => r.tipo === "erro").map((r) => `${r.texto} (${r.origem})`),
        pedirResultadoEstruturado: true,
      });
      return { project_id: proj.id, brief, brief_text: briefEmTexto(brief) };
    }

    // ---- Escrita ------------------------------------------------------------------------------

    case "pathly_update_task": {
      const r = await dados.atualizarEtapa(
        token,
        proj.id,
        args["order"] as number,
        args["status"] as string,
      );
      return r.ok
        ? { ok: true, project_id: proj.id, order: args["order"], status: args["status"] }
        : { error: r.motivo };
    }

    case "pathly_report_error": {
      const r = await dados.gravarRegistro(token, {
        user_id: userId,
        project_id: proj.id,
        etapa_ordem: (args["step"] as number | undefined) ?? null,
        provedor_id: integrationId,
        tipo: "erro",
        texto: args["message"] as string,
        itens: [],
      });
      return r.ok ? { ok: true, recorded: "error" } : { error: r.motivo };
    }

    case "pathly_add_decision": {
      const r = await dados.gravarDecisao(token, {
        projeto_id: proj.id,
        user_id: userId,
        chave: args["key"] as string,
        titulo: args["title"] as string,
        valor: args["value"] as string,
        motivo: args["reason"] as string,
      });
      return r.ok
        ? {
            ok: true,
            recorded: "decision",
            note: "Registrada como não confirmada: quem decidiu foi uma ferramenta.",
          }
        : { error: r.motivo };
    }

    case "pathly_report_implementation": {
      const arquivos = Array.isArray(args["files"]) ? (args["files"] as string[]) : [];
      const r = await dados.gravarRegistro(token, {
        user_id: userId,
        project_id: proj.id,
        etapa_ordem: (args["step"] as number | undefined) ?? null,
        provedor_id: integrationId,
        tipo: "tarefa-concluida",
        texto: args["summary"] as string,
        itens: arquivos,
      });
      if (!r.ok) return { error: r.motivo };

      if (typeof args["tests"] === "string" && args["tests"].trim()) {
        await dados.gravarRegistro(token, {
          user_id: userId,
          project_id: proj.id,
          etapa_ordem: (args["step"] as number | undefined) ?? null,
          provedor_id: integrationId,
          tipo: "testes-executados",
          texto: args["tests"],
          itens: [],
        });
      }
      return { ok: true, recorded: "implementation", files: arquivos.length };
    }

    case "pathly_update_blueprint": {
      /*
       * Proposta, não aplicação. Vai para o registro como observação, e a pessoa decide no
       * Pathly — escrever direto no blueprint faria uma ferramenta externa mudar o plano de
       * alguém sem ninguém ver.
       */
      const r = await dados.gravarRegistro(token, {
        user_id: userId,
        project_id: proj.id,
        etapa_ordem: null,
        provedor_id: integrationId,
        tipo: "observacao",
        texto: `Proposta para o bloco “${args["block"]}”: ${args["proposal"]}`,
        itens: [],
      });
      return r.ok
        ? {
            ok: true,
            recorded: "proposal",
            note: "É proposta. O plano só muda quando a pessoa aceitar no Pathly.",
          }
        : { error: r.motivo };
    }

    default:
      return { error: `A ferramenta ${f.nome} não tem execução ligada.` };
  }
}

// =============================================================================================
// O construtor
// =============================================================================================

function construir(f: FerramentaDeclarada): ToolDefinition<z.ZodRawShape> {
  return defineTool({
    name: f.nome,
    title: f.titulo,
    description: f.descricao,
    inputSchema: ENTRADAS[f.nome] ?? {},
    annotations: {
      readOnlyHint: f.familia === "leitura",
      /*
       * Uma solicitação não é destrutiva: ela cria um pedido. O que o pedido autoriza pode ser
       * destrutivo, e isso acontece depois da aprovação, noutro lugar.
       */
      destructiveHint: false,
      idempotentHint: f.familia === "leitura",
      openWorldHint: false,
    },
    handler: async (args: Record<string, unknown>, ctx: ToolContext) => {
      const userId = ctx.getUserId() ?? null;
      const token = ctx.getToken();
      /*
       * A integração é o `client_id` OAuth verificado. Sem ele não dá para consultar permissão —
       * e permissão no Pathly é por integração, não por pessoa.
       */
      const integrationId = ctx.getClientId() ?? null;

      const pedido: PedidoMcp = {
        userId,
        integrationId,
        tool: f.nome,
        args,
        projectId: idDoProjeto(args),
      };

      if (!userId || !token || !integrationId) {
        const saida = await passarPeloPortao(pedido, {
          permissoes: [],
          vivos: [],
          dentroDoLimite: true,
        });
        return responder(saida.resultado as unknown as Record<string, unknown>);
      }

      const url = lerEnv("SUPABASE_URL") ?? lerEnv("VITE_SUPABASE_URL");
      const anon = lerEnv("SUPABASE_PUBLISHABLE_KEY") ?? lerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");

      const uso =
        url && anon
          ? await registrarUso(
              url,
              anon,
              token,
              "mcp",
              LIMITES.mcp.limite,
              LIMITES.mcp.janelaMinutos,
            )
          : { permitido: true as const };

      const [permissoes, vivos] = await Promise.all([
        dados.lerPermissoes(token, integrationId),
        f.familia === "solicitacao" ? dados.lerPedidosVivos(token) : Promise.resolve([]),
      ]);

      const saida = await passarPeloPortao(pedido, {
        permissoes,
        vivos,
        /*
         * Os escopos do token. Hoje o Supabase emite só `authenticated`; ver `validarEscopo`.
         * O spread — em vez de `escopos: ctx.getScopes()` — porque `exactOptionalPropertyTypes`
         * distingue "ausente" de "presente e indefinido", e a distinção aqui é exatamente a que
         * importa: sem escopo nenhum não é o mesmo que escopo vazio.
         */
        ...(ctx.getScopes() ? { escopos: ctx.getScopes()! } : {}),
        dentroDoLimite: uso.permitido !== false,
      });

      /* Audita antes de agir: uma execução que falhe depois ainda deixa o rastro de ter sido autorizada. */
      await dados.auditar(token, {
        provedor: integrationId,
        ato: saida.auditoria.ato,
        capacidade: saida.auditoria.capacidade,
        projetoId: pedido.projectId,
        detalhe: saida.auditoria.detalhe,
      });

      if (saida.resultado.estado === "DENIED") {
        return responder({
          status: saida.resultado.recusa,
          reason: saida.resultado.motivo,
          ...(saida.resultado.faltando ? { missing_permissions: saida.resultado.faltando } : {}),
        });
      }

      if (saida.resultado.estado === "APPROVAL_REQUIRED") {
        const gravou = await dados.gravarPedido(token, {
          user_id: userId,
          project_id: pedido.projectId,
          integration_id: integrationId,
          tool: f.nome,
          arguments: args,
          requested_scope: saida.pedido!.requested_scope,
          capability: saida.pedido!.capability,
          expires_at: saida.pedido!.expires_at,
          fingerprint: saida.pedido!.fingerprint,
          nonce: saida.pedido!.nonce,
        });

        if (!gravou.ok) return responder({ status: "ERROR", reason: gravou.motivo });

        return responder({
          status: "APPROVAL_REQUIRED",
          request_id: gravou.requestId,
          tool: f.nome,
          requested_scope: saida.pedido!.requested_scope,
          expires_at: saida.pedido!.expires_at,
          requires_reauthentication: saida.resultado.exigeReautenticacao,
          message: saida.resultado.frase,
          note:
            "Nada foi executado. A pessoa precisa aprovar no Pathly, e a aprovação vale uma " +
            "execução só. Não repita a chamada: use este request_id.",
        });
      }

      const r = await executar(f, args, token, userId, integrationId);
      return responder(
        saida.resultado.estado === "OK" && saida.resultado.avisoDeCobertura
          ? { ...r, coverage_note: saida.resultado.avisoDeCobertura }
          : r,
      );
    },
  }) as ToolDefinition<z.ZodRawShape>;
}

/**
 * Todas as ferramentas do Gateway, construídas pela única porta que existe.
 *
 * A bateria confere que esta lista tem o mesmo tamanho do catálogo: uma ferramenta declarada e
 * não construída seria invisível, e uma construída fora daqui não passaria pelo portão.
 */
export const FERRAMENTAS_DO_GATEWAY = FERRAMENTAS.map(construir);

/** Exportada para a bateria: garante que todo nome do catálogo tem entrada declarada. */
export function temEntradaDeclarada(nome: string): boolean {
  return acharFerramenta(nome) !== null && ENTRADAS[nome] !== undefined;
}
