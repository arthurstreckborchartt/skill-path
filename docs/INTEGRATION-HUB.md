# Integration Hub

A camada estrutural que permite o Pathly trabalhar conectado às ferramentas que a pessoa já usa —
sem que nenhuma delas tenha código dentro do núcleo.

**Estado:** arquitetura entregue, nenhuma integração concreta implementada. O registro de
adaptadores nasce vazio, de propósito: é isso que prova que o núcleo funciona sem conhecer
fornecedor nenhum.

---

## 1. A auditoria que veio antes

Levantada em 2026-09-20, contra o repositório e o banco vivo.

| Área             | O que existe hoje                                                                                                                               |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Autenticação** | Supabase Auth. Sessão no `localStorage` do cliente. 13 rotas de servidor validam `Authorization: Bearer` contra `${SUPABASE_URL}/auth/v1/user`. |
| **Usuários**     | `auth.users` + `pathly_profiles` (plano, perfil).                                                                                               |
| **Projetos**     | `pathly_projetos` — blueprint em `conteudo` (jsonb), respostas, `etapa_atual`, `etapas_concluidas`, `etapas_total`. RLS por `user_id`.          |
| **Blueprint**    | `src/lib/blueprint/` — cinco blocos em ordem obrigatória: fundação → produto → técnico → operação → execução.                                   |
| **Etapas**       | Dentro de `blueprint.execucao`, com contadores na linha do projeto.                                                                             |
| **Copilot**      | `src/lib/copilot/` (12 arquivos). Mensagens e decisões append-only; propostas exigem confirmação humana antes de tocar o Blueprint.             |
| **O ciclo**      | Ver seção 2 — está fechado, e tem um único escritor.                                                                                            |
| **Banco**        | 24 tabelas em `public`, 72 policies de RLS, 2 triggers. Lovable Cloud.                                                                          |
| **Backend**      | **Não há Edge Functions.** São rotas server do TanStack Start em Cloudflare Workers: 15 arquivos `src/routes/api.*.ts`.                         |
| **Secrets**      | `src/lib/server-env.ts` → `lerEnv`, que lê o env do Worker, depois `process.env`, depois `import.meta.env`. Nada sensível com prefixo `VITE_`.  |
| **Permissões**   | RLS por dono (`auth.uid() = user_id`) + privilégio explícito (`REVOKE ALL` → `GRANT` do necessário) + o portão de aprovação de ações externas.  |
| **Frontend**     | TanStack Router por arquivo; design monocromático em `src/components/pathly/ui.tsx`.                                                            |
| **APIs**         | Forma uniforme: env → Bearer → `lerJsonLimitado` → `registrarUso` (limite por `politica-custo.ts`) → PostgREST **como a pessoa**.               |
| **Serviços**     | Um módulo por domínio em `src/lib/*`, no formato `contrato` / `catalogo` / `motor` / `usar-*`.                                                  |

### O achado que mais importou

**Já existe uma camada de integrações neste repositório**, validada por sonda no mesmo dia:

- `pathly_conexoes` — uma linha por pessoa × provedor, token cifrado (AES-GCM) e protegido por
  **privilégio de coluna**: `authenticated` recebe `select` de sete colunas nomeadas, e
  `token_cifrado` não está entre elas.
- `pathly_acoes_externas` — append-only, com gatilho de transição no banco que impede
  `pendente → executada` direto.

O Hub **não recria nem substitui** essas duas: elas **são** o `IntegrationConnection` e o
`IntegrationAction`. Refazê-las seria descartar um sistema validado para chamá-lo de outro nome.

O que o Hub acrescenta é o que estava fraco em volta delas — o catálogo de provedores declarava
cinco campos, e o executor era um `switch` — mais as três peças que não existiam: permissão
granular, evento e auditoria.

---

## 2. O ciclo do Pathly, e onde o Hub entra

```
PLANEJAR ──► IMPLEMENTAR ──► TESTAR ──► VALIDAR ──► ATUALIZAR BLUEPRINT ──► PRÓXIMO PASSO
   │              │             │           │                │                     │
blueprint/    prompt-builder  lancamento/  validacao/   copilot/aplicar.ts   proximo-passo.ts
                    │                                          ▲
                    └──────── o Hub entra aqui ────────────────┘
                         (executa fora, e volta com resultado)
```

**O Blueprint tem um único escritor: uma proposta aprovada** (`copilot/aplicar.ts::aprovarProposta`
→ `escreverCaminho`). Essa é a restrição mais importante da arquitetura inteira, e o Hub a honra:
a capacidade `UPDATE_BLUEPRINT` **não** dá acesso de escrita ao plano. Ela permite _criar
propostas_, que continuam passando pela mesma aprovação humana, uma a uma.

