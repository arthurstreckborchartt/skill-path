import type { Capacidade } from "@/lib/hub/capacidades";
import { DEFINICOES, faltamPara } from "@/lib/hub/capacidades";
import type { Nivel } from "@/lib/hub/niveis";
import { cobre, ehIsolado, DEFINICOES_NIVEL, NIVEIS } from "@/lib/hub/niveis";
import { fraseDeConfirmacao, VALIDADE_APROVACAO_MIN } from "@/lib/hub/aprovacao";
import { impressaoDigital, novoNonce } from "@/lib/hub/protecoes";
import { acharFerramenta, nivelDaFerramenta, type FerramentaDeclarada } from "./catalogo";

/**
 * O portão do MCP Gateway.
 *
 * ## A ordem das verificações não é arbitrária
 *
 * Cada uma recusa por um motivo diferente, e a ordem existe para que a recusa mais barata e mais
 * informativa venha primeiro:
 *
 *  1. **Autenticação** — há um usuário verificado? Sem isso não há nem o que consultar.
 *  2. **Identidade da integração** — qual cliente OAuth está chamando? Permissão é por
 *     integração, não por pessoa: "o Cursor pode ler" e "eu posso ler" são coisas diferentes.
 *  3. **A ferramenta existe?** Antes de qualquer consulta ao banco.
 *  4. **Limite de uso** — antes da autorização, porque um cliente em laço não deve conseguir
 *     martelar a tabela de permissões.
 *  5. **Autorização** — as capacidades concedidas cobrem a pedida? É aqui que a escalada morre.
 *  6. **Projeto** — a permissão vale para este projeto? Uma concessão por projeto não vaza para
 *     os outros.
 *  7. **Réplica** — este pedido já existe vivo? Duas abas, um pedido.
 *
 * ## O Gateway nunca usa `service_role`
 *
 * Toda leitura e escrita sai com o token **da pessoa**, então a RLS continua valendo por baixo.
 * Se a verificação de permissão tivesse um defeito, a RLS ainda limitaria o alcance ao que
 * aquele usuário já podia ver. Duas paredes, e a de baixo não depende de este arquivo estar
 * correto.
 *
 * É por isso que `service_role` não aparece em lugar nenhum desta camada — e se um dia aparecer,
 * a segunda parede cai junto.
 */

// =============================================================================================
// As respostas
// =============================================================================================

export const RECUSAS = [
  "UNAUTHENTICATED",
  "UNKNOWN_INTEGRATION",
  "UNKNOWN_TOOL",
  "RATE_LIMITED",
  "PERMISSION_DENIED",
  "SCOPE_DENIED",
  "PROJECT_DENIED",
  "DUPLICATE_REQUEST",
  "EXPIRED",
] as const;

export type Recusa = (typeof RECUSAS)[number];

/**
 * O que um cliente MCP recebe de volta.
 *
 * `APPROVAL_REQUIRED` não é erro: é o resultado correto de uma ferramenta de solicitação. Tratá-lo
 * como falha faria agentes tentarem de novo, e tentar de novo é exatamente o que o pedido já
 * registrado torna desnecessário.
 */
export type ResultadoDoPortao =
  | { estado: "OK"; capacidade: Capacidade; nivel: Nivel; avisoDeCobertura: string | null }
  | {
      estado: "APPROVAL_REQUIRED";
      requestId: string;
      /** O que a pessoa vai ler na tela. O agente pode repetir para quem o estiver usando. */
      frase: string;
      expiresAt: string;
      nivel: Nivel;
      /** `true` quando o nível exige autenticação recente além da aprovação. */
      exigeReautenticacao: boolean;
    }
  | { estado: "DENIED"; recusa: Recusa; motivo: string; faltando?: Capacidade[] };

// =============================================================================================
// A entrada
// =============================================================================================

/** Uma permissão concedida, como vem de `pathly_hub_permissoes`. */
export type PermissaoConcedida = {
  capacidade: Capacidade;
  projetoId: string | null;
  revogadaEm: string | null;
  expiraEm: string | null;
};

export type PedidoMcp = {
  /** Verificado pelo JWT — nunca vem do corpo da chamada. */
  userId: string | null;
  /** O `client_id` OAuth verificado. É a identidade da integração. */
  integrationId: string | null;
  tool: string;
  args: Record<string, unknown>;
  projectId: string | null;
};

