import type { OnboardingProfile } from "@/lib/onboarding";
import { gerarComClaude } from "@/lib/ia/provedor-claude";
import { gerarComGemini } from "@/lib/ia/provedor-gemini";
import { gerarComCompat, SERVICOS_COMPAT } from "@/lib/ia/provedor-openai-compat";
import type { RotaIA, SaidaProvedor } from "@/lib/ia/contrato";

/**
 * Escolhe quem gera a rota.
 *
 *   gratuito → cadeia de serviços gratuitos, na ordem
 *   Pro      → Claude Opus 5, com a cadeia gratuita como rede de segurança
 *
 * A cadeia existe porque depender de um fornecedor gratuito só não se sustenta: em 15/09/2026
 * observei três modelos do Gemini em "high demand" no intervalo de poucos minutos. Um serviço
 * cai, o seguinte atende, e a pessoa não percebe.
 *
 * Cada serviço entra na cadeia **apenas se a chave dele existir**. Isso deixa acrescentar
 * fornecedor sem mexer em código: configurou a variável, entrou na fila.
 *
 * O plano **nunca** pode vir do cliente. Ele vive no localStorage para efeito de tela, e quem
 * confiasse nisso aqui entregaria o seguinte: qualquer pessoa marca "pro" no devtools e passa a
 * gastar a conta da Anthropic. Quem chama é responsável por ler o plano de uma fonte que o
 * servidor verifique — hoje, a coluna `plano` em `pathly_profiles`.
 */

export type Plano = "free" | "pro";

/**
 * Orçamento de relógio, o mesmo para todos, porque correm em paralelo.
 *
 * 60s é o pior caso, não o esperado: o Gemini entrega em ~20s e é ele quem costuma vencer a
 * corrida. O número vem do mais lento que ainda vale a pena esperar — o OpenRouter gratuito, que
 * leva ~49s para uma rota inteira com o prompt real. Cortar antes disso seria abortar geração
 * boa; esticar muito além seria prender a pessoa na tela de carregamento.
 */
const ORCAMENTO_TOTAL_MS = 60_000;

/** Abaixo disto não vale começar: não daria tempo nem de uma geração completa (~20s). */
const MINIMO_PARA_TENTAR_MS = 12_000;

/** Lê uma variável de ambiente. Injetado pelo endpoint, que é quem sabe ler o env do Worker. */
export type LeitorEnv = (nome: string) => string | undefined;

export type ResultadoGeracao =
  | { ok: true; rota: RotaIA; provedor: string; tentativas: string[] }
  | { ok: false; motivo: string; detalhe?: string | undefined; tentativas: string[] };

type Elo = { nome: string; executar: (tetoMs: number) => Promise<SaidaProvedor> };

/**
 * Monta a fila de quem pode tentar. Serviço sem chave nem entra — assim o 503 diferencia
 * "ninguém configurado" de "todos tentaram e falharam", que são problemas bem diferentes.
 */
function montarCadeia(perfil: OnboardingProfile, plano: Plano, env: LeitorEnv): Elo[] {
  const cadeia: Elo[] = [];

  const chaveAnthropic = env("ANTHROPIC_API_KEY");
  if (plano === "pro" && chaveAnthropic) {
    cadeia.push({ nome: "claude", executar: () => gerarComClaude(perfil, chaveAnthropic) });
  }

  const chaveGemini = env("GEMINI_API_KEY");
  if (chaveGemini) {
    cadeia.push({
      nome: "gemini",
      executar: (teto) => gerarComGemini(perfil, chaveGemini, env("GEMINI_MODELO"), teto),
    });
  }

  for (const servico of SERVICOS_COMPAT) {
    const chave = env(servico.envChave);
    if (!chave) continue;
    const escolhido = env(servico.envModelo);
    const modelos = escolhido ? [escolhido] : servico.modelos;
    cadeia.push({
      nome: servico.id,
      executar: (teto) => gerarComCompat(perfil, servico, chave, modelos, teto),
    });
  }

  return cadeia;
}

/**
 * Quantos provedores correm ao mesmo tempo.
 *
 * Em paralelo e não em fila, e a medição é o motivo: o Gemini entrega em ~20s e o OpenRouter em
 * ~49s. Em fila, se o primeiro falha só depois de esgotar o tempo dele, o segundo nunca cabe no
 * orçamento — foi exatamente o que aconteceu no teste, cadeia com dois fornecedores e só um com
 * chance real. Em paralelo o custo de relógio é o do MAIS RÁPIDO que responder, não a soma.
 *
 * O preço é gastar uma chamada de cada cota por geração. Numa camada gratuita, com isto rodando
 * uma vez por pessoa no fim do onboarding, é barato perto de deixar alguém sem rota.
 *
 * O teto de 3 evita o outro extremo: com cinco serviços configurados, disparar cinco chamadas
 * simultâneas queimaria as cotas rápido demais sem ganhar latência — as duas primeiras já cobrem.
 */
const MAX_SIMULTANEOS = 3;

export async function gerarRota(
  perfil: OnboardingProfile,
  plano: Plano,
  env: LeitorEnv,
): Promise<ResultadoGeracao> {
  const cadeia = montarCadeia(perfil, plano, env);
  const tentativas: string[] = [];

  if (cadeia.length === 0) {
    return { ok: false, motivo: "sem-chave", tentativas };
  }

  const correndo = cadeia.slice(0, MAX_SIMULTANEOS);
  const orcamento = ORCAMENTO_TOTAL_MS;

  // Cada um recebe o orçamento INTEIRO: correndo em paralelo, o tempo de um não tira do outro.
  // O índice viaja junto com o resultado para dar de baixa na corrida certa quando ela chega.
  const pendentes = new Map(
    correndo.map((elo, i) => [
      i,
      elo.executar(orcamento).then((saida) => ({ i, nome: elo.nome, saida })),
    ]),
  );

  let ultima: SaidaProvedor | null = null;

  while (pendentes.size > 0) {
    const chegou = await Promise.race(pendentes.values());
    pendentes.delete(chegou.i);

    tentativas.push(`${chegou.nome}:${chegou.saida.ok ? "ok" : chegou.saida.motivo}`);

    if (chegou.saida.ok) {
      // As outras continuam em voo e são descartadas: o navegador já tem resposta, e abortar
      // agora não devolveria a cota que já foi consumida mesmo.
      return { ok: true, rota: chegou.saida.rota, provedor: chegou.nome, tentativas };
    }

    ultima = chegou.saida;
  }

  return {
    ok: false,
    motivo: ultima?.ok === false ? ultima.motivo : "erro",
    detalhe: ultima?.ok === false ? ultima.detalhe : undefined,
    tentativas,
  };
}
