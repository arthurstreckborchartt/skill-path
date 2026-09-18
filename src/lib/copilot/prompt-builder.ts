import type { Blueprint } from "@/lib/blueprint/contrato";
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
 * modelo que reescreve estas oito linhas a cada prompt vai, alguma hora, esquecer a que mais
 * importa — e a que mais importa é "não altere o que não tem relação".
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

export type EntradaPrompt = {
  destino: Destino;
  tipo: TipoPrompt;
  /** O que a pessoa quer, nas palavras dela. */
  tarefa: string;
  nomeProjeto: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  decisoes: Decisao[];
  estadoBanco: ResumoBanco | null;
  /** O que já está pronto no projeto — vem do motor de próximo passo. */
  jaExiste: string[];
  /** O que não pode ser tocado nesta tarefa. */
  naoAlterar: string[];
};

function secao(titulo: string, linhas: (string | null)[]): string | null {
  const uteis = linhas.filter((l): l is string => Boolean(l && l.trim()));
  return uteis.length === 0 ? null : [`## ${titulo}`, ...uteis].join("\n");
}

export function montarPrompt(e: EntradaPrompt): string {
  const t = e.blueprint.tecnico;
  const secoes: (string | null)[] = [];

  secoes.push(
    secao("CONTEXTO DO PROJETO", [
      `Projeto: ${e.nomeProjeto}`,
      e.blueprint.fundacao?.descricao ?? null,
      e.blueprint.fundacao?.persona
        ? `Quem usa: ${e.blueprint.fundacao.persona.nome}, ${e.blueprint.fundacao.persona.papel}`
        : null,
      `Está sendo construído por uma pessoa só. Cada peça a mais é uma peça a mais para manter.`,
    ]),
  );

  secoes.push(secao("OBJETIVO", [e.tarefa]));

  secoes.push(
    secao("ESTADO ATUAL", [
      e.jaExiste.length > 0
        ? `Já está pronto: ${e.jaExiste.join("; ")}.`
        : "O projeto está começando.",
      e.estadoBanco?.paraOContexto ?? null,
    ]),
  );

  secoes.push(
    secao("STACK", [
      t?.stack.frontend ? `Frontend: ${t.stack.frontend}` : null,
      t?.stack.backend ? `Backend: ${t.stack.backend}` : null,
      t?.stack.banco ? `Banco: ${t.stack.banco}` : null,
      t?.stack.hospedagem ? `Hospedagem: ${t.stack.hospedagem}` : null,
      `Use o que já está aqui. NÃO introduza biblioteca nova sem me perguntar antes.`,
    ]),
  );

  secoes.push(secao("ARQUITETURA", [t?.arquitetura ?? null]));

  secoes.push(
    secao("BANCO DE DADOS", [
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

  secoes.push(
    secao(
      "APIs",
      (e.api?.endpoints ?? []).map((x) => `- ${x.metodo} ${x.caminho} — ${x.finalidade}`),
    ),
  );

  /**
   * A seção de autenticação aparece mesmo vazia, ao contrário das outras.
   *
   * Quando o plano ainda não definiu o método, o silêncio faz a IA externa escolher um por conta
   * — e aí o projeto ganha uma decisão de autenticação que ninguém tomou, escondida dentro de um
   * commit sobre outra coisa. Dizer "não definido, pergunte" custa uma linha e evita isso.
   */
  secoes.push(
    secao("AUTENTICAÇÃO", [
      t?.autenticacao?.metodo
        ? `Método: ${t.autenticacao.metodo}`
        : `O plano ainda NÃO definiu o método de autenticação. NÃO escolha um por conta própria: pergunte antes.`,
      t?.autenticacao?.protecaoDeRotas ?? null,
      t?.autenticacao?.papeis?.length
        ? `Papéis: ${t.autenticacao.papeis.map((p) => p.nome).join(", ")}`
        : null,
    ]),
  );

  secoes.push(
    secao("REGRAS DE SEGURANÇA", [
      ...(t?.seguranca ?? []),
      `Trate tudo que vem do cliente como hostil, inclusive de usuário logado.`,
    ]),
  );

  secoes.push(
    secao("O QUE JÁ EXISTE", [
      ...(e.jaExiste.length > 0 ? e.jaExiste.map((x) => `- ${x}`) : ["- Nada além do plano."]),
      ...(e.decisoes.length > 0
        ? [``, `Decisões técnicas já tomadas, que você deve respeitar:`]
        : []),
      ...e.decisoes.map((d) => `- ${d.chave}: ${d.valor} — ${d.motivo}`),
    ]),
  );

  secoes.push(secao("O QUE PRECISA SER ALTERADO", [e.tarefa]));

  secoes.push(
    secao("O QUE NÃO PODE SER ALTERADO", [
      ...(e.naoAlterar.length > 0 ? e.naoAlterar.map((x) => `- ${x}`) : []),
      ...(e.decisoes.length > 0
        ? e.decisoes.map(
            (d) =>
              `- A decisão sobre ${d.chave} (${d.valor}). Se ela precisar mudar, PARE e me avise.`,
          )
        : []),
      `- Qualquer funcionalidade que já funciona e não tem relação com esta tarefa.`,
    ]),
  );

  secoes.push(secao("TAREFA", [e.tarefa, ...COMO_COMECAR[e.destino].map((x) => `- ${x}`)]));

  secoes.push(
    secao("IMPLEMENTAÇÃO ESPERADA", [
      ...EXIGENCIAS_POR_TIPO[e.tipo].map((x) => `- ${x}`),
      ...REGRAS_COMUNS.map((x) => `- ${x}`),
    ]),
  );

  secoes.push(
    secao("CRITÉRIOS DE ACEITAÇÃO", [
      `- A tarefa acima está resolvida de ponta a ponta.`,
      `- Nada que funcionava antes parou de funcionar.`,
      `- Nenhum arquivo não relacionado foi tocado.`,
      `- Os padrões do projeto foram mantidos.`,
    ]),
  );

  secoes.push(
    secao("TESTES", [
      `- Descreva como testar esta mudança à mão, passo a passo.`,
      `- Se o projeto já tem testes automatizados, acrescente os desta mudança.`,
      `- Cubra pelo menos um caso de erro, não só o caminho feliz.`,
    ]),
  );

  secoes.push(
    secao("VALIDAÇÃO", [
      `- Rode typecheck, lint e build antes de dizer que terminou.`,
      `- Se algo falhar, conserte antes de entregar — não entregue com aviso.`,
    ]),
  );

  secoes.push(
    secao("RESULTADO ESPERADO", [
      `- A lista exata dos arquivos alterados, com o que mudou em cada um.`,
      `- O que você decidiu e por quê, quando houve escolha.`,
      `- O que ficou de fora, se ficou, e por quê.`,
    ]),
  );

  return secoes.filter((s): s is string => s !== null).join("\n\n");
}
