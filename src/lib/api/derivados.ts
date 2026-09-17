import type { CampoContrato, Endpoint, MapaApi, TipoCampo } from "./contrato";
import { EXPLICACAO_AUTENTICACAO, EXPLICACAO_METODO } from "./contrato";

/**
 * Tudo o que se deriva do mapa de APIs: exemplos de `curl`, OpenAPI, documentação, prompts e
 * checklist de testes.
 *
 * Derivado, e não pedido à IA junto com o resto, pela mesma razão do módulo de banco: um exemplo
 * de `curl` escrito à parte do contrato sai desatualizado no primeiro campo que mudar, e um
 * OpenAPI escrito em prosa não abre em ferramenta nenhuma.
 */

const TIPO_JSON: Record<TipoCampo, string> = {
  texto: "string",
  numero: "number",
  booleano: "boolean",
  data: "string",
  uuid: "string",
  email: "string",
  lista: "array",
  objeto: "object",
  arquivo: "string",
};

function valorExemplo(c: CampoContrato): unknown {
  if (c.exemplo) {
    if (c.tipo === "numero") {
      const n = Number(c.exemplo.replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }
    if (c.tipo === "booleano") return c.exemplo.toLowerCase() === "true";
    return c.exemplo;
  }
  const padrao: Record<TipoCampo, unknown> = {
    texto: "texto",
    numero: 0,
    booleano: true,
    data: "2026-09-17",
    uuid: "00000000-0000-0000-0000-000000000000",
    email: "pessoa@exemplo.com",
    lista: [],
    objeto: {},
    arquivo: "arquivo.png",
  };
  return padrao[c.tipo];
}

function corpoExemplo(campos: CampoContrato[]): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const c of campos) o[c.nome] = valorExemplo(c);
  return o;
}

/** A URL com os `:id` já substituídos pelos exemplos — senão o comando não roda. */
function caminhoConcreto(e: Endpoint): string {
  let url = e.caminho;
  for (const p of e.parametrosRota) {
    url = url.replace(`:${p.nome}`, String(valorExemplo(p)));
  }
  if (e.parametrosConsulta.length > 0) {
    const query = e.parametrosConsulta
      .filter((p) => p.obrigatorio)
      .map((p) => `${p.nome}=${encodeURIComponent(String(valorExemplo(p)))}`)
      .join("&");
    if (query) url += `?${query}`;
  }
  return url;
}

export function gerarCurl(e: Endpoint, base = "https://seu-dominio.com"): string {
  const linhas = [`curl -X ${e.metodo} "${base}${caminhoConcreto(e)}"`];

  if (e.autenticacao === "token") linhas.push(`  -H "Authorization: Bearer SEU_TOKEN"`);
  if (e.autenticacao === "api_key") linhas.push(`  -H "X-API-Key: SUA_CHAVE"`);
  if (e.autenticacao === "sessao") linhas.push(`  --cookie "sessao=SEU_COOKIE"`);

  if (e.corpoRequisicao.length > 0) {
    linhas.push(`  -H "Content-Type: application/json"`);
    linhas.push(`  -d '${JSON.stringify(corpoExemplo(e.corpoRequisicao), null, 2)}'`);
  }

  return linhas.join(" \\\n");
}

export function gerarRespostaExemplo(e: Endpoint): string {
  if (e.respostaSucesso.status === 204) return "(sem corpo)";
  return JSON.stringify(corpoExemplo(e.respostaSucesso.corpo), null, 2);
}

/**
 * OpenAPI 3.1, para abrir no Swagger, Insomnia ou Postman.
 *
 * Gerado em YAML e não em JSON porque é o formato que a pessoa vai colar num arquivo e ler — e
 * YAML de OpenAPI aguenta comentário, que é onde cabe a finalidade de cada endpoint.
 */
