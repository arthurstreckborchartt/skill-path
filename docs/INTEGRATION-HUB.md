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

## 7. Permissões e aprovações

Entregue em 2026-09-20. Código em `src/lib/hub/niveis.ts`, `aprovacao.ts` e `protecoes.ts`;
tela em `src/components/pathly/confirmar-acao.tsx`; tabela em
`supabase/pathly_hub_aprovacoes.sql`.

### A regra absoluta

O Pathly **nunca** comita, empurra, publica, apaga, executa comando ou altera código sozinho.
Três mecanismos independentes a sustentam:

|                        | Pergunta que responde               |
| ---------------------- | ----------------------------------- |
| **Permissão**          | a pessoa autorizou esta capacidade? |
| **Aprovação por ação** | e autorizou **desta vez**?          |
| **Reautenticação**     | e é ela mesma, **agora**?           |

Permissão é o que pode acontecer; aprovação é o que vai acontecer agora. Juntá-las produziria um
dos dois erros: ou cada leitura pediria confirmação (e a pessoa aprenderia a clicar sem ler), ou
uma autorização de meses atrás bastaria para um push hoje.

### Os oito níveis

`READ < SUGGEST < WRITE < EXECUTE` formam uma escada. `COMMIT`, `PUSH`, `DEPLOY` e `DELETE`
**não estão nela**: cada um exige concessão própria e nada os cobre, porque cada um produz uma
consequência que não se desfaz do lado de cá.

| Nível                  | Aprovação a cada ação | Reautenticação | Pode ser persistente |
| ---------------------- | --------------------- | -------------- | -------------------- |
| READ, SUGGEST, WRITE   | não                   | não            | sim                  |
| EXECUTE                | **sim**               | não            | sim                  |
| COMMIT, DEPLOY, DELETE | **sim**               | não            | **não**              |
| PUSH                   | **sim**               | **sim**        | **não**              |

Os níveis substituíram as quatro classes de risco do dia anterior. Medem o mesmo eixo, e manter
as duas seria duas taxonomias para divergirem.

### Cobertura nunca é silenciosa

Dentro da escada, um nível superior cobre um inferior — mas `decidir()` devolve
`avisoDeCobertura` junto, e a tela é obrigada a mostrar. Reutilizar uma permissão ampla para uma
ação menor sem dizer é precisamente o que a regra proíbe.

### Escopos

`uma-vez` (padrão), `sessao`, `persistente`. O padrão importa: quando a caixa vem marcada em
"para sempre", a escolha deixa de ser escolha. E `persistente` some da tela nos quatro níveis que
o proíbem — a regra vive no código **e** numa `check constraint`, porque uma só é uma regra que
alguém contorna pelo outro caminho.

### As proteções, e contra o quê

| Proteção                                  | Ataque                                             |
| ----------------------------------------- | -------------------------------------------------- |
| `impressaoDigital` + índice único parcial | ação duplicada (clique duplo, retry, aba reaberta) |
| `novoNonce` + `mesmoSegredo`              | replay da requisição de execução                   |
| `podeReservar` + `APPROVED → EXECUTING`   | execução dupla                                     |
| `confereVinculo`                          | requisição forjada, escalada de permissão          |
| `confereConteudo`                         | troca do payload depois da aprovação               |
| `requisicaoDeAprovacaoValida`             | CSRF                                               |
| Gatilho de transição no banco             | atalho de estado vindo do cliente                  |
| `select` por coluna sem o `nonce`         | token vazado pelo navegador                        |

Autenticação e RLS **não** estão nessa lista de propósito: chamada não autenticada morre na rota,
acesso a linha alheia morre na RLS, e reimplementá-las aqui criaria uma segunda regra para
divergir da primeira.

### O texto da confirmação

Sai de `fraseDeConfirmacao()`, em código. Nunca "Permitir acesso" — sempre quem, o quê e onde:

