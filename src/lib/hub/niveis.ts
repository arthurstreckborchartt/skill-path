/**
 * Os níveis de permissão do Integration Hub.
 *
 * ## Substituem as classes de risco
 *
 * O Hub nasceu ontem com quatro classes — leitura, escrita, execução, destrutiva. Os oito níveis
 * medem **a mesma coisa**, com mais resolução. Manter as duas seria duas taxonomias para o mesmo
 * eixo, e no dia em que discordassem a tela mostraria uma e o portão usaria a outra.
 *
 * ## A escada, e o que está fora dela
 *
 * `READ < SUGGEST < WRITE < EXECUTE` formam uma escada: quem pode executar comando pode, na
 * prática, ler e escrever arquivo — negar isso seria fingir uma separação que o sistema
 * operacional não faz.
 *
 * `COMMIT`, `PUSH`, `DEPLOY` e `DELETE` **não estão na escada**. Cada um exige concessão própria,
 * e nada os cobre. Não é sobre poder técnico: é que cada um produz uma consequência que não se
 * desfaz do lado de cá — um commit entra no histórico, um push sai da sua máquina, um deploy
 * alcança quem está usando, e um arquivo apagado não volta.
 *
 * ## Cobertura nunca é silenciosa
 *
 * Mesmo dentro da escada, uma permissão mais ampla cobrindo uma ação menor **é dito em voz alta**.
 * `decidir()` devolve `cobertura: "por-nivel-superior"` junto da frase que explica, e a tela é
 * obrigada a mostrar. Uma permissão de EXECUTE que silenciosamente autoriza leituras é uma
 * permissão que a pessoa concedeu para uma coisa e está sendo usada para outra.
 */

export const NIVEIS = [
  "READ",
  "SUGGEST",
  "WRITE",
  "EXECUTE",
  "COMMIT",
  "PUSH",
  "DEPLOY",
  "DELETE",
] as const;

export type Nivel = (typeof NIVEIS)[number];

/**
 * A escada. Número maior cobre número menor — e só dentro da escada.
 *
 * Os quatro isolados recebem `null`: não têm posição, porque comparar "apagar arquivo" com
 * "executar comando" numa régua única produz sempre a resposta errada em algum caso.
 */
const DEGRAU: Record<Nivel, number | null> = {
  READ: 1,
  SUGGEST: 2,
  WRITE: 3,
  EXECUTE: 4,
  COMMIT: null,
  PUSH: null,
  DEPLOY: null,
  DELETE: null,
};

export function ehIsolado(n: Nivel): boolean {
  return DEGRAU[n] === null;
}

export type DefinicaoNivel = {
  id: Nivel;
  rotulo: string;
  /** O que acontece no mundo quando uma ação deste nível roda. */
  oQueAcontece: string;
  /**
   * `true` quando **cada ocorrência** precisa de aprovação, mesmo com permissão persistente.
   *
   * É a tradução direta da regra: o Pathly nunca comita, empurra, publica, apaga ou executa
   * sozinho. Uma permissão persistente de PUSH não existe — e mesmo que existisse, ela não
   * dispensaria a aprovação desta vez.
   */
  aprovacaoPorAcao: boolean;
  /** `true` quando exige autenticação fresca, e não só aprovação. Hoje, só PUSH. */
  exigeReautenticacao: boolean;
  /** `true` quando a permissão não pode ser guardada como persistente, nem por escolha. */
  proibePersistente: boolean;
};

