import { lerEnv } from "@/lib/server-env";
import { cabecalhosServico } from "@/lib/supabase-servidor";

/**
 * Limite de uso dos endpoints que chamam IA.
 *
 * Existe porque sem ele `/api/licao` e `/api/pratica` são um proxy de LLM gratuito e ilimitado:
 * cadastro é aberto, o texto do prompt vem do corpo da requisição, e nada impede alguém de criar
 * uma conta e disparar em laço. No plano gratuito isso esgota a cota e nega serviço a quem está
 * estudando de verdade; com a chave da Anthropic ativa, gasta dinheiro.
 *
 * A contagem vive no banco, não em memória: o Worker não guarda estado entre requisições, e cada
 * requisição pode cair numa instância diferente.
 *
 * O incremento é atômico (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, uma instrução só).
 * Ler e depois gravar deixaria cem requisições simultâneas lerem zero e passarem juntas — que é
 * exatamente o furo que este limite fecha.
 */

export type ResultadoLimite =
  | { permitido: true; usadas: number }
  | { permitido: false; usadas: number; limite: number; janelaMinutos: number }
  /** O limite não pôde ser conferido. Quem chama decide — ver a nota em `permitir`. */
  | { permitido: "indeterminado" };

/**
 * Registra a chamada e diz se ela cabe no limite.
 *
 * Quando a checagem falha (banco fora, RPC ausente), devolve `indeterminado` em vez de bloquear.
 * Escolha deliberada: derrubar o estudo de todo mundo porque o contador está fora é pior do que
 * o risco de abuso durante uma indisponibilidade, que é curta e visível. Quem chama registra.
 */
export async function registrarUso(
  supabaseUrl: string,
  anonKey: string,
  token: string,
  endpoint: string,
  limite: number,
  janelaMinutos: number,
): Promise<ResultadoLimite> {
  try {
    const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRole) return { permitido: "indeterminado" };

    // A função privilegiada não é mais executável por usuários autenticados. Primeiro obtemos a
    // identidade diretamente do Auth com o token já validado pela rota; depois o servidor chama
    // o RPC restrito à service role, sem expor essa credencial ao navegador.
    const usuario = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!usuario.ok) return { permitido: "indeterminado" };
    const userId = ((await usuario.json()) as { id?: unknown }).id;
    if (typeof userId !== "string" || !userId) return { permitido: "indeterminado" };

    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/registrar_uso_ia_servidor`, {
      method: "POST",
      headers: cabecalhosServico(serviceRole, {
        "Content-Type": "application/json",
      }),
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        p_user_id: userId,
        p_endpoint: endpoint,
        p_janela_minutos: janelaMinutos,
      }),
    });

    if (!r.ok) return { permitido: "indeterminado" };

    const usadas = (await r.json()) as number;
    if (typeof usadas !== "number") return { permitido: "indeterminado" };

    if (usadas > limite) return { permitido: false, usadas, limite, janelaMinutos };
    return { permitido: true, usadas };
  } catch {
    return { permitido: "indeterminado" };
  }
}

/**
 * Tetos por endpoint, por hora e por pessoa.
 *
 * Calibrados contra o uso real, não contra um número redondo: uma rota tem 30 a 40 tarefas, e
 * ninguém estuda mais que algumas por hora. Quem encosta nestes números não está estudando.
 */
export const LIMITES = {
  /** Uma rota inteira por hora é generoso — a pessoa refaz o onboarding no máximo umas vezes. */
  rota: { limite: 5, janelaMinutos: 60 },
  /** Abrir 40 aulas em uma hora já seria a rota inteira. */
  licao: { limite: 40, janelaMinutos: 60 },
  /** Reenviar a mesma prática para correção várias vezes é normal; 60 por hora não é. */
  pratica: { limite: 60, janelaMinutos: 60 },
  /**
   * Um blueprint completo são 4 blocos. 20 por hora = 5 projetos inteiros do zero — mais do que
   * alguém planeja de verdade num dia, e teto suficiente para o custo não escapar.
   *
   * Este é o limite que mais importa em dinheiro: no plano Pro cada bloco vai para o Claude com
   * `effort: high`, que é a chamada mais cara que o app faz.
   */
  blueprint: { limite: 20, janelaMinutos: 60 },
  /**
   * Abrir etapas do roadmap é o uso mais frequente do app: a pessoa navega, lê, volta. 40 por
   * hora cobre um dia inteiro de estudo do plano; quem passa disso não está lendo.
   */
  etapa: { limite: 40, janelaMinutos: 60 },
  /**
   * Projetar o banco é caro e raro: um projeto tem um modelo de dados, e refazer é exceção.
   * 8 por hora cobre quem está iterando no schema sem abrir espaço para uso em laço.
   */
  banco: { limite: 8, janelaMinutos: 60 },
  /** Mesmo raciocínio do banco: um projeto tem um mapa de APIs, e refazer é exceção. */
  api: { limite: 8, janelaMinutos: 60 },
  /**
   * A análise de segurança é barata: só os extras passam pela IA, e a lista é curta. O catálogo
   * e a detecção rodam sem chamada nenhuma.
   */
  seguranca: { limite: 12, janelaMinutos: 60 },
} as const;