- _"Permitir que o Codex modifique arquivos deste projeto?"_
- _"Permitir que o Pathly solicite um commit em seu nome?"_
- _"Permitir acesso de leitura ao vault do Obsidian?"_

A tela é obrigada a mostrar a consequência (`oQueAcontece` do nível), o limite (`naoPermite` da
capacidade) e o aviso de cobertura quando houver.

### Provado por

219 asserções, 0 falhas — escritas para **contornar** o sistema, não para confirmá-lo. Entre elas:
toda capacidade consequente é recusada sem aprovação; PUSH é recusado com identidade de seis
minutos atrás; aprovação de leitura apresentada na hora do deploy é recusada; conteúdo trocado
depois da aprovação é recusado; e nenhuma das 17 frases de confirmação é genérica.

## 7. O que falta, e em que ordem

Esta entrega é a **camada estrutural**. Falta, na ordem em que faz sentido:

1. ~~Rodar `supabase/pathly_hub.sql`~~ — feito e validado em duas rodadas.
2. Rodar `supabase/pathly_hub_aprovacoes.sql` e validar por sonda.
3. A tela de permissões, montada a partir de `montarTelaDePermissoes()`.
4. O portão no servidor: `decidir()` antes de chamar `adaptador.executar()`, a reserva por nonce,
   e `acesso-negado` na auditoria quando recusar.
5. Migrar o `src/lib/integracoes/` existente para adaptadores — ele continua funcionando como
   está até lá, e essa migração não tem pressa.
6. Só então os provedores concretos.

O bridge local (Cursor, Claude Code, VS Code, Obsidian, Revit) é um projeto à parte: exige um
processo na máquina da pessoa, e a nuvem não alcança `localhost`. A arquitetura já reserva o
lugar dele em `execucao: "local"` e `precisaBridge: true`.

## 8. Ferramentas de desenvolvimento com IA

Camada separada, em `src/lib/hub/ia/`. Não é um provedor do Hub — é outra abstração, e misturar
as duas produziria uma tela prometendo por conta de uma capacidade que a outra tem.

### A pesquisa decidiu a arquitetura

O pedido foi explícito: não inventar API. Antes de escrever qualquer adapter, fui ver o que existe
de verdade.

| Ferramenta   | Mecanismo real                                                  | O Pathly dirige da nuvem? |
| ------------ | --------------------------------------------------------------- | ------------------------- |
| Claude (API) | REST oficial, API key, `@anthropic-ai/sdk`                      | **sim**                   |
| Claude Code  | CLI local / Claude Agent SDK — harness que quem usa hospeda     | não                       |
| Codex        | Codex SDK roda **local** e exige o CLI instalado                | não                       |
| Cursor       | CLI headless na infra de quem usa, `.cursor/rules`, cliente MCP | não                       |

**Três das quatro rodam na máquina da pessoa.** O Codex é o caso que quase me enganou: existe
Codex na nuvem, mas ligado à conta ChatGPT de quem usa, não a uma API que um terceiro chame em
nome de outra pessoa. "Roda na nuvem" e "eu consigo chamar de fora" são coisas diferentes, e é
entre as duas que uma integração falsa nasce.

Consequência: **não existe botão "Executar com Cursor"**. O que existe é "Copiar contexto" e
"Baixar `.cursor/rules/pathly.mdc`", e cada cartão da tela abre dizendo qual dos dois é o caso.

### `AiDevelopmentProvider`

Declara `capacidades` (o que a ferramenta sabe fazer), `entregas` (como o contexto chega, da
preferida para a de menor esforço), `retorno`, `local`, `mecanismo` (com fonte e data de
verificação), `capacidadesDoHub` e `limitacoes`.

Duas invariantes são testadas, não confiadas:

- provedor `local` **nunca** declara `api-direta`;
- provedor que não executa nada **nunca** declara capacidade do Hub — não há o que autorizar
  quando quem age é a pessoa, na máquina dela.