export const DEFINICOES_NIVEL: Record<Nivel, DefinicaoNivel> = {
  READ: {
    id: "READ",
    rotulo: "Ler",
    oQueAcontece: "Nada muda. A ferramenta lê e devolve o que encontrou.",
    aprovacaoPorAcao: false,
    exigeReautenticacao: false,
    proibePersistente: false,
  },
  SUGGEST: {
    id: "SUGGEST",
    rotulo: "Sugerir",
    oQueAcontece:
      "Nada muda ainda. A ferramenta produz uma proposta — texto, prompt ou alteração de plano — " +
      "que continua esperando você.",
    aprovacaoPorAcao: false,
    exigeReautenticacao: false,
    proibePersistente: false,
  },
  WRITE: {
    id: "WRITE",
    rotulo: "Escrever",
    oQueAcontece: "Arquivos do seu projeto mudam de conteúdo.",
    aprovacaoPorAcao: false,
    exigeReautenticacao: false,
    proibePersistente: false,
  },
  EXECUTE: {
    id: "EXECUTE",
    rotulo: "Executar",
    oQueAcontece:
      "Um comando roda no ambiente conectado, com tudo que ele alcança de lá — inclusive o que as " +
      "outras permissões protegem.",
    /*
     * Executar comando arbitrário alcança tudo que o ambiente alcança. Uma permissão persistente
     * aqui equivaleria a entregar o ambiente inteiro de uma vez, e para sempre.
     */
    aprovacaoPorAcao: true,
    exigeReautenticacao: false,
    proibePersistente: false,
  },
  COMMIT: {
    id: "COMMIT",
    rotulo: "Criar commit",
    oQueAcontece: "As alterações entram no histórico do repositório, com o seu nome.",
    aprovacaoPorAcao: true,
    exigeReautenticacao: false,
    proibePersistente: true,
  },
  PUSH: {
    id: "PUSH",
    rotulo: "Enviar para o remoto",
    oQueAcontece:
      "O que está commitado sai da sua máquina e chega a quem mais tiver acesso ao repositório, " +
      "e às automações ligadas nele.",
    aprovacaoPorAcao: true,
    /*
     * A única que exige autenticação fresca. Empurrar é o ponto em que o trabalho deixa de ser
     * seu e passa a ser de todo mundo — e é o ponto em que uma sessão roubada custa mais caro.
     */
    exigeReautenticacao: true,
    proibePersistente: true,
  },
  DEPLOY: {
    id: "DEPLOY",
    rotulo: "Publicar",
    oQueAcontece: "A mudança alcança quem está usando o produto agora.",
    aprovacaoPorAcao: true,
    exigeReautenticacao: false,
    proibePersistente: true,
  },
  DELETE: {
    id: "DELETE",
    rotulo: "Apagar",
    oQueAcontece: "Arquivos somem. O que não estiver no git não tem de onde voltar.",
    aprovacaoPorAcao: true,
    exigeReautenticacao: false,
    proibePersistente: true,
  },
};

export type Cobertura = "exata" | "por-nivel-superior";

export type ResultadoCobertura =
  | { cobre: false }
  | {
      cobre: true;
      cobertura: Cobertura;
      /** Preenchido só quando a cobertura não é exata. A tela é obrigada a mostrar. */
      aviso: string | null;
    };

/**
 * A permissão de nível `concedido` cobre uma ação de nível `pedido`?
 *
 * Fora da escada, só cobertura exata. Dentro dela, um nível superior cobre — e a cobertura vem
 * com a frase que a explica, porque reutilizar permissão ampla em silêncio é precisamente o que
 * a regra proíbe.
 */
export function cobre(concedido: Nivel, pedido: Nivel): ResultadoCobertura {
  if (concedido === pedido) return { cobre: true, cobertura: "exata", aviso: null };

  const a = DEGRAU[concedido];
  const b = DEGRAU[pedido];
  if (a === null || b === null) return { cobre: false };
  if (a < b) return { cobre: false };

  return {
    cobre: true,
    cobertura: "por-nivel-superior",
    aviso:
      `Isto está sendo coberto pela sua permissão de ${DEFINICOES_NIVEL[concedido].rotulo}, ` +
      `que é mais ampla que ${DEFINICOES_NIVEL[pedido].rotulo}.`,
  };
}

/** O maior nível de uma lista. `null` quando a lista está vazia ou só tem isolados. */
export function maiorNivelDaEscada(niveis: readonly Nivel[]): Nivel | null {
  let melhor: Nivel | null = null;
  for (const n of niveis) {
    const d = DEGRAU[n];
    if (d === null) continue;
    const atual = melhor === null ? -1 : (DEGRAU[melhor] ?? -1);
    if (d > atual) melhor = n;
  }
  return melhor;
}
