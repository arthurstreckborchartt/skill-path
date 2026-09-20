import type { IntegrationAdapter } from "./adaptador";
import { DEFINICOES, type Capacidade } from "./capacidades";
import type { IntegrationProvider } from "./contrato";

/**
 * O registro de adaptadores.
 *
 * ## O ponto inteiro da arquitetura está aqui
 *
 * Acrescentar uma ferramenta ao Pathly é: escrever um adaptador no diretório dela, e acrescentar
 * **uma linha** a `ADAPTADORES`. Nenhum arquivo do núcleo muda — nem a tela de integrações, nem o
 * executor, nem o contrato, nem o banco.
 *
 * Se algum dia acrescentar um provedor exigir mexer em outro lugar, é sinal de que vazou
 * conhecimento de ferramenta para o núcleo, e o lugar certo é consertar o vazamento.
 *
 * ## Vazio de propósito
 *
 * Esta lista nasce vazia. O pedido foi a arquitetura, **sem as integrações concretas** — e um
 * registro com "github" já dentro tornaria impossível saber, depois, se o núcleo funciona sem
 * conhecer nenhum fornecedor.
 *
 * O `src/lib/integracoes/` que já existe continua funcionando como está, com seu provedor de
 * demonstração e o GitHub. A migração dele para cá é um passo separado, descrito em
 * `docs/INTEGRATION-HUB.md`.
 */
export const ADAPTADORES: readonly IntegrationAdapter[] = [];

export function acharAdaptador(provedorId: string): IntegrationAdapter | null {
  return ADAPTADORES.find((a) => a.provedor.id === provedorId) ?? null;
}

export function listarProvedores(): IntegrationProvider[] {
  return ADAPTADORES.map((a) => a.provedor);
}

export function acharAcao(provedorId: string, acaoId: string) {
  return acharAdaptador(provedorId)?.provedor.acoes.find((a) => a.id === acaoId) ?? null;
}

// =============================================================================================
// Coerência da declaração
// =============================================================================================

export type ProblemaDeRegistro = { provedor: string; problema: string };

/**
 * Confere se um provedor declara coisas que não se contradizem.
 *
 * Existe porque a declaração é **dado**, e dado errado não quebra compilação: um provedor pode
 * dizer que não suporta escrita e listar uma ação de escrita, e nada acusaria até alguém tentar
 * executar. Estas conferências são baratas e rodam em teste.
 */
export function conferirProvedor(p: IntegrationProvider): string[] {
  const problemas: string[] = [];
  const cap = new Set<Capacidade>(p.capacidades);

  for (const acao of p.acoes) {
    for (const exigida of acao.exige) {
      if (!cap.has(exigida)) {
        problemas.push(
          `a ação "${acao.id}" exige a capacidade ${exigida}, que o provedor não declara`,
        );
      }
    }
  }

  const classes = p.capacidades.map((c) => DEFINICOES[c].classe);
  if (!p.suporte.escrita && classes.includes("escrita")) {
    problemas.push("declara não suportar escrita, mas tem capacidade de escrita");
  }
  if (!p.suporte.execucao && classes.includes("execucao")) {
    problemas.push("declara não suportar execução, mas tem capacidade de execução");
  }
  if (!p.suporte.leitura && classes.includes("leitura")) {
    problemas.push("declara não suportar leitura, mas tem capacidade de leitura");
  }

  if (p.metodoAuth === "oauth" && !p.transportes.oauth) {
    problemas.push("usa OAuth como método de autenticação mas não declara o transporte OAuth");
  }
  if (p.metodoAuth === "api-key" && !p.transportes.apiKey) {
    problemas.push("usa API Key como método de autenticação mas não declara o transporte API Key");
  }

  /*
   * Ferramenta local sem bridge é a contradição mais fácil de cometer e a mais cara de descobrir
   * tarde: nuvem nenhuma alcança localhost, e o erro só aparece na primeira execução real.
   */
  if (p.execucao === "local" && !p.precisaBridge) {
    problemas.push("roda localmente mas declara não precisar de bridge — o Pathly não alcança");
  }

  if (p.capacidades.length === 0) problemas.push("não declara capacidade nenhuma");
  if (p.limitacoes.length === 0) {
    problemas.push("não declara limitação nenhuma — toda integração tem pelo menos uma");
  }

  return problemas;
}

/** Roda a conferência no registro inteiro, mais a unicidade dos ids. */
export function conferirRegistro(
  adaptadores: readonly IntegrationAdapter[] = ADAPTADORES,
): ProblemaDeRegistro[] {
  const fora: ProblemaDeRegistro[] = [];
  const vistos = new Set<string>();

  for (const a of adaptadores) {
    const p = a.provedor;
    if (vistos.has(p.id)) fora.push({ provedor: p.id, problema: "id repetido no registro" });
    vistos.add(p.id);

    for (const problema of conferirProvedor(p)) fora.push({ provedor: p.id, problema });

    if (p.transportes.oauth && !a.urlDeAutorizacao) {
      fora.push({ provedor: p.id, problema: "declara OAuth mas não implementa urlDeAutorizacao" });
    }
    if (p.transportes.oauth && !a.concluirConexao) {
      fora.push({ provedor: p.id, problema: "declara OAuth mas não implementa concluirConexao" });
    }
    if (p.transportes.webhook && !a.interpretarEvento) {
      fora.push({
        provedor: p.id,
        problema: "declara webhook mas não implementa interpretarEvento",
      });
    }
    /*
     * Webhook sem verificação de assinatura é um endereço público que aceita qualquer corpo. O Hub
     * recusa o evento em tempo de execução, mas acusar aqui é melhor: quem escreve o adaptador
     * descobre antes de publicar, não depois.
     */
    if (p.transportes.webhook && !a.verificarAssinatura) {
      fora.push({
        provedor: p.id,
        problema: "declara webhook mas não implementa verificarAssinatura",
      });
    }
  }

  return fora;
}