`capacidades` (`CODE`, `REVIEW`) é deliberadamente separado das `Capacidade` do Hub
(`WRITE_FILES`, `PUSH_GIT`): uma é o que a ferramenta **consegue**, a outra é o que a pessoa
**autoriza**.

### O pacote de contexto

`montarPacote()` produz as oito seções: `PROJECT_CONTEXT`, `CURRENT_STEP`, `TECHNICAL_DECISIONS`,
`FILES_RELEVANT`, `TASK`, `CONSTRAINTS`, `ACCEPTANCE_CRITERIA`, `KNOWN_ERRORS`.

Três decisões que valem registrar:

- **`FILES_RELEVANT` não lista arquivo.** O Pathly conhece o plano, não a árvore do repositório —
  a `Etapa` do blueprint não carrega caminho nenhum. Então vão as tabelas e os endpoints que a
  etapa provavelmente toca, cada linha prefixada por `tabela:` ou `endpoint:`. Inventar um caminho
  seria pior que não listar: a ferramenta iria procurá-lo.
- **`TECHNICAL_DECISIONS` só traz decisão `ativa`.** A substituída continua no histórico do
  Copilot porque é auditoria; mandá-la faria a ferramenta respeitar uma escolha já desfeita.
- **`ACCEPTANCE_CRITERIA` vem dos requisitos funcionais**, não da etapa. Quando a etapa cita um
  `RF`, filtra por ele; quando não cita, vão todos.

Seção vazia some do Markdown, e `secoesVazias()` alimenta um aviso que **nomeia** o que falta —
"o pacote vai sem as decisões já tomadas, onde mexer" manda a pessoa ao lugar certo, ao contrário
de "contexto incompleto".

### O retorno, e a coluna que dá sentido a ele

Oito tipos de registro, e cada um carrega `origem`: `ferramenta` quando a própria ferramenta
reportou por um canal que o Pathly leu sozinho, `pessoa` em todo o resto.

Não é burocracia. "Os testes passaram" dito por quem rodou os testes e dito por quem achou que
tinha rodado são a mesma frase com valores de prova diferentes — e é sobre a segunda que as
decisões erradas são tomadas.

`pathly_hub_registros` **não concede `update`**. Um gatilho protegeria `origem`, mas um privilégio
que não existe protege melhor: gatilho alguém desliga. Registro errado se apaga e se escreve de
novo.

Sem retorno estruturado, as quatro respostas: **[Implementei] [Não funcionou] [Preciso de ajuda]
[Mudei a arquitetura]**. Cada uma com a sua pergunta específica e a sua consequência declarada
antes do clique. `nao-funcionou` fecha o laço: vira `KNOWN_ERRORS` do próximo pacote, marcado como
relato.

### A tela

`/app/ferramentas`, alcançável por Configurações → Integrações → Ferramentas de desenvolvimento.
Cada cartão mostra estado, mecanismo (com fonte e data), capacidades, permissões consumidas,
última utilização, limitações **abertas** — e os papéis por projeto: principal, secundária,
documentação, git.

Só `claude-api` mostra conectar/testar/reconectar/revogar, porque só ela tem o que conectar. A
chave é testada contra a API da Anthropic **antes** de ser guardada, por `POST /api/ia/chave` —
`authenticated` não escreve em `pathly_conexoes`, então quem grava é o servidor, cifrando.

### Provado por

113 asserções, 0 falhas (`bateria-ia`). As que mais importam: nenhum provedor local promete API
direta; `origem` nunca escorrega de `pessoa` para `ferramenta`; retorno vazio não inventa
registro; e `FILES_RELEVANT` nunca contém um caminho de arquivo.

### O que falta

1. Rodar `supabase/pathly_hub_ferramentas.sql` e validar por sonda — está `gerado`.
2. O caminho de execução real do `claude-api`: hoje a chave é guardada e testada, mas nada é
   executado por ela ainda. É o lugar onde `retorno: "estruturado"` deixa de ser promessa.
