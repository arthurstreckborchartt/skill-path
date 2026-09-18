import type { PlanoIa } from "./contrato";
import { escolherModelo } from "./modelos";

/**
 * Os conceitos de IA, explicados para quem nunca construiu com eles — e a regra de quais aparecem.
 *
 * ## Por que a definição é canônica
 *
 * O que é um token não muda de projeto para projeto. Gerar essa explicação a cada vez custaria
 * tokens para produzir uma variação da mesma frase, e às vezes uma variação errada: um modelo que
 * confunde embedding com fine-tuning ensinaria errado para sempre naquele projeto.
 *
 * ## Por que quase nenhum aparece
 *
 * Aqui a regra de relevância importa mais que nos outros módulos. Explicar RAG para quem precisa
 * de uma chamada só não é ruído neutro — é a causa direta de a pessoa construir um sistema de
 * busca vetorial que ela não precisava. Em IA, conhecer o conceito é o que faz querer usá-lo.
 *
 * Por isso `aplicaSe` lê o plano, não o questionário: um conceito só entra quando alguma
 * funcionalidade aprovada realmente o usa.
 */

export type Conceito = {
  id: string;
  nome: string;
  /** Uma frase que resolve o termo para quem nunca ouviu. */
  resumo: string;
  /** A explicação de verdade, em 1 a 3 parágrafos. */
  explicacao: string[];
  /** O erro que quase todo mundo comete com isso. */
  armadilha: string;
  /** Quando este conceito entra. `undefined` = sempre que houver IA no plano. */
  aplicaSe?: (p: PlanoIa) => boolean;
};

const temNivel = (p: PlanoIa, ...niveis: string[]) =>
  p.funcionalidades.some((f) => niveis.includes(f.nivel));

