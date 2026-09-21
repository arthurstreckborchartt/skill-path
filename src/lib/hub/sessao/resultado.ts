import type { Origem, RegistroDeTrabalho, Resposta } from "../ia/retorno";
import { registrosDoRetorno, type RetornoEstruturado } from "../ia/retorno";

/**
 * O resultado que volta da ferramenta.
 *
 * ## Três níveis de prova, e por que três
 *
 * O Pathly já distinguia dois: o que a ferramenta reportou (`ferramenta`) e o que a pessoa contou
 * (`pessoa`). Trabalhar com ferramenta local revelou um terceiro caso, que não é nem um nem outro:
 * **a ferramenta escreveu o bloco, a pessoa colou**.
 *
 * Não é relato — o texto é da ferramenta, com o detalhe que só quem executou tem. E não é leitura
 * direta — o Pathly não viu acontecer, e o caminho passou por um `Ctrl+C` que pode ter recortado
 * metade. Chamar isso de qualquer um dos dois seria errar em uma direção conhecida.
 *
 * Então: `colado`. Vale mais que um relato e menos que um canal. A tela diz qual é qual, e o
 * histórico guarda.
 *
 * ## Por que existe um parser, em vez de campos
 *
 * Porque o brief **pede** o bloco de volta (`EXPECTED RESULT`), e uma ferramenta sem API ainda
 * assim escreve o bloco. Pedir e analisar é o único caminho que transforma retorno estruturado em
 * algo real para Cursor, Codex e Claude Code — que são três das quatro.
 *
 * O parser é deliberadamente tolerante com a forma e rígido com o conteúdo: aceita `## STATUS`,
 * `**STATUS:**` e `STATUS —`, porque modelos formatam diferente e brigar com isso é perder; mas
 * não adivinha campo ausente, porque campo ausente é informação.
 */

export const STATUS = ["sucesso", "parcial", "falhou", "bloqueado"] as const;
export type Status = (typeof STATUS)[number];

export const ROTULO_STATUS: Record<Status, string> = {
  sucesso: "Concluído",
  parcial: "Parcial",
  falhou: "Falhou",
  bloqueado: "Bloqueado",
};

export const EXPLICACAO_STATUS: Record<Status, string> = {
  sucesso: "A ferramenta diz que fez tudo que a tarefa pedia.",
  parcial: "Parte foi feita. O que ficou de fora vira o próximo passo.",
  falhou: "A tentativa não deu certo. O que falhou entra no contexto da próxima.",
  bloqueado: "A ferramenta parou por algo fora do alcance dela — falta decisão, acesso ou dado.",
};

export const CAMPOS = [
  "STATUS",
  "CHANGES",
  "FILES",
  "TESTS",
  "ERRORS",
  "DECISIONS",
  "NEXT_STEP",
] as const;

export type Campo = (typeof CAMPOS)[number];

export type ResultadoDaSessao = {
  status: Status;
  changes: string[];
  files: string[];
  tests: string[];
  errors: string[];
  decisions: string[];
  nextStep: string;
  /** Os cabeçalhos que a ferramenta não escreveu. A tela mostra — ausência é informação. */
  camposAusentes: Campo[];
  origem: Origem;
  /** O texto cru, guardado inteiro. Quando o parser errar, a verdade ainda está aqui. */
  bruto: string;
};

/*
 * "nenhum", "nenhuma", "n/a", "-": a ferramenta respondeu, e a resposta é vazio. Diferente de não
 * ter escrito o cabeçalho — por isso o campo não entra em `camposAusentes`, mas a lista fica
 * vazia. A distinção importa: "não rodei teste nenhum" é uma afirmação; silêncio não é.
 */
const VAZIOS = /^(nenhum|nenhuma|nada|n\/a|na|none|-|—|nenhum\.)$/i;

/**
 * Acha onde cada cabeçalho começa.
 *
 * Tolera `#`, `*`, `_`, `-` e espaço antes; `:`, `—`, `-` e espaço depois; e aceita o valor na
 * mesma linha ou na seguinte. O que ele **não** aceita é o cabeçalho no meio de uma frase: a
 * âncora `^` é obrigatória, senão a palavra "ERRORS" dentro de uma explicação abriria uma seção
 * e engoliria o resto do bloco.
 */
