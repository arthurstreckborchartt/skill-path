/**
 * O acesso à pasta do vault, pela File System Access API.
 *
 * ## Por que este é o mecanismo, e não o plugin
 *
 * Um vault do Obsidian é uma pasta de arquivos `.md`. O Pathly roda num navegador. A File System
 * Access API deixa uma página ler e escrever numa pasta que a pessoa escolhe — com o aviso do
 * próprio navegador, revogável por ele, e sem servidor nenhum no meio.
 *
 * O plugin Local REST API é mais completo (é o único com os comandos do Obsidian), mas escuta em
 * `127.0.0.1` — e a nuvem não alcança o localhost de ninguém. Está no catálogo, explicado, e não
 * é usado.
 *
 * ## A consequência que vale mais que tudo
 *
 * **O conteúdo do vault nunca sai do navegador.** Não é uma promessa que alguém precisa cumprir:
 * o arquivo é lido, comparado e escrito aqui dentro. O servidor do Pathly guarda o caminho da
 * nota e uma impressão digital de 8 caracteres — nada que reconstrua uma linha de texto.
 *
 * ## O preço, dito antes de começar
 *
 * Só Chromium. Firefox e Safari implementam apenas o Origin Private File System e não expõem
 * seletor de pasta. Nesses navegadores a conexão não abre, e a tela diz o motivo em vez de
 * oferecer um botão que falha depois do clique.
 */

/*
 * A API não está nos tipos padrão do TypeScript em todas as versões de `lib.dom`. Declarar o
 * mínimo que este arquivo usa é mais honesto que instalar um pacote de tipos inteiro — e deixa
 * visível, aqui, exatamente qual superfície da API o Pathly toca.
 */
type Permissao = "granted" | "denied" | "prompt";

export type HandleArquivo = {
  kind: "file";
  name: string;
  getFile(): Promise<{ text(): Promise<string>; lastModified: number; size: number }>;
  createWritable(): Promise<{ write(dado: string): Promise<void>; close(): Promise<void> }>;
};

export type HandlePasta = {
  kind: "directory";
  name: string;
  entries(): AsyncIterableIterator<[string, HandleArquivo | HandlePasta]>;
  getDirectoryHandle(nome: string, opcoes?: { create?: boolean }): Promise<HandlePasta>;
  getFileHandle(nome: string, opcoes?: { create?: boolean }): Promise<HandleArquivo>;
  removeEntry(nome: string, opcoes?: { recursive?: boolean }): Promise<void>;
  queryPermission?(o: { mode: "read" | "readwrite" }): Promise<Permissao>;
  requestPermission?(o: { mode: "read" | "readwrite" }): Promise<Permissao>;
};

type ComPicker = {
  showDirectoryPicker(o?: { mode?: "read" | "readwrite"; id?: string }): Promise<HandlePasta>;
};

export type Falha =
  | "sem-suporte"
  | "cancelado"
  | "sem-permissao"
  | "nao-encontrado"
  | "erro-de-leitura"
  | "erro-de-escrita";

export type Resultado<T> = { ok: true; valor: T } | { ok: false; falha: Falha; detalhe: string };

const MENSAGEM: Record<Falha, string> = {
  "sem-suporte":
    "Este navegador não deixa uma página escolher uma pasta. Chrome, Edge, Brave e Opera deixam; " +
    "Firefox e Safari, não.",
  cancelado: "Você fechou a janela sem escolher uma pasta.",
  "sem-permissao":
    "O navegador não liberou o acesso à pasta. Dá para reconectar e autorizar de novo.",
  "nao-encontrado": "Essa nota não está mais no vault.",
  "erro-de-leitura": "Não consegui ler o arquivo.",
  "erro-de-escrita": "Não consegui escrever o arquivo. Nada foi alterado.",
};

export function explicar(f: Falha): string {
  return MENSAGEM[f];
}

function erro(falha: Falha, detalhe = ""): { ok: false; falha: Falha; detalhe: string } {
  return { ok: false, falha, detalhe: detalhe || MENSAGEM[falha] };
}

// =============================================================================================
// Abrir o vault
// =============================================================================================