Uma integração jamais escreve no plano. Ela propõe, como o Copilot.

---

## 3. Os oito conceitos

| Conceito                  | Onde vive                                             | Estado                            |
| ------------------------- | ----------------------------------------------------- | --------------------------------- |
| **IntegrationProvider**   | `src/lib/hub/contrato.ts`                             | novo (generaliza `provedores.ts`) |
| **IntegrationAdapter**    | `src/lib/hub/adaptador.ts`                            | novo (substitui o `switch`)       |
| **IntegrationConnection** | tipo em `contrato.ts`, tabela `pathly_conexoes`       | **já existia, validada**          |
| **IntegrationPermission** | `contrato.ts` + `pathly_hub_permissoes`               | novo                              |
| **IntegrationAction**     | tipo em `contrato.ts`, tabela `pathly_acoes_externas` | **já existia, validada**          |
| **IntegrationCapability** | `src/lib/hub/capacidades.ts`                          | novo                              |
| **IntegrationEvent**      | `contrato.ts` + `pathly_hub_eventos`                  | novo                              |
| **IntegrationAuditLog**   | `contrato.ts` + `pathly_hub_auditoria`                | novo                              |

### O que cada provedor declara

```ts
{
  id, nome, tipo, versao, status, descricao,
  metodoAuth,        // oauth | api-key | cli-local | bridge | nenhum
  execucao,          // nuvem | local | hibrido
  precisaBridge,     // nuvem nenhuma alcança localhost
  transportes:  { mcp, oauth, apiKey, webhook, cli },
  suporte:      { leitura, escrita, execucao, sincronizacao },
  capacidades,       // o que PODE oferecer — a pessoa concede um subconjunto
  permissoesExternas,// escopos do fornecedor, visíveis antes de autorizar
  acoes,             // cada uma declara as capacidades que consome
  limitacoes,        // o que NÃO faz, em português
}
```

`capacidades` é o que a ferramenta **oferece**; `suporte` é o que ela **sabe fazer**. São coisas
diferentes, e `conferirProvedor()` acusa quando se contradizem — por exemplo, declarar que não
escreve e listar uma capacidade de escrita.

---

## 4. O modelo de capacidades

16 capacidades, em quatro classes de risco: `leitura`, `escrita`, `execucao`, `destrutiva`.

```
READ_PROJECT        UPDATE_BLUEPRINT ──exige──► READ_PROJECT
READ_FILES          WRITE_FILES, CREATE_FILE, UPDATE_FILE, DELETE_FILE ──exige──► READ_FILES
EXECUTE_COMMAND     RUN_TESTS
READ_GIT            CREATE_BRANCH, CREATE_COMMIT ──exige──► READ_GIT
                    PUSH_GIT ──exige──► READ_GIT + CREATE_COMMIT
READ_OBSIDIAN       WRITE_OBSIDIAN, CREATE_OBSIDIAN_NOTE ──exige──► READ_OBSIDIAN
```

### A regra, sem exceção

**Nada é concedido automaticamente.**

- Conectar uma conta **não** concede capacidade nenhuma. Conectar e autorizar são dois atos.
- Dependência **não** é concedida junto. Marcar “enviar para o remoto” e ganhar “criar commit” de
  brinde é exatamente o consentimento que não vale nada. O Hub recusa e a tela diz o que autorizar
  antes.
- Revogar **derruba quem depende** — a direção segura: tira acesso, nunca dá.
- Permissão tem validade opcional, e escopo opcional por projeto.

Cada capacidade declara `oQuePermite` e, quando há confusão previsível, `naoPermite`. Metade das
autorizações ruins vem de supor que marcar uma coisa não implicava outra.

---

## 5. As tabelas

Script: `supabase/pathly_hub.sql` — **estado `gerado`, nunca executado.** Aditivo.

| Tabela                  | Papel                 | Privilégio de `authenticated` | Proteção extra                                      |
| ----------------------- | --------------------- | ----------------------------- | --------------------------------------------------- |
| `pathly_hub_permissoes` | IntegrationPermission | `select, insert, update`      | gatilho: revogada não volta; o que concede não muda |
| `pathly_hub_eventos`    | IntegrationEvent      | **`select` apenas**           | inserir é só do servidor, que confere a assinatura  |
| `pathly_hub_auditoria`  | IntegrationAuditLog   | `select, insert`              | gatilho barra `update` e `delete` — para todos      |

