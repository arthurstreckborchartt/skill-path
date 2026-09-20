import { DEFINICOES, faltamPara, type Capacidade } from "./capacidades";
import type {
  IntegrationActionDefinition,
  IntegrationPermission,
  IntegrationProvider,
} from "./contrato";

/**
 * O portão de permissão do Hub.
 *
 * ## A regra, sem exceção
 *
 * **Nada é concedido automaticamente.** Conectar uma conta não concede capacidade nenhuma —
 * conectar e autorizar são dois atos, e o segundo é por capacidade, um de cada vez.
 *
 * Isso vale inclusive para dependência: `PUSH_GIT` exige `CREATE_COMMIT`, e conceder o primeiro
 * **não** concede o segundo. A tela mostra o que falta; a pessoa decide. Conceder em cascata
 * seria a autorização automática entrando pela porta dos fundos, que é justamente como ela entra.
 *
 * ## Por que a decisão é uma função pura
 *
 * O mesmo cálculo roda na tela (para mostrar o que falta antes de a pessoa tentar) e no servidor
 * (para recusar de verdade). Duas implementações divergiriam, e a divergência perigosa tem um
 * sentido só: a tela dizendo que pode e o servidor deixando passar o que não devia.
 *
 * O servidor é quem manda. A tela usa isto para **explicar**, nunca para autorizar.
 */

export type Decisao =
  | { pode: true }
  | {
      pode: false;
      /** As capacidades que faltam. Vazio nunca — se está aqui, falta alguma coisa. */
      faltando: Capacidade[];
      /** Uma frase em português, pronta para a tela e para a trilha de auditoria. */
      motivo: string;
    };

/** As capacidades vivas de uma conexão, num instante. Revogada ou vencida não conta. */
export function capacidadesVigentes(
  permissoes: readonly IntegrationPermission[],
  projetoId: string | null,
  agora: Date = new Date(),
): Capacidade[] {
  const vivas: Capacidade[] = [];

  for (const p of permissoes) {
    if (p.revogadaEm) continue;
    if (p.expiraEm && new Date(p.expiraEm).getTime() <= agora.getTime()) continue;
    /*
     * Permissão de projeto específico não vale para outro projeto. Permissão sem projeto vale
     * para todos — é o padrão de quem autorizou "para o Pathly", não "para este projeto".
     */
    if (p.projetoId !== null && p.projetoId !== projetoId) continue;
    if (!vivas.includes(p.capacidade)) vivas.push(p.capacidade);
  }

  return vivas;
}

/**
 * Pode executar esta ação?
 *
 * Confere as capacidades da ação **e** as dependências de cada uma. Uma ação que exige
 * `PUSH_GIT` precisa também de `CREATE_COMMIT` e `READ_GIT` concedidos — senão ela chegaria no
 * adaptador para falhar lá, num lugar que não sabe explicar o que faltou.
 */
export function podeExecutar(
  acao: IntegrationActionDefinition,
  permissoes: readonly IntegrationPermission[],
  projetoId: string | null,
  agora: Date = new Date(),
): Decisao {
  const vigentes = capacidadesVigentes(permissoes, projetoId, agora);

  const faltando: Capacidade[] = [];
  for (const exigida of acao.exige) {
    for (const f of faltamPara(exigida, vigentes)) {
      if (!faltando.includes(f)) faltando.push(f);
    }
  }

  if (faltando.length === 0) return { pode: true };

  const nomes = faltando.map((c) => `“${DEFINICOES[c].rotulo}”`).join(", ");
  return {
    pode: false,
    faltando,
    motivo:
      faltando.length === 1
        ? `Falta autorizar ${nomes} para esta conexão.`
        : `Faltam autorizar ${nomes} para esta conexão.`,
  };
}

/**
 * O que a tela de permissões oferece para um provedor.
 *
 * Devolve **todas** as capacidades que o provedor declara, cada uma com o estado atual. É de
 * propósito que as não concedidas apareçam: uma tela que só mostra o que foi autorizado esconde
 * o que a ferramenta poderia fazer, e a pessoa nunca descobre o que está recusando.
 */
export type ItemDePermissao = {
  capacidade: Capacidade;
  concedida: boolean;
  /** Por que não dá para conceder ainda, quando é o caso. Sempre dependência que falta. */
  bloqueadaPor: Capacidade[];
  expiraEm: string | null;
  concedidaEm: string | null;
};

export function montarTelaDePermissoes(
  provedor: IntegrationProvider,
  permissoes: readonly IntegrationPermission[],
  projetoId: string | null,
  agora: Date = new Date(),
): ItemDePermissao[] {
  const vigentes = capacidadesVigentes(permissoes, projetoId, agora);

  return provedor.capacidades.map((c) => {
    const linha = permissoes.find(
      (p) =>
        p.capacidade === c && !p.revogadaEm && (p.projetoId === null || p.projetoId === projetoId),
    );

    return {
      capacidade: c,
      concedida: vigentes.includes(c),
      bloqueadaPor: (DEFINICOES[c].exige ?? []).filter((d) => !vigentes.includes(d)),
      expiraEm: linha?.expiraEm ?? null,
      concedidaEm: linha?.concedidaEm ?? null,
    };
  });
}

/**
 * Pode conceder esta capacidade agora?
 *
 * Recusa quando uma dependência não foi concedida — e **não** concede a dependência junto. A
 * pessoa autoriza a base primeiro, sabendo o que está autorizando. Marcar "empurrar para o
 * remoto" e ganhar "criar commit" de brinde é exatamente o consentimento que não vale nada.
 */
export function podeConceder(
  capacidade: Capacidade,
  permissoes: readonly IntegrationPermission[],
  projetoId: string | null,
  agora: Date = new Date(),
): Decisao {
  const vigentes = capacidadesVigentes(permissoes, projetoId, agora);
  const faltando = (DEFINICOES[capacidade].exige ?? []).filter((d) => !vigentes.includes(d));

  if (faltando.length === 0) return { pode: true };

  const nomes = faltando.map((c) => `“${DEFINICOES[c].rotulo}”`).join(", ");
  return {
    pode: false,
    faltando,
    motivo: `Autorize ${nomes} antes — “${DEFINICOES[capacidade].rotulo}” depende disso.`,
  };
}

/**
 * As capacidades que caem junto ao revogar uma.
 *
 * Revogar `READ_GIT` e deixar `PUSH_GIT` de pé produziria uma permissão que o portão recusa a
 * cada tentativa, e a pessoa veria "não autorizado" numa capacidade marcada como autorizada.
 * Revogar em cascata é seguro pelo lado que importa: tira acesso, nunca dá.
 */
export function revogarEmCascata(
  capacidade: Capacidade,
  concedidas: readonly Capacidade[],
): Capacidade[] {
  const cai = [capacidade];
  let mudou = true;

  while (mudou) {
    mudou = false;
    for (const c of concedidas) {
      if (cai.includes(c)) continue;
      const deps = DEFINICOES[c].exige ?? [];
      if (deps.some((d) => cai.includes(d))) {
        cai.push(c);
        mudou = true;
      }
    }
  }

  return cai;
}