3. Servir o pacote de contexto por MCP em `/mcp`, que é o único jeito de ele ficar vivo para as
   três ferramentas locais em vez de virar uma cópia que envelhece.

## 9. Orquestração do desenvolvimento

A camada em `src/lib/hub/sessao/`. É onde o Hub deixa de ser um catálogo de integrações e vira o
fio que atravessa uma etapa inteira.

### O que o Pathly é aqui

Um **orquestrador de contexto, planejamento e estado**. Não um agente que toma conta do
computador — e isso não é modéstia, é o que a pesquisa da seção 8 estabeleceu: três das quatro
ferramentas rodam na máquina de quem usa, e nenhuma nuvem alcança `localhost`.

O que sobra vale mais do que parece. A diferença entre quem constrói um SaaS em três meses e quem
desiste quase nunca é a ferramenta: é perder o fio. Esquecer por que aquela decisão foi tomada,
refazer a tentativa que já falhou, entregar metade de uma etapa e começar outra.

### Os doze passos, e as três voltas

```
planejar → gerar-tarefa → preparar-contexto → escolher-ferramenta → solicitar-execucao →
autorizar → executar → receber-resultado → testar → validar → atualizar-blueprint → concluida
```

Mais `cancelada` e `falhou`, que saem de qualquer ponto.

O fluxo original era só de ida. As **voltas** são o que o torna utilizável:

- `receber-resultado` → `executar`: voltou com nada aproveitável;
- `testar` → `executar`: teste falhou — a volta mais comum de todas;
- `validar` → `executar`: passou nos testes e ainda assim não é o que a etapa pedia.

Sem elas a pessoa cancelaria e abriria outra sessão, e o histórico diria que a etapa saiu de
primeira. `voltas()` conta quantas vezes a sessão reentrou em `executar` — é o número mais honesto
sobre uma etapa, e some se a volta não existir.

**Nenhum passo avança sozinho.** Uma sessão que corre até `executar` por conta própria coloca quem
usa na posição de interromper o produto em vez de conduzi-lo, e é assim que alguém autoriza sem
querer.

### O mesmo passo significa duas coisas

`autorizar` com `claude-api` é uma aprovação de verdade: a pessoa libera, o Pathly age. Com Cursor
é outra coisa — a pessoa decidiu começar, e o Pathly anota. `explicarPasso(passo, provedor)`
escreve as duas, e a bateria prova que são textos diferentes. Escrever "Autorizar" nos dois casos
faria alguém acreditar que negar no Pathly impediria o Cursor de rodar. Não impediria; o Cursor
nem sabe que o Pathly existe.

### O Execution Brief

Treze seções: `PROJECT`, `CURRENT STEP`, `STACK`, `OBJECTIVE`, `CURRENT ARCHITECTURE`,
`DECISIONS`, `CONSTRAINTS`, `FILES`, `TASK`, `ACCEPTANCE CRITERIA`, `DO NOT`, `KNOWN ERRORS`,
`EXPECTED RESULT`.

Montado **em cima** do `PacoteDeContexto` da seção 8, não ao lado — `CONSTRAINTS`, `DECISIONS` e
`ACCEPTANCE CRITERIA` saem de `montarPacote`, para não existirem duas versões da mesma verdade.

Três seções são novas e cada uma resolve um problema conhecido:

- `OBJECTIVE` separa o porquê do o quê;
- `DO NOT` vem do `foraDoEscopo` do produto mais cinco proibições que valem em todo projeto —
  é a seção que quase ninguém escreve e que evita metade do retrabalho;
- `EXPECTED RESULT` **pede o bloco de volta**, e é o truque que faz retorno estruturado existir
  sem API nenhuma.

`completudeDoBrief()` dá um número de 0 a 100, porque "o contexto está incompleto" não ajuda a
decidir se vale mandar assim mesmo — 90% manda, 40% é melhor gerar o modelo de dados antes.

