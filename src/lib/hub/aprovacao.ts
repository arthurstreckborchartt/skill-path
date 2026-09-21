import { DEFINICOES, nivelDe, type Capacidade } from "./capacidades";
import { cobre, DEFINICOES_NIVEL, type Nivel } from "./niveis";
import type { IntegrationActionDefinition, IntegrationPermission } from "./contrato";

/**
 * O sistema de aprovações do Integration Hub.
 *
 * ## A regra absoluta, em código
 *
 * O Pathly **nunca** comita, empurra, publica, apaga, executa comando ou altera código sozinho.
 * Não é uma convenção que as telas respeitam por educação: é `decidir()`, e toda ação externa
 * passa por aqui antes de existir.
 *
 * Três mecanismos a sustentam, e são independentes de propósito:
 *
 * 1. **Permissão** — a pessoa concedeu aquela capacidade? (`permissoes.ts`)
 * 2. **Aprovação por ação** — os níveis consequentes exigem um "sim" *desta vez*, mesmo com
 *    permissão viva. Permissão é o que pode acontecer; aprovação é o que vai acontecer agora.
 * 3. **Reautenticação** — `PUSH` exige sessão fresca. Aprovação antiga não vale, e não há como
 *    guardar `PUSH` como permissão persistente.
 *
 * ## Por que aprovação e permissão são coisas separadas
 *
 * Juntá-las produziria um dos dois erros: ou cada leitura pediria confirmação (e a pessoa
 * aprenderia a clicar em "sim" sem ler), ou uma autorização de meses atrás bastaria para um push
 * hoje. Separadas, leitura flui e push não.
 */

// =============================================================================================
// Escopo — quanto tempo uma autorização vale
// =============================================================================================

export const ESCOPOS = ["uma-vez", "sessao", "persistente"] as const;
export type Escopo = (typeof ESCOPOS)[number];

export const ROTULO_ESCOPO: Record<Escopo, string> = {
  "uma-vez": "Só desta vez",
  sessao: "Enquanto eu estiver nesta sessão",
  persistente: "Até eu revogar",
};

/**
 * `uma-vez` é o padrão, e isso não é detalhe de implementação.
 *
 * Quando a caixa vem marcada em "para sempre", a escolha deixa de ser escolha. O padrão certo é o
 * que a pessoa escolheria se estivesse prestando atenção — e ninguém, prestando atenção, concede
 * acesso permanente para resolver uma tarefa.
 */
export const ESCOPO_PADRAO: Escopo = "uma-vez";

/** Minutos de validade de uma aprovação concedida. Depois disso, ela vence sem ter sido usada. */
export const VALIDADE_APROVACAO_MIN = 10;

/** Minutos que uma reautenticação vale. Curto: é a defesa contra sessão roubada. */
export const VALIDADE_REAUTENTICACAO_MIN = 5;

// =============================================================================================
// Estados
// =============================================================================================

export const ESTADOS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXPIRED",
  "EXECUTING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
] as const;
export type Estado = (typeof ESTADOS)[number];

/**
 * As transições permitidas, como dado.
 *
 * Escritas aqui e não espalhadas em `if` porque é a regra de segurança do módulo: se alguém
 * acrescentar um caminho de `PENDING` direto para `SUCCESS`, tem que ser nesta tabela, à vista.
 *
 * `EXECUTING` existe justamente para tornar a execução dupla impossível de representar: só se
 * chega a ele a partir de `APPROVED`, e só uma vez.
 */
export const TRANSICOES: Record<Estado, readonly Estado[]> = {
  PENDING: ["APPROVED", "REJECTED", "EXPIRED", "CANCELLED"],
  APPROVED: ["EXECUTING", "EXPIRED", "CANCELLED"],
  EXECUTING: ["SUCCESS", "FAILED"],
  REJECTED: [],
  EXPIRED: [],
  SUCCESS: [],
  FAILED: [],
  CANCELLED: [],
};

export function podeIr(de: Estado, para: Estado): boolean {
  return TRANSICOES[de].includes(para);
}

export function ehTerminal(e: Estado): boolean {
  return TRANSICOES[e].length === 0;
}

