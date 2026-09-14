import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { emptyProfile, type AreaId, type ExperienceId, type GoalId } from "@/lib/onboarding";
import { generateRoute, roleLabelForArea } from "@/lib/route-templates";

const AREA_IDS = [
  "tech",
  "design",
  "marketing",
  "sales",
  "finance",
  "engineering",
  "admin",
  "audiovisual",
  "data",
  "ai",
  "other",
] as const;

const EXPERIENCE_IDS = ["none", "lt1", "1to3", "3to5", "gt5"] as const;

/**
 * Motor determinístico do Pathly exposto como ferramenta: mesma entrada, mesma rota.
 * Não toca em conta nem em dados salvos — só transforma os parâmetros recebidos.
 */
export default defineTool({
  name: "generate_pathly_route",
  title: "Gerar rota do Pathly",
  description:
    "Gera uma rota de estudo personalizada (etapas, habilidades, projetos, horas, XP e renda projetada) a partir da área desejada, renda atual, renda desejada, experiência e horas de estudo por semana. Use list_pathly_catalogs para os ids válidos.",
  inputSchema: {
    area: z.enum(AREA_IDS).describe("Área desejada, ex. 'tech'."),
    currentIncome: z.number().describe("Renda mensal atual em reais (0 se não tem renda)."),
    targetIncome: z.number().describe("Renda mensal desejada em reais."),
    experience: z.enum(EXPERIENCE_IDS).describe("Experiência na área desejada."),
    hoursPerWeek: z.number().describe("Horas de estudo por semana."),
    goal: z.string().optional().describe("Id do objetivo, ex. 'earn_more'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ area, currentIncome, targetIncome, experience, hoursPerWeek, goal }) => {
    const profile = emptyProfile();
    profile.goal = (goal as GoalId | undefined) ?? "earn_more";
    profile.desiredAreas = [area as AreaId];
    profile.experience = experience as ExperienceId;
    profile.income = {
      current: Math.max(0, Math.round(currentIncome)),
      noIncome: currentIncome <= 0,
      target: Math.max(0, Math.round(targetIncome)),
      horizon: null,
    };
    profile.study = {
      hoursPerWeek: Math.min(60, Math.max(2, Math.round(hoursPerWeek))),
      presetId: null,
    };

    const steps = generateRoute(profile);
    const payload = {
      role: roleLabelForArea(area as AreaId),
      totalHours: steps.reduce((sum, s) => sum + s.hours, 0),
      totalXp: steps.reduce((sum, s) => sum + s.xp, 0),
      steps: steps.map((s) => ({
        order: s.order,
        title: s.title,
        goal: s.goal,
        why: s.why,
        difficulty: s.difficulty,
        impactLevel: s.impactLevel,
        milestone: s.milestone,
        demandPct: s.demandPct,
        hours: s.hours,
        startWeek: s.week,
        eta: s.eta,
        incomeAfter: s.incomeAfter,
        skills: s.skills,
        projects: s.projects,
        resources: s.resources,
        checklist: s.checklist.map((c) => c.label),
        xp: s.xp,
      })),
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