export const CONCEITOS: Conceito[] = [
  {
    id: "llm",
    nome: "O que é um LLM",
    resumo:
      "Um programa que completa texto, treinado em tanto texto que a completação parece raciocínio.",
    explicacao: [
      "Um modelo de linguagem recebe um texto e escreve a continuação mais provável, uma palavra de cada vez. Não existe banco de fatos dentro dele nem consulta a lugar nenhum: o que parece conhecimento é padrão estatístico aprendido durante o treino.",
      "Isso explica as duas coisas que mais surpreendem quem começa. Ele erra com a mesma confiança com que acerta, porque não tem como saber a diferença. E ele não sabe nada que aconteceu depois do treino — inclusive sobre o seu produto, que ele nunca viu.",
    ],
    armadilha:
      "Tratar a resposta como verdade verificada. O modelo não tem um mecanismo interno de checagem: se o fato importa, quem confere é o seu código ou uma pessoa.",
  },
  {
    id: "tokens",
    nome: "Tokens",
    resumo: "Os pedaços de texto que o modelo conta — e a unidade da sua fatura.",
    explicacao: [
      "O modelo não lê letras nem palavras: ele lê tokens, pedaços que vão de um caractere a uma palavra inteira. Em português, a conta de guardanapo é de mais ou menos um token para cada quatro caracteres.",
      "Tudo é cobrado por token, e entrada e saída têm preços diferentes — saída costuma custar cinco vezes mais. Por isso um prompt gigante que produz uma resposta curta pode sair mais barato que o contrário.",
    ],
    armadilha:
      "Esquecer que a conversa inteira é reenviada a cada volta. Numa conversa longa, você paga de novo por tudo que já foi dito — o custo cresce com o quadrado do número de mensagens, não com o número delas.",
  },
  {
    id: "prompt",
    nome: "Prompt",
    resumo: "A instrução que você manda junto. É o seu código, não uma conversa.",
    explicacao: [
      "O prompt de sistema é onde você diz quem o modelo é, o que ele pode fazer, o que ele nunca deve fazer e em que formato responder. Ele vai em toda chamada, e é a diferença entre um resultado que serve e um que quase serve.",
      "Trate como código: guarde em arquivo, versione, e mude uma coisa por vez. Prompt editado no chat até 'ficar bom' é uma mudança que ninguém consegue reproduzir nem reverter.",
    ],
    armadilha:
      "Escrever o prompt em linguagem de pedido educado. O modelo não obedece por cortesia: 'responda apenas com o JSON, sem texto em volta' funciona; 'por favor, tente responder em JSON se possível' produz texto em volta.",
  },
  {
    id: "contexto",
    nome: "Janela de contexto",
    resumo: "O quanto cabe numa chamada, contando pergunta e resposta.",
    explicacao: [
      "Tudo que o modelo enxerga numa chamada precisa caber na janela: prompt de sistema, histórico, documentos anexados e a resposta que ele ainda vai escrever. Estourar não degrada, dá erro.",
      "Janela grande não é convite para encher. Contexto longo custa caro em toda chamada e piora a atenção do modelo no que importa — enfiar dez documentos quando um resolve costuma dar resposta pior, não melhor.",
    ],
    armadilha:
      "Acreditar que 'cabe na janela' significa 'o modelo vai usar'. Informação no meio de um contexto muito longo é a que ele mais ignora. Coloque o que importa no começo ou no fim.",
  },
  {
    id: "structured-outputs",
    nome: "Resposta estruturada",
    resumo: "Obrigar o modelo a responder num formato que o seu código consegue ler.",
    explicacao: [
      "Se a resposta vai para dentro do seu sistema, ela precisa ser JSON com forma conhecida — não um parágrafo bonito. Os provedores têm um parâmetro que garante isso pelo schema, e é ele que você usa, não uma instrução no prompt pedindo JSON.",
      "Mesmo com garantia de formato, valide antes de gravar. Schema garante a forma; ele não garante que o conteúdo faz sentido.",
    ],
    armadilha:
      "Fazer `JSON.parse` direto na resposta e confiar. Quando o modelo bate no limite de tokens, o JSON vem cortado no meio — e o parse quebra em produção, não no teste.",
    aplicaSe: (p) => temNivel(p, "llm-simples", "rag", "tool-calling", "agente"),
  },
  {
    id: "streaming",
    nome: "Streaming",
    resumo: "Mostrar a resposta enquanto ela é escrita, em vez de esperar o fim.",
    explicacao: [
      "Sem streaming, a tela fica parada do primeiro ao último token. Com streaming, o texto aparece conforme sai. O tempo total é o mesmo; a percepção não é nem parecida.",
      "Serve para resposta longa com alguém esperando. Para resposta curta, ou para o que roda em segundo plano, streaming só adiciona complexidade sem ninguém ver a diferença.",
    ],
    armadilha:
      "Streamear direto para a tela sem guardar. Se a conexão cai na metade, a pessoa perde a resposta inteira e você não tem o que mostrar de novo.",
    aplicaSe: (p) =>
      p.funcionalidades.some((f) => {
        const m = escolherModelo(f);
        return f.sincrona && m !== null && f.tokensSaida > 200;
      }),
  },
  {
    id: "embeddings",
    nome: "Embeddings",
    resumo: "Transformar texto em números, de um jeito que texto parecido fica perto.",
    explicacao: [
      "Um embedding é uma lista de números que representa o sentido de um trecho. Dois trechos que falam da mesma coisa ficam próximos nessa representação, mesmo sem repetir nenhuma palavra — é assim que 'como cancelo minha conta' encontra o parágrafo sobre encerramento de assinatura.",
      "É o que faz busca por significado funcionar onde busca por palavra falha. E é barato: gerar embedding custa uma fração do que custa gerar texto.",
    ],
    armadilha:
      "Trocar de modelo de embedding sem regerar tudo. Vetores de modelos diferentes não se comparam — a busca continua funcionando, só que devolvendo resultado errado, silenciosamente.",
    aplicaSe: (p) => temNivel(p, "rag"),
  },
  {
    id: "rag",
    nome: "RAG — busca antes de responder",
    resumo: "Procurar os trechos certos nos seus documentos e mandá-los junto com a pergunta.",
    explicacao: [
      "O modelo não conhece os seus documentos. RAG resolve isso em dois tempos: primeiro o seu código busca os trechos relevantes, depois manda esses trechos junto da pergunta e pede a resposta baseada neles.",
      "A qualidade do RAG é quase toda decidida na busca, não no prompt. Se o trecho certo não foi recuperado, nenhum prompt salva — o modelo vai responder com o que recebeu, com confiança.",
    ],
    armadilha:
      "Partir o documento em pedaços de tamanho fixo. Cortar no meio da frase destrói o sentido do trecho; corte por seção, parágrafo ou título, com um pouco de sobreposição.",
    aplicaSe: (p) => temNivel(p, "rag"),
  },
  {
    id: "vector-db",
    nome: "Banco vetorial",
    resumo: "Onde os embeddings ficam guardados para serem buscados rápido.",
    explicacao: [
      "Busca por similaridade precisa comparar o vetor da pergunta com o de cada trecho. Um banco vetorial faz isso com índice, em vez de percorrer tudo.",
      "Quase sempre você não precisa de um serviço novo: Postgres com a extensão pgvector resolve até uma escala que a maioria dos produtos nunca alcança, e mantém seus dados num banco só, com um backup só.",
    ],
    armadilha:
      "Contratar um banco vetorial dedicado antes de ter volume. É mais um serviço para operar, mais uma conta e mais um lugar de onde os dados podem vazar — para resolver um problema de escala que você ainda não tem.",
    aplicaSe: (p) => temNivel(p, "rag"),
  },
  {
    id: "tool-calling",
    nome: "Ferramentas (tool calling)",
    resumo: "Deixar o modelo pedir que o seu código execute algo, e responder com o resultado.",
    explicacao: [
      "Você descreve funções que existem no seu sistema — consultar pedido, calcular frete — e o modelo, em vez de responder, devolve qual delas chamar e com quais argumentos. Seu código executa e devolve o resultado para ele concluir.",
      "Quem executa é sempre você. O modelo só pede — e é nessa fronteira que mora a segurança: cada ferramenta precisa checar permissão como se o pedido viesse de fora, porque efetivamente vem.",
    ],
    armadilha:
      "Expor uma ferramenta genérica demais, tipo 'rodar esta consulta SQL'. Você acabou de dar ao modelo — e a quem souber conversar com ele — acesso direto ao seu banco.",
    aplicaSe: (p) => temNivel(p, "tool-calling", "agente"),
  },
  {
    id: "agentes",
    nome: "Agentes",
    resumo: "O modelo decide sozinho a sequência de passos até terminar a tarefa.",
    explicacao: [
      "Num agente, o modelo escolhe o que fazer, faz, olha o resultado e decide o próximo passo — em laço, até concluir. É o que permite resolver tarefas que você não conseguiria roteirizar de antemão.",
      "É também o degrau mais caro e mais difícil de testar: cada volta reenvia o histórico, o custo cresce rápido, e um erro no segundo passo contamina todos os seguintes sem avisar.",
    ],
    armadilha:
      "Usar agente para um processo que você já sabe descrever em ordem. Se você consegue escrever os passos, escreva os passos: fica mais barato, mais rápido e testável — e você ainda pode chamar o modelo dentro de cada um.",
    aplicaSe: (p) => temNivel(p, "agente"),
  },
  {
    id: "avaliacao",
    nome: "Avaliação",
    resumo: "Um conjunto de casos com resposta esperada, que você roda a cada mudança.",
    explicacao: [
      "Software normal você testa: entrada conhecida, saída esperada, passou ou não passou. IA não dá resposta idêntica duas vezes, então o teste vira medição — vinte ou trinta casos reais, um critério de acerto, e uma taxa.",
      "Sem isso, 'melhorei o prompt' é palpite. Toda mudança de prompt melhora alguma coisa e piora outra; sem medir, você só percebe a parte que piorou quando um usuário reclama.",
    ],
    armadilha:
      "Adiar a avaliação para depois do lançamento. Os casos de teste bons vêm dos exemplos reais que você já tem hoje — e depois do lançamento você vai estar ocupado apagando incêndio.",
    aplicaSe: (p) => p.precisaDeIa,
  },
];