export function gerarOpenApi(m: MapaApi, nomeProjeto: string): string {
  const linhas: string[] = [
    "openapi: 3.1.0",
    "info:",
    `  title: API do ${nomeProjeto}`,
    "  version: 0.1.0",
    "servers:",
    "  - url: https://seu-dominio.com",
    "    description: producao",
    "paths:",
  ];

  // Agrupa por caminho: o OpenAPI põe os métodos debaixo da rota, não o contrário.
  const porCaminho = new Map<string, Endpoint[]>();
  for (const e of m.endpoints) {
    porCaminho.set(e.caminho, [...(porCaminho.get(e.caminho) ?? []), e]);
  }

  for (const [caminho, lista] of porCaminho) {
    // O OpenAPI usa `{id}`; o app usa `:id`.
    linhas.push(`  ${caminho.replace(/:([a-zA-Z0-9_]+)/g, "{$1}")}:`);

    for (const e of lista) {
      linhas.push(`    ${e.metodo.toLowerCase()}:`);
      linhas.push(`      summary: ${e.finalidade.replace(/\n/g, " ")}`);
      linhas.push(`      tags: [${e.grupo}]`);

      if (e.autenticacao !== "nenhuma") linhas.push(`      security: [{ bearerAuth: [] }]`);

      const parametros = [
        ...e.parametrosRota.map((p) => ({ p, onde: "path" })),
        ...e.parametrosConsulta.map((p) => ({ p, onde: "query" })),
      ];
      if (parametros.length > 0) {
        linhas.push("      parameters:");
        for (const { p, onde } of parametros) {
          linhas.push(`        - name: ${p.nome}`);
          linhas.push(`          in: ${onde}`);
          linhas.push(`          required: ${onde === "path" ? true : p.obrigatorio}`);
          linhas.push(`          schema: { type: ${TIPO_JSON[p.tipo]} }`);
          if (p.descricao) linhas.push(`          description: ${p.descricao.replace(/\n/g, " ")}`);
        }
      }

      if (e.corpoRequisicao.length > 0) {
        linhas.push("      requestBody:");
        linhas.push("        required: true");
        linhas.push("        content:");
        linhas.push("          application/json:");
        linhas.push("            schema:");
        linhas.push("              type: object");
        const obrigatorios = e.corpoRequisicao.filter((c) => c.obrigatorio).map((c) => c.nome);
        if (obrigatorios.length > 0) {
          linhas.push(`              required: [${obrigatorios.join(", ")}]`);
        }
        linhas.push("              properties:");
        for (const c of e.corpoRequisicao) {
          linhas.push(`                ${c.nome}:`);
          linhas.push(`                  type: ${TIPO_JSON[c.tipo]}`);
          if (c.descricao) {
            linhas.push(`                  description: ${c.descricao.replace(/\n/g, " ")}`);
          }
        }
      }

      linhas.push("      responses:");
      linhas.push(`        "${e.respostaSucesso.status}":`);
      linhas.push(`          description: ${e.respostaSucesso.quando.replace(/\n/g, " ")}`);
      for (const err of e.erros) {
        linhas.push(`        "${err.status}":`);
        linhas.push(`          description: ${err.quando.replace(/\n/g, " ")} (${err.codigo})`);
      }
    }
  }

  const temToken = m.endpoints.some((e) => e.autenticacao !== "nenhuma");
  if (temToken) {
    linhas.push(
      "components:",
      "  securitySchemes:",
      "    bearerAuth:",
      "      type: http",
      "      scheme: bearer",
      "      bearerFormat: JWT",
    );
  }

  return linhas.join("\n");
}

