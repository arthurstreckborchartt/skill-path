import type { ModeloDeDados } from "./contrato";
import { ROTULO_TIPO } from "./contrato";
import { gerarSql, ROTULO_DIALETO, type Dialeto } from "./dialetos";
import type { Achado } from "./diagnostico";

/**
 * Os prompts prontos para colar numa IA de código, e o checklist de validação.
 *
 * Montados por código a partir do modelo, e não gerados pela IA junto com ele. Duas razões:
 *
 * 1. **O prompt precisa conter o schema exato.** Um prompt escrito pela IA descreveria o modelo
 *    com as palavras dela, e a IA do outro lado reconstruiria algo parecido — não igual. Aqui o
 *    SQL vai literal.
 * 2. **Trocar de dialeto tem que refazer o prompt.** Como o prompt é derivado, mudar de Postgres
 *    para MySQL na tela já entrega o prompt certo, sem nova geração.
 */

export type PromptPronto = {
  id: string;
  titulo: string;
  /** Para que serve, em uma linha. */
  para: string;
  texto: string;
};

function resumoDoModelo(m: ModeloDeDados): string {
  return m.entidades
    .map((e) => {
      const cols = e.colunas
        .map((c) => {
          const marcas: string[] = [];
          if (e.chavePrimaria.includes(c.nome)) marcas.push("PK");
          if (c.unica) marcas.push("único");
          if (c.obrigatoria) marcas.push("obrigatório");
          if (c.sensivel) marcas.push("SENSÍVEL");
          return `    - ${c.nome} (${ROTULO_TIPO[c.tipoLogico]}${marcas.length ? `, ${marcas.join(", ")}` : ""})`;
        })
        .join("\n");
      return `  ${e.nome} — ${e.descricao}\n${cols}`;
    })
    .join("\n\n");
}

function relacoesEmTexto(m: ModeloDeDados): string {
  if (m.relacoes.length === 0) return "  (nenhuma)";
  return m.relacoes
    .map(
      (r) =>
        `  - ${r.de}.${r.coluna} aponta para ${r.para} (${r.cardinalidade}, ao apagar: ${r.aoApagarPai})`,
    )
    .join("\n");
}

export function gerarPrompts(
  m: ModeloDeDados,
  d: Dialeto,
  nomeProjeto: string,
  achados: Achado[],
): PromptPronto[] {
  const { sql } = gerarSql(m, d);
  const banco = ROTULO_DIALETO[d];
  const sensiveis = m.entidades.flatMap((e) =>
    e.colunas.filter((c) => c.sensivel).map((c) => `${e.nome}.${c.nome}`),
  );

  const prompts: PromptPronto[] = [
    {
      id: "migration",
      titulo: "Criar a migration",
      para: "Transformar o schema numa migration da sua ferramenta.",
      texto: `Crie a migration inicial do banco de dados do projeto "${nomeProjeto}", usando ${banco}.

Este é o schema exato que ela precisa produzir:

\`\`\`sql
${sql}
\`\`\`

Regras:
- Use a ferramenta de migration que já existe neste projeto. Se não houver nenhuma, me pergunte qual usar antes de escrever.
- A migration precisa ter subida E descida. A descida derruba as tabelas na ordem inversa.
- Não altere nomes de tabela, de coluna, nem tipos. Se algum tipo não existir em ${banco}, use o equivalente mais próximo e me avise qual trocou e por quê.
- Não adicione tabela, coluna nem índice que não esteja acima.`,
    },
    {
      id: "modelos",
      titulo: "Gerar os modelos de dados",
      para: "Criar as classes, entidades ou tipos que o código usa.",
      texto: `Gere os modelos de dados do projeto "${nomeProjeto}" a partir deste schema de ${banco}.

Tabelas:

${resumoDoModelo(m)}

Relacionamentos:

${relacoesEmTexto(m)}

Regras:
- Use o ORM ou a biblioteca de acesso a dados que já existe neste projeto. Se não houver, me pergunte antes.
- Declare os relacionamentos nos dois lados quando a ferramenta permitir.
- Campos marcados como SENSÍVEL não podem aparecer em nenhuma serialização padrão — deixe-os fora do que é devolvido por API a menos que eu peça explicitamente.
- Não invente campo que não está na lista.`,
    },
    {
      id: "seed",
      titulo: "Criar dados de exemplo",
      para: "Popular o banco para conseguir testar as telas.",
      texto: `Escreva um script de seed para o banco do projeto "${nomeProjeto}" (${banco}).

Schema:

\`\`\`sql
${sql}
\`\`\`

Regras:
- Crie dados que façam sentido para o negócio deste projeto, em português do Brasil, com nomes e valores brasileiros realistas.
- Respeite a ordem das chaves estrangeiras: insira o pai antes do filho.
- Volume pequeno: o suficiente para ver as telas funcionando, não para teste de carga.
- Nenhum dado real de pessoa real. Nada de CPF válido de verdade.
- O script precisa poder rodar duas vezes sem quebrar.`,
    },
  ];

  if (achados.length > 0) {
    prompts.push({
      id: "corrigir",
      titulo: "Corrigir os problemas encontrados",
      para: "Resolver o que o diagnóstico apontou neste modelo.",
      texto: `Ajuste o schema do projeto "${nomeProjeto}" (${banco}) para corrigir os problemas abaixo.

Schema atual:

\`\`\`sql
${sql}
\`\`\`

Problemas a corrigir, em ordem de importância:

${achados.map((a, i) => `${i + 1}. [${a.gravidade}] ${a.titulo}\n   Consequência: ${a.consequencia}\n   Correção sugerida: ${a.correcao}`).join("\n\n")}

Regras:
- Entregue o SQL das alterações, não o schema inteiro reescrito.
- Se discordar de alguma correção, diga por quê em vez de aplicá-la calado.
- Não mude nada que não esteja na lista.`,
    });
  }

  if (sensiveis.length > 0) {
    prompts.push({
      id: "protecao",
      titulo: "Proteger os dados sensíveis",
      para: "Restringir acesso aos campos pessoais deste banco.",
      texto: `Implemente a proteção dos dados pessoais no banco do projeto "${nomeProjeto}" (${banco}).

Campos marcados como sensíveis:

${sensiveis.map((s) => `- ${s}`).join("\n")}

Schema:

\`\`\`sql
${sql}
\`\`\`

Preciso de:
- Controle de acesso no nível do banco quando ${banco} suportar (no PostgreSQL, Row Level Security e grants por coluna).
- Uma consulta ou view que devolva os dados já sem os campos sensíveis, para as telas que não precisam deles.
- O que fazer quando alguém pedir exclusão dos dados pela LGPD: quais linhas apagar, quais anonimizar e o que precisa ser mantido por obrigação legal.
- Diga claramente o que ${banco} NÃO consegue garantir e precisa ser feito na aplicação.`,
    });
  }

  return prompts;
}

