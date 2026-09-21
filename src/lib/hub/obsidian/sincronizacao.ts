import type { Blueprint, Etapa } from "@/lib/blueprint/contrato";
import type { Decisao } from "@/lib/copilot/contrato";
import type { RegistroDeTrabalho } from "../ia/retorno";
import { ROTULO_ORIGEM, ROTULO_REGISTRO } from "../ia/retorno";
import type {
  ConexaoObsidian,
  EventoObsidian,
  RegistroDeEvento,
  TipoDeSincronia,
} from "./contrato";
import { podeEscrever } from "./contrato";
import { BLOCO_DO_TIPO, caminhoDe, comoPasta, ehNotaIndice, type Mapeamento } from "./estrutura";
import { comparar, impressao, mesclar, notaNova, type Estado, type Frontmatter } from "./nota";

/**
 * A sincronização — o que vira nota, e como ela chega lá sem destruir nada.
 *
 * ## O laço, e como ele é cortado
 *
 * Sincronização bidirecional tem um jeito clássico de dar errado: o Pathly escreve, o watcher vê
 * o arquivo mudar, manda de volta para o Pathly, que escreve de novo. Um laço que não para e
 * que, em cada volta, tem uma chance de perder alguma coisa.
 *
 * O corte aqui é simples e não depende de flag nem de silenciar watcher: **o Pathly guarda a
 * impressão digital do que ele acabou de escrever**. Na próxima leitura, se a impressão bate, a
 * mudança foi dele mesmo e não gera nada. O laço morre na primeira volta, sempre, inclusive se
 * duas abas estiverem sincronizando ao mesmo tempo.
 *
 * É o mesmo mecanismo da detecção de conflito, usado ao contrário — e é por isso que ele é
 * confiável: não há um segundo sistema para manter em pé.
 *
 * ## O que nunca sai do navegador
 *
 * Todo texto desta camada é montado e comparado no navegador de quem usa. O conteúdo do vault
 * **não vai para o servidor do Pathly e não vai para IA nenhuma**. O que o servidor guarda é o
 * caminho da nota e uma impressão digital de 8 caracteres — o suficiente para detectar conflito,
 * e insuficiente para reconstruir uma linha de texto.
 */

// =============================================================================================
// O que cada tipo escreve
// =============================================================================================

function lista(itens: readonly string[], vazio: string): string {
  return itens.length === 0 ? `_${vazio}_` : itens.map((x) => `- ${x}`).join("\n");
}