/** A documentação da API em Markdown, para README ou wiki. */
export function gerarDocumentacao(m: MapaApi, nomeProjeto: string): string {
  const p: string[] = [`# API do ${nomeProjeto}`, ""];

  if (m.convencoes.length > 0) {
    p.push("## Regras que valem para toda a API", "", ...m.convencoes.map((c) => `- ${c}`), "");
  }

  for (const grupo of m.grupos) {
    const daqui = m.endpoints.filter((e) => e.grupo === grupo.nome);
    if (daqui.length === 0) continue;

    p.push(`## ${grupo.nome}`, "");
    if (grupo.descricao) p.push(grupo.descricao, "");

    for (const e of daqui) {
      p.push(`### \`${e.metodo} ${e.caminho}\``, "", e.finalidade, "");
      p.push(
        `**Autenticação:** ${EXPLICACAO_AUTENTICACAO[e.autenticacao]}`,
        e.autorizacao ? `**Quem pode:** ${e.autorizacao}` : "",
        "",
      );

      if (e.corpoRequisicao.length > 0) {
        p.push(
          "**Corpo da requisição**",
          "",
          "| Campo | Tipo | Obrigatório | Regra |",
          "| --- | --- | --- | --- |",
        );
        for (const c of e.corpoRequisicao) {
          p.push(
            `| \`${c.nome}\` | ${c.tipo} | ${c.obrigatorio ? "sim" : "não"} | ${c.validacao || "—"} |`,
          );
        }
        p.push("");
      }

      p.push("**Exemplo**", "", "```bash", gerarCurl(e), "```", "");
      p.push(
        `**Resposta ${e.respostaSucesso.status}**`,
        "",
        "```json",
        gerarRespostaExemplo(e),
        "```",
        "",
      );

      if (e.erros.length > 0) {
        p.push("**Erros**", "", "| Status | Código | Quando |", "| --- | --- | --- |");
        for (const err of e.erros) {
          p.push(`| ${err.status} | \`${err.codigo}\` | ${err.quando} |`);
        }
        p.push("");
      }
    }
  }

  return p.join("\n");
}

export type PromptApi = { id: string; titulo: string; para: string; texto: string };

function resumoDosEndpoints(m: MapaApi): string {
  return m.endpoints
    .map((e) => {
      const corpo =
        e.corpoRequisicao.length > 0
          ? ` | corpo: ${e.corpoRequisicao.map((c) => `${c.nome}${c.obrigatorio ? "*" : ""}`).join(", ")}`
          : "";
      const auth = e.autenticacao === "nenhuma" ? "público" : e.autenticacao;
      return `  ${e.metodo} ${e.caminho} — ${e.finalidade} [${auth}]${corpo}`;
    })
    .join("\n");
}

