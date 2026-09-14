import { defineMcp } from "@lovable.dev/mcp-js";
import generateRouteTool from "./tools/generate-route";
import listCatalogsTool from "./tools/list-catalogs";

export default defineMcp({
  name: "pathly",
  title: "Pathly",
  version: "0.1.0",
  instructions:
    "Ferramentas do Pathly. Use `list_pathly_catalogs` para descobrir os ids válidos (áreas, objetivos, experiência) e `generate_pathly_route` para montar uma rota de estudo personalizada entre a renda atual e a renda desejada. Nenhuma ferramenta acessa dados de conta.",
  tools: [listCatalogsTool, generateRouteTool],
});
