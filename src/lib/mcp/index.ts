import { auth, defineMcp } from "@lovable.dev/mcp-js";
import generateRouteTool from "./tools/generate-route";
import listCatalogsTool from "./tools/list-catalogs";
import { FERRAMENTAS_DO_GATEWAY } from "./gateway/ferramentas";

const supabaseUrl = (process.env["SUPABASE_URL"] ?? import.meta.env["VITE_SUPABASE_URL"]).replace(
  /\/+$/,
  "",
);

/**
 * As instruções que todo cliente MCP lê antes de escolher uma ferramenta.
 *
 * O parágrafo sobre `pathly_request_*` é o mais importante daqui. Um agente que não entenda que
 * `APPROVAL_REQUIRED` é uma resposta normal vai tratá-la como falha e repetir a chamada — e
 * repetir cria pedidos duplicados, que a pessoa então precisa recusar um a um.
 *
 * Por isso a instrução diz as três coisas: não é erro, não repita, e conte a quem está usando
 * você que existe um pedido esperando.
 */
const INSTRUCOES = [
  "Ferramentas do Pathly, em duas famílias.",
  "",
  "PÚBLICAS, sem conta: `list_pathly_catalogs` e `generate_pathly_route` montam uma rota de " +
    "estudo a partir de parâmetros. Não tocam em dados de ninguém.",
  "",
  "DO PROJETO, exigem login e permissão concedida à sua integração: as `pathly_get_*` leem " +
    "plano, etapa atual, decisões técnicas, erros conhecidos e histórico de trabalho. As " +
    "`pathly_update_task`, `pathly_report_error`, `pathly_add_decision`, " +
    "`pathly_report_implementation` e `pathly_update_blueprint` escrevem no registro do projeto " +
    "DENTRO do Pathly — nunca no seu código, no seu repositório ou no seu vault.",
  "",
  "As `pathly_request_*` NÃO EXECUTAM NADA. Elas criam um pedido e devolvem `APPROVAL_REQUIRED` " +
    "com um `request_id`: alterar arquivo, rodar comando, commitar, empurrar e publicar só " +
    "acontecem depois de a pessoa aprovar no Pathly. Receber `APPROVAL_REQUIRED` não é erro e " +
    "não deve ser repetido — avise quem está usando você que há um pedido esperando decisão, e " +
    "siga com o que der para fazer sem ele.",
  "",
  "Permissão é por nível e por projeto, e cada nível precisa ser autorizado explicitamente: " +
    "READ não alcança WRITE, WRITE não alcança COMMIT, e COMMIT não alcança PUSH. Quando faltar " +
    "permissão, a resposta diz exatamente qual — repita isso para a pessoa em vez de procurar " +
    "outro caminho.",
].join("\n");

export default defineMcp({
  name: "pathly",
  title: "Pathly",
  version: "0.2.0",
  instructions: INSTRUCOES,
  auth: auth.oauth.issuer({
    issuer: `${supabaseUrl}/auth/v1`,
    acceptedAudiences: "authenticated",
    jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  }),
  tools: [listCatalogsTool, generateRouteTool, ...FERRAMENTAS_DO_GATEWAY],
});
