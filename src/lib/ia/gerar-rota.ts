import Anthropic from "@anthropic-ai/sdk";
import type { OnboardingProfile } from "@/lib/onboarding";
import { SCHEMA_ROTA, validarRota, type RotaIA } from "@/lib/ia/contrato";

/**
 * Geração da rota pelo Claude. **Só roda no servidor.** A chave da Anthropic nunca pode entrar
 * no bundle: qualquer pessoa abriria o devtools e gastaria a conta do Arthur.
 */

const MODELO = "claude-opus-5";

/**
 * As regras do produto, e elas não são decoração. A Pathly não promete emprego, não promete
 * renda, não cita vaga aberta e não afirma compatibilidade com vaga nenhuma. Um modelo solto
 * escreve "em 3 meses você estará ganhando R$ 8.000" sem pensar duas vezes, e isso é exatamente
 * o que o produto não pode dizer.
 */
const SISTEMA = `Você monta trilhas de estudo para a Pathly, um app brasileiro para pessoas que
querem migrar de carreira ou crescer na área em que já estão.

Escreva em português do Brasil, na segunda pessoa ("você"), com frases curtas e concretas.

REGRAS INEGOCIÁVEIS:
- Nunca prometa emprego, contratação, vaga ou renda. Nem explícita nem implicitamente.
- Nunca diga quanto a pessoa vai passar a ganhar, nem em quanto tempo. Os números de renda do app
  são calculados fora daqui e não são previsão de salário.
- Nunca cite vagas abertas, empresas contratando ou compatibilidade com uma vaga.
- Nunca invente estatística de mercado ("87% das empresas exigem..."). Se quiser falar de
  relevância, fale de forma qualitativa.
- Não recomende curso pago específico nem plataforma específica. O app cuida disso em outra tela.

COMO ESTRUTURAR:
- Entre 6 e 10 etapas, em ordem real de pré-requisito: cada uma só depende do que veio antes.
- Comece pelo fundamento que a pessoa ainda não tem, considerando a experiência declarada. Se ela
  já domina algo, não gaste uma etapa nisso.
- Cada etapa tem de 4 a 8 tarefas pequenas. "Pequena" quer dizer que cabe numa sessão de estudo e
  dá para marcar como feita sem ambiguidade. Comece cada tarefa com um verbo no infinitivo.
- Prefira tarefas que produzem algo ("Construir uma planilha que...") a tarefas de consumo
  passivo ("Assistir a uma aula sobre...").
- Os projetos de cada etapa são coisas que a pessoa consegue mostrar para alguém.
- Considere as horas por semana disponíveis ao dimensionar a carga de cada etapa.
- Leve a sério o texto livre do campo "o que você quer fazer": ele é o que a pessoa realmente
  quer, e vale mais que a área escolhida no formulário.`;

function resumirPerfil(p: OnboardingProfile): string {
  const partes: string[] = [];
  partes.push(`Área escolhida: ${p.desiredAreas[0] ?? "não informada"}`);
  partes.push(`Profissão atual: ${p.currentProfession?.trim() || "não informada"}`);
  partes.push(`Experiência na área desejada: ${p.experience ?? "nenhuma"}`);
  partes.push(`Horas de estudo por semana: ${Math.max(2, p.study?.hoursPerWeek || 7)}`);
  if (p.learningStyles?.length) partes.push(`Prefere aprender por: ${p.learningStyles.join(", ")}`);
  if (p.budget) partes.push(`Orçamento para estudar: ${p.budget}`);
  if (p.situation) partes.push(`Situação atual: ${p.situation}`);

  const skills = (p.skills ?? []).filter((s) => s.name?.trim());
  partes.push(
    skills.length > 0
      ? `Já sabe (com nível declarado): ${skills.map((s) => `${s.name} (${s.level})`).join(", ")}`
      : "Não declarou nenhuma habilidade prévia.",
  );

  const texto = p.goalText?.trim();
  partes.push(
    texto
      ? `O QUE ELA ESCREVEU QUE QUER FAZER, nas palavras dela: "${texto}"`
      : "Não escreveu nada no campo livre.",
  );

  return partes.join("\n");
}

export type ResultadoGeracao =
  | { ok: true; rota: RotaIA }
  | {
      ok: false;
      motivo: "sem-chave" | "recusa" | "invalida" | "erro";
      detalhe?: string | undefined;
    };

export async function gerarRotaComIA(
  perfil: OnboardingProfile,
  apiKey: string | undefined,
): Promise<ResultadoGeracao> {
  if (!apiKey) return { ok: false, motivo: "sem-chave" };

  const client = new Anthropic({ apiKey });

  try {
    // Streaming porque a rota inteira é uma resposta longa, e um POST não-streaming com
    // max_tokens alto encosta no timeout de HTTP antes de terminar.
    const stream = client.messages.stream({
      model: MODELO,
      max_tokens: 32000,
      system: SISTEMA,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: SCHEMA_ROTA },
      },
      messages: [
        {
          role: "user",
          content: `Monte a trilha de estudo desta pessoa.\n\n${resumirPerfil(perfil)}`,
        },
      ],
    });

    const resposta = await stream.finalMessage();

    // Precisa vir antes de ler o content: numa recusa o content não tem o JSON.
    if (resposta.stop_reason === "refusal") {
      return {
        ok: false,
        motivo: "recusa",
        detalhe: resposta.stop_details?.explanation ?? undefined,
      };
    }

    const texto = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const rota = validarRota(JSON.parse(texto));
    if (!rota) return { ok: false, motivo: "invalida" };
    return { ok: true, rota };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, motivo: "erro", detalhe: "chave da Anthropic inválida" };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, motivo: "erro", detalhe: "limite de uso atingido" };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, motivo: "erro", detalhe: `API respondeu ${error.status}` };
    }
    return {
      ok: false,
      motivo: "erro",
      detalhe: error instanceof Error ? error.message : undefined,
    };
  }
}
