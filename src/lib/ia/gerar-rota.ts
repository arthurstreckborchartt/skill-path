import type { OnboardingProfile } from "@/lib/onboarding";
import { gerarComClaude, type SaidaProvedor } from "@/lib/ia/provedor-claude";
import type { RotaIA } from "@/lib/ia/contrato";
import { gerarComGemini } from "@/lib/ia/provedor-gemini";

/**
 * Escolhe quem gera a rota, pelo plano da pessoa.
 *
 *   gratuito → Gemini, camada gratuita
 *   Pro      → Claude Opus 5, com o Gemini como rede de segurança
 *
 * O plano **nunca** pode vir do cliente. Ele vive no `localStorage` para efeito de tela, e quem
 * confiasse nisso aqui entregaria o seguinte: qualquer pessoa marca "pro" no devtools e passa a
 * gastar a conta da Anthropic. Quem chama esta função é responsável por ter lido o plano de uma
 * fonte que o servidor consiga verificar — hoje, a coluna `plano` em `pathly_profiles`.
 */

export type Plano = "free" | "pro";

export type ChavesIA = {
  anthropic: string | undefined;
  gemini: string | undefined;
};

export type ResultadoGeracao =
  | { ok: true; rota: RotaIA; provedor: string }
  | { ok: false; motivo: string; detalhe?: string | undefined; tentativas: string[] };

/**
 * A ordem dos provedores por plano. No Pro o Gemini entra como segunda tentativa: se o Claude
 * cair, estourar limite ou recusar, é melhor entregar uma rota boa do que nenhuma — quem pagou
 * não pode ficar sem rota por causa de uma indisponibilidade que não é dele.
 */
function ordem(plano: Plano): { nome: string; chave: (c: ChavesIA) => string | undefined }[] {
  const gemini = { nome: "gemini", chave: (c: ChavesIA) => c.gemini };
  const claude = { nome: "claude", chave: (c: ChavesIA) => c.anthropic };
  return plano === "pro" ? [claude, gemini] : [gemini];
}

export async function gerarRota(
  perfil: OnboardingProfile,
  plano: Plano,
  chaves: ChavesIA,
): Promise<ResultadoGeracao> {
  const tentativas: string[] = [];
  let ultima: SaidaProvedor | null = null;

  for (const provedor of ordem(plano)) {
    const chave = provedor.chave(chaves);
    const saida =
      provedor.nome === "claude"
        ? await gerarComClaude(perfil, chave)
        : await gerarComGemini(perfil, chave);

    tentativas.push(`${provedor.nome}:${saida.ok ? "ok" : saida.motivo}`);
    if (saida.ok) return { ok: true, rota: saida.rota, provedor: provedor.nome };
    ultima = saida;
  }

  return {
    ok: false,
    motivo: ultima?.ok === false ? ultima.motivo : "erro",
    detalhe: ultima?.ok === false ? ultima.detalhe : undefined,
    tentativas,
  };
}
