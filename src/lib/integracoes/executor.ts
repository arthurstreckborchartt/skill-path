import type { AcaoExterna } from "./contrato";
import { listarRepos } from "./github";
import { chamar } from "@/lib/mcp/cliente/protocolo";

/**
 * O que acontece depois da aprovação.
 *
 * ## Só servidor
 *
 * Este módulo é o único lugar que fala com o mundo lá fora em nome da pessoa, e para os provedores
 * reais ele precisará do token — que só existe no servidor. Importar daqui do cliente não vazaria
 * o token (ele nem chega ao navegador), mas colocaria a lógica de execução num lugar onde qualquer
 * pessoa a reescreve com o devtools aberto. Ele é usado só por `/api/integracoes/executar`.
 *
 * ## Por que o executor não monta o que vai enviar
 *
 * Ele recebe a ação já gravada e usa o `payload` **dela**. Não remonta nada a partir do catálogo,
 * não aceita corpo do cliente. É o que faz a aprovação valer para o objeto que a pessoa leu, e não
 * para um parecido montado meio segundo depois.
 *
 * ## O que nunca entra no resultado
 *
 * `resultado` e `motivo` vão para o banco e aparecem na tela. Token, cabeçalho de autorização e
 * corpo bruto de resposta ficam de fora — o que volta é uma frase curta em português.
 */

export type ResultadoExecucao =
  | { ok: true; resumo: string }
  | {
      ok: false;
      motivo: string;
      /**
       * `true` quando tentar de novo não adianta (provedor sem suporte, ação desconhecida).
       *
       * Não muda o estado gravado — ação que falha fica `falhou` nos dois casos, e `falhou` é
       * terminal. Serve para a tela escolher entre "tente de novo" e "isto não vai funcionar".
       */
      permanente: boolean;
    };

/**
 * O provedor de demonstração, que existe para o portão de aprovação ser testável sem conta
 * nenhuma.
 *
 * Ele não faz `fetch`. A ausência de rede aqui é a característica, não uma simplificação: é o que
 * permite alguém ver o fluxo inteiro — pedir, aprovar, executar, ler o resultado — antes de
 * entregar credencial de qualquer serviço ao Pathly.
 */
function executarDemo(acao: AcaoExterna): ResultadoExecucao {
  switch (acao.acaoId) {
    case "demo-listar":
      return { ok: true, resumo: "3 itens de exemplo: Alfa, Beta, Gama." };

    case "demo-criar": {
      const nome = typeof acao.payload["nome"] === "string" ? acao.payload["nome"] : "sem nome";
      return { ok: true, resumo: `Item de exemplo criado: ${nome.slice(0, 60)}.` };
    }

    default:
      return {
        ok: false,
        motivo: `Ação "${acao.acaoId}" não existe no provedor de demonstração.`,
        permanente: true,
      };
  }
}

export type ContextoExecucao = {
  /**
   * O token em claro do provedor, quando há conexão.
   *
   * `null` enquanto não existir OAuth. Quem chama decifra; o executor só usa. A separação existe
   * para este módulo nunca precisar conhecer a chave de cifragem.
   */
  token: string | null;
  /**
   * O servidor MCP desta ação, **resolvido do banco pelo endpoint**, nunca do corpo da requisição.
   *
   * `null` quando a ação não é MCP, ou quando o endereço do `payload` não corresponde a nenhum
   * servidor que a pessoa conectou — e aí o executor recusa.
   *
   * É a peça central da fase 2. O `payload` guarda o endereço porque a aprovação precisa dizer
   * para onde vai, mas o endereço ali é **chave de busca**, não destino: o executor só chama o que
   * achou na lista da própria pessoa. Sem isso, aprovar uma ação seria um jeito de apontar o
   * servidor do Pathly para qualquer lugar.
   */
  mcp: {
    endereco: string;
    token: string | null;
    /** Os nomes que o servidor oferecia na última descoberta. Ferramenta fora daqui é recusada. */
    ferramentas: readonly string[];
  } | null;
};

