import type { Origem, RegistroDeTrabalho } from "../ia/retorno";
import { ROTULO_REGISTRO } from "../ia/retorno";
import type { DevelopmentSession, Passo } from "./contrato";

/**
 * A linha do tempo da sessão.
 *
 * ## Por que ela não é uma tabela
 *
 * A tentação óbvia é gravar cada evento numa tabela de linha do tempo, na hora em que acontece.
 * É a escolha errada, e por um motivo específico: a linha do tempo passaria a ser uma **segunda
 * escrita** sobre os mesmos fatos. Um dia o registro de trabalho grava e a linha do tempo falha,
 * e a partir daí a tela conta uma história que os dados não sustentam.
 *
 * Aqui ela é **derivada**. Três fontes que já existem e já são gravadas por necessidade própria:
 *
 * - os passos da sessão, escritos por gatilho quando `current_step` muda;
 * - os registros de trabalho (`pathly_hub_registros`), com a `origem` de cada afirmação;
 * - as aprovações (`pathly_hub_aprovacoes`), com quem aprovou e quando.
 *
 * Se a linha do tempo mostra "testes executados", é porque existe um registro de testes
 * executados. Ela não pode mentir, porque não guarda nada.
 *
 * ## A `origem` continua visível aqui
 *
 * "2 testes falharam" lido da ferramenta e "2 testes falharam" digitado por alguém aparecem na
 * mesma linha do tempo, na mesma altura — e com marcas diferentes. É onde a distinção mais
 * importa: a linha do tempo é o que a pessoa relê seis semanas depois, quando não lembra mais de
 * nada.
 */

export type FonteDoEvento = "sessao" | "registro" | "aprovacao";

export type EventoDaLinha = {
  /** ISO, para ordenar. */
  em: string;
  /** `17:43` — o que aparece na coluna da esquerda. */
  hora: string;
  titulo: string;
  detalhe: string | null;
  fonte: FonteDoEvento;
  /** Só quando a fonte é um registro de trabalho. Os passos da sessão são do Pathly. */
  origem: Origem | null;
  /** Marca os eventos que merecem atenção: erro, teste falho, sessão falhada. */
  ruim: boolean;
};

/**
 * Como cada passo aparece **depois** de ter acontecido.
 *
 * Diferente de `ROTULO_PASSO`, que nomeia o passo enquanto ele está acontecendo. "Preparar o
 * contexto" é o que a sessão está fazendo; "Pathly preparou a tarefa" é o que ela fez. Uma linha
 * do tempo escrita no infinitivo lê como uma lista de tarefas, não como uma história.
 */
function narrativa(passo: Passo, nomeDoProvedor: string | null): string {
  const f = nomeDoProvedor ?? "a ferramenta";
  switch (passo) {
    case "planejar":
      return "Sessão aberta";
    case "gerar-tarefa":
      return "Pathly gerou a tarefa";
    case "preparar-contexto":
      return "Pathly preparou o contexto";
    case "escolher-ferramenta":
      return nomeDoProvedor ? `${f} escolhida` : "Ferramenta escolhida";
    case "solicitar-execucao":
      return "Execução solicitada";
    case "autorizar":
      return `${f} autorizada`;
    case "executar":
      return `${f} começou a trabalhar`;
    case "receber-resultado":
      return "Resultado recebido";
    case "testar":
      return "Fase de testes";
    case "validar":
      return "Fase de validação";
    case "atualizar-blueprint":
      return "Validação concluída";
    case "concluida":
      return "Blueprint atualizado";
    case "cancelada":
      return "Sessão cancelada";
    case "falhou":
      return "Sessão interrompida por erro";
  }
}

const PASSOS_RUINS: readonly Passo[] = ["falhou"];

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * O texto de um registro de trabalho na linha do tempo.
 *
 * Registros de arquivo e de teste ganham uma frase contada — "4 arquivos modificados" lê melhor
 * que "Arquivos alterados: src/a.ts, src/b.ts, ..." numa coluna estreita, e o detalhe continua
 * disponível logo abaixo.
 */
