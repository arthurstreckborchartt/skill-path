import { defineTool } from "@lovable.dev/mcp-js";
import {
  areas,
  budgets,
  experiences,
  goals,
  horizons,
  learningStyles,
  situations,
  workModels,
} from "@/lib/onboarding";

/**
 * Catálogos do onboarding: os ids estáveis que `generate_pathly_route` espera.
 * Sem eles o cliente teria que adivinhar valores como "tech" ou "1to3".
 */
export default defineTool({
  name: "list_pathly_catalogs",
  title: "Listar catálogos do Pathly",
  description:
    "Lista as opções válidas (ids e rótulos) de objetivos, áreas, experiência, prazos, estilos de aprendizado, orçamento, situação e modelo de trabalho usadas para gerar uma rota.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const payload = {
      goals,
      areas,
      experiences,
      horizons,
      learningStyles,
      budgets,
      situations,
      workModels,
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
