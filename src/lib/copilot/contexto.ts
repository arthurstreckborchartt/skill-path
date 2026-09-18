import type { Blueprint } from "@/lib/blueprint/contrato";
import type { ModeloDeDados } from "@/lib/banco/contrato";
import type { MapaApi } from "@/lib/api/contrato";
import type { PlanoIa } from "@/lib/arquitetura-ia/contrato";
import type { Decisao, MensagemCopilot, Proposta } from "./contrato";
import type { MudancaRegistrada } from "./historico";
import type { ResumoBanco } from "./estado-banco";
import type { Faceta } from "./roteador";
import type { ProximoPasso } from "./proximo-passo";

/**
 * O montador de contexto.
 *
 * ## O problema
 *
 * Medido num projeto real de MVP (21 etapas, 6 tabelas, 14 endpoints): o estado completo dá ~1.650
 * tokens, e uma pergunta específica precisa de 270 a 930. Mandar tudo sempre custaria de 2 a 6
 * vezes mais em TODA mensagem — e pioraria a resposta, porque informação no meio de um contexto
 * longo é a que o modelo mais ignora.
 *
 * O número cresce com o projeto: um plano grande, com o roadmap inteiro e o mapa de API completo,
 * chega fácil a dezenas de milhares. A estratégia existe para esse caso, não para o pequeno.
 *
 * ## A estratégia
 *
 * Quatro camadas, com orçamento duro. Primeiro entra o que é sempre relevante e é pequeno:
 * núcleo, estado do banco, decisões ativas, propostas pendentes, próximo passo. Depois entram as
 * fatias das facetas que o roteador apontou. Por último, o que é útil mas cortável: histórico de
 * mudanças e conversa recente.
 *
 * Quando estoura, corta de trás para frente — e diz o que cortou, em `fatiasCortadas`. Cortar em
 * silêncio faria uma resposta ruim parecer um problema do modelo, quando foi o contexto que
 * chegou pela metade.
 *
 * ## Por que este arquivo é puro
 *
 * Recebe tudo já carregado e devolve texto. Quem busca no banco é o endpoint. Isso deixa a
 * estratégia inteira testável com objetos em memória, sem tabela nenhuma — e é assim que dá para
 * saber se o orçamento funciona antes de gastar uma chamada de IA.
 */

/** ~4 caracteres por token em português. Estimativa grosseira e assumida como tal. */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

/** O teto. Deixa folga confortável para a resposta dentro da janela dos provedores gratuitos. */
export const ORCAMENTO_TOKENS = 8000;

export type FontesContexto = {
  nome: string;
  blueprint: Blueprint;
  modelo: ModeloDeDados | null;
  api: MapaApi | null;
  planoIa: PlanoIa | null;
  decisoes: Decisao[];
  propostasPendentes: Proposta[];
  mudancasRecentes: MudancaRegistrada[];
  mensagensRecentes: MensagemCopilot[];
  estadoBanco: ResumoBanco | null;
  proximoPasso: ProximoPasso;
  progresso: number;
  etapaAtual: string | null;
};

type Bloco = {
  nome: string;
  /** `true` entra sempre, mesmo estourando o orçamento. */
  essencial: boolean;
  texto: string;
};

export type ContextoMontado = {
  texto: string;
  tokensEstimados: number;
  fatiasIncluidas: string[];
  /** O que não coube. Vai para o metadata da mensagem, para depurar resposta genérica. */
  fatiasCortadas: string[];
};

// ---------------------------------------------------------------------------------------------
// As fatias
// ---------------------------------------------------------------------------------------------

function nucleo(f: FontesContexto): string {
  const l: string[] = [`## O projeto`, `Nome: ${f.nome}`];

  const fu = f.blueprint.fundacao;
  if (fu) {
    if (fu.descricao) l.push(`O que é: ${fu.descricao}`);
    if (fu.persona) l.push(`Quem usa: ${fu.persona.nome}, ${fu.persona.papel}`);
  }

  const st = f.blueprint.tecnico?.stack;
  if (st) l.push(`Stack: ${st.frontend} / ${st.backend} / ${st.banco} / ${st.hospedagem}`);

  l.push(`Progresso: ${f.progresso}%`);
  if (f.etapaAtual) l.push(`Onde a pessoa está: ${f.etapaAtual}`);
  l.push(`Próximo passo recomendado: ${f.proximoPasso.titulo} — ${f.proximoPasso.porque}`);

  return l.join("\n");
}

/**
 * O estado real do banco.
 *
 * Entra sempre, e é curto. Sem isto o Copilot fala das tabelas do plano como se existissem, e a
 * pessoa vai depurar um banco imaginário — o erro mais caro que um copiloto de construção pode
 * cometer, porque parece competente enquanto acontece.
 */
function estadoDoBanco(f: FontesContexto): string | null {
  if (!f.estadoBanco) return null;
  return [
    `## Estado real do banco`,
    f.estadoBanco.paraOContexto,
    `As tabelas do plano são PLANEJADAS até alguém executar o SQL. Nunca diga que uma tabela existe sem esta confirmação.`,
  ].join("\n");
}