Ao sair de `preparar-contexto`, o brief é **congelado** em `context_snapshot`. O gatilho recusa
reescrevê-lo. É o que permite responder, três dias depois, "o que a ferramenta sabia quando fez
isso?" — a primeira pergunta quando o resultado veio errado.

### O resultado, e o terceiro nível de prova

O brief pede `STATUS / CHANGES / FILES / TESTS / ERRORS / DECISIONS / NEXT_STEP`.
`analisarResultado()` lê o bloco: tolerante com a forma (`## STATUS`, `**STATUS:**`, `NEXT STEP`),
rígido com o conteúdo. Sem `STATUS` não há resultado. `"nenhum"` vira lista vazia **e não conta
como campo ausente** — "não rodei teste nenhum" é uma afirmação, silêncio não é.

Isso obrigou a acrescentar um terceiro valor a `origem`:

| valor        | o que significa                        |
| ------------ | -------------------------------------- |
| `ferramenta` | o Pathly leu direto, por um canal dele |
| `colado`     | a ferramenta escreveu, você trouxe     |
| `pessoa`     | você digitou                           |

`colado` vale mais que um relato e menos que um canal. Achatá-lo em `pessoa` subestimaria a
informação; em `ferramenta`, mentiria sobre ela.

Quando nem o bloco existe: **"Você terminou essa tarefa?"** com `[Sim] [Não] [Deu erro] [Mudei a
abordagem]`. Não é um segundo vocabulário — cada uma aponta para uma `Resposta` de `retorno.ts`, e
`Não` aponta para `null`, porque não terminar não é um fato sobre o código.

### A linha do tempo

**Derivada, não gravada.** Junta três fontes que já existem por necessidade própria: os passos da
sessão, os registros de trabalho e as aprovações. Gravar eventos à parte criaria uma segunda
escrita sobre os mesmos fatos — e um dia o registro grava, a linha do tempo falha, e a tela passa
a contar uma história que os dados não sustentam. Aqui ela não pode mentir, porque não guarda
nada.

```
17:43  Sessão aberta
17:44  Pathly preparou o contexto
17:45  Codex autorizada
17:51  4 arquivos modificados          (colado da ferramenta)
17:53  Testes falharam                 (colado da ferramenta)
17:55  Observação                      (informado por você)
17:57  Validação concluída
17:58  Blueprint atualizado
```

A `origem` aparece em cada linha. É onde ela mais importa: a linha do tempo é o que a pessoa relê
seis semanas depois, quando não lembra de nada.

### `steps` é do gatilho

O cliente escreve `current_step`; o banco anexa `{passo, em}` a `steps` no **mesmo UPDATE**. Isso
tira o read-modify-write (duas abas não se atropelam) e, sobretudo, torna impossível a linha do
tempo divergir do estado.

### Provado por

160 asserções, 0 falhas (`bateria-sessao`), mais 113 de `bateria-ia` continuando verdes depois do
terceiro valor de `origem`.

A mais valiosa: a bateria **lê o arquivo SQL** e compara o gatilho com `TRANSICOES` do TypeScript,
transição por transição. Duas cópias de uma máquina de estados divergem em silêncio; esta não
consegue.

As outras que importam: `ERRORS` no meio de uma frase não abre seção; cabeçalho repetido fica com
o primeiro; `"2 de 5 passaram, 3 falharam"` conta como falha; `origem` sobrevive de parser a
registro a linha do tempo; e todo passo do fluxo tem saída por `cancelada`.

### Dois briefs, e por que os dois existem

`context_snapshot` é o **registro**: responde "o que a ferramenta sabia quando fez isso?". O brief
vivo é o que vai para a ferramenta **agora**.

Antes da primeira volta os dois são iguais e a distinção parece acadêmica. Depois de um teste
falhar, não é: reenviar o congelado mandaria de volta um brief sem o erro que acabou de acontecer,
anulando `KNOWN ERRORS` na única hora em que ela vale alguma coisa. A tela copia o vivo em
`executar`, mostra o congelado como registro, e avisa quando os dois divergem.