/** Os conceitos que este plano precisa, na ordem em que fazem sentido aprender. */
export function conceitosDoPlano(p: PlanoIa): Conceito[] {
  if (!p.precisaDeIa) return [];
  return CONCEITOS.filter((c) => !c.aplicaSe || c.aplicaSe(p));
}

/**
 * Os que ficaram de fora, com o motivo.
 *
 * Existe para a pessoa saber que a lista foi podada de propósito. Sem isto, quem já ouviu falar
 * de RAG e não vê RAG na tela conclui que o produto é incompleto — e vai atrás por conta.
 */
export function conceitosForaComMotivo(p: PlanoIa): { conceito: Conceito; porque: string }[] {
  if (!p.precisaDeIa) return [];

  const motivos: Record<string, string> = {
    embeddings: "nenhuma funcionalidade deste plano busca em documentos",
    rag: "nenhuma funcionalidade deste plano busca em documentos",
    "vector-db": "sem RAG, não há vetores para guardar",
    "tool-calling": "nenhuma funcionalidade deste plano precisa que o modelo execute algo",
    agentes: "nenhuma funcionalidade deste plano precisa de passos decididos na hora",
    streaming: "nenhuma resposta é longa o bastante, com alguém esperando, para justificar",
  };

  return CONCEITOS.filter((c) => c.aplicaSe && !c.aplicaSe(p)).map((c) => ({
    conceito: c,
    porque: motivos[c.id] ?? "não se aplica a este plano",
  }));
}
