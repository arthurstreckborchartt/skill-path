/**
 * A política de custo por endpoint — e o que fazer quando o contador de uso não responde.
 *
 * ## Por que não existe uma regra única
 *
 * Falhar aberto em tudo transforma uma configuração ausente em conta de IA sem teto. Falhar
 * fechado em tudo transforma uma indisponibilidade curta do contador em produto fora do ar. As
 * duas são erradas, e pelo mesmo motivo: tratam um webhook de pagamento e uma geração de
 * blueprint no Claude como se tivessem o mesmo risco.
 *
 * A regra aqui é uma só, aplicada por endpoint: **quanto maior o custo financeiro possível de uma
 * chamada, menor a tolerância a não conseguir contá-la.**
 *
 * ## O limite de emergência é fraco de propósito, e isto precisa ser dito
 *
 * O app roda em Cloudflare Workers (preset `cloudflare-module`). Não há memória compartilhada
 * entre isolates, e cada requisição pode cair em um diferente. Um contador em memória é, portanto,
 * **por isolate**: com N isolates ativos, o teto efetivo é N vezes o configurado.
 *
 * Ele não substitui o contador central e não serve para faturamento. Serve para uma coisa só:
 * limitar a explosão enquanto o contador oficial está fora. Tratá-lo como número confiável seria
 * pior que não tê-lo, porque daria uma sensação de proteção que ele não entrega.
 */

export type ClasseCusto = "free" | "low" | "medium" | "high" | "critical";

/**
 * O que fazer quando o contador central não pôde ser consultado.
 *
 * - `open`: deixa passar. Só para o que não gera custo externo.
 * - `local_cap`: deixa passar até um teto conservador em memória, por isolate.
 * - `closed`: recusa. A chamada externa não acontece sem contagem.
 */
export type ModoDeFalha = "open" | "local_cap" | "closed";

export type PoliticaCusto = {
  classe: ClasseCusto;
  /** `false` só para o que não chama serviço pago nem consome cota. */
  exigeContador: boolean;
  modoDeFalha: ModoDeFalha;
  /**
   * Chamadas permitidas por hora, por usuário e por isolate, enquanto o contador está fora.
   * Deliberadamente muito menor que o limite normal.
   */
  tetoEmergencia?: number;
};

/**
 * A tabela. Um lugar só, para não haver número mágico espalhado pelas rotas.
 *
 * As chaves são os nomes que as rotas já passam para `registrarUso`, não os caminhos: é o que
 * elas usam para contar, e duplicar a identidade do endpoint em duas convenções criaria a chance
 * de as duas discordarem.
 */
export const POLITICAS: Record<string, PoliticaCusto> = {
  /**
   * Blueprint e etapa são os dois `critical`, e por motivos diferentes.
   *
   * O blueprint é a chamada mais cara do app: no plano Pro cada bloco vai para o Claude com
   * `effort: high`, e são quatro blocos por projeto. A etapa é mais barata por chamada, mas tem o
   * dobro do teto por hora — 40 × 10.240 tokens é o maior volume horário do produto.
   *
   * Nos dois, deixar passar sem contar é abrir exatamente o abuso que o limite fecha.
   */
  blueprint: { classe: "critical", exigeContador: true, modoDeFalha: "closed" },
  etapa: { classe: "critical", exigeContador: true, modoDeFalha: "closed" },

  // Caros por chamada (12k a 14k tokens no Claude), mas com teto baixo: 8 por hora.
  banco: { classe: "high", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 2 },
  api: { classe: "high", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 2 },
  "arquitetura-ia": {
    classe: "high",
    exigeContador: true,
    modoDeFalha: "local_cap",
    tetoEmergencia: 2,
  },

  // Conversa: barato por mensagem, mas é o uso mais frequente que existe.
  copilot: { classe: "high", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 5 },

  // Só os extras passam pela IA; o catálogo e a detecção rodam sem chamada nenhuma.
  seguranca: { classe: "medium", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 3 },

  /**
   * Estes três não passam pelo Claude — só pelos provedores gratuitos.
   *
   * O risco aqui não é dinheiro, é esgotar a cota gratuita e negar serviço a quem está estudando.
   * Continua sendo motivo para limitar, e não é motivo para derrubar o estudo de todos quando o
   * contador cair.
   */
  licao: { classe: "medium", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 5 },
  pratica: { classe: "medium", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 5 },
  rota: { classe: "medium", exigeContador: true, modoDeFalha: "local_cap", tetoEmergencia: 2 },

  /**
   * O único endpoint aqui cujo risco não é a nossa fatura.
   *
   * Executar ação externa não chama provedor pago: custo financeiro nosso, zero. O que está em
   * jogo é a conta da pessoa no outro lado — cota gastada, e no limite um bloqueio por abuso que
   * recai sobre ela, não sobre nós.
   *
   * Por isso não é `open`, apesar do custo zero. A aprovação humana antes de cada execução é a
   * defesa principal, mas ela protege contra o Pathly agir sozinho — não contra um script com o
   * token da pessoa, que criaria, aprovaria e executaria em laço pelos mesmos caminhos.
   *
   * E não é `closed`, apesar do efeito externo, porque `closed` aqui significa produto fora do ar
   * em qualquer ambiente sem `SUPABASE_SERVICE_ROLE_KEY` — inclusive desenvolvimento. O que se
   * ganharia é pequeno: sem contador, o teto por isolate ainda limita a explosão, e cada execução
   * continua exigindo uma linha `aprovada` que vale uma vez só.
   *
   * Teto baixo, 3: quem aprova uma por uma nunca encosta nele numa janela degradada.
   */
  integracoes: {
    classe: "medium",
    exigeContador: true,
    modoDeFalha: "local_cap",
    tetoEmergencia: 3,
  },
};