function decisoes(f: FontesContexto): string | null {
  if (f.decisoes.length === 0) return null;
  return [
    `## Decisões técnicas em vigor`,
    `Respeite todas. Se a resposta contrariar alguma, diga isso explicitamente e proponha a mudança.`,
    ...f.decisoes.map((d) => `- ${d.chave}: ${d.valor} — ${d.motivo}`),
  ].join("\n");
}

function propostas(f: FontesContexto): string | null {
  if (f.propostasPendentes.length === 0) return null;
  return [
    `## Propostas esperando confirmação`,
    `Já foram sugeridas e a pessoa ainda não respondeu. NÃO proponha de novo.`,
    ...f.propostasPendentes.map((p) => `- ${p.titulo}: ${p.motivo}`),
  ].join("\n");
}

function fatiaBanco(f: FontesContexto): string | null {
  if (!f.modelo?.entidades || f.modelo.entidades.length === 0) return null;
  return [
    `## Modelo de dados`,
    ...f.modelo.entidades.map(
      (e) => `- ${e.nome}: ${e.colunas.map((c) => `${c.nome} (${c.tipoLogico})`).join(", ")}`,
    ),
  ].join("\n");
}

function fatiaApi(f: FontesContexto): string | null {
  if (!f.api?.endpoints || f.api.endpoints.length === 0) return null;
  return [
    `## Endpoints`,
    ...f.api.endpoints.map((e) => `- ${e.metodo} ${e.caminho} — ${e.finalidade}`),
  ].join("\n");
}

/**
 * As fatias leem o Blueprint como ele vem do banco, e ele pode estar pela metade.
 *
 * Um plano gravado antes de o contrato ganhar um campo chega sem ele. Aqui isso não pode virar
 * exceção: um `undefined` no meio da montagem derruba o chat inteiro, e a pessoa perde a
 * conversa por causa de um campo que nem era o assunto da pergunta.
 */
function fatiaAuth(f: FontesContexto): string | null {
  const a = f.blueprint.tecnico?.autenticacao;
  if (!a) return null;

  const l = [`## Autenticação`, `Método: ${a.metodo ?? "não definido"}`];
  if (a.protecaoDeRotas) l.push(a.protecaoDeRotas);
  if (a.papeis && a.papeis.length > 0) {
    l.push(`Papéis: ${a.papeis.map((p) => `${p.nome} (${(p.pode ?? []).join(", ")})`).join("; ")}`);
  }
  return l.join("\n");
}

function fatiaSeguranca(f: FontesContexto): string | null {
  const t = f.blueprint.tecnico;
  if (!t || t.seguranca.length === 0) return null;
  return [`## Segurança decidida no plano`, ...t.seguranca.map((s) => `- ${s}`)].join("\n");
}

function fatiaIa(f: FontesContexto): string | null {
  if (!f.planoIa) return null;

  const l = [
    `## Arquitetura de IA`,
    f.planoIa.precisaDeIa
      ? `A análise concluiu que o projeto usa IA em parte.`
      : `A análise concluiu que este projeto NÃO precisa de IA.`,
  ];

  for (const fu of f.planoIa.funcionalidades) {
    l.push(`- ${fu.nome} (${fu.nivel}): ${fu.porqueEsseNivel}`);
  }
  for (const d of f.planoIa.descartadas) {
    l.push(`- DESCARTADA ${d.nome}: ${d.porque} → ${d.oQueUsarNoLugar}`);
  }

  return l.join("\n");
}

function fatiaRoadmap(f: FontesContexto): string | null {
  const e = f.blueprint.execucao;
  if (!e) return null;
  return [
    `## Trilha de execução`,
    `${e.etapas.length} etapas em ${e.fases.length} fases.`,
    ...e.etapas.slice(0, 12).map((x) => `${x.ordem}. ${x.titulo} — entrega: ${x.entrega}`),
  ].join("\n");
}

function fatiaDeploy(f: FontesContexto): string | null {
  const o = f.blueprint.operacao;
  if (!o) return null;
  return [
    `## Operação`,
    `Deploy: ${o.deploy.estrategia}`,
    `Ambientes: ${o.deploy.ambientes.join(", ")}`,
    ...o.requisitosNaoFuncionais.slice(0, 5).map((r) => `- ${r.descricao} (${r.comoMedir})`),
  ].join("\n");
}

function fatiaStack(f: FontesContexto): string | null {
  const t = f.blueprint.tecnico;
  if (!t) return null;
  return [
    `## Stack e arquitetura`,
    `Por que esta stack: ${t.stack.justificativa}`,
    `Arquitetura: ${t.arquitetura}`,
  ].join("\n");
}

function fatiaProduto(f: FontesContexto): string | null {
  const p = f.blueprint.produto;
  if (!p?.funcionalidades) return null;
  const mvp = p.funcionalidades.filter((x) => x.prioridade === "mvp");
  return [`## O MVP`, ...mvp.map((x) => `- ${x.nome}: ${x.descricao}`)].join("\n");
}