// =============================================================================================
// O pedido de aprovação
// =============================================================================================

/**
 * Um pedido de aprovação — o registro completo de uma ação externa, do pedido ao resultado.
 *
 * Os nomes seguem o vocabulário que você definiu, inclusive em inglês, porque é o que vai
 * aparecer na trilha e em qualquer exportação depois.
 */
export type ApprovalRequest = {
  id: string;
  user_id: string;
  project_id: string | null;
  integration_id: string;
  /** O id da ação no catálogo do provedor. */
  action: string;
  requested_permission: Nivel;
  /** A capacidade concreta que a ação consome. */
  capability: Capacidade;
  /** O escopo pedido. `persistente` só quando a pessoa escolheu explicitamente. */
  scope: Escopo;
  status: Estado;
  /** `null` até alguém aprovar. Sempre o `user_id` da pessoa — nunca um sistema. */
  approved_by: string | null;
  approved_at: string | null;
  executed_at: string | null;
  result: string | null;
  error: string | null;
  /** Vence sem uso. Uma aprovação que espera indefinidamente é uma aprovação esquecida. */
  expires_at: string;
  /**
   * O que vai acontecer, congelado no momento do pedido.
   *
   * Nunca é remontado na execução: é o que garante que o que a pessoa leu e o que sai são o mesmo
   * objeto.
   */
  metadata: Record<string, unknown>;
  /** Impressão digital do conteúdo. Duas iguais são a mesma ação, não duas. */
  fingerprint: string;
  /** Consumido na execução. Segunda tentativa com o mesmo não roda nada. */
  nonce: string;
  created_at: string;
};

// =============================================================================================
// A decisão
// =============================================================================================

export type MotivoRecusa =
  | "sem-permissao"
  | "precisa-aprovacao"
  | "precisa-reautenticacao"
  | "aprovacao-vencida"
  | "estado-invalido"
  | "duplicada";

export type Decisao =
  | {
      pode: true;
      /** Preenchido quando uma permissão mais ampla está cobrindo. A tela é obrigada a mostrar. */
      avisoDeCobertura: string | null;
    }
  | {
      pode: false;
      motivo: MotivoRecusa;
      /** A frase que a tela mostra. Específica, nunca "acesso negado". */
      explicacao: string;
      /** O que resolveria. `null` quando não há caminho — estado terminal, por exemplo. */
      oQueResolve: string | null;
    };

export type ContextoDecisao = {
  acao: IntegrationActionDefinition;
  permissoes: readonly IntegrationPermission[];
  projetoId: string | null;
  /** A aprovação desta ação, quando já existe. */
  aprovacao: ApprovalRequest | null;
  /** Quando a pessoa se autenticou pela última vez. `null` = nunca nesta sessão. */
  autenticadaEm: string | null;
  agora?: Date;
};

/**
 * Pode executar esta ação, agora?
 *
 * É a única porta. Tudo que sai do Pathly para fora passa por aqui, e o servidor chama isto antes
 * de tocar em qualquer adaptador.
 */