export type ContextoDoPortao = {
  permissoes: readonly PermissaoConcedida[];
  /** Os escopos do token desta chamada. `undefined` quando o emissor não emite nenhum. */
  escopos?: readonly string[];
  /** Os pedidos vivos desta pessoa, para detectar réplica. */
  vivos: readonly { id: string; fingerprint: string }[];
  /** `false` quando o teto de chamadas foi atingido. */
  dentroDoLimite: boolean;
  agora?: Date;
};

// =============================================================================================
// A autorização
// =============================================================================================

/** As capacidades vigentes: concedidas, não revogadas, não vencidas, e válidas para o projeto. */
export function vigentes(
  permissoes: readonly PermissaoConcedida[],
  projetoId: string | null,
  agora: Date,
): Capacidade[] {
  return (
    permissoes
      .filter((p) => p.revogadaEm === null)
      .filter((p) => p.expiraEm === null || new Date(p.expiraEm) > agora)
      /* `projetoId: null` é permissão global; a específica só vale no projeto dela. */
      .filter((p) => p.projetoId === null || p.projetoId === projetoId)
      .map((p) => p.capacidade)
  );
}

export type Autorizacao =
  | { autorizado: true; avisoDeCobertura: string | null }
  | { autorizado: false; recusa: Recusa; motivo: string; faltando: Capacidade[] };

/**
 * O escopo OAuth que cada nível exige **no token**.
 *
 * Isto é outra coisa da permissão concedida no Hub, e as duas precisam existir:
 *
 * - **Permissão** é o que a pessoa autorizou àquela integração. Vive no banco.
 * - **Escopo** é o que o token desta requisição carrega. Vive no JWT.
 *
 * Um token vazado de uma integração de leitura não deve conseguir escrever nem que a permissão no
 * banco diga que sim — é a diferença entre "esta integração pode" e "esta chamada pode".
 */
export const ESCOPO_DO_NIVEL: Record<Nivel, string> = {
  READ: "pathly:read",
  SUGGEST: "pathly:suggest",
  WRITE: "pathly:write",
  EXECUTE: "pathly:execute",
  COMMIT: "pathly:commit",
  PUSH: "pathly:push",
  DEPLOY: "pathly:deploy",
  DELETE: "pathly:delete",
};

export type ResultadoDeEscopo =
  { valido: true; verificado: boolean } | { valido: false; motivo: string };

/**
 * O token carrega escopo suficiente para este nível?
 *
 * ## O estado honesto disto hoje
 *
 * Quem emite os tokens é o Supabase Auth, e ele emite um escopo só: `authenticated`. Nenhum token
 * que chega aqui hoje traz `pathly:*`, então **esta camada ainda não recusa nada** — e devolve
 * `verificado: false` para dizer isso em voz alta, em vez de fingir que conferiu.
 *
 * Escrevo assim, e não como um `return true`, por um motivo prático: quando o Pathly passar a
 * emitir token por integração — `pathly:read` para o Cursor, `pathly:commit` para o CI — a
 * verificação já está no caminho e passa a morder sozinha. Um `TODO` no lugar viraria a camada
 * que alguém "liga depois", e ninguém liga.
 *
 * Escopo do Pathly presente é escopo cobrado: a escada vale aqui também, e nível isolado exige o
 * escopo exato.
 */
export function validarEscopo(
  escoposDoToken: readonly string[] | undefined,
  pedido: Nivel,
): ResultadoDeEscopo {
  const doPathly = (escoposDoToken ?? []).filter((s) => s.startsWith("pathly:"));
  if (doPathly.length === 0) return { valido: true, verificado: false };

  const exigido = ESCOPO_DO_NIVEL[pedido];
  if (doPathly.includes(exigido)) return { valido: true, verificado: true };

  /* Sem o escopo exato, só a escada salva — e ela não alcança nível isolado. */
  const cobertoPorAmplo = NIVEIS.some(
    (n) => doPathly.includes(ESCOPO_DO_NIVEL[n]) && cobre(n, pedido).cobre,
  );
  if (cobertoPorAmplo) return { valido: true, verificado: true };

  return {
    valido: false,
    motivo:
      `O token desta chamada não carrega o escopo ${exigido}. ` +
      (ehIsolado(pedido)
        ? `${DEFINICOES_NIVEL[pedido].rotulo} é isolado: nenhum escopo mais amplo o cobre.`
        : `Os escopos que ele traz não alcançam ${DEFINICOES_NIVEL[pedido].rotulo}.`),
  };
}