Este erro estava no código e só apareceu percorrendo o fluxo inteiro numa sessão real — nenhum
teste o teria pego, porque os dois briefs só divergem depois de uma volta com resultado gravado.

### Verificado assim

O SQL foi aplicado em 2026-09-20 e validado em duas camadas, separadas de propósito.

**Com privilégio total**, 12 provas em projeto descartável: gatilho de nascimento escrevendo o
primeiro passo; trilha de 10 passos acumulada pelo gatilho, incluindo a volta `testar → executar`
(`voltas = 1`, calculado no SQL igual a `voltas()` no TypeScript); `planejar → executar` e
`testar → atualizar-blueprint` recusados com `P0001`; `task_id`, `context_snapshot` e
`completed_at` protegidos; segunda sessão viva → `23505`.

**Pelo navegador logado**, que é outra camada: `update` em `pathly_hub_registros` → `42501`
(privilégio, não gatilho); `insert` com `user_id` alheio → `42501` de RLS; `select nonce` →
`42501` **e** `select id, status` → `200`, que é o par que separa "a coluna está protegida" de "a
tabela quebrou".

**E a sessão inteira na tela**, do `planejar` ao retorno: bloco em markdown colado (`## STATUS`,
`**CHANGES:**`, `NEXT STEP` com espaço) e analisado; `TESTS: nenhum` virando nenhum registro de
teste; cinco registros marcados `(colado da ferramenta)`; a volta zerando para `executar` com o
erro já dentro de `KNOWN ERRORS`. A sessão e os registros de prova foram apagados depois.

### O que falta

1. A execução real por `claude-api`, que é o único caminho em que `origem: "ferramenta"` deixa de
   ser tipo declarado e passa a acontecer.
2. Uma tela de sessões do projeto inteiro. Hoje a sessão vive dentro do painel da etapa, e o
   histórico entre etapas só existe em `lerSessoesDoProjeto()`.
3. As transições de `pathly_hub_aprovacoes` continuam **não exercitadas**: testá-las exigiria
   fabricar uma aprovação no banco, que é exatamente o que aquele sistema existe para impedir.
   Ficam pendentes até a primeira aprovação de verdade.

## 10. Obsidian

A camada em `src/lib/hub/obsidian/`. O vault vira a camada externa de conhecimento do projeto.

### A pesquisa, de novo antes do código

O Obsidian é um app local e o vault é uma pasta de `.md`. Não existe API na nuvem.

| Mecanismo                  | Existe?                                  | O Pathly alcança?               | O que permite                        |
| -------------------------- | ---------------------------------------- | ------------------------------- | ------------------------------------ |
| **File System Access API** | sim, Chromium                            | **sim, no navegador da pessoa** | ler, escrever, criar, apagar, buscar |
| Local REST API (plugin)    | sim, `127.0.0.1:27124`, bearer de 64 hex | não, da nuvem                   | tudo, mais comandos do Obsidian      |
| MCP do Obsidian            | sim — é o **mesmo plugin**, em `/mcp/`   | não, da nuvem                   | igual ao REST                        |
| `obsidian://`              | sim, sem instalar nada                   | parcialmente                    | cria e abre; **não lê de volta**     |
| API oficial na nuvem       | **não existe**                           | —                               | —                                    |

O achado que decidiu tudo: **o vault é uma pasta, e o Pathly roda num navegador.** A File System
Access API dá acesso real a uma pasta que a pessoa escolhe, com o aviso do próprio navegador.

E ela resolve de graça a exigência mais difícil: **nada do vault passa pela nuvem.** Não é uma
política que alguém precisa respeitar — o arquivo é lido, comparado e escrito no navegador. O
servidor guarda caminho e uma impressão digital de 8 caracteres, e o `check`
`impressao ~ '^[0-9a-f]{8}$'` garante que a coluna não aceite texto nem se alguém tentar.

O preço está declarado antes do primeiro botão: **só Chromium**. Em Firefox e Safari a tela diz
isso em vez de oferecer um botão que falha depois do clique.

