import { cifrar, decifrar } from "./cripto";

/**
 * O que atravessa o fluxo de OAuth, entre `/iniciar` e `/callback`.
 *
 * ## Por que existe um cookie aqui
 *
 * O callback chega como navegação do GitHub, sem o `Bearer` da sessão do Supabase — que mora no
 * `localStorage` e o servidor não enxerga. Sem carregar algo entre as duas pontas, o callback não
 * saberia de quem é a conexão que está gravando.
 *
 * Então o `/iniciar`, que **tem** o `Bearer`, identifica a pessoa e guarda isso aqui.
 *
 * ## Por que cifrado, se já é HttpOnly
 *
 * `HttpOnly` impede o JavaScript da página de ler. Não impede quem tiver acesso ao disco, ao
 * despejo de memória do navegador, ou a um log que registre cabeçalhos. E não autentica: um
 * cookie adulterado chegaria como válido.
 *
 * Cifrar com AES-GCM resolve os dois: o conteúdo não se lê e, porque GCM autentica, mexer nele
 * faz a decifragem falhar em vez de devolver um `userId` escolhido por quem mexeu. É a mesma
 * chave e o mesmo módulo do token — sem componente novo para manter.
 */

export const NOME_COOKIE = "pathly_oauth";

/** Minutos, não horas: é o tempo de a pessoa ver a tela do GitHub e clicar em autorizar. */
const VALIDADE_S = 10 * 60;

export type EstadoOauth = {
  estado: string;
  verificador: string;
  userId: string;
  provedor: string;
  /** Epoch em segundos. Conferido na volta — cookie vencido não autoriza. */
  exp: number;
};

export async function gravarCookie(dados: Omit<EstadoOauth, "exp">, seguro: boolean) {
  const conteudo: EstadoOauth = { ...dados, exp: Math.floor(Date.now() / 1000) + VALIDADE_S };
  const cifrado = await cifrar(JSON.stringify(conteudo));
  if (!cifrado.ok) return null;

  /*
   * `SameSite=Lax` e não `Strict`: o callback é uma navegação vinda do github.com, e `Strict`
   * não manda cookie em requisição de outro site — nem em navegação de topo. O cookie não
   * chegaria, e o fluxo falharia sempre.
   *
   * `Path` restrito às rotas de OAuth: não há motivo para este cookie viajar em toda requisição
   * do app.
   */
  const partes = [
    `${NOME_COOKIE}=${cifrado.valor}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/integracoes/oauth",
    `Max-Age=${VALIDADE_S}`,
  ];
  // `Secure` quebra em `http://localhost`, que é onde se desenvolve. Em produção é obrigatório.
  if (seguro) partes.push("Secure");
  return partes.join("; ");
}

/** O cabeçalho que apaga o cookie. Chamado tanto no sucesso quanto na recusa. */
export function apagarCookie(seguro: boolean): string {
  const partes = [
    `${NOME_COOKIE}=`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/api/integracoes/oauth",
    "Max-Age=0",
  ];
  if (seguro) partes.push("Secure");
  return partes.join("; ");
}

export function lerCookieBruto(cabecalho: string | null): string | null {
  if (!cabecalho) return null;
  for (const parte of cabecalho.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === NOME_COOKIE) return resto.join("=") || null;
  }
  return null;
}

export async function lerCookie(cabecalho: string | null): Promise<EstadoOauth | null> {
  const bruto = lerCookieBruto(cabecalho);
  if (!bruto) return null;

  const claro = await decifrar(bruto);
  if (!claro.ok) return null;

  try {
    const o = JSON.parse(claro.valor) as Partial<EstadoOauth>;
    if (
      typeof o.estado !== "string" ||
      typeof o.verificador !== "string" ||
      typeof o.userId !== "string" ||
      typeof o.provedor !== "string" ||
      typeof o.exp !== "number"
    ) {
      return null;
    }
    if (o.exp < Math.floor(Date.now() / 1000)) return null;
    return o as EstadoOauth;
  } catch {
    return null;
  }
}

/**
 * Comparação em tempo constante do `state`.
 *
 * O `state` é um segredo de curta duração, e comparar com `===` vaza, pelo tempo, quantos
 * caracteres iniciais bateram. O ganho prático de atacar isso é pequeno; o custo de fazer certo
 * também é.
 */
export function mesmoEstado(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}
