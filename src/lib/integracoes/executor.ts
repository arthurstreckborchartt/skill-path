import type { AcaoExterna } from "./contrato";

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

/** Chamadas externas param aqui. Sem isto, uma ponta lenta segura o Worker até o limite dele. */
const TIMEOUT_MS = 10_000;

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
};

export async function executarAcao(
  acao: AcaoExterna,
  contexto: ContextoExecucao,
): Promise<ResultadoExecucao> {
  if (acao.provedor === "demo") return executarDemo(acao);

  if (!contexto.token) {
    return {
      ok: false,
      motivo: "Não há conexão com este provedor. Conecte a conta antes de executar.",
      permanente: true,
    };
  }

  /*
   * GitHub entra aqui junto com o OAuth. Hoje não há caminho para chegar neste ponto pela tela —
   * conectar não é oferecido sem credencial no ambiente —, então isto cobre só quem inserir uma
   * ação direto no banco. Recusar explícito é melhor que cair num `default` silencioso.
   */
  return {
    ok: false,
    motivo: `Execução para ${acao.provedor} ainda não foi implementada.`,
    permanente: true,
  };
}

/** Exportado para o dia do primeiro provedor real: chamada externa com prazo, sempre. */
export async function buscarComPrazo(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}