export function temSuporte(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/**
 * Pede a pasta do vault.
 *
 * Só funciona a partir de um gesto da pessoa — clique, tecla. É uma regra do navegador, e é boa:
 * impede que uma página abra o seletor de arquivos sozinha.
 *
 * `mode: "readwrite"` já no seletor evita um segundo aviso na primeira escrita. Pedir leitura
 * agora e escrita depois pareceria mais cuidadoso e seria pior — duas interrupções em vez de uma,
 * e a segunda chegando quando a pessoa já esqueceu o que autorizou.
 */
export async function escolherVault(): Promise<Resultado<HandlePasta>> {
  if (!temSuporte()) return erro("sem-suporte");

  try {
    const handle = await (window as unknown as ComPicker).showDirectoryPicker({
      mode: "readwrite",
      id: "pathly-vault",
    });
    return { ok: true, valor: handle };
  } catch (e) {
    const nome = (e as { name?: string })?.name;
    if (nome === "AbortError") return erro("cancelado");
    if (nome === "SecurityError") return erro("sem-permissao");
    return erro("sem-permissao", String((e as Error)?.message ?? e));
  }
}

/**
 * Confere se a permissão ainda vale, e pede de novo quando não vale.
 *
 * O navegador esquece a autorização ao fechar a aba, então toda sessão nova precisa pedir outra
 * vez. É chato e é o desenho certo: uma página não deveria manter acesso silencioso ao disco de
 * alguém entre visitas.
 */
export async function garantirPermissao(
  h: HandlePasta,
  escrita: boolean,
): Promise<Resultado<true>> {
  const mode = escrita ? "readwrite" : "read";
  try {
    if (h.queryPermission && (await h.queryPermission({ mode })) === "granted") {
      return { ok: true, valor: true };
    }
    if (h.requestPermission && (await h.requestPermission({ mode })) === "granted") {
      return { ok: true, valor: true };
    }
    return erro("sem-permissao");
  } catch (e) {
    return erro("sem-permissao", String((e as Error)?.message ?? e));
  }
}

// =============================================================================================
// Caminhar pela árvore
// =============================================================================================

async function descer(
  raiz: HandlePasta,
  partes: readonly string[],
  criar: boolean,
): Promise<Resultado<HandlePasta>> {
  let atual = raiz;
  for (const parte of partes) {
    if (!parte || parte === ".") continue;
    /* `..` nunca. Ele escaparia da pasta autorizada, e é aí que a granularidade de permissão morre. */
    if (parte === "..") return erro("sem-permissao", "Caminho com “..” não é permitido.");
    try {
      atual = await atual.getDirectoryHandle(parte, { create: criar });
    } catch {
      return erro("nao-encontrado", `A pasta "${parte}" não existe no vault.`);
    }
  }
  return { ok: true, valor: atual };
}

function separarCaminho(caminho: string): { pastas: string[]; arquivo: string } {
  const partes = caminho.split("/").filter(Boolean);
  return { pastas: partes.slice(0, -1), arquivo: partes[partes.length - 1] ?? "" };
}

// =============================================================================================
// Ler, escrever, apagar
// =============================================================================================

/** Lê uma nota. `null` em `valor` quando ela não existe — ausência não é erro. */
export async function ler(raiz: HandlePasta, caminho: string): Promise<Resultado<string | null>> {
  const { pastas, arquivo } = separarCaminho(caminho);
  const pasta = await descer(raiz, pastas, false);
  if (!pasta.ok) return pasta.falha === "nao-encontrado" ? { ok: true, valor: null } : pasta;

  try {
    const h = await pasta.valor.getFileHandle(arquivo);
    const f = await h.getFile();
    return { ok: true, valor: await f.text() };
  } catch (e) {
    const nome = (e as { name?: string })?.name;
    if (nome === "NotFoundError") return { ok: true, valor: null };
    return erro("erro-de-leitura", String((e as Error)?.message ?? e));
  }
}

/**
 * Escreve uma nota, criando as pastas do caminho.
 *
 * `createWritable` trunca o arquivo ao abrir — então quem chama precisa passar o texto **inteiro**
 * e já mesclado. É por isso que `nota.ts` existe: montar aqui, a partir do que está no disco, e só
 * então escrever.
 */
export async function escrever(
  raiz: HandlePasta,
  caminho: string,
  texto: string,
): Promise<Resultado<true>> {
  const { pastas, arquivo } = separarCaminho(caminho);
  if (!arquivo.endsWith(".md")) return erro("erro-de-escrita", "Só escrevo arquivos .md.");

  const pasta = await descer(raiz, pastas, true);
  if (!pasta.ok) return pasta;

  try {
    const h = await pasta.valor.getFileHandle(arquivo, { create: true });
    const w = await h.createWritable();
    await w.write(texto);
    await w.close();
    return { ok: true, valor: true };
  } catch (e) {
    return erro("erro-de-escrita", String((e as Error)?.message ?? e));
  }
}

/**
 * Apaga uma nota.
 *
 * Separada de todo o resto de propósito, e nunca chamada em lote. `DELETE_NOTE` exige confirmação
 * daquela nota específica — uma autorização de apagar não vale para a próxima.
 */
export async function apagar(raiz: HandlePasta, caminho: string): Promise<Resultado<true>> {
  const { pastas, arquivo } = separarCaminho(caminho);
  const pasta = await descer(raiz, pastas, false);
  if (!pasta.ok) return pasta;

  try {
    await pasta.valor.removeEntry(arquivo);
    return { ok: true, valor: true };
  } catch (e) {
    const nome = (e as { name?: string })?.name;
    if (nome === "NotFoundError") return erro("nao-encontrado");
    return erro("erro-de-escrita", String((e as Error)?.message ?? e));
  }
}

// =============================================================================================
// Listar e buscar
// =============================================================================================

export type Entrada = { caminho: string; tipo: "nota" | "pasta" };

/**
 * Lista o que há numa pasta, sem descer.
 *
 * Um nível por vez de propósito: varrer o vault inteiro de uma vez é lento num vault grande, e —
 * pior — leria pastas que a pessoa não autorizou. A tela desce conforme ela abre.
 */
export async function listar(raiz: HandlePasta, caminho = ""): Promise<Resultado<Entrada[]>> {
  const pasta = await descer(raiz, caminho.split("/").filter(Boolean), false);
  if (!pasta.ok) return pasta;

  const saida: Entrada[] = [];
  try {
    for await (const [nome, h] of pasta.valor.entries()) {
      /* `.obsidian` é a configuração do app, e `.trash` é a lixeira dele. Nada ali é do Pathly. */
      if (nome.startsWith(".")) continue;
      const completo = caminho ? `${caminho}/${nome}` : nome;
      if (h.kind === "directory") saida.push({ caminho: completo, tipo: "pasta" });
      else if (nome.endsWith(".md")) saida.push({ caminho: completo, tipo: "nota" });
    }
  } catch (e) {
    return erro("erro-de-leitura", String((e as Error)?.message ?? e));
  }

  return {
    ok: true,
    valor: saida.sort((a, b) =>
      a.tipo === b.tipo ? a.caminho.localeCompare(b.caminho) : a.tipo === "pasta" ? -1 : 1,
    ),
  };
}

/**
 * Isto parece um vault do Obsidian?
 *
 * A marca mais confiável é a pasta `.obsidian`, que o app cria sozinho. Ela pode não existir num
 * vault recém-criado que ainda não foi aberto — então a ausência **não** reprova: devolve um aviso
 * e deixa a pessoa seguir. Recusar seria errar contra quem está certo.
 */
export async function pareceVault(
  raiz: HandlePasta,
): Promise<{ vault: boolean; notas: number; aviso: string | null }> {
  let temConfig = false;
  let notas = 0;

  try {
    for await (const [nome, h] of raiz.entries()) {
      if (nome === ".obsidian" && h.kind === "directory") temConfig = true;
      else if (h.kind === "file" && nome.endsWith(".md")) notas++;
      else if (h.kind === "directory" && !nome.startsWith(".")) notas += 1;
    }
  } catch {
    return { vault: false, notas: 0, aviso: "Não consegui ler a pasta." };
  }

  if (temConfig) return { vault: true, notas, aviso: null };
  return {
    vault: false,
    notas,
    aviso:
      "Não encontrei a pasta .obsidian aqui, então talvez esta não seja a raiz de um vault. Se " +
      "for um vault novo que você ainda não abriu no Obsidian, pode seguir.",
  };
}

export type Achado = { caminho: string; linha: number; trecho: string };

/**
 * Busca um termo nas pastas autorizadas.
 *
 * Devolve **trechos**, nunca as notas inteiras. É o que permite usar o vault como contexto sem
 * despejar o conteúdo dele em lugar nenhum — e o limite existe pelo mesmo motivo: uma busca por
 * "o" não pode virar uma cópia do vault.
 */
export async function buscar(
  raiz: HandlePasta,
  termo: string,
  pastas: readonly string[],
  limite = 40,
): Promise<Resultado<Achado[]>> {
  const alvo = termo.trim().toLowerCase();
  if (alvo.length < 2) return { ok: true, valor: [] };

  const achados: Achado[] = [];

  async function varrer(caminho: string, profundidade: number): Promise<void> {
    if (achados.length >= limite || profundidade > 6) return;
    const itens = await listar(raiz, caminho);
    if (!itens.ok) return;

    for (const i of itens.valor) {
      if (achados.length >= limite) return;
      if (i.tipo === "pasta") {
        await varrer(i.caminho, profundidade + 1);
        continue;
      }
      const conteudo = await ler(raiz, i.caminho);
      if (!conteudo.ok || conteudo.valor === null) continue;

      conteudo.valor.split("\n").forEach((linha, n) => {
        if (achados.length >= limite) return;
        if (linha.toLowerCase().includes(alvo)) {
          achados.push({ caminho: i.caminho, linha: n + 1, trecho: linha.trim().slice(0, 200) });
        }
      });
    }
  }

  for (const p of pastas) await varrer(p, 0);
  return { ok: true, valor: achados };
}
