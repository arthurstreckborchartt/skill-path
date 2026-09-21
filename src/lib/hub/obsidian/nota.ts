/**
 * O motor de notas — onde vive a regra mais importante desta integração.
 *
 * ## Nunca a nota inteira
 *
 * Uma nota do vault é da pessoa. Ela escreveu ali à mão, colou link, deixou um lembrete no meio.
 * Um produto que regrava o arquivo todo a cada sincronização apaga tudo isso, e só vai descobrir
 * no dia em que alguém perder duas horas de anotação.
 *
 * Então o Pathly só escreve **dentro de marcadores que ele mesmo colocou**:
 *
 * ```markdown
 * # NEXOS Finance
 *
 * Minhas anotações. O Pathly não toca aqui.
 *
 * <!-- pathly:inicio estado -->
 * Fase: Backend · Etapa 6 de 21
 * <!-- pathly:fim estado -->
 *
 * Mais anotações minhas, também intocadas.
 * ```
 *
 * Fora dos marcadores, nada muda. Nunca.
 *
 * ## Quando os marcadores somem
 *
 * A pessoa pode apagar um marcador sem querer — ou de propósito, para o Pathly parar de mexer ali.
 * As duas leituras são plausíveis, e é por isso que o Pathly **não adivinha**: sem marcador, ele
 * não escreve e devolve `marcador-ausente`. A tela pergunta.
 *
 * Adivinhar aqui seria escolher entre "recriar o bloco no fim" — que espalha blocos pela nota a
 * cada sincronização — e "reescrever a nota" — que é exatamente o que este arquivo existe para
 * impedir.
 *
 * ## Conflito é detectado por conteúdo, não por relógio
 *
 * O Pathly guarda a impressão digital do que ele escreveu por último. Na sincronização seguinte,
 * lê o arquivo e compara. Diferente = alguém mexeu fora do Pathly.
 *
 * Data de modificação não serve: relógios de máquinas diferentes discordam, o Obsidian Sync
 * reescreve mtime, e um arquivo salvo sem mudança nenhuma ganha mtime novo. Hash de conteúdo não
 * tem nenhum desses problemas.
 */

// =============================================================================================
// Marcadores
// =============================================================================================

const ABRE = "<!-- pathly:inicio ";
const FECHA = "<!-- pathly:fim ";
const FIM_TAG = " -->";

/** O nome de um bloco: letras, números e hífen. Restrito porque ele entra numa expressão regular. */
const NOME_VALIDO = /^[a-z0-9-]+$/;

export function marcadorDeAbertura(bloco: string): string {
  return `${ABRE}${bloco}${FIM_TAG}`;
}

export function marcadorDeFechamento(bloco: string): string {
  return `${FECHA}${bloco}${FIM_TAG}`;
}

/** Um bloco pronto para ser inserido numa nota. */
export function envolver(bloco: string, conteudo: string): string {
  return `${marcadorDeAbertura(bloco)}\n${conteudo.trim()}\n${marcadorDeFechamento(bloco)}`;
}

/**
 * Marcador que está dentro de uma cerca de código não conta.
 *
 * Parece paranoia até a primeira nota que **documenta o Pathly** — e o vault do Pathly é
 * exatamente isso. Uma nota explicando os marcadores escreveria `<!-- pathly:fim estado -->`
 * dentro de um bloco ```, e um `indexOf` ingênuo fecharia o bloco ali, cortando a nota ao meio na
 * primeira sincronização.
 *
 * Isto não é um parser de Markdown: só alterna um booleano a cada linha que começa com ``` ou ~~~.
 * Cobre o caso real e não tenta cobrir cerca aninhada, que Markdown mal define.
 */