function acharCabecalhos(texto: string): { campo: Campo; linha: number; resto: string }[] {
  const linhas = texto.split(/\r?\n/);
  const achados: { campo: Campo; linha: number; resto: string }[] = [];

  linhas.forEach((linha, i) => {
    for (const campo of CAMPOS) {
      /* `NEXT_STEP` também aparece como `NEXT STEP`: o underscore some em quase toda formatação. */
      const nome = campo.replace("_", "[ _]?");
      const re = new RegExp(`^[\\s#*_>-]*${nome}\\s*[:—-]?\\s*(.*)$`, "i");
      const m = re.exec(linha);
      if (m) {
        achados.push({ campo, linha: i, resto: (m[1] ?? "").trim() });
        break;
      }
    }
  });

  return achados;
}

function itens(bloco: string): string[] {
  return bloco
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s*_>-]*[-*•]?\s*/, "").trim())
    .filter((l) => l.length > 0 && !VAZIOS.test(l));
}

export type Analise = { ok: true; resultado: ResultadoDaSessao } | { ok: false; motivo: string };

/**
 * Analisa o bloco que a ferramenta escreveu.
 *
 * `origem` é parâmetro porque o mesmo texto pode chegar por dois caminhos: lido da API
 * (`ferramenta`) ou colado pela pessoa (`colado`). Deduzir aqui seria adivinhar; quem chama sabe.
 */
export function analisarResultado(texto: string, origem: Origem): Analise {
  const bruto = texto.trim();
  if (!bruto) return { ok: false, motivo: "Cole o bloco de resultado que a ferramenta escreveu." };

  const achados = acharCabecalhos(bruto);
  if (achados.length === 0) {
    return {
      ok: false,
      motivo:
        "Não encontrei nenhum dos sete cabeçalhos (STATUS, CHANGES, FILES, TESTS, ERRORS, " +
        "DECISIONS, NEXT_STEP). Se a ferramenta não escreveu o bloco, responda as quatro " +
        "perguntas em vez de colar.",
    };
  }

  const linhas = bruto.split(/\r?\n/);
  const blocos = new Map<Campo, string>();

  achados.forEach((a, i) => {
    const fim = achados[i + 1]?.linha ?? linhas.length;
    const corpo = [a.resto, ...linhas.slice(a.linha + 1, fim)].join("\n");
    /*
     * Cabeçalho repetido: fica o primeiro. Um modelo que escreve STATUS duas vezes quase sempre
     * está repetindo o bloco no fim da resposta, e o primeiro é o da execução.
     */
    if (!blocos.has(a.campo)) blocos.set(a.campo, corpo);
  });

  const cru = (c: Campo) => blocos.get(c) ?? "";
  const camposAusentes = CAMPOS.filter((c) => !blocos.has(c));

  /*
   * Sem STATUS não há resultado: é o único campo que decide o que a sessão faz em seguida. Os
   * outros seis podem faltar e o registro ainda vale.
   */
  const statusCru = cru("STATUS").trim().toLowerCase();
  const status = STATUS.find((s) => statusCru.includes(s));
  if (!status) {
    return {
      ok: false,
      motivo: statusCru
        ? `Não reconheci o STATUS "${statusCru.slice(0, 40)}". Use: sucesso, parcial, falhou ou bloqueado.`
        : "Faltou o STATUS. Sem ele eu não sei o que fazer com o resto.",
    };
  }

  return {
    ok: true,
    resultado: {
      status,
      changes: itens(cru("CHANGES")),
      files: itens(cru("FILES")),
      tests: itens(cru("TESTS")),
      errors: itens(cru("ERRORS")),
      decisions: itens(cru("DECISIONS")),
      nextStep: itens(cru("NEXT_STEP")).join(" "),
      camposAusentes: camposAusentes.filter((c) => c !== "STATUS"),
      origem,
      bruto,
    },
  };
}

/**
 * O resultado vira registros de trabalho, que é onde o histórico mora.
 *
 * Reaproveita `registrosDoRetorno` em vez de escrever outro conversor: os oito tipos de registro
 * já existem, e duplicá-los criaria duas listas que discordam na primeira mudança.
 */