/**
 * Cada fatia carrega o próprio nome, e não o da faceta que a pediu.
 *
 * Sem isso, a faceta `deploy` — que puxa operação E stack — reportava duas fatias chamadas
 * "fatia:deploy" em `fatiasIncluidas`. Rótulo errado num campo de diagnóstico é pior que rótulo
 * nenhum: ele faz procurar o problema no lugar errado.
 */
type FatiaNomeada = { nome: string; montar: (f: FontesContexto) => string | null };

const BANCO: FatiaNomeada = { nome: "banco", montar: fatiaBanco };
const API: FatiaNomeada = { nome: "api", montar: fatiaApi };
const AUTH: FatiaNomeada = { nome: "auth", montar: fatiaAuth };
const SEGURANCA: FatiaNomeada = { nome: "seguranca", montar: fatiaSeguranca };
const IA: FatiaNomeada = { nome: "ia", montar: fatiaIa };
const ROADMAP: FatiaNomeada = { nome: "roadmap", montar: fatiaRoadmap };
const DEPLOY: FatiaNomeada = { nome: "deploy", montar: fatiaDeploy };
const STACK: FatiaNomeada = { nome: "stack", montar: fatiaStack };
const PRODUTO: FatiaNomeada = { nome: "produto", montar: fatiaProduto };

const FATIA_POR_FACETA: Record<Faceta, FatiaNomeada[]> = {
  banco: [BANCO],
  api: [API, BANCO],
  auth: [AUTH, API],
  seguranca: [SEGURANCA, AUTH, BANCO],
  ia: [IA],
  roadmap: [ROADMAP],
  deploy: [DEPLOY, STACK],
  // Erro pode vir de qualquer lugar; stack e API são onde a maioria mora.
  erro: [STACK, API],
  stack: [STACK],
  produto: [PRODUTO],
  geral: [],
};

// ---------------------------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------------------------

export function montarContexto(
  f: FontesContexto,
  facetas: Faceta[],
  orcamento = ORCAMENTO_TOKENS,
): ContextoMontado {
  const blocos: Bloco[] = [{ nome: "nucleo", essencial: true, texto: nucleo(f) }];

  const push = (nome: string, texto: string | null, essencial = false) => {
    if (texto) blocos.push({ nome, essencial, texto });
  };

  push("estado-banco", estadoDoBanco(f), true);
  push("decisoes", decisoes(f), true);
  push("propostas-pendentes", propostas(f), true);

  // As fatias das facetas, sem repetir a mesma função quando duas facetas pedem a mesma coisa.
  const jaIncluidas = new Set<string>();
  for (const faceta of facetas) {
    for (const fatia of FATIA_POR_FACETA[faceta]) {
      if (jaIncluidas.has(fatia.nome)) continue;
      jaIncluidas.add(fatia.nome);
      push(`fatia:${fatia.nome}`, fatia.montar(f));
    }
  }

  if (f.mudancasRecentes.length > 0) {
    push(
      "mudancas",
      [
        `## O que já mudou neste projeto`,
        ...f.mudancasRecentes
          .slice(0, 5)
          .map((m) => `- ${m.campoAfetado ?? m.titulo}: ${m.motivo}`),
      ].join("\n"),
    );
  }

  if (f.mensagensRecentes.length > 0) {
    push(
      "conversa",
      [
        `## Conversa recente`,
        ...f.mensagensRecentes.slice(-6).map((m) => {
          const quem = m.papel === "usuario" ? "Pessoa" : "Você";
          const texto = m.papel === "usuario" ? m.texto : (m.resposta?.blocos[0] ?? m.texto);
          return `${quem}: ${texto.slice(0, 300)}`;
        }),
      ].join("\n"),
    );
  }

  /**
   * O corte.
   *
   * Essenciais entram primeiro e sempre — se o núcleo e as decisões sozinhos estourarem o
   * orçamento, o problema é o projeto, não a estratégia, e responder sem eles seria pior que
   * responder caro.
   */
  const incluidos: Bloco[] = blocos.filter((b) => b.essencial);
  const cortados: string[] = [];
  let tokens = incluidos.reduce((s, b) => s + estimarTokens(b.texto), 0);

  for (const b of blocos.filter((x) => !x.essencial)) {
    const custo = estimarTokens(b.texto);
    if (tokens + custo > orcamento) {
      cortados.push(b.nome);
      continue;
    }
    incluidos.push(b);
    tokens += custo;
  }

  // Reordena para a ordem original: o corte não pode embaralhar a leitura.
  const ordenados = blocos.filter((b) => incluidos.includes(b));
  const texto = ordenados.map((b) => b.texto).join("\n\n");

  return {
    texto,
    tokensEstimados: estimarTokens(texto),
    fatiasIncluidas: ordenados.map((b) => b.nome),
    fatiasCortadas: cortados,
  };
}
