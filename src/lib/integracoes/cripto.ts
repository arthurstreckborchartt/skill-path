import { lerEnv } from "@/lib/server-env";

/**
 * Cifragem dos tokens de terceiros.
 *
 * ## Por que existe, se a tabela já tem RLS
 *
 * RLS decide **quem** pode ler a linha. Ela não protege contra quem já está do lado de dentro:
 * um backup vazado, um dump de suporte, uma consulta feita com `service_role` por engano num log.
 * O token do GitHub de alguém é a credencial mais perigosa que este app vai guardar — vale mais
 * que a senha do Pathly, porque abre a conta da pessoa em outro serviço.
 *
 * Então a linha guarda texto cifrado, e a chave mora fora do banco: num secret do Worker. Vazar o
 * banco sem vazar o Worker não entrega token nenhum.
 *
 * ## Só servidor
 *
 * Este módulo lê `INTEGRACOES_CHAVE`. Importá-lo de código de cliente colocaria o nome do secret
 * no bundle — o valor não vai junto, mas o hábito é ruim. Ele é usado só de rota `/api/*`.
 *
 * ## O formato
 *
 * `v1.<iv em base64url>.<cifrado+tag em base64url>`
 *
 * O prefixo de versão existe para o dia da rotação de chave ou troca de algoritmo: dá para ler o
 * formato antigo enquanto se escreve o novo, em vez de precisar migrar tudo de uma vez. Sem ele,
 * rotacionar exigiria parar o mundo.
 *
 * `AES-GCM` e não `AES-CBC`: GCM autentica. Um texto cifrado adulterado falha ao decifrar em vez
 * de devolver lixo que o resto do código trataria como token.
 */

const VERSAO = "v1";
const NOME_DA_CHAVE = "INTEGRACOES_CHAVE";

/** 96 bits é o tamanho de IV recomendado para GCM — é o que o modo foi projetado para usar. */
const TAMANHO_IV = 12;

export type ResultadoCripto<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(texto: string): Uint8Array<ArrayBuffer> | null {
  const normal = texto.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bruto = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, "="));
    const saida = new Uint8Array(new ArrayBuffer(bruto.length));
    for (let i = 0; i < bruto.length; i++) saida[i] = bruto.charCodeAt(i);
    return saida;
  } catch {
    return null;
  }
}

/**
 * A chave, derivada do secret.
 *
 * O secret é texto; AES precisa de 256 bits. `SHA-256` do secret resolve sem exigir que a pessoa
 * gere um valor com tamanho exato. Não é derivação de senha (não tem sal nem custo) e não precisa
 * ser: o secret já é aleatório e longo, não é algo que alguém escolheu e memorizou.
 */
async function chave(): Promise<ResultadoCripto<CryptoKey>> {
  const segredo = lerEnv(NOME_DA_CHAVE);
  if (!segredo || segredo.length < 32) {
    return {
      ok: false,
      motivo: `${NOME_DA_CHAVE} ausente ou curta demais (mínimo 32 caracteres).`,
    };
  }

  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(segredo));
  const k = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return { ok: true, valor: k };
}

/** `true` quando o ambiente tem a chave. Para a tela dizer "não configurado" em vez de quebrar. */
export function cifragemDisponivel(): boolean {
  const s = lerEnv(NOME_DA_CHAVE);
  return typeof s === "string" && s.length >= 32;
}

export async function cifrar(claro: string): Promise<ResultadoCripto<string>> {
  if (!claro) return { ok: false, motivo: "Nada para cifrar." };

  const k = await chave();
  if (!k.ok) return k;

  const iv = crypto.getRandomValues(new Uint8Array(TAMANHO_IV));
  const cifrado = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    k.valor,
    new TextEncoder().encode(claro),
  );

  return { ok: true, valor: `${VERSAO}.${base64url(iv)}.${base64url(new Uint8Array(cifrado))}` };
}

export async function decifrar(guardado: string): Promise<ResultadoCripto<string>> {
  const partes = guardado.split(".");
  if (partes.length !== 3 || partes[0] !== VERSAO) {
    return { ok: false, motivo: "Formato desconhecido." };
  }

  const iv = deBase64url(partes[1]!);
  const corpo = deBase64url(partes[2]!);
  if (!iv || !corpo || iv.length !== TAMANHO_IV) {
    return { ok: false, motivo: "Conteúdo inválido." };
  }

  const k = await chave();
  if (!k.ok) return k;

  try {
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, k.valor, corpo);
    return { ok: true, valor: new TextDecoder().decode(claro) };
  } catch {
    /*
     * Chave errada e texto adulterado caem os dois aqui, e o motivo não distingue de propósito:
     * dizer qual dos dois foi entrega informação a quem está testando.
     */
    return { ok: false, motivo: "Não foi possível decifrar." };
  }
}
