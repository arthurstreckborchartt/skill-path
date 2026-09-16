import type { Respostas } from "./respostas";

/**
 * As regras que tornam o plano adaptativo.
 *
 * ## Por que isto é código e não texto de prompt
 *
 * "Não crie Stripe se o projeto não tem pagamentos" escrito no prompt é uma sugestão. Modelos de
 * linguagem foram treinados em milhares de projetos que têm Stripe, e a média puxa para incluir.
 * Pedir com educação funciona na maioria das vezes, e "na maioria das vezes" não serve para a
 * promessa central deste produto, que é **arquitetura mínima necessária**.
 *
 * Então são duas camadas:
 *
 * 1. **Diretrizes no prompt** — instruções explícitas, em primeira pessoa e no imperativo, do que
 *    exigir e do que proibir. Resolve o caso comum e, mais importante, evita que o resto do plano
 *    seja construído em cima de algo que depois seria removido.
 * 2. **Filtro depois da geração** — o que escapou é retirado. Esta camada é a garantia, e ela é
 *    deliberadamente estreita: mexe só em listas onde um item é autocontido (integrações,
 *    endpoints), nunca em prosa. Apagar meia frase de uma arquitetura deixaria um texto quebrado,
 *    que é pior que o item indevido.
 *
 * O que o filtro não alcança fica honesto: a função `avisos()` relata o que sobrou fora das
 * regras, em vez de fingir que a limpeza foi completa.
 */

export type Diretrizes = {
  /** O que o plano PRECISA cobrir. Vira instrução no prompt e checagem depois. */
  exigir: string[];
  /** O que o plano NÃO pode conter. Mesma coisa, no sentido inverso. */
  proibir: string[];
  /** Ajustes de profundidade e de tom, derivados do nível e do modo de construir. */
  calibragem: string[];
};

/**
 * Famílias de serviço que só fazem sentido quando a resposta correspondente é "sim".
 *
 * Os nomes são casados por conteúdo, em minúsculas e sem acento, porque a IA escreve "Stripe",
 * "stripe checkout" ou "Stripe (pagamentos)" conforme o dia. Casar por igualdade exata deixaria
 * passar quase tudo — foi o mesmo erro que o catálogo de cursos deste projeto já cometeu.
 */
const FAMILIAS = {
  pagamento: [
    "stripe",
    "paypal",
    "mercado pago",
    "mercadopago",
    "pagar.me",
    "pagarme",
    "asaas",
    "iugu",
    "gerencianet",
    "efi",
    "adyen",
    "braintree",
    "paddle",
    "lemon squeezy",
    "pix",
    "boleto",
    "gateway de pagamento",
    "checkout",
    "assinatura recorrente",
    "cobranca recorrente",
  ],
  ia: [
    "openai",
    "anthropic",
    "claude",
    "gpt",
    "gemini",
    "llm",
    "langchain",
    "pinecone",
    "weaviate",
    "qdrant",
    "chroma",
    "embedding",
    "vector",
    "hugging face",
    "huggingface",
    "replicate",
    "modelo de linguagem",
  ],
  autenticacao: [
    "auth0",
    "clerk",
    "firebase auth",
    "supabase auth",
    "nextauth",
    "keycloak",
    "okta",
    "oauth",
    "openid",
  ],
  armazenamento: [
    "s3",
    "cloudinary",
    "uploadthing",
    "supabase storage",
    "firebase storage",
    "cloud storage",
    "blob storage",
    "r2",
  ],
} as const;

/**
 * Sem acento e em minúsculas, para o casamento por conteúdo não depender de grafia.
 *
 * Por código de ponto, sem regex, e isto não é estilo: escrever a faixa dos diacríticos numa
 * expressão regular já produziu caracteres literais invisíveis no editor duas vezes neste
 * projeto. `NFD` separa a letra do acento, e o laço descarta os acentos soltos.
 */
function normalizar(texto: string): string {
  const PRIMEIRO_DIACRITICO = 0x300;
  const ULTIMO_DIACRITICO = 0x36f;

  let saida = "";
  for (const c of texto.toLowerCase().normalize("NFD")) {
    const n = c.codePointAt(0) ?? 0;
    if (n >= PRIMEIRO_DIACRITICO && n <= ULTIMO_DIACRITICO) continue;
    saida += c;
  }
  return saida;
}

function ehAlfanumerico(c: string): boolean {
  const n = c.codePointAt(0) ?? 0;
  const DIGITO = n >= 0x30 && n <= 0x39;
  const LETRA = n >= 0x61 && n <= 0x7a;
  return DIGITO || LETRA;
}

/**
 * O termo aparece como palavra, não no meio de outra.
 *
 * `includes` puro não serve: termos curtos como "s3" e "gpt" casam dentro de qualquer palavra que
 * os contenha por acaso, e este filtro **remove** itens do plano. Um falso positivo aqui apaga um
 * endpoint legítimo do projeto de alguém, o que é bem pior que deixar passar um indevido.
 */