Decisões que valem explicar:

- **Uma linha por capacidade**, não um vetor numa coluna: dá para saber _quando_ cada uma foi
  concedida, revogar uma sem reescrever as outras, e referenciá-la na auditoria.
- **Revogar não apaga** — preenche `revogada_em`. Uma permissão que existiu é um fato.
- **O servidor não tem `insert` em permissões.** Se tivesse, existiria um caminho em que o Pathly
  concede permissão a si mesmo.
- **Evento é dado, nunca instrução.** Um webhook dizendo “rode os testes” vira uma linha, e no
  máximo produz uma ação `pendente`. Sem isso, quem descobre a URL do webhook comanda o Pathly.

---

## 6. Como adicionar uma integração nova

Exemplo com um provedor fictício. **Dois arquivos, e uma linha.**

**a) Escreva o adaptador,** em `src/lib/hub/provedores/exemplo.ts`:

```ts
import type { IntegrationAdapter } from "../adaptador";

export const exemplo: IntegrationAdapter = {
  provedor: {
    id: "exemplo",
    nome: "Exemplo",
    tipo: "controle-de-versao",
    versao: "1.0.0",
    status: "beta",
    descricao: "Lê repositórios para dar contexto ao plano.",
    metodoAuth: "oauth",
    execucao: "nuvem",
    precisaBridge: false,
    transportes: { mcp: false, oauth: true, apiKey: false, webhook: false, cli: false },
    suporte: { leitura: true, escrita: false, execucao: false, sincronizacao: false },
    capacidades: ["READ_GIT"],
    permissoesExternas: ["repo:read"],
    acoes: [
      {
        id: "listar-repos",
        rotulo: "Listar repositórios",
        resumo: "Ler a lista dos seus repositórios.",
        destino: "GET https://api.exemplo.com/repos",
        impacto: "leitura",
        exige: ["READ_GIT"],
      },
    ],
    limitacoes: ["não escreve nada", "não enxerga repositório privado de organização"],
  },

  executar: async (acao, ctx) => {
    // `acao` chega já aprovada e reservada. Não reconfira permissão aqui.
    const r = await fetch("https://api.exemplo.com/repos", {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    if (!r.ok) return { ok: false, motivo: `Recusado (${r.status}).`, permanente: false };
    const repos = (await r.json()) as unknown[];
    return { ok: true, resumo: `${repos.length} repositórios.` };
  },

  urlDeAutorizacao: ({ redirectUri, estado, desafioPkce }) => `https://exemplo.com/oauth?...`,
  concluirConexao: async ({ codigo, redirectUri, verificadorPkce }) => {
    /* ... */
  },
};
```

**b) Registre,** em `src/lib/hub/registro.ts`:

```diff
- export const ADAPTADORES: readonly IntegrationAdapter[] = [];
+ export const ADAPTADORES: readonly IntegrationAdapter[] = [exemplo];
```

**Pronto.** Nenhum outro arquivo muda: nem tela, nem executor, nem contrato, nem banco. A tela de
permissões monta sozinha a partir de `capacidades`, e o portão sozinho a partir de `acoes[].exige`.

Se algum dia acrescentar um provedor exigir mexer em outro lugar, é sinal de que vazou
conhecimento de ferramenta para o núcleo — e o conserto é o vazamento, não o provedor.

**c) Rode a conferência.** `conferirRegistro()` acusa declaração incoerente: ação que exige
capacidade não declarada, provedor que diz não escrever mas tem capacidade de escrita, ferramenta
local sem bridge, OAuth sem `urlDeAutorizacao`, webhook sem `verificarAssinatura`.

---

## 7. O que falta, e em que ordem

Esta entrega é a **camada estrutural**. Falta, na ordem em que faz sentido:

1. Rodar `supabase/pathly_hub.sql` e validar por sonda (o roteiro está no fim do script).
2. A tela de permissões, montada a partir de `montarTelaDePermissoes()`.
3. O portão no servidor: `podeExecutar()` antes de chamar `adaptador.executar()`, e
   `acesso-negado` na auditoria quando recusar.
4. Migrar o `src/lib/integracoes/` existente para adaptadores — ele continua funcionando como
   está até lá, e essa migração não tem pressa.
5. Só então os provedores concretos.

O bridge local (Cursor, Claude Code, VS Code, Obsidian, Revit) é um projeto à parte: exige um
processo na máquina da pessoa, e a nuvem não alcança `localhost`. A arquitetura já reserva o
lugar dele em `execucao: "local"` e `precisaBridge: true`.