/**
 * A política de um endpoint não listado.
 *
 * `closed` de propósito. Se alguém acrescentar uma rota de IA e esquecer de classificá-la, o
 * comportamento seguro é recusar quando não dá para contar — não é herdar silenciosamente a
 * permissão. Esquecer de cadastrar aparece como erro na hora; herdar `open` aparece na fatura.
 */
export const POLITICA_PADRAO: PoliticaCusto = {
  classe: "critical",
  exigeContador: true,
  modoDeFalha: "closed",
};

export function politicaDe(endpoint: string): PoliticaCusto {
  return POLITICAS[endpoint] ?? POLITICA_PADRAO;
}

// ---------------------------------------------------------------------------------------------
// O teto de emergência
// ---------------------------------------------------------------------------------------------

/**
 * Contagem em memória, por usuário e endpoint, em janela de uma hora.
 *
 * Escopo de isolate. Reinicia a cada deploy e a cada reciclagem do Worker, e não é compartilhada
 * entre instâncias. Nada disso é defeito: é o que um fallback de emergência pode ser sem
 * infraestrutura nova, e acrescentar Redis ou fila para contar melhor durante uma falha rara
 * custaria mais operação do que o problema que resolve.
 */
const JANELA_MS = 60 * 60 * 1000;

const contagem = new Map<string, { inicio: number; chamadas: number }>();

/**
 * Limpa entradas vencidas quando o mapa cresce.
 *
 * Sem isto, um isolate de vida longa acumularia uma entrada por usuário atendido desde o início.
 * O teto de 5.000 é folgado: a limpeza é O(n) e só roda quando realmente precisa.
 */
function limparSeNecessario(agora: number): void {
  if (contagem.size < 5000) return;
  for (const [chave, v] of contagem) {
    if (agora - v.inicio >= JANELA_MS) contagem.delete(chave);
  }
}

export type ResultadoEmergencia = { permitido: boolean; usadas: number; teto: number };

export function consumirTetoEmergencia(
  userId: string,
  endpoint: string,
  teto: number,
): ResultadoEmergencia {
  const agora = Date.now();
  limparSeNecessario(agora);

  const chave = `${userId}:${endpoint}`;
  const atual = contagem.get(chave);

  if (!atual || agora - atual.inicio >= JANELA_MS) {
    contagem.set(chave, { inicio: agora, chamadas: 1 });
    return { permitido: true, usadas: 1, teto };
  }

  // Conta a tentativa mesmo quando recusa: quem insiste em laço não ganha janela por insistir.
  atual.chamadas += 1;
  return { permitido: atual.chamadas <= teto, usadas: atual.chamadas, teto };
}

/** Só para teste: zera a contagem em memória. */
export function limparTetoEmergencia(): void {
  contagem.clear();
}