/**
 * Uma chamada a servidor MCP que a pessoa conectou.
 *
 * ## As três perguntas antes da rede
 *
 * 1. **Este servidor é dela?** O endpoint resolveu `contexto.mcp` procurando o endereço do
 *    `payload` na lista dela. Veio `null` significa que não achou — recusa.
 * 2. **O servidor ainda oferece esta ferramenta?** Uma aprovação pode ter sido dada ontem e o
 *    servidor ter removido a ferramenta hoje. Executar assim mesmo chamaria um nome que já não
 *    existe, e o servidor decidiria o que fazer com ele.
 * 3. **O endereço que vou chamar é o que ela aprovou?** O do contexto veio do banco e o do
 *    `payload` veio da linha da ação, que é imutável depois de criada. Se divergirem, alguma das
 *    duas mudou debaixo da aprovação — e nenhuma leitura razoável disso termina em "chame mesmo
 *    assim".
 *
 * Só depois disso a rede acontece, e lá `chamar` ainda valida o destino e não entrega credencial
 * num desvio que troque de host.
 */
async function executarMcp(
  acao: AcaoExterna,
  mcp: NonNullable<ContextoExecucao["mcp"]>,
): Promise<ResultadoExecucao> {
  const enderecoDaAcao = acao.payload["servidor"];
  if (typeof enderecoDaAcao !== "string" || enderecoDaAcao !== mcp.endereco) {
    return {
      ok: false,
      motivo: "O servidor desta ação não confere com o que está conectado. Peça de novo.",
      permanente: true,
    };
  }

  if (!mcp.ferramentas.includes(acao.acaoId)) {
    return {
      ok: false,
      motivo: `O servidor não oferece mais a ferramenta "${acao.acaoId}". Reconecte para atualizar a lista.`,
      permanente: true,
    };
  }

  const bruto = acao.payload["argumentos"];
  const argumentos =
    bruto && typeof bruto === "object" && !Array.isArray(bruto)
      ? (bruto as Record<string, unknown>)
      : {};

  const r = await chamar(mcp.endereco, acao.acaoId, argumentos, mcp.token);
  if (!r.ok) return { ok: false, motivo: r.motivo, permanente: false };

  /*
   * A ferramenta rodou e falhou: isso é `ok`, com o erro no resumo.
   *
   * A aprovação foi consumida — a chamada aconteceu, e o que o servidor fez do lado dele o Pathly
   * não desfaz. Marcar como falha ofereceria "tentar de novo" e gastaria uma segunda aprovação
   * para repetir o mesmo erro.
   */
  return {
    ok: true,
    resumo: r.ehErroDaFerramenta ? `A ferramenta respondeu com erro: ${r.texto}` : r.texto,
  };
}

export async function executarAcao(
  acao: AcaoExterna,
  contexto: ContextoExecucao,
): Promise<ResultadoExecucao> {
  if (acao.provedor === "demo") return executarDemo(acao);

  if (acao.provedor === "mcp") {
    if (!contexto.mcp) {
      return {
        ok: false,
        motivo: "Você não tem este servidor MCP conectado. Conecte antes de executar.",
        permanente: true,
      };
    }
    return executarMcp(acao, contexto.mcp);
  }

  if (!contexto.token) {
    return {
      ok: false,
      motivo: "Não há conexão com este provedor. Conecte a conta antes de executar.",
      permanente: true,
    };
  }

  if (acao.provedor === "github") {
    switch (acao.acaoId) {
      case "github-repos": {
        const r = await listarRepos(contexto.token);
        return r.ok
          ? { ok: true, resumo: r.valor }
          : { ok: false, motivo: r.motivo, permanente: false };
      }
      default:
        return {
          ok: false,
          motivo: `Ação "${acao.acaoId}" não existe no GitHub.`,
          permanente: true,
        };
    }
  }

  /*
   * Provedor conhecido pelo tipo mas sem execução escrita. Recusar explícito é melhor que cair
   * num `default` silencioso que devolveria sucesso sem ter feito nada.
   */
  return {
    ok: false,
    motivo: `Execução para ${acao.provedor} ainda não foi implementada.`,
    permanente: true,
  };
}