function foraDeCerca(texto: string, indice: number): boolean {
  let dentro = false;
  let pos = 0;

  for (const linha of texto.split("\n")) {
    const fim = pos + linha.length;
    if (/^\s{0,3}(```|~~~)/.test(linha)) dentro = !dentro;
    else if (indice >= pos && indice <= fim) return !dentro;
    pos = fim + 1;
  }
  return !dentro;
}

function procurar(texto: string, alvo: string, de: number): number {
  let i = texto.indexOf(alvo, de);
  while (i >= 0 && !foraDeCerca(texto, i)) i = texto.indexOf(alvo, i + 1);
  return i;
}

function acharBloco(texto: string, bloco: string): { inicio: number; fim: number } | null {
  const a = procurar(texto, marcadorDeAbertura(bloco), 0);
  if (a < 0) return null;
  const f = procurar(texto, marcadorDeFechamento(bloco), a);
  if (f < 0) return null;
  return { inicio: a, fim: f + marcadorDeFechamento(bloco).length };
}

/** Os blocos do Pathly presentes numa nota, na ordem. */
export function blocosPresentes(texto: string): string[] {
  const re = new RegExp(`${ABRE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([a-z0-9-]+)`, "g");
  const achados: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    const nome = m[1]!;
    if (foraDeCerca(texto, m.index) && acharBloco(texto, nome)) achados.push(nome);
  }
  return achados;
}

/** O conteúdo de um bloco, sem os marcadores. `null` quando o bloco não existe. */
export function lerBloco(texto: string, bloco: string): string | null {
  const pos = acharBloco(texto, bloco);
  if (!pos) return null;
  const dentro = texto.slice(
    pos.inicio + marcadorDeAbertura(bloco).length,
    pos.fim - marcadorDeFechamento(bloco).length,
  );
  return dentro.replace(/^\n/, "").replace(/\n$/, "");
}

// =============================================================================================
// Frontmatter
// =============================================================================================

export type Frontmatter = Record<string, string | string[]>;

export type NotaSeparada = {
  frontmatter: Frontmatter;
  /** `true` quando a nota já tinha frontmatter. Serve para não inventar um onde não havia. */
  tinhaFrontmatter: boolean;
  corpo: string;
};

/**
 * Separa o frontmatter YAML do corpo.
 *
 * Deliberadamente simples: só `chave: valor` e listas com `- item`. O Obsidian aceita YAML
 * completo, mas o Pathly escreve pouca coisa lá — `tags`, `projeto`, `atualizado-por` — e um
 * parser YAML de verdade seria uma dependência nova para ler três linhas.
 *
 * O que ele **não** entende (aninhamento, blocos de texto, âncoras) é preservado literalmente em
 * `frontmatter` como texto bruto da linha, e volta intacto na serialização. Vale repetir: não
 * entender não é motivo para destruir.
 */
export function separar(texto: string): NotaSeparada {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { frontmatter: {}, tinhaFrontmatter: false, corpo: texto };

  const fm: Frontmatter = {};
  let chaveDeLista: string | null = null;

  for (const linha of m[1]!.split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(linha);
    if (item && chaveDeLista) {
      (fm[chaveDeLista] as string[]).push(item[1]!.trim());
      continue;
    }
    const par = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(linha);
    if (!par) continue;

    const [, chave, valor] = par;
    if (valor!.trim() === "") {
      fm[chave!] = [];
      chaveDeLista = chave!;
    } else {
      fm[chave!] = valor!.trim();
      chaveDeLista = null;
    }
  }

  return { frontmatter: fm, tinhaFrontmatter: true, corpo: texto.slice(m[0].length) };
}

export function serializar(n: NotaSeparada): string {
  const chaves = Object.keys(n.frontmatter);
  if (chaves.length === 0) return n.corpo;

  const linhas = chaves.map((k) => {
    const v = n.frontmatter[k]!;
    return Array.isArray(v) ? `${k}:\n${v.map((x) => `  - ${x}`).join("\n")}` : `${k}: ${v}`;
  });
  return `---\n${linhas.join("\n")}\n---\n${n.corpo}`;
}

/**
 * Atualiza chaves do frontmatter sem tocar nas outras.
 *
 * A pessoa pode ter `aliases`, `cssclass`, `publish` — nada disso é do Pathly, e nada disso é
 * mexido. Só as chaves passadas mudam.
 */
export function atualizarFrontmatter(texto: string, campos: Frontmatter): string {
  const n = separar(texto);
  return serializar({ ...n, frontmatter: { ...n.frontmatter, ...campos } });
}

// =============================================================================================
// As operações de escrita
// =============================================================================================

export type ResultadoDeEscrita =
  | { ok: true; texto: string; mudou: boolean }
  | { ok: false; motivo: "marcador-ausente" | "bloco-invalido"; detalhe: string };

/**
 * Substitui o conteúdo de um bloco. **A operação principal.**
 *
 * Não cria o bloco: quando o marcador não está lá, devolve `marcador-ausente` e não escreve nada.
 * Criar é `inserirBloco`, e a separação é de propósito — atualizar e criar têm consequências
 * diferentes, e um "patch" que cria em silêncio acaba espalhando blocos pela nota.
 */
export function aplicarSecao(texto: string, bloco: string, conteudo: string): ResultadoDeEscrita {
  if (!NOME_VALIDO.test(bloco)) {
    return { ok: false, motivo: "bloco-invalido", detalhe: `"${bloco}" não é um nome de bloco.` };
  }

  const pos = acharBloco(texto, bloco);
  if (!pos) {
    return {
      ok: false,
      motivo: "marcador-ausente",
      detalhe:
        `O bloco "${bloco}" não está mais nesta nota. Ele pode ter sido apagado de propósito, ` +
        `para o Pathly parar de escrever aqui — então ele não recria por conta própria.`,
    };
  }

  const novo = texto.slice(0, pos.inicio) + envolver(bloco, conteudo) + texto.slice(pos.fim);
  return { ok: true, texto: novo, mudou: novo !== texto };
}

/** Cria o bloco no fim da nota. Se já existir, atualiza em vez de duplicar. */
export function inserirBloco(texto: string, bloco: string, conteudo: string): ResultadoDeEscrita {
  if (!NOME_VALIDO.test(bloco)) {
    return { ok: false, motivo: "bloco-invalido", detalhe: `"${bloco}" não é um nome de bloco.` };
  }
  if (acharBloco(texto, bloco)) return aplicarSecao(texto, bloco, conteudo);

  const base = texto.replace(/\s*$/, "");
  const novo = `${base}${base ? "\n\n" : ""}${envolver(bloco, conteudo)}\n`;
  return { ok: true, texto: novo, mudou: true };
}

/** Acrescenta no fim do bloco, preservando o que já estava lá. */
export function anexar(texto: string, bloco: string, adicao: string): ResultadoDeEscrita {
  const atual = lerBloco(texto, bloco);
  if (atual === null) return aplicarSecao(texto, bloco, adicao);
  return aplicarSecao(texto, bloco, `${atual}\n${adicao.trim()}`.trim());
}

/**
 * Acrescenta no começo do bloco.
 *
 * É o certo para registros em ordem cronológica invertida — um log em que o mais recente fica no
 * topo. Anexar no fim obrigaria a rolar a nota inteira para ver o que acabou de acontecer.
 */
export function antepor(texto: string, bloco: string, adicao: string): ResultadoDeEscrita {
  const atual = lerBloco(texto, bloco);
  if (atual === null) return aplicarSecao(texto, bloco, adicao);
  return aplicarSecao(texto, bloco, `${adicao.trim()}\n${atual}`.trim());
}

/** Remove o bloco e os marcadores, deixando o resto da nota intacto. */
export function removerBloco(texto: string, bloco: string): ResultadoDeEscrita {
  const pos = acharBloco(texto, bloco);
  if (!pos) {
    return { ok: false, motivo: "marcador-ausente", detalhe: `O bloco "${bloco}" não está aqui.` };
  }
  const novo = (texto.slice(0, pos.inicio) + texto.slice(pos.fim)).replace(/\n{3,}/g, "\n\n");
  return { ok: true, texto: novo, mudou: true };
}

// =============================================================================================
// Impressão digital e conflito
// =============================================================================================

/**
 * A impressão digital do conteúdo.
 *
 * FNV-1a de 32 bits, em hexadecimal. Não é criptográfico e não precisa ser: aqui ele só responde
 * "este arquivo é byte a byte o mesmo de antes?". `crypto.subtle` daria SHA-256, mas é assíncrono
 * e obrigaria metade deste módulo a virar `async` para ganhar uma garantia que ninguém precisa.
 *
 * Colisão de FNV-32 em texto exigiria má sorte deliberada. O custo de uma seria o Pathly não
 * notar uma edição externa — e a pessoa vê a nota, então o erro apareceria na hora.
 */
export function impressao(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export type Estado = "igual" | "so-pathly" | "so-obsidian" | "conflito" | "nova";

/**
 * Compara o que há no disco com o que o Pathly sabia e com o que ele quer escrever.
 *
 * As cinco respostas cobrem os casos reais, e a que importa é `conflito`: os dois lados mexeram
 * desde a última sincronização, e escolher sozinho apagaria o trabalho de um deles.
 */
export function comparar(params: {
  /** O texto atual no disco. `null` quando a nota não existe. */
  noDisco: string | null;
  /** A impressão do que o Pathly escreveu (ou leu) por último. `null` na primeira vez. */
  impressaoConhecida: string | null;
  /** O texto que o Pathly quer escrever agora. */
  doPathly: string;
}): Estado {
  const { noDisco, impressaoConhecida, doPathly } = params;

  if (noDisco === null) return "nova";

  const atual = impressao(noDisco);
  const mudouFora = impressaoConhecida !== null && atual !== impressaoConhecida;
  const pathlyMudou = noDisco !== doPathly;

  /* Primeira sincronização de uma nota que já existia: não dá para saber se mudou, então trata-se
   * como mudança externa. Assumir o contrário faria a primeira escrita apagar o que já estava. */
  if (impressaoConhecida === null) return pathlyMudou ? "conflito" : "igual";

  if (!mudouFora && !pathlyMudou) return "igual";
  if (!mudouFora && pathlyMudou) return "so-pathly";
  if (mudouFora && !pathlyMudou) return "so-obsidian";
  return "conflito";
}

export const EXPLICACAO_ESTADO: Record<Estado, string> = {
  igual: "A nota no vault já está como o Pathly deixou.",
  "so-pathly": "Só o Pathly tem novidade. Pode escrever sem risco.",
  "so-obsidian": "Você mexeu na nota e o Pathly não tem nada novo. Nada a escrever.",
  conflito: "Essa nota foi modificada desde a última sincronização.",
  nova: "A nota ainda não existe no vault.",
};

// =============================================================================================
// Mesclagem segura
// =============================================================================================

export type ResultadoDeMesclagem =
  | { ok: true; texto: string; blocosEscritos: string[]; blocosAusentes: string[] }
  | { ok: false; motivo: string };

/**
 * A mesclagem segura: aplica vários blocos numa nota, preservando tudo o mais.
 *
 * ## Por que ela consegue resolver um conflito
 *
 * Porque conflito aqui quase nunca é conflito de verdade. "A nota mudou" costuma significar que a
 * pessoa escreveu um parágrafo **fora** dos blocos do Pathly — e nesse caso as duas mudanças não
 * se tocam, e as duas cabem.
 *
 * Então a ordem certa é: partir do que está **no disco** (preservando o texto da pessoa) e aplicar
 * os blocos por cima. O contrário — partir do texto do Pathly e tentar trazer o da pessoa — só
 * funcionaria se o Pathly soubesse o que ela escreveu, e ele não sabe.
 *
 * Conflito de verdade — os dois mexendo no mesmo bloco — continua existindo, e aí a decisão é da
 * pessoa. É o que `blocosAusentes` sinaliza: o bloco sumiu, e recriá-lo seria uma escolha, não uma
 * mesclagem.
 */
export function mesclar(
  noDisco: string,
  blocos: readonly { bloco: string; conteudo: string }[],
  frontmatter?: Frontmatter,
): ResultadoDeMesclagem {
  let texto = frontmatter ? atualizarFrontmatter(noDisco, frontmatter) : noDisco;
  const escritos: string[] = [];
  const ausentes: string[] = [];

  for (const b of blocos) {
    const r = aplicarSecao(texto, b.bloco, b.conteudo);
    if (r.ok) {
      texto = r.texto;
      if (r.mudou) escritos.push(b.bloco);
    } else if (r.motivo === "marcador-ausente") {
      ausentes.push(b.bloco);
    } else {
      return { ok: false, motivo: r.detalhe };
    }
  }

  return { ok: true, texto, blocosEscritos: escritos, blocosAusentes: ausentes };
}

/**
 * Monta uma nota nova, com os blocos do Pathly e um lugar reservado para a pessoa escrever.
 *
 * O convite no topo não é enfeite: sem ele, a nota parece gerada e intocável, e ninguém escreve
 * nela. A integração inteira existe para que a nota vire um lugar de trabalho, não um relatório.
 */
export function notaNova(params: {
  titulo: string;
  frontmatter?: Frontmatter;
  blocos: readonly { bloco: string; conteudo: string }[];
}): string {
  const corpo = [
    `# ${params.titulo}`,
    "",
    "Escreva o que quiser aqui. O Pathly só altera o que está entre os marcadores dele.",
    "",
    ...params.blocos.map((b) => `${envolver(b.bloco, b.conteudo)}\n`),
  ].join("\n");

  return params.frontmatter
    ? serializar({ frontmatter: params.frontmatter, tinhaFrontmatter: true, corpo })
    : corpo;
}

// =============================================================================================
// Comparação para a tela
// =============================================================================================

export type LinhaDeDiferenca = { tipo: "igual" | "so-a" | "so-b"; texto: string };

/**
 * Uma comparação linha a linha, para a tela de "Comparar alterações".
 *
 * É um diff ingênuo — casa prefixo comum e sufixo comum, e marca o miolo como diferente. Não faz
 * alinhamento ótimo, então uma linha inserida no meio faz o resto aparecer como alterado.
 *
 * Isso é aceitável aqui e não seria num editor de código: o que a pessoa precisa decidir é "de
 * que lado eu fico", não revisar cada linha. Um algoritmo de verdade seria uma dependência nova
 * para melhorar uma tela de decisão binária.
 */
export function diferenca(a: string, b: string): LinhaDeDiferenca[] {
  const la = a.split("\n");
  const lb = b.split("\n");

  let inicio = 0;
  while (inicio < la.length && inicio < lb.length && la[inicio] === lb[inicio]) inicio++;

  let fim = 0;
  while (
    fim < la.length - inicio &&
    fim < lb.length - inicio &&
    la[la.length - 1 - fim] === lb[lb.length - 1 - fim]
  ) {
    fim++;
  }

  const saida: LinhaDeDiferenca[] = [];
  for (let i = 0; i < inicio; i++) saida.push({ tipo: "igual", texto: la[i]! });
  for (let i = inicio; i < la.length - fim; i++) saida.push({ tipo: "so-a", texto: la[i]! });
  for (let i = inicio; i < lb.length - fim; i++) saida.push({ tipo: "so-b", texto: lb[i]! });
  for (let i = la.length - fim; i < la.length; i++) saida.push({ tipo: "igual", texto: la[i]! });

  return saida;
}
