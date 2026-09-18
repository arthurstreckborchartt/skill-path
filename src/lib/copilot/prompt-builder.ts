import type { Blueprint, Etapa } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { Decisao } from "./contrato";
import type { ResumoBanco } from "./estado-banco";

/**
 * O Prompt Builder: transforma o estado real do projeto num pedido que uma IA externa consegue
 * executar sem estragar o que já funciona.
 *
 * ## O problema que ele resolve
 *
 * "Implemente autenticação no meu app" entregue a uma IA de codificação produz, com frequência,
 * uma segunda implementação de autenticação ao lado da que já existia — mais arquivos, mais
 * abstração, e duas fontes de verdade. Não é burrice do modelo: ele não sabia o que já existia,
 * então construiu do zero.
 *
 * O prompt daqui carrega o que existe, o que pode mudar e o que **não** pode. As três coisas.
 *
 * ## Por que ele não passa por IA
 *
 * Pedir a um modelo que escreva o prompt daria markdown bonito e genérico, que esquece o nome do
 * banco da pessoa. O código tem a stack, as tabelas, os endpoints e a etapa atual na mão, e monta
 * a mesma instrução sem gastar um token — e sem variar entre uma geração e outra.
 *
 * ## Por que o destino muda o prompt
 *
 * Não é cosmético. O Claude Code e o Cursor leem o repositório; o ChatGPT não lê nada. Mandar
 * "primeiro inspecione o código existente" para o ChatGPT é pedir o impossível, e o modelo
 * responde inventando o que acha que está lá. Para ele, a instrução equivalente é outra: peça os
 * arquivos antes de escrever.
 */

export const DESTINOS = ["claude", "cursor", "codex", "lovable", "chatgpt", "outro"] as const;
export type Destino = (typeof DESTINOS)[number];

export const ROTULO_DESTINO: Record<Destino, string> = {
  claude: "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  lovable: "Lovable",
  chatgpt: "ChatGPT",
  outro: "Outro",
};

export const TIPOS_PROMPT = [
  "implementacao",
  "debug",
  "refatoracao",
  "banco",
  "api",
  "frontend",
  "backend",
  "seguranca",
  "testes",
  "deploy",
  "documentacao",
] as const;
export type TipoPrompt = (typeof TIPOS_PROMPT)[number];

export const ROTULO_TIPO: Record<TipoPrompt, string> = {
  implementacao: "Implementação",
  debug: "Debug",
  refatoracao: "Refatoração",
  banco: "Banco",
  api: "API",
  frontend: "Frontend",
  backend: "Backend",
  seguranca: "Segurança",
  testes: "Testes",
  deploy: "Deploy",
  documentacao: "Documentação",
};

/**
 * As regras de convivência, iguais em todo prompt.
 *
 * Ficam em código, canônicas, e não são geradas por IA: são a parte que não pode variar. Um
 * modelo que reescreve estas linhas a cada prompt vai, alguma hora, esquecer a que mais importa —
 * e a que mais importa é "não altere o que não tem relação".
 */
const REGRAS_COMUNS = [
  "NÃO duplique funcionalidade que já existe. Se algo parecido já está implementado, estenda em vez de criar do lado.",
  "NÃO crie arquivo novo quando dá para mexer num existente. Arquivo a mais é manutenção a mais para uma pessoa só.",
  "NÃO altere funcionalidade que não tem relação com esta tarefa, nem 'de passagem'.",
  "Respeite os padrões que já estão no código: nomes, estrutura de pastas, estilo, jeito de tratar erro.",
  "Valide antes de concluir: rode o que existir de typecheck, lint e teste.",
  "No fim, diga EXATAMENTE quais arquivos você alterou e o que mudou em cada um.",
];

/** O que cada destino consegue fazer antes de escrever — e o que pedir a ele. */
const COMO_COMECAR: Record<Destino, string[]> = {
  claude: [
    "Antes de escrever qualquer linha: leia os arquivos relacionados e entenda a arquitetura atual.",
    "Faça a menor mudança que resolve. Prefira diff pequeno a reescrita.",
  ],
  cursor: [
    "Antes de escrever: abra e leia os arquivos relacionados; use o índice do codebase para achar o que já existe.",
    "Edite em bloco pequeno. NÃO reescreva o arquivo inteiro quando a mudança é de dez linhas.",
  ],
  codex: [
    "Antes de escrever qualquer linha: leia os arquivos relacionados e entenda a arquitetura atual.",
    "Faça a menor mudança que resolve, e rode o que existir de verificação antes de terminar.",
  ],
  lovable: [
    "Antes de gerar: leia o que já existe no projeto. NÃO regenere a aplicação — a mudança é incremental.",
    "Mexa só nos arquivos ligados a esta tarefa. O resto do app já funciona.",
  ],
  chatgpt: [
    // ChatGPT não lê o repositório: a instrução de inspecionar seria impossível, e ele responderia
    // inventando o que acha que está lá.
    "Você NÃO tem acesso ao meu repositório. Antes de escrever código, PEÇA os arquivos que precisar ver.",
    "Se faltar informação para decidir, pergunte em vez de assumir. Código escrito sobre suposição vai quebrar aqui.",
  ],
  outro: [
    "Antes de escrever: se você tiver acesso ao código, leia os arquivos relacionados. Se não tiver, peça.",
    "Faça a menor mudança que resolve.",
  ],
};

