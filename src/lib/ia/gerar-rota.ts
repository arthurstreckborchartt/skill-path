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
 * Orçamento de relógio para a cadeia INTEIRA.
 *
 * Sem um teto global, cada provedor traria o seu e quatro deles somariam mais de dois minutos
 * com a pessoa parada na tela de "montando sua rota". O teto é aqui, e cada elo recebe apenas o
 * que sobrou — quem chega por último pode não ter tempo de tentar, e isso é o certo: melhor cair
 * na rota por regras do que prender alguém por dois minutos.
 */
const ORCAMENTO_TOTAL_MS = 55_000;

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

  let ultima: SaidaProvedor | null = null;
  const limite = Date.now() + ORCAMENTO_TOTAL_MS;

  for (const elo of cadeia) {
    const restante = limite - Date.now();
    if (restante < MINIMO_PARA_TENTAR_MS) {
      tentativas.push(`${elo.nome}:sem-tempo`);
      break;
    }

    const saida = await elo.executar(restante);
    tentativas.push(`${elo.nome}:${saida.ok ? "ok" : saida.motivo}`);
    if (saida.ok) return { ok: true, rota: saida.rota, provedor: elo.nome, tentativas };

    ultima = saida;

    // Recusa por política não é problema de fornecedor: o prompt ou o perfil dispararam algum
    // filtro, e o próximo serviço tende a recusar igual. Parar é mais honesto que insistir.
    if (saida.motivo === "recusa") break;
  }

  return {
    ok: false,
    motivo: ultima?.ok === false ? ultima.motivo : "erro",
    detalhe: ultima?.ok === false ? ultima.detalhe : undefined,
    tentativas,
  };
}