export function decidir(c: ContextoDecisao): Decisao {
  const agora = c.agora ?? new Date();
  const capacidade = c.acao.exige[0];

  if (!capacidade) {
    return {
      pode: false,
      motivo: "estado-invalido",
      explicacao: "Esta ação não declara o que precisa para rodar, então não dá para autorizá-la.",
      oQueResolve: null,
    };
  }

  const nivel = nivelDe(capacidade);
  const def = DEFINICOES_NIVEL[nivel];

  // ---- 1. Permissão ---------------------------------------------------------------------------
  const vigentes = c.permissoes.filter(
    (p) =>
      !p.revogadaEm &&
      (!p.expiraEm || new Date(p.expiraEm).getTime() > agora.getTime()) &&
      (p.projetoId === null || p.projetoId === c.projetoId),
  );

  let avisoDeCobertura: string | null = null;
  const concedida = vigentes.some((p) => {
    const r = cobre(nivelDe(p.capacidade), nivel);
    if (r.cobre && r.cobertura === "por-nivel-superior") avisoDeCobertura = r.aviso;
    return r.cobre && p.capacidade === capacidade;
  });

  /*
   * A cobertura por nível superior é aceita, mas **nunca em silêncio**: o aviso vai junto na
   * decisão, e a tela é obrigada a mostrar. Reutilizar uma permissão ampla para uma ação menor
   * sem dizer é exatamente o que a regra proíbe.
   */
  const cobertaPorMaior =
    !concedida &&
    vigentes.some((p) => {
      const r = cobre(nivelDe(p.capacidade), nivel);
      if (r.cobre && r.aviso) avisoDeCobertura = r.aviso;
      return r.cobre;
    });

  if (!concedida && !cobertaPorMaior) {
    return {
      pode: false,
      motivo: "sem-permissao",
      explicacao: `Você ainda não autorizou “${DEFINICOES[capacidade].rotulo}” para esta conexão.`,
      oQueResolve: `Autorizar “${DEFINICOES[capacidade].rotulo}” nas permissões desta integração.`,
    };
  }

  // ---- 2. Aprovação por ação ------------------------------------------------------------------
  if (def.aprovacaoPorAcao) {
    if (!c.aprovacao) {
      return {
        pode: false,
        motivo: "precisa-aprovacao",
        explicacao: `${def.rotulo} exige a sua confirmação a cada vez, mesmo já autorizado. ${def.oQueAcontece}`,
        oQueResolve: "Confirmar esta ação específica.",
      };
    }

    if (c.aprovacao.status !== "APPROVED") {
      return {
        pode: false,
        motivo: "estado-invalido",
        explicacao: `Esta ação está em ${c.aprovacao.status}, e só executa a partir de APPROVED.`,
        oQueResolve: c.aprovacao.status === "PENDING" ? "Aprovar o pedido." : null,
      };
    }

    if (new Date(c.aprovacao.expires_at).getTime() <= agora.getTime()) {
      return {
        pode: false,
        motivo: "aprovacao-vencida",
        explicacao: `A aprovação venceu. Aprovações valem ${VALIDADE_APROVACAO_MIN} minutos — depois disso, o que você aprovou pode não ser mais o que aconteceria agora.`,
        oQueResolve: "Pedir de novo e aprovar.",
      };
    }
  }

  // ---- 3. Reautenticação ----------------------------------------------------------------------
  if (def.exigeReautenticacao) {
    if (!c.autenticadaEm) {
      return {
        pode: false,
        motivo: "precisa-reautenticacao",
        explicacao: `${def.rotulo} exige que você entre de novo, agora. Uma autorização anterior não vale para isto.`,
        oQueResolve: "Confirmar sua identidade.",
      };
    }
    const idadeMin = (agora.getTime() - new Date(c.autenticadaEm).getTime()) / 60000;
    if (idadeMin > VALIDADE_REAUTENTICACAO_MIN) {
      return {
        pode: false,
        motivo: "precisa-reautenticacao",
        explicacao: `Sua confirmação de identidade tem mais de ${VALIDADE_REAUTENTICACAO_MIN} minutos. Para ${def.rotulo.toLowerCase()}, ela precisa ser desta hora.`,
        oQueResolve: "Confirmar sua identidade de novo.",
      };
    }
  }

  return { pode: true, avisoDeCobertura };
}

// =============================================================================================
// O texto que a pessoa lê
// =============================================================================================

/**
 * A frase da confirmação.
 *
 * Específica sempre. "Permitir acesso" não diz o que vai acontecer, e quem lê isso trinta vezes
 * aprende a clicar sem ler — que é o oposto do que um portão de aprovação existe para produzir.
 */