/** O que cada tipo de tarefa exige de específico, além das regras comuns. */
const EXIGENCIAS_POR_TIPO: Record<TipoPrompt, string[]> = {
  implementacao: [
    "Implemente só o que foi pedido. Funcionalidade extra não pedida é escopo a mais para manter.",
  ],
  debug: [
    "Antes de corrigir, explique a CAUSA. Correção sem causa identificada costuma ser sintoma escondido.",
    "Depois de corrigir, diga como reproduzir o bug e como confirmar que sumiu.",
  ],
  refatoracao: [
    "O comportamento não pode mudar. Se algo passar a funcionar diferente, não é refatoração.",
    "Refatore em passos pequenos e verificáveis, não numa reescrita só.",
  ],
  banco: [
    "Toda migração precisa de subida E descida. Migração sem volta é migração que ninguém tem coragem de rodar.",
    "NÃO apague coluna nem tabela sem me avisar antes, explicitamente.",
  ],
  api: [
    "Todo endpoint que mexe em dado de alguém precisa checar QUEM pode chamá-lo.",
    "Documente os erros reais de cada rota, com código estável e mensagem sem jargão.",
  ],
  frontend: [
    "Reutilize os componentes que já existem antes de criar um novo.",
    "Trate os três estados: carregando, vazio e erro. Tela que só desenha o caminho feliz quebra no primeiro uso real.",
  ],
  backend: [
    "Valide toda entrada que vem de fora, inclusive tamanho.",
    "Nunca registre senha, token, cartão ou dado pessoal em log.",
  ],
  seguranca: [
    "Assuma que quem chama é hostil, mesmo autenticado.",
    "NÃO confie em validação feita no cliente: qualquer pessoa abre o devtools e chama a API direto.",
  ],
  testes: [
    "Teste o comportamento, não a implementação. Teste que quebra ao renomear função interna é manutenção sem retorno.",
    "Cubra os casos de borda e o caminho de erro, não só o caminho feliz.",
  ],
  deploy: [
    "NÃO exponha segredo em variável de build que vai para o cliente.",
    "Descreva como reverter, não só como subir.",
  ],
  documentacao: [
    "Documente o PORQUÊ das decisões, não o que o código já diz.",
    "NÃO altere código nesta tarefa. Só documentação.",
  ],
};

/**
 * O alvo do prompt.
 *
 * `etapa` é o caso principal e o que o produto promete: o prompt sai da etapa em que a pessoa
 * está, com a entrega esperada e as dependências já resolvidas. `livre` existe para quando ela
 * quer outra coisa — mas não é o padrão, porque prompt de texto livre é justamente o prompt
 * genérico que este módulo existe para evitar.
 */
export type Alvo = { tipo: "etapa"; etapa: Etapa } | { tipo: "livre"; tarefa: string };

export type EntradaPrompt = {
  destino: Destino;
  tipo: TipoPrompt;
  alvo: Alvo;
  nomeProjeto: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  decisoes: Decisao[];
  estadoBanco: ResumoBanco | null;
  /** O que já está pronto no projeto. */
  jaExiste: string[];
  /** Etapas já concluídas, para o prompt não mandar refazer o que existe. */
  etapasConcluidas: Etapa[];
  progresso: number;
};

function secao(titulo: string, linhas: (string | null | undefined)[]): string | null {
  const uteis = linhas.filter((l): l is string => Boolean(l && l.trim()));
  return uteis.length === 0 ? null : [`## ${titulo}`, ...uteis].join("\n");
}

function objetivoDo(alvo: Alvo): string {
  return alvo.tipo === "etapa" ? alvo.etapa.titulo : alvo.tarefa;
}

