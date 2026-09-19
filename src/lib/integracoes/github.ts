import { buscarComPrazo } from "./rede";

/**
 * O provedor GitHub: autorização, troca de código, renovação e as chamadas de API.
 *
 * ## Só servidor
 *
 * Tudo aqui usa o `client_secret`. Importar este módulo de código de cliente colocaria o nome do
 * segredo no bundle e, pior, convidaria alguém a fazer a troca do código no navegador — onde o
 * segredo teria que estar. Ele é usado só pelas rotas `/api/integracoes/oauth/*` e pelo executor.
 *
 * ## Dois tokens, uma coluna
 *
 * O app está registrado com `Expire user access tokens`, então o GitHub devolve um token de acesso
 * curto **e** um `refresh_token`. A `pathly_conexoes` tem uma coluna de token só.
 *
 * Em vez de migrar o schema, o que vai cifrado na coluna é um objeto com os dois. É exatamente o
 * que o prefixo de versão do `cripto.ts` existe para permitir: mudar o que está lá dentro sem
 * mudar a forma de fora. Quem lê usa `lerCredencial`, que valida a forma — e trata o formato
 * antigo, de token solto, como um acesso sem refresh.
 */

const AUTORIZAR = "https://github.com/login/oauth/authorize";
const TROCAR = "https://github.com/login/oauth/access_token";
const API = "https://api.github.com";

/** O que vai cifrado dentro de `token_cifrado`. */
export type Credencial = {
  acesso: string;
  /** `null` quando o app não expira tokens, ou no formato antigo. */
  refresh: string | null;
  /** ISO, ou `null` quando não expira. Vem do `expires_in` do GitHub, não de número chumbado. */
  expiraEm: string | null;
};

export type ResultadoGithub<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function aleatorio(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

/**
 * PKCE.
 *
 * O `client_secret` já protege a troca do código neste fluxo, então o PKCE é cinto além do
 * suspensório: ele fecha o caso em que o código vaza no caminho de volta — por histórico do
 * navegador, log de proxy, `Referer`. Sem o verificador, um código interceptado não vira token.
 */
export async function gerarPkce(): Promise<{ verificador: string; desafio: string }> {
  const verificador = aleatorio(48);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador));
  return { verificador, desafio: base64url(new Uint8Array(hash)) };
}

export function novoEstado(): string {
  return aleatorio(24);
}

export function urlDeAutorizacao(params: {
  clientId: string;
  redirectUri: string;
  estado: string;
  desafio: string;
  escopos: string[];
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.escopos.join(" "),
    state: params.estado,
    code_challenge: params.desafio,
    code_challenge_method: "S256",
  });
  return `${AUTORIZAR}?${q.toString()}`;
}

type RespostaToken = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function daResposta(dados: RespostaToken): ResultadoGithub<Credencial> {
  /*
   * O GitHub responde 200 mesmo quando recusa: o erro vem no corpo. Confiar no status aqui faria
   * um `bad_verification_code` virar uma credencial com `acesso: undefined`, gravada como válida.
   */
  if (dados.error || !dados.access_token) {
    return { ok: false, motivo: dados.error ?? "O GitHub não devolveu token." };
  }
  return {
    ok: true,
    valor: {
      acesso: dados.access_token,
      refresh: dados.refresh_token ?? null,
      expiraEm: dados.expires_in
        ? new Date(Date.now() + dados.expires_in * 1000).toISOString()
        : null,
    },
  };
}

async function pedirToken(corpo: URLSearchParams): Promise<ResultadoGithub<Credencial>> {
  let resposta: Response;
  try {
    resposta = await buscarComPrazo(TROCAR, {
      method: "POST",
      // Sem este `Accept`, o GitHub responde form-encoded e o `json()` estoura.
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: corpo.toString(),
    });
  } catch {
    return { ok: false, motivo: "O GitHub não respondeu a tempo." };
  }

  if (!resposta.ok) return { ok: false, motivo: `O GitHub recusou (${resposta.status}).` };
  return daResposta((await resposta.json()) as RespostaToken);
}

export function trocarCodigo(params: {
  clientId: string;
  clientSecret: string;
  codigo: string;
  redirectUri: string;
  verificador: string;
}): Promise<ResultadoGithub<Credencial>> {
  return pedirToken(
    new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      code: params.codigo,
      redirect_uri: params.redirectUri,
      code_verifier: params.verificador,
    }),
  );
}

export function renovar(params: {
  clientId: string;
  clientSecret: string;
  refresh: string;
}): Promise<ResultadoGithub<Credencial>> {
  return pedirToken(
    new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      grant_type: "refresh_token",
      refresh_token: params.refresh,
    }),
  );
}

/** Lê o que estava cifrado, tolerando o formato antigo de token solto. */
export function lerCredencial(claro: string): Credencial | null {
  try {
    const o = JSON.parse(claro) as Partial<Credencial>;
    if (typeof o.acesso === "string" && o.acesso) {
      return {
        acesso: o.acesso,
        refresh: typeof o.refresh === "string" ? o.refresh : null,
        expiraEm: typeof o.expiraEm === "string" ? o.expiraEm : null,
      };
    }
    return null;
  } catch {
    // Não era JSON: é o formato antigo, um token de acesso sem refresh.
    return claro ? { acesso: claro, refresh: null, expiraEm: null } : null;
  }
}

/** Vencido, ou a menos de um minuto de vencer — a margem evita corrida com a chamada em curso. */
export function precisaRenovar(c: Credencial): boolean {
  if (!c.expiraEm) return false;
  return new Date(c.expiraEm).getTime() - Date.now() < 60_000;
}

const CABECALHOS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Pathly",
});

export async function contaDe(token: string): Promise<ResultadoGithub<string>> {
  try {
    const r = await buscarComPrazo(`${API}/user`, { headers: CABECALHOS(token) });
    if (!r.ok) return { ok: false, motivo: `Não consegui ler sua conta (${r.status}).` };
    const u = (await r.json()) as { login?: string };
    return { ok: true, valor: u.login ?? "" };
  } catch {
    return { ok: false, motivo: "O GitHub não respondeu a tempo." };
  }
}

export async function listarRepos(token: string): Promise<ResultadoGithub<string>> {
  try {
    const r = await buscarComPrazo(`${API}/user/repos?per_page=30&sort=updated`, {
      headers: CABECALHOS(token),
    });
    if (!r.ok) return { ok: false, motivo: `O GitHub recusou a leitura (${r.status}).` };

    const repos = (await r.json()) as { full_name?: string }[];
    if (repos.length === 0) return { ok: true, valor: "Nenhum repositório encontrado." };

    /*
     * O resultado vai para o banco e para a tela: resumo, não despejo. Os três primeiros nomes
     * dizem à pessoa que a leitura funcionou e o que foi visto, sem transformar uma coluna de
     * texto em cópia da API.
     */
    const nomes = repos
      .slice(0, 3)
      .map((x) => x.full_name ?? "")
      .filter(Boolean);
    const resto = repos.length - nomes.length;
    return {
      ok: true,
      valor: `${repos.length} repositórios. ${nomes.join(", ")}${resto > 0 ? ` e mais ${resto}` : ""}.`,
    };
  } catch {
    return { ok: false, motivo: "O GitHub não respondeu a tempo." };
  }
}