`EXECUTE_OBSIDIAN_COMMAND` está no catálogo porque existe — mas só pelo plugin, que é `127.0.0.1`.
Declarada e marcada como fora de alcance; um botão que não faz nada seria pior.

### Nunca a nota inteira

A regra que organiza `nota.ts`. O Pathly só escreve **dentro de marcadores que ele mesmo pôs**:

```markdown
Minha anotação. O Pathly não toca aqui.

<!-- pathly:inicio estado -->

Fase: Backend · Etapa 6 de 21
<!-- pathly:fim estado -->

Mais texto meu, também intocado.
```

Quando o marcador some, o Pathly **não adivinha**: devolve `marcador-ausente` e a tela pergunta.
Apagar um marcador é uma forma legítima de dizer "pare de escrever aqui", e recriá-lo sozinho
espalharia blocos pela nota a cada sincronização.

Marcador dentro de cerca de código não conta — o vault do Pathly documenta o Pathly, e um
`indexOf` ingênuo cortaria essa nota ao meio na primeira sincronização.

As operações: `aplicarSecao`, `inserirBloco`, `anexar`, `antepor`, `removerBloco`,
`atualizarFrontmatter`, `mesclar`. O frontmatter da pessoa (`aliases`, `cssclass`, `publish`)
nunca é tocado.

### Conflito por conteúdo, e o laço que morre na primeira volta

O Pathly guarda a impressão digital do que escreveu. Na leitura seguinte compara: igual = foi ele
mesmo (**o laço morre aqui**); diferente = alguém mexeu fora (**conflito**).

O mesmo dado resolve os dois problemas, e é por isso que é confiável: não há um segundo sistema
para manter em pé. Data de modificação não serviria — relógios discordam, o Obsidian Sync
reescreve mtime, e salvar sem mudar nada já gera mtime novo.

Nota preexistente sem impressão conhecida vira **conflito**, não escrita. É o que impede a
primeira sincronização de apagar o que já estava lá.

Em conflito: `[Comparar alterações] [Usar Obsidian] [Usar Pathly] [Mesclar manualmente]`. E vale
notar que `mesclar` já parte do que está **no disco** — então a maioria dos "conflitos" não é
conflito: a pessoa escreveu fora dos blocos, e as duas mudanças cabem.

### A estrutura é sugestão

`PATHLY/Projects/`, `Blueprints/`, `Technical-Decisions/`, `Tasks/`, `Errors/`, `Research/`,
`Logs/` — é o que o Pathly **propõe**. Todo caminho é remapeável, e raiz vazia é aceita, porque
quem usa Obsidian há um ano tem convenção própria e links que dependem de caminho.

`Research/` é a única pasta que o Pathly quase só lê: o conteúdo é da pessoa.

### Nada vem marcado

Nenhuma pasta autorizada, nenhum dos sete tipos ligado, **sincronização automática desligada**.
Quando ela é ligada, a tela lista exatamente o que passará a ser escrito. Apagar nota tem tela
própria, por nota — `DELETE_NOTE` é o único nível isolado aqui.

Permissão é por pasta, com herança e especificidade: `Projects/X` sobrepõe `Projects`. E
`PATHLY2` **não** é coberta por `PATHLY` — prefixo de string não é prefixo de caminho.

### Obsidian → Pathly aceita pouco, de propósito

Só as caixas de marcar das tarefas. É a única edição no vault com significado exato. Ler prosa e
tentar reconstruir blueprint ou decisão seria adivinhação, e adivinhação erraria calado, mudando o
plano de alguém sem avisar.

### Provado por

191 asserções, 0 falhas — 80 em `bateria-nota` e 111 em `bateria-obsidian`.

As que mais importam: **todo o texto da pessoa sobrevive** a patch, append, prepend, remoção e
mesclagem; sem pasta autorizada nada é escrito e o motivo é dito; a segunda sincronização não
escreve nem gera evento; o conflito preserva a anotação dela no texto proposto; e um marcador
dentro de cerca de código não corta a nota ao meio.

