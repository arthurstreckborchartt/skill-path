import type { OnboardingProfile } from "@/lib/onboarding";

/**
 * O prompt é compartilhado pelos dois provedores de propósito.
 *
 * O plano gratuito usa um modelo gratuito e o Pro usa o Claude, mas as **regras do produto são
 * as mesmas**: nenhum dos dois pode prometer emprego, prometer renda, citar vaga ou inventar
 * estatística. Se cada provedor tivesse o seu texto, a regra ia divergir na primeira edição —
 * e a versão gratuita é justamente a que mais gente vai ver.
 */

export const SISTEMA = `Você monta trilhas de estudo para a Pathly, um app brasileiro para pessoas que
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

export function resumirPerfil(p: OnboardingProfile): string {
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