export function gerarPrompts(m: MapaApi, nomeProjeto: string, stack: string): PromptApi[] {
  const comAuth = m.endpoints.filter((e) => e.autenticacao !== "nenhuma");
  const comLimite = m.endpoints.filter((e) => e.limiteUso.temLimite);

  const prompts: PromptApi[] = [
    {
      id: "rotas",
      titulo: "Implementar as rotas",
      para: "Criar os endpoints com validação e tratamento de erro.",
      texto: `Implemente os endpoints da API do projeto "${nomeProjeto}"${stack ? `, usando ${stack}` : ""}.

Endpoints:

${resumoDosEndpoints(m)}

${m.convencoes.length > 0 ? `Regras que valem para toda a API:\n${m.convencoes.map((c) => `- ${c}`).join("\n")}\n` : ""}
Para cada endpoint:
- Valide o corpo ANTES de tocar no banco. Campo fora do contrato deve ser rejeitado, não ignorado.
- Use o status correto: 201 para criação, 204 quando não há corpo, 200 no resto.
- Erro sempre no mesmo formato: um código estável que o cliente testa e uma mensagem para a pessoa ler. A mensagem nunca pode conter nome de tabela nem trecho de SQL.
- Nunca decida permissão com um valor que veio do corpo da requisição.

Não crie endpoint que não esteja na lista.`,
    },
    {
      id: "validacao",
      titulo: "Criar as validações",
      para: "Escrever os schemas de entrada de cada rota.",
      texto: `Escreva as validações de entrada da API do projeto "${nomeProjeto}"${stack ? ` em ${stack}` : ""}.

${m.endpoints
  .filter((e) => e.corpoRequisicao.length > 0 || e.parametrosConsulta.length > 0)
  .map(
    (e) =>
      `${e.metodo} ${e.caminho}\n${[...e.corpoRequisicao, ...e.parametrosConsulta]
        .map(
          (c) =>
            `  - ${c.nome} (${c.tipo}${c.obrigatorio ? ", obrigatório" : ""}): ${c.validacao || c.descricao}`,
        )
        .join("\n")}`,
  )
  .join("\n\n")}

Use a biblioteca de validação que já existe no projeto. Se não houver nenhuma, me pergunte qual usar antes de escrever.
Rejeite campo não declarado em vez de ignorá-lo silenciosamente.`,
    },
    {
      id: "testes",
      titulo: "Escrever os testes",
      para: "Cobrir o caminho feliz e os erros de cada rota.",
      texto: `Escreva testes de integração para a API do projeto "${nomeProjeto}"${stack ? ` em ${stack}` : ""}.

${m.endpoints
  .map(
    (e) =>
      `${e.metodo} ${e.caminho}\n  sucesso: ${e.respostaSucesso.status} — ${e.respostaSucesso.quando}\n${e.erros.map((x) => `  erro: ${x.status} ${x.codigo} — ${x.quando}`).join("\n")}`,
  )
  .join("\n\n")}

Para cada endpoint, teste o caminho feliz e CADA erro listado.
${comAuth.length > 0 ? "Para os endpoints autenticados, teste também: sem token (401) e com token de outra pessoa tentando acessar recurso alheio (403 ou 404)." : ""}
Use a ferramenta de teste que já existe no projeto. Os testes precisam poder rodar em qualquer ordem.`,
    },
  ];

  if (comAuth.length > 0) {
    prompts.push({
      id: "auth",
      titulo: "Implementar a autenticação",
      para: "Proteger as rotas que exigem identidade.",
      texto: `Implemente a autenticação da API do projeto "${nomeProjeto}"${stack ? ` em ${stack}` : ""}.

Endpoints protegidos:

${comAuth.map((e) => `  ${e.metodo} ${e.caminho} [${e.autenticacao}] — ${e.autorizacao || "quem pode: não especificado"}`).join("\n")}

Preciso de:
- O middleware que confere a identidade e devolve 401 quando ela falta ou é inválida.
- A checagem de AUTORIZAÇÃO, separada da autenticação: confirmar que quem chamou pode mexer NAQUELE registro. O dono do recurso sai sempre da identidade autenticada, nunca de um id vindo do corpo.
- Prazo de validade curto, e o caminho de renovação.
- Diga explicitamente o que a sua implementação NÃO protege.`,
    });
  }

  if (comLimite.length > 0) {
    prompts.push({
      id: "ratelimit",
      titulo: "Implementar o rate limiting",
      para: "Colocar teto de chamadas onde precisa.",
      texto: `Implemente o limite de chamadas da API do projeto "${nomeProjeto}"${stack ? ` em ${stack}` : ""}.

${comLimite.map((e) => `  ${e.metodo} ${e.caminho} — ${e.limiteUso.quanto}\n    motivo: ${e.limiteUso.porque}`).join("\n\n")}

Requisitos:
- O contador precisa ser compartilhado entre instâncias. Guardar em memória não funciona quando há mais de uma cópia do servidor rodando.
- O incremento tem que ser atômico: ler e depois gravar deixa cem chamadas simultâneas passarem juntas.
- Devolva 429 com o cabeçalho \`Retry-After\`.
- Se o contador estiver fora do ar, decida e justifique: bloquear tudo ou deixar passar.`,
    });
  }

  return prompts;
}

export type ItemTeste = { texto: string; como: string; endpoint: string | null };