export type ItemValidacao = {
  texto: string;
  /** Como conferir, concretamente. */
  como: string;
};

/**
 * O checklist de validação, derivado do modelo.
 *
 * Cada item é verificável executando alguma coisa, não lendo o schema de novo. "Confira se as
 * chaves estrangeiras estão certas" não é checklist — é um pedido para reler tudo.
 */
export function gerarChecklist(m: ModeloDeDados, d: Dialeto, achados: Achado[]): ItemValidacao[] {
  const itens: ItemValidacao[] = [
    {
      texto: "O script rodou do começo ao fim sem erro",
      como: "Rode o SQL num banco vazio. Qualquer erro no meio deixa o banco pela metade — recomece do zero em vez de corrigir por cima.",
    },
    {
      texto: `As ${m.entidades.length} tabelas existem`,
      como:
        d === "postgres"
          ? "`\\dt` no psql, ou consulte `information_schema.tables`."
          : d === "mysql"
            ? "`SHOW TABLES;`"
            : "`.tables` no shell do SQLite.",
    },
  ];

  if (m.relacoes.length > 0) {
    const r = m.relacoes[0]!;
    itens.push({
      texto: "As chaves estrangeiras recusam id inexistente",
      como: `Tente inserir uma linha em \`${r.de}\` com \`${r.coluna}\` apontando para um id que não existe em \`${r.para}\`. O banco tem que recusar. Se aceitar${d === "sqlite" ? ", provavelmente falta `PRAGMA foreign_keys = ON;`" : ", a chave estrangeira não foi criada"}.`,
    });
  }

  const unicas = m.entidades.flatMap((e) =>
    e.colunas.filter((c) => c.unica).map((c) => ({ tabela: e.nome, coluna: c.nome })),
  );
  if (unicas.length > 0) {
    const u = unicas[0]!;
    itens.push({
      texto: "Os campos únicos recusam duplicata",
      como: `Insira duas linhas em \`${u.tabela}\` com o mesmo \`${u.coluna}\`. A segunda tem que falhar.`,
    });
  }

  if (m.restricoes.length > 0) {
    const r = m.restricoes[0]!;
    itens.push({
      texto: "As regras de valor estão valendo",
      como: `Tente inserir em \`${r.tabela}\` um valor que viole \`${r.expressao}\`. O banco tem que recusar.`,
    });
  }

  const comTimestamp = m.entidades.find((e) => e.temTimestamps);
  if (comTimestamp) {
    itens.push({
      texto: "As datas se preenchem sozinhas",
      como: `Insira uma linha em \`${comTimestamp.nome}\` sem informar \`criado_em\`. O campo tem que vir preenchido.`,
    });
  }

  const comEnum = m.entidades.flatMap((e) =>
    e.colunas
      .filter((c) => c.tipoLogico === "enum")
      .map((c) => ({ tabela: e.nome, coluna: c.nome, valores: c.enumValores })),
  );
  if (comEnum.length > 0) {
    const x = comEnum[0]!;
    itens.push({
      texto: "As listas fechadas recusam valor fora da lista",
      como: `Tente gravar \`"valor_invalido"\` em \`${x.tabela}.${x.coluna}\`. Só ${x.valores.join(", ")} deveriam passar.`,
    });
  }

  const sensiveis = m.entidades.flatMap((e) => e.colunas.filter((c) => c.sensivel));
  if (sensiveis.length > 0) {
    itens.push({
      texto: "Os dados sensíveis não saem por acidente",
      como: `Chame a API que lista ${m.entidades.find((e) => e.colunas.some((c) => c.sensivel))?.nome} e confira, no JSON devolvido, que nenhum dos ${sensiveis.length} campos sensíveis aparece sem você ter pedido.`,
    });
  }

  if (achados.filter((a) => a.gravidade === "alto").length > 0) {
    itens.push({
      texto: "Os problemas de gravidade alta foram resolvidos",
      como: "Volte na aba de diagnóstico e confira que a lista de alto está vazia. Os de gravidade média podem esperar; os altos, não.",
    });
  }

  return itens;
}