function doRegistro(r: RegistroDeTrabalho): {
  titulo: string;
  detalhe: string | null;
  ruim: boolean;
} {
  if (r.tipo === "arquivos-alterados") {
    const n = r.itens.length;
    return {
      titulo: `${n} arquivo${n === 1 ? "" : "s"} modificado${n === 1 ? "" : "s"}`,
      detalhe: r.itens.join(", ") || null,
      ruim: false,
    };
  }

  if (r.tipo === "testes-executados") {
    const falhou = /falhou/i.test(r.texto);
    return {
      titulo: falhou ? "Testes falharam" : "Testes executados",
      detalhe: r.texto,
      ruim: falhou,
    };
  }

  return {
    titulo: ROTULO_REGISTRO[r.tipo],
    detalhe: r.texto,
    ruim: r.tipo === "erro",
  };
}

export type EntradaDaLinha = {
  sessao: DevelopmentSession;
  registros: readonly RegistroDeTrabalho[];
  aprovacoes: readonly { id: string; action: string; status: string; approved_at: string | null }[];
  /** O nome da ferramenta, para a narrativa dizer "Codex autorizado" em vez de "ferramenta". */
  nomeDoProvedor: string | null;
};

export function montarLinhaDoTempo(e: EntradaDaLinha): EventoDaLinha[] {
  const eventos: EventoDaLinha[] = [];

  for (const p of e.sessao.steps) {
    eventos.push({
      em: p.em,
      hora: hora(p.em),
      titulo: narrativa(p.passo, e.nomeDoProvedor),
      detalhe: null,
      fonte: "sessao",
      origem: null,
      ruim: PASSOS_RUINS.includes(p.passo),
    });
  }

  for (const r of e.registros) {
    const { titulo, detalhe, ruim } = doRegistro(r);
    eventos.push({
      em: r.em,
      hora: hora(r.em),
      titulo,
      detalhe,
      fonte: "registro",
      origem: r.origem,
      ruim,
    });
  }

  for (const a of e.aprovacoes) {
    if (!a.approved_at) continue;
    eventos.push({
      em: a.approved_at,
      hora: hora(a.approved_at),
      titulo: `Você aprovou: ${a.action}`,
      detalhe: null,
      fonte: "aprovacao",
      origem: null,
      ruim: false,
    });
  }

  /*
   * Ordena pelo instante. Empate mantém a ordem de inserção — passos primeiro, depois registros —
   * porque quando os dois caem no mesmo minuto foi o passo que causou o registro.
   */
  return eventos.sort((a, b) => a.em.localeCompare(b.em));
}

/**
 * Quanto tempo a sessão levou até agora, em texto curto.
 *
 * Existe porque é a informação que a pessoa procura quando olha uma sessão antiga, e calcular de
 * cabeça a partir de dois ISO é exatamente o tipo de coisa que o produto deveria fazer por ela.
 */
export function duracao(s: DevelopmentSession, agora = new Date()): string {
  const fim = s.completedAt ? new Date(s.completedAt) : agora;
  const min = Math.max(0, Math.round((fim.getTime() - new Date(s.startedAt).getTime()) / 60000));
  if (min < 1) return "menos de um minuto";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? `${h}h` : `${h}h ${resto}min`;
}

/**
 * Quantas voltas a etapa custou.
 *
 * Toda entrada em `executar` depois da primeira é uma volta: o teste falhou, ou a validação
 * reprovou, e a tarefa voltou para a ferramenta. É o número mais honesto sobre uma etapa, e o
 * único que some se a pessoa cancelar a sessão e abrir outra em vez de voltar.
 */
export function voltas(s: DevelopmentSession): number {
  return Math.max(0, s.steps.filter((p) => p.passo === "executar").length - 1);
}