export function montarPrompt(e: EntradaPrompt): string {
  const t = e.blueprint.tecnico;
  const objetivo = objetivoDo(e.alvo);
  const secoes: (string | null)[] = [];

  // --- CONTEXTO -------------------------------------------------------------------------------
  secoes.push(
    secao("CONTEXTO", [
      `Projeto: ${e.nomeProjeto}`,
      e.blueprint.fundacao?.descricao,
      e.blueprint.fundacao?.persona
        ? `Quem usa: ${e.blueprint.fundacao.persona.nome}, ${e.blueprint.fundacao.persona.papel}`
        : null,
      `Está sendo construído por uma pessoa só. Cada peça a mais é uma peça a mais para manter.`,
    ]),
  );

  // --- OBJETIVO -------------------------------------------------------------------------------
  secoes.push(
    secao("OBJETIVO", [
      objetivo,
      e.alvo.tipo === "etapa" ? `Entrega esperada: ${e.alvo.etapa.entrega}` : null,
      e.alvo.tipo === "etapa" ? `Fase do projeto: ${e.alvo.etapa.fase}` : null,
    ]),
  );

  // --- ESTADO ATUAL ---------------------------------------------------------------------------
  secoes.push(
    secao("ESTADO ATUAL", [
      `Progresso do projeto: ${e.progresso}%`,
      e.alvo.tipo === "etapa"
        ? `Esta é a etapa ${e.alvo.etapa.ordem} da trilha de execução.`
        : null,
      e.jaExiste.length > 0
        ? `Já está pronto no plano: ${e.jaExiste.join("; ")}.`
        : "O projeto está começando.",
      /**
       * As etapas concluídas entram pelo nome.
       *
       * É o que impede o pedido mais caro que uma IA externa pode atender: reimplementar do zero
       * algo que a pessoa já construiu, porque ninguém disse que aquilo existia.
       */
      e.etapasConcluidas.length > 0
        ? `Etapas JÁ CONCLUÍDAS (não refaça): ${e.etapasConcluidas.map((x) => `${x.ordem}. ${x.titulo}`).join("; ")}.`
        : null,
      e.estadoBanco?.paraOContexto,
    ]),
  );

  // --- ARQUITETURA ----------------------------------------------------------------------------
  secoes.push(
    secao("ARQUITETURA", [
      t?.arquitetura,
      t ? `Frontend: ${t.stack.frontend}` : null,
      t ? `Backend: ${t.stack.backend}` : null,
      t ? `Banco: ${t.stack.banco}` : null,
      t ? `Hospedagem: ${t.stack.hospedagem}` : null,
      `Use o que já está aqui. NÃO introduza biblioteca nova sem me perguntar antes.`,
      ...(e.api?.endpoints ?? []).map((x) => `- ${x.metodo} ${x.caminho} — ${x.finalidade}`),
    ]),
  );

  // --- BANCO ----------------------------------------------------------------------------------
  secoes.push(
    secao("BANCO", [
      ...(e.modelo?.entidades ?? []).map(
        (x) => `- ${x.nome}: ${x.colunas.map((c) => c.nome).join(", ")}`,
      ),
      // Sem esta linha, a IA externa escreve código que consulta tabela que ninguém criou — e o
      // erro só aparece em runtime, longe daqui.
      e.estadoBanco && e.estadoBanco.faltam > 0
        ? `ATENÇÃO: ${e.estadoBanco.faltam} destas tabelas ainda NÃO existem no banco. São planejadas.`
        : null,
    ]),
  );

  // --- REQUISITOS -----------------------------------------------------------------------------
  /**
   * Requisito não funcional entra com o `comoMedir` junto, sempre.
   *
   * "O sistema deve ser rápido" não serve para nada; "a tela de vendas abre em menos de 1s num
   * celular de entrada" é um alvo que dá para conferir. Mandar o primeiro faz a IA externa
   * escrever otimização por intuição, na parte errada.
   */
  secoes.push(
    secao("REQUISITOS", [
      ...(e.blueprint.operacao?.requisitosNaoFuncionais ?? [])
        .slice(0, 6)
        .map((r) => `- ${r.descricao} — como medir: ${r.comoMedir}`),
      e.alvo.tipo === "etapa" && e.alvo.etapa.dependeDe.length > 0
        ? `Esta etapa depende das etapas ${e.alvo.etapa.dependeDe.join(", ")}, que devem estar prontas antes.`
        : null,
    ]),
  );

  // --- RESTRIÇÕES -----------------------------------------------------------------------------
  secoes.push(
    secao("RESTRIÇÕES", [
      ...COMO_COMECAR[e.destino].map((x) => `- ${x}`),
      ...REGRAS_COMUNS.map((x) => `- ${x}`),
      ...e.decisoes.map((d) => `- Respeite a decisão sobre ${d.chave}: ${d.valor} (${d.motivo}).`),
    ]),
  );

  // --- IMPLEMENTAÇÃO --------------------------------------------------------------------------
  secoes.push(
    secao("IMPLEMENTAÇÃO", [
      `Tipo de trabalho: ${ROTULO_TIPO[e.tipo]}.`,
      ...EXIGENCIAS_POR_TIPO[e.tipo].map((x) => `- ${x}`),
    ]),
  );

  // --- CRITÉRIOS DE ACEITAÇÃO -----------------------------------------------------------------
  secoes.push(
    secao("CRITÉRIOS DE ACEITAÇÃO", [
      e.alvo.tipo === "etapa"
        ? `- A entrega desta etapa existe e funciona: ${e.alvo.etapa.entrega}`
        : `- O objetivo acima está resolvido de ponta a ponta.`,
      `- Nada que funcionava antes parou de funcionar.`,
      `- Nenhum arquivo não relacionado foi tocado.`,
      `- Os padrões do projeto foram mantidos.`,
    ]),
  );

  // --- TESTES ---------------------------------------------------------------------------------
  secoes.push(
    secao("TESTES", [
      `- Descreva como testar esta mudança à mão, passo a passo.`,
      `- Se o projeto já tem testes automatizados, acrescente os desta mudança.`,
      `- Cubra pelo menos um caso de erro, não só o caminho feliz.`,
      `- Rode typecheck, lint e build antes de dizer que terminou. Se falhar, conserte antes de entregar.`,
    ]),
  );

  // --- SEGURANÇA ------------------------------------------------------------------------------
  secoes.push(
    secao("SEGURANÇA", [
      t?.autenticacao?.metodo
        ? `Autenticação do projeto: ${t.autenticacao.metodo}. ${t.autenticacao.protecaoDeRotas ?? ""}`.trim()
        : `O plano ainda NÃO definiu o método de autenticação. NÃO escolha um por conta própria: pergunte antes.`,
      t?.autenticacao?.papeis?.length
        ? `Papéis: ${t.autenticacao.papeis.map((p) => p.nome).join(", ")}`
        : null,
      ...(t?.seguranca ?? []).map((x) => `- ${x}`),
      `- Trate tudo que vem do cliente como hostil, inclusive de usuário logado.`,
    ]),
  );

  // --- NÃO ALTERAR ----------------------------------------------------------------------------
  secoes.push(
    secao("NÃO ALTERAR", [
      ...e.etapasConcluidas.map((x) => `- A etapa ${x.ordem} (${x.titulo}), que já está entregue.`),
      ...e.decisoes.map(
        (d) => `- A decisão sobre ${d.chave} (${d.valor}). Se ela precisar mudar, PARE e me avise.`,
      ),
      `- Qualquer funcionalidade que já funciona e não tem relação com esta tarefa.`,
      `- Configuração de build, deploy e variáveis de ambiente, salvo pedido explícito.`,
    ]),
  );

  // --- RESULTADO ESPERADO ---------------------------------------------------------------------
  secoes.push(
    secao("RESULTADO ESPERADO", [
      `- A lista exata dos arquivos alterados, com o que mudou em cada um.`,
      `- O que você decidiu e por quê, quando houve escolha.`,
      `- O que ficou de fora, se ficou, e por quê.`,
      `- Como eu confiro que está pronto.`,
    ]),
  );

  return secoes.filter((s): s is string => s !== null).join("\n\n");
}

/**
 * A etapa que o prompt deve mirar.
 *
 * `etapa_atual` do projeto quando ela existe na trilha; senão, a primeira não concluída. O
 * fallback importa: projeto que regerou a execução pode ter `etapa_atual` apontando para uma
 * ordem que não existe mais, e devolver `null` ali esconderia o recurso inteiro da pessoa.
 */
export function etapaAlvo(blueprint: Blueprint, etapaAtual: number): Etapa | null {
  const etapas = blueprint.execucao?.etapas ?? [];
  if (etapas.length === 0) return null;
  return etapas.find((x) => x.ordem === etapaAtual) ?? etapas[0] ?? null;
}

/** As etapas já entregues, pela ordem da trilha. Entram no prompt como "não refaça". */
export function etapasConcluidas(blueprint: Blueprint, quantasConcluidas: number): Etapa[] {
  const etapas = blueprint.execucao?.etapas ?? [];
  return [...etapas].sort((a, b) => a.ordem - b.ordem).slice(0, Math.max(0, quantasConcluidas));
}
