import { lerEnv } from "@/lib/server-env";
import { cabecalhosServico } from "@/lib/supabase-servidor";
import { consumirTetoEmergencia, politicaDe } from "@/lib/politica-custo";

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

/**
 * Por que a recusa carrega um motivo.
 *
 * "Você usou muitas vezes" e "não consegui conferir o seu limite" são fatos diferentes, e a
 * pessoa age diferente diante deles: no primeiro caso ela espera a janela virar, no segundo ela
 * tenta de novo em instantes. Um 429 genérico para os dois manda quem poderia continuar embora.
 */
export type MotivoRecusa = "limite" | "contador-indisponivel" | "teto-emergencia";

export type ResultadoLimite =
  | { permitido: true; usadas: number; viaEmergencia?: boolean }
  | {
      permitido: false;
      motivo: MotivoRecusa;
      usadas: number;
      limite: number;
      janelaMinutos: number;
    }
  /** O contador respondeu e a política do endpoint deixou passar mesmo assim. */
  | { permitido: "indeterminado" };

/**
 * O aviso de que o limite está desligado — e por que ele precisa existir.
 *
 * `indeterminado` foi pensado para indisponibilidade: banco fora, RPC com erro. Nesse caso a
 * escolha de deixar passar é boa, porque a falha é curta e alguém percebe.
 *
 * Faltar `SUPABASE_SERVICE_ROLE_KEY` não é isso. É configuração ausente: permanente, silenciosa,
 * e com o efeito exato que este arquivo existe para impedir — todo endpoint de IA vira um proxy
 * de LLM ilimitado, e ninguém descobre até a fatura. Sem este aviso, os dois casos são
 * indistinguíveis no log.
 *
 * Uma vez por processo, não por requisição: o objetivo é aparecer no início do log de um deploy
 * mal configurado, não afogar o log de um que está certo.
 */
let jaAvisou = false;

function avisarSemChave(): void {
  if (jaAvisou) return;
  jaAvisou = true;
  console.error(
    "[Pathly] SUPABASE_SERVICE_ROLE_KEY ausente: o limite de uso de IA está DESLIGADO. " +
      "Todos os endpoints de IA vão aceitar chamadas sem teto até a variável ser configurada.",
  );
}

/**
 * Quem é a pessoa. Necessário tanto para o contador central quanto para o teto de emergência.
 */
async function lerUserId(
  supabaseUrl: string,
  anonKey: string,
  token: string,
): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const id = ((await r.json()) as { id?: unknown }).id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * O contador central — a fonte oficial. `null` quando não foi possível contar.
 *
 * A função privilegiada não é executável por usuários autenticados: a rota valida o token e o
 * servidor chama o RPC restrito à service role, sem expor essa credencial ao navegador.
 */