function contemTermo(texto: string, termo: string): boolean {
  for (let i = texto.indexOf(termo); i !== -1; i = texto.indexOf(termo, i + 1)) {
    const antes = i === 0 ? " " : texto[i - 1]!;
    const fim = i + termo.length;
    const depois = fim >= texto.length ? " " : texto[fim]!;
    if (!ehAlfanumerico(antes) && !ehAlfanumerico(depois)) return true;
  }
  return false;
}

function mencionaFamilia(texto: string, familia: readonly string[]): boolean {
  const t = normalizar(texto);
  return familia.some((termo) => contemTermo(t, termo));
}

export function diretrizes(r: Respostas): Diretrizes {
  const exigir: string[] = [];
  const proibir: string[] = [];
  const calibragem: string[] = [];

  // --- Pagamentos ---
  if (r.temPagamentos) {
    exigir.push(
      "O projeto cobra dinheiro. Inclua um provedor de pagamento adequado ao Brasil, o fluxo de cobrança, o tratamento de webhook e o que acontece quando um pagamento falha ou é estornado.",
    );
  } else {
    proibir.push(
      "O projeto NÃO cobra dinheiro dentro do sistema. Não inclua Stripe, Pix, boleto, gateway de pagamento, assinatura nem checkout em lugar nenhum do plano — nem como integração, nem como tabela, nem como endpoint, nem como etapa.",
    );
  }

  // --- IA ---
  if (r.temIa) {
    exigir.push(
      "O produto usa IA. Diga onde exatamente ela entra, qual provedor, o que acontece quando ele falha ou fica lento, e como o custo por chamada é controlado.",
    );
  } else {
    proibir.push(
      "O produto NÃO usa IA. Não inclua provedor de IA, banco vetorial, embeddings nem qualquer arquitetura de modelo. No campo sobre IA, escreva que este projeto não precisa de IA e por quê.",
    );
  }

  // --- Autenticação e papéis ---
  if (r.temAutenticacao) {
    exigir.push(
      "O sistema tem usuários que entram com conta. Defina o método de autenticação, onde a sessão fica, como a senha é tratada e o que protege cada rota.",
    );
    if (r.tiposDeUsuario === "varios") {
      exigir.push(
        "Existe mais de um tipo de usuário. Defina os papéis, o que cada um pode fazer, e onde essa permissão é verificada — no banco, no servidor, ou nos dois.",
      );
    } else {
      calibragem.push(
        "Há um único tipo de usuário. Não crie sistema de papéis, permissões nem níveis de acesso: isso é complexidade que ninguém pediu.",
      );
    }
  } else {
    proibir.push(
      "O sistema NÃO tem login. Não inclua autenticação, cadastro, sessão, tabela de usuários nem controle de acesso. Na seção de autenticação, escreva que este projeto não precisa de contas e por quê.",
    );
  }

  // --- Uploads ---
  if (r.temUploads) {
    exigir.push(
      "O sistema recebe arquivos enviados por quem usa. Defina onde ficam guardados, o limite de tamanho, quais tipos são aceitos e quem pode ler cada arquivo depois.",
    );
  } else {
    proibir.push(
      "O sistema NÃO recebe arquivos. Não inclua serviço de armazenamento de objetos, CDN de mídia nem tabela de anexos.",
    );
  }

  // --- Dados sensíveis ---
  if (r.temDadosSensiveis) {
    exigir.push(
      "O sistema guarda dados sensíveis. Trate a LGPD explicitamente: que dado pessoal é guardado, por quanto tempo, com que base legal, como a pessoa pede exclusão, o que é cifrado em repouso e o que fica registrado em log de acesso.",
    );
    calibragem.push(
      "Por causa dos dados sensíveis, a seção de segurança é a mais detalhada do plano. Vale mais que a de infraestrutura.",
    );
  } else {
    calibragem.push(
      "Não há dados sensíveis. A segurança deve cobrir o básico bem feito — não escreva plano de conformidade nem de auditoria para um sistema que não guarda nada delicado.",
    );
  }

  // --- Integrações externas ---
  if (r.temIntegracoes) {
    exigir.push(
      r.integracoesQuais
        ? `O sistema conversa com serviços externos, especificamente: ${r.integracoesQuais}. Para cada um, diga o que ele resolve aqui e o que acontece quando ele está fora do ar.`
        : "O sistema conversa com serviços externos. Escolha os mínimos necessários, diga o que cada um resolve e o que acontece quando ficam fora do ar.",
    );
  } else {
    proibir.push(
      "O sistema NÃO conversa com serviços externos além do que for estritamente inevitável para funcionar. Não invente integrações.",
    );
  }

  // --- Nível técnico e modo de construir ---
  const usaIa = r.comoConstroi.includes("ia");
  const usaManual = r.comoConstroi.includes("manual");

  if (r.nivelTecnico === "iniciante") {
    calibragem.push(
      "Quem vai construir está começando. Escolha a stack com menos peças móveis possível, prefira serviço gerenciado a infraestrutura própria, e explique cada termo técnico na primeira vez que ele aparecer. Nunca proponha microsserviços, Kubernetes, fila de mensagens ou monorepo.",
    );
  } else if (r.nivelTecnico === "intermediario") {
    calibragem.push(
      "Quem vai construir já entregou coisas antes. Pode usar vocabulário técnico sem explicar o básico, mas continue preferindo o simples: a complexidade precisa se pagar.",
    );
  } else {
    calibragem.push(
      "Quem vai construir programa há bastante tempo. Vá direto ao ponto, sem explicar conceito conhecido. Ainda assim, justifique cada escolha de arquitetura — experiência não é motivo para complicar.",
    );
  }

  if (usaIa && !usaManual) {
    calibragem.push(
      "O código será escrito com ajuda de IA. Prefira tecnologias muito documentadas e populares, porque é onde os modelos acertam mais. Cada etapa precisa ser pequena e verificável o bastante para caber num pedido só.",
    );
  } else if (usaManual && !usaIa) {
    calibragem.push(
      "O código será escrito à mão. Pode agrupar etapas maiores e assumir que quem constrói lê documentação.",
    );
  } else {
    calibragem.push(
      "O código será escrito parte com IA, parte à mão. Marque nas etapas quais são mecânicas (boas para pedir à IA) e quais exigem decisão de quem conhece o projeto.",
    );
  }

  if (r.stackPreferida) {
    exigir.push(
      `A pessoa já decidiu a stack: ${r.stackPreferida}. Use ESTA stack. Se alguma parte dela for inadequada para o projeto, use assim mesmo e explique a ressalva no campo de justificativa — a decisão é dela, não sua.`,
    );
  }

  return { exigir, proibir, calibragem };
}