export function fraseDeConfirmacao(params: {
  provedorNome: string;
  capacidade: Capacidade;
  alvo?: string;
}): string {
  const { provedorNome, capacidade, alvo } = params;
  const onde = alvo ? ` ${alvo}` : "";

  switch (capacidade) {
    case "READ_PROJECT":
      return `Permitir que o ${provedorNome} leia o contexto deste projeto?`;
    case "WRITE_PROJECT":
      return `Permitir que o ${provedorNome} registre no Pathly o que fez neste projeto?`;
    case "UPDATE_BLUEPRINT":
      return `Permitir que o ${provedorNome} proponha mudanças no plano deste projeto?`;
    case "READ_FILES":
      return `Permitir que o ${provedorNome} leia os arquivos deste projeto?`;
    case "WRITE_FILES":
    case "UPDATE_FILE":
      return `Permitir que o ${provedorNome} modifique arquivos${onde} deste projeto?`;
    case "CREATE_FILE":
      return `Permitir que o ${provedorNome} crie arquivos${onde} neste projeto?`;
    case "DELETE_FILE":
      return `Permitir que o ${provedorNome} apague arquivos${onde} deste projeto?`;
    case "EXECUTE_COMMAND":
      return `Permitir que o ${provedorNome} execute comandos${onde} no seu ambiente?`;
    case "RUN_TESTS":
      return `Permitir que o ${provedorNome} rode os testes deste projeto?`;
    case "READ_GIT":
      return `Permitir que o ${provedorNome} leia o histórico do git deste projeto?`;
    case "CREATE_BRANCH":
      return `Permitir que o ${provedorNome} crie uma branch neste repositório?`;
    case "CREATE_COMMIT":
      return `Permitir que o Pathly solicite um commit${onde} em seu nome?`;
    case "PUSH_GIT":
      return `Permitir enviar os commits para o repositório remoto?`;
    case "BRIDGE_CONNECT":
      return `Registrar esta ponte local e deixá-la buscar tarefas do Pathly?`;
    case "REVIT_GET_PROJECT":
      return `Permitir que o ${provedorNome} leia os dados do projeto aberto no Revit?`;
    case "REVIT_READ_MODEL":
      return `Permitir que o ${provedorNome} leia os elementos do seu modelo?`;
    case "REVIT_EXPORT":
      return `Permitir exportar${onde} a partir do seu modelo do Revit?`;
    case "REVIT_CREATE_ELEMENT":
      return `Criar${onde} no seu modelo do Revit? Confira a simulação antes de autorizar.`;
    case "REVIT_UPDATE_ELEMENT":
      return `Alterar${onde} no seu modelo do Revit? Confira a simulação antes de autorizar.`;
    case "VSCODE_OPEN_FILE":
      return `Permitir que o ${provedorNome} abra arquivos${onde} no seu VS Code?`;
    case "DEPLOY_APP":
      return `Permitir publicar este projeto, alcançando quem está usando agora?`;
    /*
     * As do vault citam a pasta quando há uma. "Ler o seu vault" e "ler a pasta Projects/" são
     * autorizações de tamanhos muito diferentes, e a frase precisa mostrar qual das duas é.
     */
    case "READ_VAULT":
      return `Permitir que o ${provedorNome} leia o vault inteiro, todas as pastas?`;
    case "READ_FOLDER":
      return `Permitir que o ${provedorNome} leia as notas${onde || " desta pasta"} do seu vault?`;
    case "WRITE_FOLDER":
      return `Permitir que o ${provedorNome} escreva notas${onde || " nesta pasta"} do seu vault?`;
    case "CREATE_NOTE":
      return `Permitir que o ${provedorNome} crie a nota${onde} no seu vault?`;
    case "UPDATE_NOTE":
      return `Permitir atualizar os blocos do Pathly na nota${onde}, sem tocar no resto?`;
    case "DELETE_NOTE":
      /* O aviso vem ANTES da pergunta: quem lê a pergunta primeiro já clicou quando chega no aviso. */
      return `Isso não tem desfazer pelo Pathly. Apagar a nota${onde} do seu vault?`;
    case "SEARCH_VAULT":
      return `Permitir que o ${provedorNome} busque${onde || " nas pastas autorizadas"} do seu vault?`;
    case "EXECUTE_OBSIDIAN_COMMAND":
      return `Permitir que o ${provedorNome} execute comandos dentro do Obsidian?`;
  }
}

/** Os escopos que este nível aceita. `persistente` some onde o nível o proíbe. */
export function escoposDisponiveis(nivel: Nivel): Escopo[] {
  const d = DEFINICOES_NIVEL[nivel];
  return d.proibePersistente ? ["uma-vez", "sessao"] : ["uma-vez", "sessao", "persistente"];
}