/**
 * A pedida é coberta pelas concedidas?
 *
 * ## Onde a escalada morre de verdade
 *
 * Na **capacidade**. `faltamPara` exige a capacidade pedida e as que ela depende, e é daí que as
 * três regras saem:
 *
 * - READ concedido, ferramenta de WRITE → `WRITE_FILES` não está concedida → recusa.
 * - WRITE concedido, ferramenta de COMMIT → `CREATE_COMMIT` não está concedida → recusa.
 * - COMMIT concedido, ferramenta de PUSH → `PUSH_GIT` não está concedida → recusa.
 *
 * ## Por que não há uma segunda checagem de nível aqui
 *
 * Porque ela não poderia recusar. Se a capacidade pedida está concedida, o nível dela está entre
 * os concedidos por definição, e `cobre(nivel, nivel)` é sempre exato.
 *
 * Eu tinha escrito essa checagem e a chamei de "defesa em profundidade". A bateria, varrendo os
 * 64 pares de níveis, mostrou que ela nunca dispara — era código morto se apresentando como
 * portão, que é pior que nenhum código, porque alguém confia nele.
 *
 * A verificação de nível que **de fato** morde é a de escopo, logo acima: ela olha o token, e não
 * o banco. O sistema de níveis continua essencial — decide o que é isolado, o que exige
 * reautenticação e o que pode virar permissão permanente. Só não é aqui que ele recusa.
 */
export function autorizar(
  f: FerramentaDeclarada,
  concedidas: readonly Capacidade[],
  escoposDoToken?: readonly string[],
): Autorizacao {
  const faltando = faltamPara(f.capacidade, concedidas);
  if (faltando.length > 0) {
    const nomes = faltando.map((c) => `“${DEFINICOES[c].rotulo}”`).join(", ");
    return {
      autorizado: false,
      recusa: "PERMISSION_DENIED",
      motivo:
        `A ferramenta ${f.nome} precisa de ${nomes}, que esta integração não tem. ` +
        `Autorize em Configurações → Integrações; o Pathly não concede permissão sozinho.`,
      faltando,
    };
  }

  const escopo = validarEscopo(escoposDoToken, nivelDaFerramenta(f));
  if (!escopo.valido) {
    return {
      autorizado: false,
      recusa: "SCOPE_DENIED",
      motivo: escopo.motivo,
      faltando: [f.capacidade],
    };
  }

  return { autorizado: true, avisoDeCobertura: null };
}

// =============================================================================================
// O portão
// =============================================================================================

const MOTIVO: Record<Recusa, string> = {
  UNAUTHENTICATED: "Esta chamada não trouxe um usuário verificado.",
  /*
   * A mensagem é longa porque o caso é específico e o diagnóstico, sem ela, custa uma tarde.
   *
   * Um token de sessão do Supabase — o que o app usa no navegador — **não carrega `client_id`**.
   * Só o token obtido pelo fluxo OAuth do MCP carrega, e é ele que diz qual integração está
   * chamando. Sem essa identidade não existe permissão a consultar: no Pathly, quem recebe
   * permissão é a integração, não a pessoa.
   *
   * E não há atalho aqui de propósito. Assumir uma integração padrão faria um chamador anônimo
   * herdar as permissões de outro — que é precisamente a escalada que este portão existe para
   * impedir.
   */
  UNKNOWN_INTEGRATION:
    "Esta chamada trouxe um usuário válido, mas nenhuma identidade de integração (client_id). " +
    "Um token de sessão do app não serve aqui: conecte-se pelo fluxo OAuth do MCP, em que o seu " +
    "cliente se registra e recebe um token com client_id. Permissão no Pathly é concedida a uma " +
    "integração, e sem saber qual é não há o que consultar.",
  UNKNOWN_TOOL: "Essa ferramenta não existe no Pathly.",
  RATE_LIMITED: "Muitas chamadas em pouco tempo. Tente de novo daqui a pouco.",
  PERMISSION_DENIED: "Esta integração não tem a permissão necessária.",
  SCOPE_DENIED: "O nível desta integração não alcança o nível desta ferramenta.",
  PROJECT_DENIED: "A permissão desta integração não vale para este projeto.",
  DUPLICATE_REQUEST:
    "Já existe um pedido igual esperando decisão. Use o id que você recebeu antes, em vez de " +
    "criar outro.",
  EXPIRED: "Este pedido venceu. Peça de novo, e a pessoa decide sobre o pedido novo.",
};

