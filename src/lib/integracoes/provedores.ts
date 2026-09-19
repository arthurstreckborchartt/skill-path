import type { Impacto, Provedor } from "./contrato";

/**
 * O que cada provedor oferece.
 *
 * ## Por que um provedor de demonstração
 *
 * O GitHub exige um OAuth App registrado na conta de quem opera o Pathly, e o `client_secret`
 * dele não pode passar por aqui. Sem o registro, o caminho inteiro — pedir, aprovar, executar,
 * gravar o resultado — ficaria sem teste até alguém criar o app.
 *
 * O `demo` fecha esse buraco: ele tem o mesmo formato, o mesmo portão de aprovação e o mesmo
 * executor, mas responde de mentira, sem sair para a rede. É o que permite provar a máquina de
 * estados e a tela antes de existir qualquer credencial de verdade — e serve depois como caso de
 * teste permanente, porque não depende de conta nenhuma continuar existindo.
 *
 * ## O que uma ação declara
 *
 * `impacto` decide o peso visual na tela, não a permissão: `leitura` e `destrutiva` passam pelo
 * mesmo portão. Quem quiser tornar leitura automática um dia vai ter que mexer no executor, à
 * vista, e não em silêncio num campo de configuração.
 */

export type AcaoDisponivel = {
  id: string;
  /** Como aparece no botão. */
  rotulo: string;
  /** A frase que a pessoa lê antes de aprovar. Deve dizer o efeito, não o endpoint. */
  resumo: string;
  /** Legível: `GET /user/repos`. Sem isso, aprovar é aprovar às cegas. */
  destino: string;
  impacto: Impacto;
};

export type DefinicaoProvedor = {
  id: Provedor;
  nome: string;
  /** Uma linha sobre o que ele permite fazer. */
  descricao: string;
  /** Escopos pedidos no OAuth. Vazio no provedor de demonstração. */
  escopos: string[];
  /** `false` enquanto faltar credencial no ambiente — a tela diz isso em vez de oferecer e falhar. */
  exigeCredencial: boolean;
  acoes: AcaoDisponivel[];
};

export const PROVEDOR_DEMO: DefinicaoProvedor = {
  id: "demo",
  nome: "Provedor de demonstração",
  descricao:
    "Não sai para a internet. Existe para você ver e testar o fluxo de aprovação antes de conectar uma conta de verdade.",
  escopos: [],
  exigeCredencial: false,
  acoes: [
    {
      id: "demo-listar",
      rotulo: "Listar itens",
      resumo: "Pedir a lista de itens de exemplo. Nada sai para a internet e nada é alterado.",
      destino: "GET demo://itens",
      impacto: "leitura",
    },
    {
      id: "demo-criar",
      rotulo: "Criar item",
      resumo:
        "Criar um item de exemplo. Simula uma escrita: serve para ver como uma ação que altera algo é apresentada antes da aprovação.",
      destino: "POST demo://itens",
      impacto: "escrita",
    },
  ],
};

export const PROVEDOR_GITHUB: DefinicaoProvedor = {
  id: "github",
  nome: "GitHub",
  descricao:
    "Ler seus repositórios para dar contexto ao plano. O primeiro corte é só leitura — nada é escrito na sua conta.",
  /*
   * `read:user` e `repo` no modo de leitura. Pedir menos do que se precisa força uma segunda
   * autorização depois; pedir mais do que se usa é dívida de confiança que não se paga.
   */
  escopos: ["read:user", "repo"],
  exigeCredencial: true,
  acoes: [
    {
      id: "github-repos",
      rotulo: "Listar repositórios",
      resumo:
        "Ler a lista dos seus repositórios para o Pathly entender o que já existe. Não altera nada na sua conta.",
      destino: "GET https://api.github.com/user/repos",
      impacto: "leitura",
    },
  ],
};

export const PROVEDORES_DISPONIVEIS: DefinicaoProvedor[] = [PROVEDOR_DEMO, PROVEDOR_GITHUB];

export function acharProvedor(id: string): DefinicaoProvedor | null {
  return PROVEDORES_DISPONIVEIS.find((p) => p.id === id) ?? null;
}

export function acharAcao(provedor: string, acaoId: string): AcaoDisponivel | null {
  return acharProvedor(provedor)?.acoes.find((a) => a.id === acaoId) ?? null;
}