function blueprintEmMarkdown(b: Blueprint, nomeProjeto: string): string {
  const t = b.tecnico;
  const f = b.fundacao;

  return [
    f?.descricao ? `**O que é:** ${f.descricao}` : null,
    f?.problema ? `\n**O problema:** ${f.problema}` : null,
    f?.publico ? `\n**Para quem:** ${f.publico}` : null,
    t?.stack
      ? `\n## Stack\n\n${lista([t.stack.frontend, t.stack.backend, t.stack.banco, t.stack.hospedagem].filter(Boolean), "não definida")}`
      : null,
    t?.arquitetura ? `\n## Arquitetura\n\n${t.arquitetura}` : null,
    b.produto?.requisitosFuncionais?.length
      ? `\n## Requisitos\n\n${b.produto.requisitosFuncionais.map((r) => `- **${r.id}** ${r.descricao}\n  - Pronto quando: ${r.criterioAceite}`).join("\n")}`
      : null,
    b.produto?.foraDoEscopo?.length
      ? `\n## Fora do escopo\n\n${lista(b.produto.foraDoEscopo, "")}`
      : null,
    `\n---\n_Projeto ${nomeProjeto} no Pathly._`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}

function decisoesEmMarkdown(decisoes: readonly Decisao[]): string {
  const ativas = decisoes.filter((d) => d.status === "ativa");
  const antigas = decisoes.filter((d) => d.status === "substituida");

  const bloco = (d: Decisao) =>
    `- **${d.titulo}:** ${d.valor}${d.motivo ? `\n  - Porque: ${d.motivo}` : ""}`;

  return [
    ativas.length ? ativas.map(bloco).join("\n") : "_Nenhuma decisão registrada ainda._",
    /*
     * As substituídas ficam, recolhidas. Uma decisão desfeita é justamente o que alguém procura
     * seis meses depois, quando pergunta "por que a gente não usou X?" — e apagá-la para deixar a
     * nota limpa é jogar fora a resposta.
     */
    antigas.length
      ? `\n> [!abstract]- Decisões substituídas (${antigas.length})\n${antigas.map((d) => `> - ~~${d.titulo}: ${d.valor}~~`).join("\n")}`
      : null,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}

function estadoEmMarkdown(params: {
  etapa: Etapa | null;
  concluidas: number;
  total: number;
  proximoPasso: string | null;
  projeto: string;
  m: Mapeamento;
}): string {
  const { etapa, concluidas, total, proximoPasso, projeto, m } = params;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  /* Links para as outras notas, em vez de cópias. Conteúdo duplicado é como um vault vira mentira. */
  const nota = (t: TipoDeSincronia) => {
    const c = caminhoDe(m, t, projeto);
    return `[[${c.replace(/\.md$/, "")}]]`;
  };

  return [
    `**Progresso:** ${concluidas} de ${total} etapas (${pct}%)`,
    etapa ? `**Fase:** ${etapa.fase}` : null,
    etapa
      ? `**Etapa atual:** ${etapa.ordem}. ${etapa.titulo}`
      : "**Etapa atual:** trilha ainda não gerada",
    proximoPasso ? `\n**Próximo passo:** ${proximoPasso}` : null,
    `\n${nota("blueprint")} · ${nota("decisoes")} · ${nota("tarefas")} · ${nota("erros")}`,
  ]
    .filter((x): x is string => x !== null)
    .join("\n");
}

function tarefasEmMarkdown(etapas: readonly Etapa[], concluidas: readonly number[]): string {
  if (etapas.length === 0) return "_A trilha ainda não foi gerada._";

  const porFase = new Map<string, Etapa[]>();
  for (const e of etapas) {
    const f = e.fase || "Sem fase";
    porFase.set(f, [...(porFase.get(f) ?? []), e]);
  }

  return [...porFase.entries()]
    .map(([fase, lista]) => {
      /* Caixa de marcar de verdade: a pessoa marca no Obsidian e o estado volta na sincronização. */
      const itens = lista
        .map(
          (e) =>
            `- [${concluidas.includes(e.ordem) ? "x" : " "}] **${e.ordem}.** ${e.titulo}${e.entrega ? ` — ${e.entrega}` : ""}`,
        )
        .join("\n");
      return `### ${fase}\n\n${itens}`;
    })
    .join("\n\n");
}

function errosEmMarkdown(registros: readonly RegistroDeTrabalho[]): string {
  const ruins = registros.filter(
    (r) => r.tipo === "erro" || (r.tipo === "testes-executados" && /falhou/i.test(r.texto)),
  );
  if (ruins.length === 0) return "_Nada falhou até agora._";

  /*
   * A `origem` vai junto. Um erro verificado e um erro relatado valem coisas diferentes, e o
   * vault é exatamente onde alguém vai reler isso daqui a meses sem lembrar de nada.
   */
  return ruins
    .map(
      (r) =>
        `- ${r.texto}\n  - _${ROTULO_ORIGEM[r.origem]}, ${new Date(r.em).toLocaleDateString("pt-BR")}_`,
    )
    .join("\n");
}

function logsEmMarkdown(registros: readonly RegistroDeTrabalho[]): string {
  if (registros.length === 0) return "_Nenhum trabalho registrado ainda._";

  /* Mais recente no topo: é o que se procura ao abrir um log, e rolar até o fim cansa. */
  return registros
    .slice(0, 50)
    .map((r) => {
      const quando = new Date(r.em).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const itens = r.itens.length ? `\n${r.itens.map((i) => `  - \`${i}\``).join("\n")}` : "";
      return `- **${quando}** · ${ROTULO_REGISTRO[r.tipo]} _(${ROTULO_ORIGEM[r.origem]})_\n  - ${r.texto}${itens}`;
    })
    .join("\n");
}

// =============================================================================================
// Montar as notas
// =============================================================================================

export type DadosDoProjeto = {
  nome: string;
  blueprint: Blueprint;
  decisoes: readonly Decisao[];
  etapas: readonly Etapa[];
  etapasConcluidas: readonly number[];
  total: number;
  proximoPasso: string | null;
  registros: readonly RegistroDeTrabalho[];
};

/** O conteúdo de um bloco, para um tipo. `null` quando o tipo não gera conteúdo. */
export function conteudoDoTipo(
  tipo: TipoDeSincronia,
  d: DadosDoProjeto,
  m: Mapeamento,
): string | null {
  const etapaAtual =
    d.etapas.find((e) => !d.etapasConcluidas.includes(e.ordem)) ??
    d.etapas[d.etapas.length - 1] ??
    null;

  switch (tipo) {
    case "blueprint":
      return blueprintEmMarkdown(d.blueprint, d.nome);
    case "decisoes":
      return decisoesEmMarkdown(d.decisoes);
    case "estado":
      return estadoEmMarkdown({
        etapa: etapaAtual,
        concluidas: d.etapasConcluidas.length,
        total: d.total,
        proximoPasso: d.proximoPasso,
        projeto: d.nome,
        m,
      });
    case "tarefas":
      return tarefasEmMarkdown(d.etapas, d.etapasConcluidas);
    case "erros":
      return errosEmMarkdown(d.registros);
    case "logs":
      return logsEmMarkdown(d.registros);
    /*
     * `pesquisa` é a única que o Pathly não gera. A pasta é da pessoa: ele lê o que estiver lá
     * para usar como contexto, e não escreve por cima do que ela pesquisou.
     */
    case "pesquisa":
      return null;
  }
}

const TITULO: Record<TipoDeSincronia, string> = {
  blueprint: "Blueprint — {projeto}",
  decisoes: "Decisões técnicas — {projeto}",
  estado: "{projeto}",
  tarefas: "Tarefas — {projeto}",
  erros: "Erros — {projeto}",
  pesquisa: "Pesquisa — {projeto}",
  logs: "Registro de desenvolvimento — {projeto}",
};

function frontmatterDe(tipo: TipoDeSincronia, projeto: string): Frontmatter {
  return {
    tags: ["pathly", tipo],
    "pathly-projeto": projeto,
    "pathly-sincronizado": new Date().toISOString().slice(0, 10),
  };
}

// =============================================================================================
// O plano de escrita
// =============================================================================================

export type AcaoDeEscrita = {
  tipo: TipoDeSincronia;
  caminho: string;
  /** O texto completo da nota depois da mudança. `null` quando não há o que escrever. */
  texto: string | null;
  estado: Estado;
  /** Os blocos cujos marcadores a pessoa apagou. O Pathly não os recria sozinho. */
  blocosAusentes: string[];
  evento: EventoObsidian | null;
  /** A impressão do texto novo, para guardar e cortar o laço na próxima leitura. */
  impressaoNova: string | null;
  motivo?: string;
};

export type EntradaDaSincronia = {
  dados: DadosDoProjeto;
  mapeamento: Mapeamento;
  conexao: ConexaoObsidian;
  /** O que está no disco hoje, por caminho. `null` quando a nota não existe. */
  noDisco: Record<string, string | null>;
  /** A impressão que o Pathly guardou da última vez, por caminho. */
  impressoes: Record<string, string | null>;
};

const EVENTO_DO_TIPO: Partial<Record<TipoDeSincronia, EventoObsidian>> = {
  blueprint: "BLUEPRINT_SYNCED",
  decisoes: "DECISION_SYNCED",
  tarefas: "TASK_SYNCED",
};

/**
 * Monta o plano: o que seria escrito, onde, e em que estado cada nota está.
 *
 * **Não escreve nada.** Devolver um plano antes de agir é o que permite a tela mostrar "estas
 * quatro notas vão mudar, esta está em conflito" e a pessoa decidir com a informação na frente —
 * em vez de descobrir depois, lendo o vault.
 */
export function planejar(e: EntradaDaSincronia): AcaoDeEscrita[] {
  const { dados, mapeamento: m, conexao } = e;
  const acoes: AcaoDeEscrita[] = [];

  for (const tipo of Object.keys(conexao.tipos) as TipoDeSincronia[]) {
    if (!conexao.tipos[tipo]) continue;

    const conteudo = conteudoDoTipo(tipo, dados, m);
    if (conteudo === null) continue;

    const caminho = caminhoDe(m, tipo, dados.nome);

    if (!podeEscrever(caminho, conexao)) {
      acoes.push({
        tipo,
        caminho,
        texto: null,
        estado: "igual",
        blocosAusentes: [],
        evento: null,
        impressaoNova: null,
        motivo: "Esta pasta não está autorizada para escrita.",
      });
      continue;
    }

    const disco = e.noDisco[caminho] ?? null;
    const conhecida = e.impressoes[caminho] ?? null;
    const bloco = BLOCO_DO_TIPO[tipo];

    /*
     * Os tipos que caem na nota-índice entram como blocos dela, e não como nota própria. É o que
     * deixa o README do projeto reunir estado e próximo passo sem duplicar as outras notas.
     */
    const blocos = [{ bloco, conteudo }];

    if (disco === null) {
      const texto = notaNova({
        titulo: TITULO[tipo].replace("{projeto}", dados.nome),
        frontmatter: frontmatterDe(tipo, dados.nome),
        blocos,
      });
      acoes.push({
        tipo,
        caminho,
        texto,
        estado: "nova",
        blocosAusentes: [],
        evento: "NOTE_CREATED",
        impressaoNova: impressao(texto),
      });
      continue;
    }

    const r = mesclar(disco, blocos, frontmatterDe(tipo, dados.nome));
    if (!r.ok) {
      acoes.push({
        tipo,
        caminho,
        texto: null,
        estado: "igual",
        blocosAusentes: [],
        evento: null,
        impressaoNova: null,
        motivo: r.motivo,
      });
      continue;
    }

    const estado = comparar({ noDisco: disco, impressaoConhecida: conhecida, doPathly: r.texto });

    acoes.push({
      tipo,
      caminho,
      /* Em conflito, o texto vai junto — a tela precisa dele para comparar. Escrever é outra decisão. */
      texto: estado === "igual" ? null : r.texto,
      estado,
      blocosAusentes: r.blocosAusentes,
      evento: estado === "igual" ? null : (EVENTO_DO_TIPO[tipo] ?? "NOTE_UPDATED"),
      impressaoNova: estado === "igual" ? null : impressao(r.texto),
      ...(ehNotaIndice(m, tipo, dados.nome) && tipo !== "estado"
        ? { motivo: "Este tipo cai na mesma nota do estado, como um bloco separado." }
        : {}),
    });
  }

  return acoes;
}

/** As ações que de fato mudam alguma coisa e não estão em conflito. */
export function prontasParaEscrever(acoes: readonly AcaoDeEscrita[]): AcaoDeEscrita[] {
  return acoes.filter((a) => a.texto !== null && a.estado !== "conflito" && !a.motivo);
}

export function emConflito(acoes: readonly AcaoDeEscrita[]): AcaoDeEscrita[] {
  return acoes.filter((a) => a.estado === "conflito");
}

/**
 * Uma mudança lida do disco é eco do próprio Pathly?
 *
 * É a função que corta o laço. Chamada antes de qualquer reação a arquivo mudado: se a impressão
 * do que está lá é a que o Pathly guardou ao escrever, foi ele mesmo, e reagir criaria a volta.
 */
export function ehEcoDoPathly(noDisco: string, impressaoGuardada: string | null): boolean {
  return impressaoGuardada !== null && impressao(noDisco) === impressaoGuardada;
}

// =============================================================================================
// Obsidian → Pathly
// =============================================================================================

export type MudancaVindaDoVault = {
  caminho: string;
  tipo: TipoDeSincronia;
  /** As etapas marcadas como feitas no vault. Só `tarefas` produz isto. */
  etapasMarcadas: number[];
};

/**
 * O que o Pathly aceita de volta do vault.
 *
 * Deliberadamente pouco: **só as caixas de marcar das tarefas**. É a única edição no vault que
 * tem significado exato e inequívoco no projeto — marcou, concluiu.
 *
 * Ler prosa de volta e tentar reconstruir blueprint ou decisão seria adivinhação: o texto da nota
 * é livre, e interpretá-lo erraria calado, mudando o plano de alguém sem avisar. O caminho certo
 * para isso é a pessoa editar no Pathly, onde os campos existem.
 */
export function lerDoVault(
  caminho: string,
  tipo: TipoDeSincronia,
  texto: string,
): MudancaVindaDoVault {
  const marcadas: number[] = [];
  if (tipo === "tarefas") {
    const re = /^-\s*\[x\]\s*\*\*(\d+)\.\*\*/gim;
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) marcadas.push(Number(m[1]));
  }
  return { caminho, tipo, etapasMarcadas: marcadas };
}

// =============================================================================================
// Eventos
// =============================================================================================

export function eventoDe(a: AcaoDeEscrita, origem: "pathly" | "obsidian"): RegistroDeEvento | null {
  if (!a.evento) return null;
  return {
    evento: a.evento,
    caminho: a.caminho,
    origem,
    em: new Date().toISOString(),
    ...(a.blocosAusentes.length
      ? { detalhe: `Blocos sem marcador: ${a.blocosAusentes.join(", ")}` }
      : {}),
  };
}

/** O resumo que a tela mostra antes de a pessoa mandar sincronizar. */
export function resumoDoPlano(acoes: readonly AcaoDeEscrita[]): string {
  const novas = acoes.filter((a) => a.estado === "nova").length;
  const mudadas = prontasParaEscrever(acoes).filter((a) => a.estado !== "nova").length;
  const conflitos = emConflito(acoes).length;
  const bloqueadas = acoes.filter((a) => a.motivo && a.texto === null).length;

  const partes = [
    novas ? `${novas} nota(s) nova(s)` : null,
    mudadas ? `${mudadas} atualizada(s)` : null,
    conflitos ? `${conflitos} em conflito` : null,
    bloqueadas ? `${bloqueadas} sem permissão` : null,
  ].filter(Boolean);

  return partes.length === 0
    ? "Nada a sincronizar: o vault já está em dia."
    : partes.join(", ") + ".";
}

/** O nome da pasta do projeto, exposto para a tela mostrar onde as notas vão cair. */
export const pastaDoProjeto = comoPasta;
