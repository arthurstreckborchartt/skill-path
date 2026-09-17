import type { ModeloDeDados } from "./contrato";
import type { Respostas } from "@/lib/blueprint/respostas";

/**
 * Detecção de problemas no modelo de dados.
 *
 * ## Por que isto é código e não uma pergunta à IA
 *
 * "Aponte os problemas deste schema" devolve uma lista plausível que muda a cada execução: numa
 * vez ele vê a FK sem índice, na outra não. Para um aviso que a pessoa vai usar para decidir se
 * o banco dela está pronto, "às vezes" não serve.
 *
 * Tudo aqui é verificável no modelo: ou a FK tem índice, ou não tem. A checagem roda igual toda
 * vez, e falha para o lado de avisar — um falso positivo custa uma leitura, um falso negativo
 * custa uma migration em produção.
 *
 * Mesmo princípio de `blueprint/regras.ts`.
 */

export type Gravidade = "alto" | "medio" | "baixo";

export type Achado = {
  gravidade: Gravidade;
  /** Onde o problema está, para a tela destacar. */
  tabela: string | null;
  titulo: string;
  /** O que acontece se ficar assim. Concreto, não "pode causar problemas". */
  consequencia: string;
  /** O que fazer. Uma ação, não um conselho. */
  correcao: string;
};

/** Nomes que quase sempre guardam dado pessoal, para conferir o que ficou sem marcação. */
const PISTAS_SENSIVEIS = [
  "cpf",
  "cnpj",
  "rg",
  "passaporte",
  "email",
  "e_mail",
  "telefone",
  "celular",
  "endereco",
  "cep",
  "nascimento",
  "aniversario",
  "cartao",
  "senha",
  "password",
  "salario",
  "renda",
  "saude",
  "diagnostico",
  "medico",
  "biometria",
  "localizacao",
  "latitude",
  "longitude",
];

function semAcento(t: string): string {
  let saida = "";
  for (const c of t.toLowerCase().normalize("NFD")) {
    const n = c.codePointAt(0) ?? 0;
    if (n >= 0x300 && n <= 0x36f) continue;
    saida += c;
  }
  return saida;
}