function negar(recusa: Recusa, motivo?: string, faltando?: Capacidade[]): ResultadoDoPortao {
  return {
    estado: "DENIED",
    recusa,
    motivo: motivo ?? MOTIVO[recusa],
    ...(faltando ? { faltando } : {}),
  };
}

/**
 * O que o alvo de um pedido mostra na confirmação.
 *
 * Trunca, porque um comando de mil caracteres numa frase de confirmação vira um parágrafo que
 * ninguém lê — e uma confirmação que ninguém lê é pior que nenhuma.
 */
function alvoDe(f: FerramentaDeclarada, args: Record<string, unknown>): string {
  if (!f.campoDoAlvo) return "";
  const v = args[f.campoDoAlvo];
  if (typeof v !== "string" || !v.trim()) return "";
  const limpo = v.trim().replace(/\s+/g, " ");
  return ` \`${limpo.length > 80 ? `${limpo.slice(0, 80)}…` : limpo}\``;
}

/**
 * O pedido MCP, com os nove campos que você nomeou.
 *
 * Ele **é** um `ApprovalRequest`: `pathly_hub_aprovacoes` já modela "uma ação externa esperando
 * decisão", com estados, vencimento, impressão digital e nonce. Criar uma segunda tabela para
 * pedido de MCP daria dois lugares para responder "isto foi aprovado?" — e um dia eles
 * discordariam.
 *
 * O mapeamento: `request_id` → `id`, `tool` → `action`, `arguments` → `metadata`,
 * `requested_scope` → `requested_permission` (o nível) com `scope` (uma-vez, sessão, persistente).
 */
export type PedidoRegistrado = {
  request_id: string;
  user_id: string;
  project_id: string | null;
  integration_id: string;
  tool: string;
  arguments: Record<string, unknown>;
  requested_scope: Nivel;
  capability: Capacidade;
  created_at: string;
  expires_at: string;
  fingerprint: string;
  nonce: string;
};

export type SaidaDoPortao = {
  resultado: ResultadoDoPortao;
  /** Preenchido só quando o resultado é `APPROVAL_REQUIRED`. Quem grava é a camada de cima. */
  pedido: PedidoRegistrado | null;
  /** O que vai para a trilha de auditoria — sempre, inclusive nas recusas. */
  auditoria: { ato: string; capacidade: Capacidade | null; detalhe: string };
};

/**
 * Decide o que acontece com uma chamada MCP.
 *
 * Não escreve no banco e não executa nada: devolve a decisão e, quando é caso de aprovação, o
 * pedido pronto para ser gravado. Separar decidir de agir é o que permite testar a decisão
 * inteira sem banco — e é onde 100% das regras de escalada podem ser verificadas.
 */