As oito capacidades do vault substituíram as três que eu tinha inventado antes — `bateria-hub` e
`bateria-permissoes` foram migradas junto e seguem verdes (45 e 244). Duas falhas delas eram
reais e foram corrigidas no texto, não no teste: `DELETE_NOTE` não terminava em pergunta, e a
explicação dela era curta demais.

### O que falta

1. Rodar `supabase/pathly_obsidian.sql` e validar por sonda — está `gerado`.
2. A sincronização automática está declarada e desligada; falta o gatilho que a dispara quando o
   projeto muda.
3. Guardar o handle da pasta em IndexedDB para reduzir o reabrir a um clique. O navegador ainda
   vai pedir a permissão — e isso não é para contornar.

## 11. MCP Gateway

O contrato para quem constrói integração está em [`MCP-GATEWAY.md`](./MCP-GATEWAY.md). Aqui, só o
que ele mudou por dentro.

### Ele não criou servidor nenhum

O Pathly **já expunha** um servidor MCP em `/mcp`, com `@lovable.dev/mcp-js` e OAuth contra o JWKS
do Supabase — duas ferramentas públicas que não tocam em conta. O Gateway estendeu esse servidor
com dezessete ferramentas do projeto. Criar um segundo endpoint teria dado dois lugares para
autenticar.

### Nem tabela

`pathly_hub_aprovacoes` já modelava "uma ação externa esperando decisão", com os oito estados,
vencimento, impressão digital e nonce. Os nove campos que o pedido de MCP precisa mapeiam um a um
nas colunas que já existem. Uma tabela separada daria dois lugares para responder "isto foi
aprovado?".

### Uma capacidade nova

`WRITE_PROJECT`, nível WRITE: escrever no registro do projeto **dentro** do Pathly — etapa
concluída, erro, decisão, trabalho entregue. Ela não alcança código, repositório nem vault, e é o
que as cinco ferramentas de escrita consomem.

### A correção que a bateria forçou

Eu tinha escrito, no portão, uma segunda checagem de nível e a chamei de "defesa em profundidade".
A varredura dos 64 pares de níveis mostrou que ela **nunca podia recusar**: se a capacidade pedida
está concedida, o nível dela está entre os concedidos por definição, e `cobre(n, n)` é sempre
exato.

Código morto se apresentando como portão é pior que nenhum código, porque alguém confia nele. Foi
removida, e no lugar entrou a verificação que de fato morde — a de **escopo do token**, que
pergunta "esta chamada pode?" em vez de "esta integração pode?".

A escalada continua morrendo onde sempre morreu: na capacidade. `faltamPara` exige a capacidade
pedida e as dependências dela, e é por isso que READ não alcança WRITE, WRITE não alcança COMMIT e
COMMIT não alcança PUSH.

### Duas descobertas sobre o ambiente

1. **Token de sessão do app não serve no MCP.** Ele não carrega `client_id`, e sem essa identidade
   não há permissão a consultar — permissão no Pathly é da integração, não da pessoa. A recusa
   explica o caminho certo em vez de dizer só "não autorizado". Não há atalho de propósito:
   assumir uma integração padrão faria um chamador anônimo herdar permissões de outro.
2. **O endpoint `/mcp` recusa tokens de sessão com `invalid_token`**, e isso é anterior a este
   trabalho — o bloco de `auth` não foi tocado. Um cliente MCP de verdade passa pelo fluxo OAuth e
   recebe token com `client_id`; foi só isso que a sonda não conseguiu simular.

### Provado por

277 asserções, 0 falhas (`bateria-gateway`), escritas para contornar o portão: os 64 pares de
níveis varridos, nenhuma `request_*` devolvendo `OK` nem com as 23 capacidades concedidas, toda
ferramenta de nível isolado sendo de solicitação, e toda recusa auditada sem criar pedido.