export function diagnosticar(m: ModeloDeDados, r: Respostas): Achado[] {
  const achados: Achado[] = [];

  // --- Chave primária ausente ---
  for (const e of m.entidades) {
    if (e.chavePrimaria.length === 0) {
      achados.push({
        gravidade: "alto",
        tabela: e.nome,
        titulo: "Tabela sem chave primária",
        consequencia:
          "Sem chave primária você não consegue atualizar nem apagar uma linha específica com segurança, e linhas idênticas duplicadas passam a existir sem jeito de distinguir.",
        correcao: `Adicione uma coluna \`id\` como chave primária em \`${e.nome}\`.`,
      });
    }
  }

  // --- Índice faltando em chave estrangeira ---
  for (const rel of m.relacoes) {
    const temIndice =
      m.indices.some((i) => i.tabela === rel.de && i.colunas[0] === rel.coluna) ||
      m.entidades.find((e) => e.nome === rel.de)?.chavePrimaria[0] === rel.coluna;

    if (!temIndice) {
      achados.push({
        gravidade: "medio",
        tabela: rel.de,
        titulo: `Falta índice em ${rel.de}.${rel.coluna}`,
        consequencia: `Toda busca de "${rel.de} de um ${rel.para}" vai ler a tabela inteira. Com poucas linhas ninguém nota; com dezenas de milhares, a tela trava.`,
        correcao: `Crie um índice em \`${rel.de} (${rel.coluna})\`. É a correção mais barata desta lista.`,
      });
    }
  }

  // --- Dado sensível sem marcação ---
  for (const e of m.entidades) {
    for (const c of e.colunas) {
      const nome = semAcento(c.nome);
      const pareceSensivel = PISTAS_SENSIVEIS.some((p) => nome.includes(p));
      if (!pareceSensivel || c.sensivel) continue;

      /**
       * Hash de senha tem mensagem própria.
       *
       * Ele também precisa ser marcado — vazar hash é vazar material para ataque de dicionário —
       * mas dizer "parece dado pessoal" faria parecer que o modelo errou ao usar hash, quando ele
       * acertou. Uma checagem que repreende a decisão certa perde a confiança de quem lê.
       */
      const ehHashDeSenha =
        nome.includes("hash") && (nome.includes("senha") || nome.includes("password"));

      achados.push({
        gravidade: "alto",
        tabela: e.nome,
        titulo: ehHashDeSenha
          ? `${e.nome}.${c.nome} precisa ser marcado como sensível`
          : `${e.nome}.${c.nome} parece dado pessoal e não está marcado`,
        consequencia: ehHashDeSenha
          ? "Guardar o hash em vez da senha está certo, mas ele ainda não pode sair do banco: com o hash em mãos, um ataque de dicionário roda offline, sem limite de tentativas."
          : "Dado pessoal sem marcação escapa das regras de acesso, de anonimização e de exclusão que a LGPD exige. O vazamento costuma acontecer por uma consulta que ninguém lembrou que trazia esse campo.",
        correcao: ehHashDeSenha
          ? `Marque \`${c.nome}\` como sensível e garanta que ela nunca entre numa resposta de API — nem em \`select *\`.`
          : `Marque \`${c.nome}\` como sensível e decida quem pode lê-la.`,
      });
    }
  }

  // --- Senha em texto ---
  for (const e of m.entidades) {
    for (const c of e.colunas) {
      const nome = semAcento(c.nome);
      if ((nome.includes("senha") || nome.includes("password")) && !nome.includes("hash")) {
        achados.push({
          gravidade: "alto",
          tabela: e.nome,
          titulo: `${e.nome}.${c.nome} sugere senha guardada direto`,
          consequencia:
            "Senha em texto transforma qualquer vazamento de banco em vazamento de contas — inclusive nos outros sites onde a pessoa repetiu a senha.",
          correcao: `Renomeie para \`senha_hash\` e guarde só o resultado de um algoritmo de hash com sal (bcrypt ou argon2). Nunca a senha.`,
        });
      }
    }
  }

  // --- Sem timestamps ---
  const semTempo = m.entidades.filter((e) => !e.temTimestamps);
  if (semTempo.length > 0) {
    achados.push({
      gravidade: "baixo",
      tabela: semTempo.length === 1 ? semTempo[0]!.nome : null,
      titulo: `${semTempo.length === 1 ? "Uma tabela" : `${semTempo.length} tabelas`} sem data de criação`,
      consequencia:
        "Sem `criado_em` você não consegue responder quando algo entrou, ordenar por mais recente, nem investigar um problema olhando o que mudou naquele dia.",
      correcao: `Ligue os timestamps em ${semTempo.map((e) => `\`${e.nome}\``).join(", ")}. Custa duas colunas e você nunca mais precisa disso.`,
    });
  }

  // --- Unicidade faltando em campo de login ---
  if (r.temAutenticacao) {
    for (const e of m.entidades) {
      for (const c of e.colunas) {
        const nome = semAcento(c.nome);
        const ehLogin =
          nome === "email" || nome === "e_mail" || nome === "usuario" || nome === "login";
        if (ehLogin && !c.unica) {
          achados.push({
            gravidade: "alto",
            tabela: e.nome,
            titulo: `${e.nome}.${c.nome} deveria ser único`,
            consequencia:
              "Sem unicidade, duas contas podem ser criadas com o mesmo e-mail. Na hora do login o sistema não sabe qual é qual, e a recuperação de senha passa a poder tomar a conta errada.",
            correcao: `Marque \`${c.nome}\` como única. O banco passa a recusar a duplicata mesmo que o código deixe passar.`,
          });
        }
      }
    }
  }

  // --- Sem constraint nenhuma ---
  if (
    m.restricoes.length === 0 &&
    m.entidades.some((e) =>
      e.colunas.some((c) => c.tipoLogico === "dinheiro" || c.tipoLogico === "inteiro"),
    )
  ) {
    achados.push({
      gravidade: "medio",
      tabela: null,
      titulo: "Nenhuma regra de valor no banco",
      consequencia:
        "Preço negativo, quantidade negativa e data de fim antes do início entram no banco sem reclamação. Um bug no código vira dado estragado que fica lá para sempre.",
      correcao:
        "Adicione CHECK nas colunas numéricas que têm faixa conhecida — `preco >= 0` já evita a maior parte dos casos.",
    });
  }

  // --- Excesso de complexidade ---
  if (m.entidades.length > 12) {
    achados.push({
      gravidade: "medio",
      tabela: null,
      titulo: `${m.entidades.length} tabelas para um MVP`,
      consequencia:
        "Cada tabela é um CRUD, uma tela e um conjunto de testes. Acima de doze, o tempo até o primeiro usuário real costuma passar do ponto em que o projeto é abandonado.",
      correcao:
        "Veja quais podem esperar. Tabela que só existe para uma funcionalidade marcada como 'depois' não precisa existir agora.",
    });
  }

  // --- Tabela com colunas demais ---
  for (const e of m.entidades) {
    if (e.colunas.length > 20) {
      achados.push({
        gravidade: "baixo",
        tabela: e.nome,
        titulo: `${e.nome} tem ${e.colunas.length} colunas`,
        consequencia:
          "Tabela muito larga normalmente está guardando duas coisas diferentes juntas, e toda consulta passa a carregar campos que ninguém pediu.",
        correcao: `Veja se dá para separar parte de \`${e.nome}\` numa tabela ligada por 1:1.`,
      });
    }
  }

  // --- N:N sem tabela de ligação ---
  for (const rel of m.relacoes) {
    if (rel.cardinalidade === "N:N") {
      const ligacao = m.entidades.find(
        (e) =>
          m.relacoes.filter((x) => x.de === e.nome).length >= 2 &&
          e.nome.includes(rel.de.slice(0, 4)) === false,
      );
      if (!ligacao) {
        achados.push({
          gravidade: "medio",
          tabela: rel.de,
          titulo: `Relação N:N entre ${rel.de} e ${rel.para} sem tabela de ligação`,
          consequencia:
            "Banco relacional não representa muitos-para-muitos com uma coluna. Sem uma tabela no meio, ou os dados viram lista dentro de um campo ou a relação se perde.",
          correcao: `Crie uma tabela \`${rel.de}_${rel.para}\` com as duas chaves estrangeiras e chave primária composta.`,
        });
      }
    }
  }

  // --- Coluna que parece lista dentro de um campo ---
  for (const e of m.entidades) {
    for (const c of e.colunas) {
      const nome = semAcento(c.nome);
      const pareceLista =
        (c.tipoLogico === "texto" || c.tipoLogico === "json") &&
        (nome.endsWith("s_ids") || nome.endsWith("_lista") || nome.endsWith("_ids"));
      if (pareceLista) {
        achados.push({
          gravidade: "medio",
          tabela: e.nome,
          titulo: `${e.nome}.${c.nome} guarda uma lista dentro de um campo`,
          consequencia:
            "Guardar ids separados por vírgula impede o banco de garantir que eles existem, impede índice e transforma qualquer busca por um deles numa varredura de texto.",
          correcao: `Substitua por uma tabela de ligação. É mais trabalho agora e muito menos depois.`,
        });
      }
    }
  }

  // Alto primeiro: a ordem da lista é a ordem em que vale a pena resolver.
  const peso: Record<Gravidade, number> = { alto: 0, medio: 1, baixo: 2 };
  return achados.sort((a, b) => peso[a.gravidade] - peso[b.gravidade]);
}

export function contarPorGravidade(achados: Achado[]): Record<Gravidade, number> {
  return {
    alto: achados.filter((a) => a.gravidade === "alto").length,
    medio: achados.filter((a) => a.gravidade === "medio").length,
    baixo: achados.filter((a) => a.gravidade === "baixo").length,
  };
}
