/**
 * Validação de entrada para os endpoints que montam prompt.
 *
 * Todo campo que chega do cliente e entra num prompt precisa de teto de tamanho. Sem isso, um
 * corpo de requisição de vários megabytes vira contexto enviado ao provedor — e o custo de uma
 * chamada de IA é proporcional ao tamanho do que se manda.
 *
 * Isto complementa o limite de frequência: um trava quantas chamadas, o outro trava quanto cada
 * chamada pode custar. Só os dois juntos fecham o abuso financeiro.
 */

/** Teto do corpo inteiro, antes de parsear. */
export const TETO_CORPO_BYTES = 32 * 1024;

/**
 * Lê o corpo como JSON recusando o que for grande demais.
 *
 * A checagem vem **antes** do parse: parsear para só então medir já pagou o custo de memória que
 * se queria evitar.
 */
export async function lerJsonLimitado<T>(
  request: Request,
  tetoBytes = TETO_CORPO_BYTES,
): Promise<{ ok: true; dados: T } | { ok: false; motivo: "grande" | "invalido" }> {
  const declarado = request.headers.get("content-length");
  if (declarado && Number(declarado) > tetoBytes) return { ok: false, motivo: "grande" };

  const texto = await request.text();
  // `content-length` pode mentir ou faltar; o tamanho real é o que vale.
  if (texto.length > tetoBytes) return { ok: false, motivo: "grande" };

  try {
    return { ok: true, dados: JSON.parse(texto) as T };
  } catch {
    return { ok: false, motivo: "invalido" };
  }
}

/**
 * Caracteres de controle nao tem uso legitimo num campo que vira prompt, e servem para embaralhar
 * a leitura do texto pelo modelo. Tabulacao e quebra de linha ficam.
 *
 * Feito por codigo de ponto, sem regex: escapes de controle dentro de uma expressao regular ja
 * viraram caracteres literais neste arquivo uma vez — invisiveis no editor e faceis de corromper.
 */
function ehControle(caractere: string): boolean {
  const n = caractere.charCodeAt(0);
  if (n === 9 || n === 10 || n === 13) return false;
  return n <= 31 || n === 127;
}

/** Corta e limpa um campo de texto que vai virar prompt. */
export function texto(valor: unknown, maximo: number): string {
  if (typeof valor !== "string") return "";
  let limpo = "";
  for (const c of valor) {
    if (!ehControle(c)) limpo += c;
  }
  return limpo.trim().slice(0, maximo);
}

/** Lista de textos curtos, com teto de itens e de tamanho por item. */
export function listaDeTextos(valor: unknown, maxItens: number, maxCada: number): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((v) => texto(v, maxCada))
    .filter(Boolean)
    .slice(0, maxItens);
}

/** Tetos por campo. Generosos para o uso real, apertados o bastante para não virar carona. */
export const TETOS = {
  /** A frase que descreve o projeto. Cabe um parágrafo; nao cabe um documento de requisitos. */
  ideia: 600,
  /** Nome do projeto, digitado pela pessoa. */
  nomeProjeto: 80,
  tarefa: 200,
  etapa: 200,
  objetivo: 500,
  area: 100,
  habilidade: 60,
  habilidades: 8,
  pratica: 1000,
  resposta: 4000,
} as const;