export function registrosDoResultado(
  r: ResultadoDaSessao,
  provedorId: string,
): RegistroDeTrabalho[] {
  const bruto: RetornoEstruturado = {
    ...(r.changes.length > 0 ? { resumo: r.changes.join("; ") } : {}),
    arquivos: r.files,
    ...(r.tests.length > 0
      ? {
          testes: {
            comando: r.tests.join(" | "),
            /*
             * Um bloco de testes só conta como passado quando NÃO há sinal de falha. A ordem
             * importa: procurar "passou" primeiro daria verde em "2 de 5 passaram, 3 falharam".
             */
            passou: !/fail|falh|erro|error|✗|✖/i.test(r.tests.join(" ")),
          },
        }
      : {}),
    erros: r.errors,
    decisoes: r.decisions,
    ...(r.nextStep ? { proximoPasso: r.nextStep } : {}),
  };

  return registrosDoRetorno(bruto, provedorId, new Date()).map((x) => ({ ...x, origem: r.origem }));
}

// =============================================================================================
// Quando não dá para obter o resultado
// =============================================================================================

/**
 * A pergunta de saída, e as quatro respostas.
 *
 * Ela existe para o Pathly não depender de uma integração perfeita com toda ferramenta que
 * existe. Nenhuma delas vai reportar de volta por conta própria, e um produto que só funciona
 * quando reportam não funciona.
 *
 * As quatro respondem "Você terminou essa tarefa?" — não são um segundo vocabulário. Cada uma
 * aponta para uma `Resposta` de `retorno.ts`, que continua sendo a única lista de tipos de
 * registro. `ainda-nao` é a exceção e aponta para `null`: não terminar não é um fato sobre o
 * código, é a ausência de um.
 */
export const PERGUNTA_DE_SAIDA = "Você terminou essa tarefa?";

export const RESPOSTAS_DE_SAIDA = ["sim", "ainda-nao", "deu-erro", "mudei-a-abordagem"] as const;
export type RespostaDeSaida = (typeof RESPOSTAS_DE_SAIDA)[number];

export const ROTULO_SAIDA: Record<RespostaDeSaida, string> = {
  sim: "Sim",
  "ainda-nao": "Não",
  "deu-erro": "Deu erro",
  "mudei-a-abordagem": "Mudei a abordagem",
};

export const CONSEQUENCIA_SAIDA: Record<RespostaDeSaida, string> = {
  sim: "A sessão avança para os testes.",
  "ainda-nao": "Nada muda. A sessão fica esperando você terminar.",
  "deu-erro": "Registra o erro e volta para a execução. O erro entra no próximo brief.",
  "mudei-a-abordagem":
    "Registra a mudança como decisão técnica e volta para a execução. Ela entra no contexto de todas as etapas seguintes.",
};

export const PERGUNTA_DA_SAIDA: Record<RespostaDeSaida, string> = {
  sim: "O que ficou pronto?",
  "ainda-nao": "Quer anotar onde parou? (opcional)",
  "deu-erro": "O que aconteceu? Cole a mensagem de erro, se houver.",
  "mudei-a-abordagem": "O que mudou, e por quê?",
};

/** A `Resposta` correspondente em `retorno.ts`. `null` quando não há fato a registrar. */
export const RESPOSTA_EQUIVALENTE: Record<RespostaDeSaida, Resposta | null> = {
  sim: "implementei",
  "ainda-nao": null,
  "deu-erro": "nao-funcionou",
  "mudei-a-abordagem": "mudei-a-arquitetura",
};

/** Para onde a sessão vai depois de cada resposta. */
export const PASSO_DEPOIS_DA_SAIDA: Record<RespostaDeSaida, "testar" | "executar"> = {
  sim: "testar",
  "ainda-nao": "executar",
  "deu-erro": "executar",
  "mudei-a-abordagem": "executar",
};

/** O que a sessão faz com um resultado estruturado: status decide, e não a boa vontade. */
export function passoDepoisDoResultado(status: Status): "testar" | "executar" {
  return status === "sucesso" || status === "parcial" ? "testar" : "executar";
}