/** As diretrizes formatadas para entrar no prompt. */
export function diretrizesEmTexto(r: Respostas): string {
  const d = diretrizes(r);
  const partes: string[] = [];

  if (d.exigir.length) {
    partes.push("## O plano PRECISA cobrir", ...d.exigir.map((x) => `- ${x}`));
  }
  if (d.proibir.length) {
    partes.push("", "## O plano NÃO PODE conter", ...d.proibir.map((x) => `- ${x}`));
  }
  if (d.calibragem.length) {
    partes.push("", "## Calibragem", ...d.calibragem.map((x) => `- ${x}`));
  }

  return partes.join("\n");
}

/**
 * Retira do bloco técnico o que as respostas proibiram.
 *
 * Age só sobre `integracoes` e `endpoints`, onde cada item é autocontido e remover um não deixa
 * buraco. Tabelas ficam: uma tabela removida quebraria as relações das outras, e o estrago seria
 * maior que o item indevido.
 */
export function filtrarTecnico<T extends Record<string, unknown>>(dados: T, r: Respostas): T {
  const proibidas: string[] = [];
  if (!r.temPagamentos) proibidas.push(...FAMILIAS.pagamento);
  if (!r.temIa) proibidas.push(...FAMILIAS.ia);
  if (!r.temAutenticacao) proibidas.push(...FAMILIAS.autenticacao);
  if (!r.temUploads) proibidas.push(...FAMILIAS.armazenamento);

  if (proibidas.length === 0) return dados;

  const saida = { ...dados } as Record<string, unknown>;

  const integracoes = saida["integracoes"];
  if (Array.isArray(integracoes)) {
    saida["integracoes"] = integracoes.filter((i) => {
      const item = i as { nome?: string; para?: string };
      return !mencionaFamilia(`${item.nome ?? ""} ${item.para ?? ""}`, proibidas);
    });
  }

  const endpoints = saida["endpoints"];
  if (Array.isArray(endpoints)) {
    saida["endpoints"] = endpoints.filter((e) => {
      const item = e as { caminho?: string; descricao?: string };
      return !mencionaFamilia(`${item.caminho ?? ""} ${item.descricao ?? ""}`, proibidas);
    });
  }

  return saida as T;
}

/**
 * O que passou pelas regras mesmo assim.
 *
 * O filtro não cobre prosa, e fingir que cobre seria pior que não ter filtro: a pessoa confiaria
 * num plano que ainda tem uma seção de pagamentos num projeto sem pagamentos. Isto aparece na
 * tela como aviso, para ela decidir se regera o bloco.
 */
export function avisos(dados: Record<string, unknown>, r: Respostas): string[] {
  const fora: string[] = [];
  const prosa = [
    dados["arquitetura"],
    dados["ia"],
    ...(Array.isArray(dados["seguranca"]) ? dados["seguranca"] : []),
  ]
    .filter((x): x is string => typeof x === "string")
    .join(" ");

  if (!r.temPagamentos && mencionaFamilia(prosa, FAMILIAS.pagamento)) {
    fora.push("O plano ainda menciona pagamentos, e você respondeu que o projeto não cobra.");
  }
  if (!r.temIa && mencionaFamilia(prosa, FAMILIAS.ia)) {
    fora.push("O plano ainda menciona IA, e você respondeu que o projeto não usa.");
  }
  if (!r.temAutenticacao && mencionaFamilia(prosa, FAMILIAS.autenticacao)) {
    fora.push("O plano ainda menciona login, e você respondeu que o projeto não tem contas.");
  }

  return fora;
}