/**
 * O checklist de testes, derivado dos endpoints.
 *
 * Cada item aponta para uma chamada concreta que a pessoa consegue fazer. "Teste a autenticação"
 * não é item de checklist — é um pedido para ela inventar o teste sozinha.
 */
export function gerarChecklistTestes(m: MapaApi): ItemTeste[] {
  const itens: ItemTeste[] = [];

  for (const e of m.endpoints) {
    itens.push({
      endpoint: e.id,
      texto: `${e.metodo} ${e.caminho} responde ${e.respostaSucesso.status} no caminho feliz`,
      como: `Rode o \`curl\` de exemplo desta rota. Deve voltar ${e.respostaSucesso.status}.`,
    });
  }

  const autenticados = m.endpoints.filter((e) => e.autenticacao !== "nenhuma");
  if (autenticados.length > 0) {
    const alvo = autenticados[0]!;
    itens.push({
      endpoint: alvo.id,
      texto: "Rota protegida recusa chamada sem identificação",
      como: `Rode o \`curl\` de \`${alvo.metodo} ${alvo.caminho}\` sem o cabeçalho de autenticação. Tem que voltar 401, e não 200 nem 500.`,
    });
    itens.push({
      endpoint: alvo.id,
      texto: "Uma pessoa não acessa o recurso de outra",
      como: `Entre com duas contas diferentes. Com o token da conta A, chame \`${alvo.caminho}\` usando um id que pertence à conta B. Tem que voltar 403 ou 404 — nunca os dados.`,
    });
  }

  const comValidacao = m.endpoints.filter((e) =>
    e.corpoRequisicao.some((c) => c.obrigatorio || c.validacao),
  );
  if (comValidacao.length > 0) {
    const alvo = comValidacao[0]!;
    const campo = alvo.corpoRequisicao.find((c) => c.obrigatorio) ?? alvo.corpoRequisicao[0]!;
    itens.push({
      endpoint: alvo.id,
      texto: "Campo obrigatório faltando é recusado",
      como: `Chame \`${alvo.metodo} ${alvo.caminho}\` sem o campo \`${campo.nome}\`. Tem que voltar 400 ou 422 com um código de erro, não 500.`,
    });
    itens.push({
      endpoint: alvo.id,
      texto: "Campo que não existe no contrato é recusado",
      como: `Chame \`${alvo.metodo} ${alvo.caminho}\` com um campo extra, tipo \`"admin": true\`. Ele deve ser rejeitado — não ignorado em silêncio.`,
    });
  }

  const comLimite = m.endpoints.filter((e) => e.limiteUso.temLimite);
  if (comLimite.length > 0) {
    const alvo = comLimite[0]!;
    itens.push({
      endpoint: alvo.id,
      texto: "O teto de chamadas funciona",
      como: `Chame \`${alvo.caminho}\` em laço até passar de ${alvo.limiteUso.quanto}. Tem que voltar 429.`,
    });
  }

  const sensiveis = m.endpoints.filter((e) => e.respostaSucesso.corpo.some((c) => c.sensivel));
  if (sensiveis.length > 0) {
    itens.push({
      endpoint: sensiveis[0]!.id,
      texto: "Dado sensível não sai por acidente",
      como: `Olhe o JSON devolvido por \`${sensiveis[0]!.caminho}\` e confirme que nenhum campo pessoal aparece sem você ter pedido. Senha e hash nunca podem estar ali.`,
    });
  }

  itens.push({
    endpoint: null,
    texto: "Nenhum erro devolve 500",
    como: "Force cada erro da lista de cada endpoint. Todo 500 que aparecer é um bug seu, não uma resposta planejada.",
  });

  return itens;
}

/** O resumo textual de um endpoint, para a tela mostrar sem repetir lógica. */
export function explicarEndpoint(e: Endpoint): { metodo: string; autenticacao: string } {
  return {
    metodo: EXPLICACAO_METODO[e.metodo],
    autenticacao: EXPLICACAO_AUTENTICACAO[e.autenticacao],
  };
}
