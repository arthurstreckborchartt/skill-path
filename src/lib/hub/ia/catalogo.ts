import type { AiDevelopmentProvider, Entrega } from "./contrato";
import type { PacoteDeContexto } from "./contexto";
import { pacoteEmMarkdown } from "./contexto";
import { CLAUDE_API, CLAUDE_CODE } from "./provedores/claude";
import { CODEX } from "./provedores/codex";
import { CURSOR } from "./provedores/cursor";

/**
 * As ferramentas que o Pathly conhece.
 *
 * Ao contrário do `ADAPTADORES` do Hub, que nasce vazio de propósito, este catálogo já vem cheio:
 * aqui não há integração para registrar, há **declaração**. Conhecer o Cursor não custa
 * credencial nem permissão nenhuma — o Pathly só sabe qual arquivo ele lê.
 */
export const PROVEDORES_IA: readonly AiDevelopmentProvider[] = [
  CLAUDE_API,
  CLAUDE_CODE,
  CODEX,
  CURSOR,
];

export function acharProvedor(id: string): AiDevelopmentProvider | null {
  return PROVEDORES_IA.find((p) => p.id === id) ?? null;
}

/**
 * A melhor entrega que esta ferramenta aceita — `entregas` está ordenada da preferida para a de
 * menor esforço, então é a primeira.
 */
export function melhorEntrega(p: AiDevelopmentProvider): Entrega {
  return p.entregas[0] ?? "prompt";
}

/**
 * O Pathly executa algo por esta ferramenta?
 *
 * A pergunta que decide se a tela mostra "Executar" ou "Copiar contexto". Só é verdade quando a
 * ferramenta não roda na máquina da pessoa **e** aceita chamada direta — as duas coisas, porque
 * uma ferramenta remota sem API é tão inalcançável quanto uma local.
 */
export function executaDoPathly(p: AiDevelopmentProvider): boolean {
  return !p.local && p.entregas.includes("api-direta");
}

/**
 * Uma frase sobre o alcance real, para a tela não precisar inventar a sua.
 *
 * É o texto que impede a promessa exagerada: quem lê descobre em uma linha se aperta um botão ou
 * se copia um texto.
 */
export function comoEstaFerramentaRecebe(p: AiDevelopmentProvider): string {
  if (executaDoPathly(p)) {
    return "O Pathly chama esta ferramenta e traz a resposta de volta.";
  }
  if (p.arquivoDeRegras) {
    return `O Pathly prepara o contexto; quem executa é você, na sua máquina. O arquivo ${p.arquivoDeRegras.caminho} faz o contexto chegar sozinho.`;
  }
  return "O Pathly prepara o contexto; quem executa é você, na sua máquina.";
}

/**
 * O conteúdo do arquivo de regras.
 *
 * Um aviso no topo e o pacote embaixo. O aviso existe porque o arquivo vai para o repositório de
 * outra pessoa, e daqui a três meses alguém vai abrir `AGENTS.md` sem lembrar de onde veio.
 */
export function conteudoDoArquivoDeRegras(
  p: AiDevelopmentProvider,
  pacote: PacoteDeContexto,
  nomeProjeto: string,
): string {
  return [
    `# Contexto do projeto — gerado pelo Pathly`,
    ``,
    `Projeto: ${nomeProjeto}. Ferramenta: ${p.nome}.`,
    ``,
    `Este arquivo é gerado. Ele é substituído a cada atualização do contexto no Pathly — o que`,
    `você escrever aqui à mão se perde. Anotações suas vão em outro arquivo de regras.`,
    ``,
    pacoteEmMarkdown(pacote),
  ].join("\n");
}