export async function passarPeloPortao(
  p: PedidoMcp,
  ctx: ContextoDoPortao,
): Promise<SaidaDoPortao> {
  const agora = ctx.agora ?? new Date();
  const audit = (ato: string, capacidade: Capacidade | null, detalhe: string) => ({
    ato,
    capacidade,
    detalhe,
  });

  if (!p.userId) {
    return {
      resultado: negar("UNAUTHENTICATED"),
      pedido: null,
      auditoria: audit("acesso-negado", null, `${p.tool}: sem usuário verificado`),
    };
  }

  if (!p.integrationId) {
    return {
      resultado: negar("UNKNOWN_INTEGRATION"),
      pedido: null,
      auditoria: audit("acesso-negado", null, `${p.tool}: sem client_id`),
    };
  }

  const f = acharFerramenta(p.tool);
  if (!f) {
    return {
      resultado: negar("UNKNOWN_TOOL"),
      pedido: null,
      auditoria: audit("acesso-negado", null, `ferramenta desconhecida: ${p.tool}`),
    };
  }

  /* Antes da autorização: um cliente em laço não deve martelar a tabela de permissões. */
  if (!ctx.dentroDoLimite) {
    return {
      resultado: negar("RATE_LIMITED"),
      pedido: null,
      auditoria: audit("acesso-negado", f.capacidade, `${p.tool}: limite de uso`),
    };
  }

  const concedidas = vigentes(ctx.permissoes, p.projectId, agora);
  const a = autorizar(f, concedidas, ctx.escopos);

  if (!a.autorizado) {
    /*
     * Uma permissão existe mas é de outro projeto? A recusa muda de nome. "Você não tem
     * permissão" quando a pessoa tem — só noutro projeto — manda procurar no lugar errado.
     */
    const globais = vigentes(ctx.permissoes, null, agora);
    const seriaOutroProjeto =
      p.projectId !== null &&
      autorizar(
        f,
        [...new Set([...concedidas, ...ctx.permissoes.map((x) => x.capacidade)])],
        ctx.escopos,
      ).autorizado &&
      !autorizar(f, globais, ctx.escopos).autorizado;

    const recusa = seriaOutroProjeto ? "PROJECT_DENIED" : a.recusa;
    return {
      resultado: negar(
        recusa,
        seriaOutroProjeto
          ? `Esta integração tem a permissão, mas concedida para outro projeto. Autorize também para este.`
          : a.motivo,
        a.faltando,
      ),
      pedido: null,
      auditoria: audit("acesso-negado", f.capacidade, `${p.tool}: ${recusa}`),
    };
  }

  const nivel = nivelDaFerramenta(f);

  /* Leitura e escrita passam. Autorizadas, dentro do limite, para este projeto. */
  if (f.familia !== "solicitacao") {
    return {
      resultado: {
        estado: "OK",
        capacidade: f.capacidade,
        nivel,
        avisoDeCobertura: a.avisoDeCobertura,
      },
      pedido: null,
      auditoria: audit(
        f.familia === "leitura" ? "leitura" : "escrita",
        f.capacidade,
        `${p.tool} via MCP`,
      ),
    };
  }

  // ---- Solicitação: cria o pedido e devolve APPROVAL_REQUIRED ---------------------------------

  /*
   * A impressão não leva `userId`: o índice único no banco é `(user_id, fingerprint)`, então a
   * pessoa já entra na chave. E não leva a capacidade porque ela é função do nome da ferramenta —
   * `pathly_request_commit` é sempre `CREATE_COMMIT`, e acrescentá-la não distinguiria nada.
   */
  const fingerprint = await impressaoDigital({
    integrationId: p.integrationId,
    action: p.tool,
    projectId: p.projectId,
    metadata: p.args,
  });

  const duplicata = ctx.vivos.find((v) => v.fingerprint === fingerprint);
  if (duplicata) {
    return {
      resultado: negar(
        "DUPLICATE_REQUEST",
        `${MOTIVO.DUPLICATE_REQUEST} O pedido é ${duplicata.id}.`,
      ),
      pedido: null,
      auditoria: audit("acesso-negado", f.capacidade, `${p.tool}: duplicata de ${duplicata.id}`),
    };
  }

  const expira = new Date(agora.getTime() + VALIDADE_APROVACAO_MIN * 60_000);

  return {
    resultado: {
      estado: "APPROVAL_REQUIRED",
      requestId: crypto.randomUUID(),
      frase: fraseDeConfirmacao({
        provedorNome: p.integrationId,
        capacidade: f.capacidade,
        alvo: alvoDe(f, p.args),
      }),
      expiresAt: expira.toISOString(),
      nivel,
      exigeReautenticacao: DEFINICOES_NIVEL[nivel].exigeReautenticacao,
    },
    pedido: {
      request_id: "",
      user_id: p.userId,
      project_id: p.projectId,
      integration_id: p.integrationId,
      tool: p.tool,
      arguments: p.args,
      requested_scope: nivel,
      capability: f.capacidade,
      created_at: agora.toISOString(),
      expires_at: expira.toISOString(),
      fingerprint,
      nonce: novoNonce(),
    },
    auditoria: audit("pedido", f.capacidade, `${p.tool} aguardando aprovação`),
  };
}

/**
 * O pedido ainda vale?
 *
 * Chamada na hora de executar, não na de criar. Um pedido criado há quinze minutos e aprovado há
 * catorze pode ter vencido no meio — e executar o que venceu é o mesmo que executar o que nunca
 * foi aprovado.
 */
export function aindaVale(pedido: { expires_at: string }, agora = new Date()): boolean {
  return new Date(pedido.expires_at) > agora;
}