async function contarNoBanco(
  supabaseUrl: string,
  serviceRole: string,
  userId: string,
  endpoint: string,
  janelaMinutos: number,
): Promise<number | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/registrar_uso_ia_servidor`, {
      method: "POST",
      headers: cabecalhosServico(serviceRole, { "Content-Type": "application/json" }),
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        p_user_id: userId,
        p_endpoint: endpoint,
        p_janela_minutos: janelaMinutos,
      }),
    });
    if (!r.ok) return null;

    const usadas = (await r.json()) as unknown;
    return typeof usadas === "number" ? usadas : null;
  } catch {
    return null;
  }
}

/**
 * O registro de observabilidade.
 *
 * Sai só quando o contador central falhou — o caminho feliz não precisa de log, e poluí-lo
 * esconderia justamente o que interessa. Nunca carrega prompt, token ou conteúdo: só o suficiente
 * para responder "quantas vezes o contador caiu, em qual endpoint, e o que o produto fez".
 */
function registrarFalhaDeContagem(dados: {
  endpoint: string;
  classe: string;
  modoDeFalha: string;
  fallbackAtivado: boolean;
  resultado: string;
}): void {
  console.warn(
    "[Pathly] limite-uso " +
      JSON.stringify({
        ...dados,
        contadorDisponivel: false,
        em: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      }),
  );
}

/**
 * Registra a chamada e diz se ela cabe no limite.
 *
 * Com o contador central respondendo, a resposta é a dele. Quando ele não responde, quem decide é
 * a política do endpoint em `politica-custo.ts` — e é lá que está escrito por que cada um tolera
 * mais ou menos essa falha.
 */
export async function registrarUso(
  supabaseUrl: string,
  anonKey: string,
  token: string,
  endpoint: string,
  limite: number,
  janelaMinutos: number,
): Promise<ResultadoLimite> {
  const politica = politicaDe(endpoint);

  // Endpoint sem custo externo não precisa de contagem nem de fallback.
  if (!politica.exigeContador) return { permitido: "indeterminado" };

  const serviceRole = lerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRole) avisarSemChave();

  const userId = await lerUserId(supabaseUrl, anonKey, token);

  const usadas =
    serviceRole && userId
      ? await contarNoBanco(supabaseUrl, serviceRole, userId, endpoint, janelaMinutos)
      : null;

  if (usadas !== null) {
    if (usadas > limite) {
      return { permitido: false, motivo: "limite", usadas, limite, janelaMinutos };
    }
    return { permitido: true, usadas };
  }

  // Daqui para baixo, o contador central não respondeu.

  if (politica.modoDeFalha === "open") {
    registrarFalhaDeContagem({
      endpoint,
      classe: politica.classe,
      modoDeFalha: "open",
      fallbackAtivado: false,
      resultado: "permitido",
    });
    return { permitido: "indeterminado" };
  }

  /**
   * Sem identificar a pessoa, o teto de emergência não tem por quem contar.
   *
   * Cair para `closed` aqui é o certo: um teto por usuário que não sabe quem é o usuário não
   * limita nada, e deixar passar seria o mesmo que `open` num endpoint que a política disse que
   * não pode ficar aberto.
   */
  if (politica.modoDeFalha === "closed" || !userId || !politica.tetoEmergencia) {
    registrarFalhaDeContagem({
      endpoint,
      classe: politica.classe,
      modoDeFalha: politica.modoDeFalha,
      fallbackAtivado: false,
      resultado: "bloqueado",
    });
    return {
      permitido: false,
      motivo: "contador-indisponivel",
      usadas: 0,
      limite,
      janelaMinutos,
    };
  }

  const emergencia = consumirTetoEmergencia(userId, endpoint, politica.tetoEmergencia);

  registrarFalhaDeContagem({
    endpoint,
    classe: politica.classe,
    modoDeFalha: "local_cap",
    fallbackAtivado: true,
    resultado: emergencia.permitido ? "permitido-em-emergencia" : "bloqueado-por-teto-emergencia",
  });

  if (!emergencia.permitido) {
    return {
      permitido: false,
      motivo: "teto-emergencia",
      usadas: emergencia.usadas,
      limite: emergencia.teto,
      janelaMinutos: 60,
    };
  }

  return { permitido: true, usadas: emergencia.usadas, viaEmergencia: true };
}

/**
 * O status e o texto de uma recusa.
 *
 * Existe para a pessoa nunca ler o motivo técnico. "Contador indisponível", "RPC ausente" ou
 * "service role não configurada" não são informação para quem está tentando usar o produto — são
 * informação para o log, e é lá que ficam.
 *
 * O status também muda: estourar o limite é 429 (culpa do uso, a janela vai virar), não conseguir
 * conferir é 503 (culpa nossa, tente de novo já). Mandar 429 nos dois faria quem poderia
 * continuar em instantes esperar uma hora à toa.
 */
export function recusaParaResposta(
  uso: { motivo: MotivoRecusa },
  mensagemDoLimite: string,
): { status: number; mensagem: string } {
  if (uso.motivo === "limite") return { status: 429, mensagem: mensagemDoLimite };

  if (uso.motivo === "teto-emergencia") {
    return {
      status: 503,
      mensagem:
        "Estamos com uma instabilidade e reduzimos temporariamente as chamadas. Tente de novo em alguns minutos.",
    };
  }

  return {
    status: 503,
    mensagem:
      "Não foi possível verificar o seu limite de uso agora. Tente de novo em alguns instantes.",
  };
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
  /**
   * Mesmo raciocínio do banco e da API: um projeto tem uma arquitetura de IA, e refazer é exceção.
   * O plano guardado é devolvido sem chamada nenhuma — só `refazer` gasta.
   */
  arquiteturaIa: { limite: 8, janelaMinutos: 60 },
  /**
   * O Copilot é conversa, e conversa é o uso mais frequente que existe: a pessoa pergunta, lê,
   * pergunta de novo. Um teto baixo aqui transformaria o recurso num brinquedo que acaba no meio
   * da dúvida.
   *
   * 30 por hora é uma sessão longa de trabalho — quem passa disso não está mais conversando, está
   * usando o Pathly como proxy de LLM. Cada mensagem é barata: o contexto fica entre 300 e 900
   * tokens, contra os milhares dos geradores de blueprint.
   */
  copilot: { limite: 30, janelaMinutos: 60 },
} as const;
