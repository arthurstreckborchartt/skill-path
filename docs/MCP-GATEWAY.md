# MCP Gateway do Pathly

Como uma ferramenta compatível com Model Context Protocol conversa com o Pathly, e o que ela
consegue — ou não — fazer.

Este documento é para quem vai **construir** uma integração. A arquitetura interna está em
[`INTEGRATION-HUB.md`](./INTEGRATION-HUB.md); aqui é o contrato.

## O endereço

```
https://pathlyapp.app/mcp
```

Autenticação OAuth 2.1, com o servidor de autorização anunciado em
`/.well-known/oauth-protected-resource`. O emissor é o Supabase Auth do Pathly.

O servidor MCP já existia antes deste Gateway, com duas ferramentas públicas que não tocam em
conta nenhuma: `list_pathly_catalogs` e `generate_pathly_route`. Elas continuam lá.

## A regra que organiza tudo

**`request` não significa `execute`.**

Cinco ferramentas deste Gateway pedem coisas consequentes — alterar arquivo, rodar comando,
commitar, empurrar, publicar. Nenhuma delas faz nada. Todas devolvem:

```json
{
  "status": "APPROVAL_REQUIRED",
  "request_id": "…",
  "tool": "pathly_request_commit",
  "requested_scope": "COMMIT",
  "expires_at": "2026-09-20T12:10:00Z",
  "requires_reauthentication": false,
  "message": "Permitir que o Pathly solicite um commit `feat: autenticação` em seu nome?",
  "note": "Nada foi executado. …"
}
```

`APPROVAL_REQUIRED` **não é erro.** Não repita a chamada — repetir cria pedidos duplicados que a
pessoa terá que recusar um a um, e o Gateway recusa o segundo com `DUPLICATE_REQUEST` de todo
jeito. Avise quem está usando você que há um pedido esperando decisão, e siga com o que der para
fazer sem ele.

## As dezessete ferramentas

### Leitura — nível `READ`, capacidade `READ_PROJECT`

| Ferramenta                       | O que devolve                                                                  |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `pathly_get_project`             | Nome, ideia, status, fase, progresso                                           |
| `pathly_get_blueprint`           | O plano: problema, público, stack, arquitetura, requisitos, fora do escopo     |
| `pathly_get_current_task`        | Etapa atual: ordem, título, entrega, fase, dependências                        |
| `pathly_get_technical_decisions` | Decisões ativas e as substituídas, separadas                                   |
| `pathly_get_project_context`     | O Execution Brief inteiro — substitui as outras seis quando você vai trabalhar |
| `pathly_get_errors`              | O que já falhou, **com a origem de cada afirmação**                            |
| `pathly_get_task_history`        | Arquivos alterados, testes, decisões e observações                             |

Todas aceitam `project_id` opcional. Sem ele, o Pathly usa o projeto mais recente — um agente
quase nunca sabe o id, e exigi-lo faria a primeira chamada ser sempre um erro.

### Escrita — dentro do Pathly, nunca fora

| Ferramenta                     | Capacidade         | Nível   |
| ------------------------------ | ------------------ | ------- |
| `pathly_update_task`           | `WRITE_PROJECT`    | WRITE   |
| `pathly_report_error`          | `WRITE_PROJECT`    | WRITE   |
| `pathly_add_decision`          | `WRITE_PROJECT`    | WRITE   |
| `pathly_report_implementation` | `WRITE_PROJECT`    | WRITE   |
| `pathly_update_blueprint`      | `UPDATE_BLUEPRINT` | SUGGEST |

Estas escrevem **no registro do projeto dentro do Pathly**. Nenhuma toca no seu código, no seu
repositório ou no seu vault.

`pathly_update_blueprint` é proposta, não aplicação: entra como sugestão e a pessoa decide.
Escrever direto no blueprint faria uma ferramenta externa mudar o plano de alguém sem ninguém ver.

`pathly_add_decision` registra a decisão como **não confirmada** — quem decidiu foi uma
ferramenta, não a pessoa.

### Solicitação — pede, e só

| Ferramenta                   | Capacidade        | Nível   | Exige reautenticação |
| ---------------------------- | ----------------- | ------- | -------------------- |
| `pathly_request_file_change` | `WRITE_FILES`     | WRITE   | não                  |
| `pathly_request_command`     | `EXECUTE_COMMAND` | EXECUTE | não                  |
| `pathly_request_commit`      | `CREATE_COMMIT`   | COMMIT  | não                  |
| `pathly_request_push`        | `PUSH_GIT`        | PUSH    | **sim**              |
| `pathly_request_deploy`      | `DEPLOY_APP`      | DEPLOY  | **sim**              |

## Como a autorização funciona

### Permissão é por integração, não por pessoa

"Eu posso commitar" e "o Cursor pode commitar em meu nome" são coisas diferentes. A permissão é
concedida a um `client_id`, em Configurações → Integrações, e o Pathly **nunca concede sozinho**.

### Permissão é por projeto, ou global

Uma permissão concedida para o projeto A não vale no projeto B. Quando a permissão existe mas é de
outro projeto, a recusa vem como `PROJECT_DENIED` — e não como "sem permissão", que mandaria
procurar no lugar errado.

### Escalada não acontece

| Concedido              | Pedido | Resultado |
| ---------------------- | ------ | --------- |
| READ                   | WRITE  | recusa    |
| WRITE                  | COMMIT | recusa    |
| COMMIT                 | PUSH   | recusa    |
| EXECUTE + WRITE + READ | PUSH   | recusa    |
| DEPLOY                 | PUSH   | recusa    |

Cada nível precisa ser autorizado explicitamente. Acumular níveis inferiores não produz um
superior, e um nível isolado — COMMIT, PUSH, DEPLOY, DELETE — não é coberto por nenhum outro, por
mais amplo que seja.

**A exceção declarada:** `PUSH_GIT` exige `CREATE_COMMIT` e `READ_GIT`. Autorizar push autoriza
commit junto, porque não se empurra o que não foi commitado. A direção proibida é a outra.

### Onde a escalada morre, exatamente

Na **capacidade**. O Gateway exige a capacidade pedida e todas de que ela depende. Uma integração
com `WRITE_FILES` não tem `CREATE_COMMIT`, e é só isso que precisa acontecer.

Vale registrar uma correção: a primeira versão deste Gateway tinha também uma checagem de nível
que se apresentava como "defesa em profundidade". A bateria, varrendo os 64 pares de níveis,
mostrou que ela **nunca podia recusar** — se a capacidade está concedida, o nível dela está entre
os concedidos por definição. Código morto se apresentando como portão é pior que nenhum código,
porque alguém confia nele. Foi removida.

A verificação de nível que de fato morde é a de **escopo do token**, abaixo.

### Escopo do token

Duas perguntas diferentes:

- **Permissão:** esta integração pode? — vive no banco.
- **Escopo:** esta chamada pode? — vive no JWT.

Um token vazado de uma integração de leitura não deve escrever, nem que a permissão no banco diga
que sim. Os escopos são `pathly:read`, `pathly:suggest`, `pathly:write`, `pathly:execute`,
`pathly:commit`, `pathly:push`, `pathly:deploy`, `pathly:delete`.

**Estado honesto:** o emissor de tokens hoje é o Supabase Auth, que emite um escopo só
(`authenticated`). Nenhum token que chega traz `pathly:*`, então esta camada **ainda não recusa
nada** — ela devolve `verificado: false` em vez de fingir que conferiu. Quando o Pathly passar a
emitir token por integração, a verificação já está no caminho e passa a morder sozinha.

## As recusas

| Código                | O que aconteceu                                                  |
| --------------------- | ---------------------------------------------------------------- |
| `UNAUTHENTICATED`     | Sem usuário verificado                                           |
| `UNKNOWN_INTEGRATION` | Sem `client_id` — veja a seção seguinte                          |
| `UNKNOWN_TOOL`        | Essa ferramenta não existe                                       |
| `RATE_LIMITED`        | 120 chamadas por hora, por pessoa                                |
| `PERMISSION_DENIED`   | Falta permissão; a resposta diz **qual**                         |
| `SCOPE_DENIED`        | O token não carrega o escopo do nível                            |
| `PROJECT_DENIED`      | A permissão existe, mas é de outro projeto                       |
| `DUPLICATE_REQUEST`   | Já existe pedido igual vivo; a resposta traz o `request_id` dele |
| `EXPIRED`             | O pedido venceu                                                  |

Toda recusa traz um motivo em texto. Repasse-o para a pessoa em vez de tentar outro caminho.

## O que um cliente MCP precisa fazer

O Gateway identifica a integração pelo **`client_id` do token OAuth**. Um token de sessão do app
— o que o Pathly usa no navegador — **não carrega `client_id`**, e por isso não serve aqui: a
chamada recebe `UNKNOWN_INTEGRATION`.

Não há atalho, e é de propósito. Assumir uma integração padrão faria um chamador anônimo herdar as
permissões de outro, que é exatamente a escalada que este portão existe para impedir.

O caminho é o fluxo OAuth normal do MCP: o cliente descobre o servidor de autorização em
`/.well-known/oauth-protected-resource`, se registra, e recebe um token com `client_id`. É o que
Claude Desktop, Cursor e Codex fazem sozinhos ao adicionar um servidor MCP.

## O pedido, campo a campo

Um pedido criado por `pathly_request_*` é gravado em `pathly_hub_aprovacoes` — a mesma tabela que
o Integration Hub já usa. Não há tabela separada para MCP, e é deliberado: duas tabelas dariam
dois lugares para responder "isto foi aprovado?", e um dia elas discordariam.

| Campo pedido      | Coluna                 | Observação                 |
| ----------------- | ---------------------- | -------------------------- |
| `request_id`      | `id`                   | uuid                       |
| `user_id`         | `user_id`              | do JWT, nunca do corpo     |
| `project_id`      | `project_id`           | pode ser nulo              |
| `integration_id`  | `integration_id`       | o `client_id` verificado   |
| `tool`            | `action`               | o nome da ferramenta       |
| `arguments`       | `metadata`             | os argumentos, como vieram |
| `requested_scope` | `requested_permission` | o nível                    |
| `created_at`      | `created_at`           |                            |
| `expires_at`      | `expires_at`           | 10 minutos                 |

Mais `fingerprint` (contra pedido duplicado), `nonce` (contra replay) e `scope`, que num pedido
vindo do MCP é sempre `uma-vez` — nunca sessão, nunca permanente.

## Proteções

- **Autenticação** — JWT verificado contra o JWKS do emissor.
- **Autorização** — capacidade concedida à integração, vigente, para este projeto.
- **Validação de escopo** — o token carrega o escopo do nível (ver estado honesto acima).
- **Limite de uso** — 120 por hora, conferido **antes** da autorização: um cliente em laço não
  deve martelar a tabela de permissões.
- **Trilha de auditoria** — toda chamada, inclusive as recusadas. `acesso-negado` é um ato como
  qualquer outro, e auditar só o que deu certo produz uma trilha que não responde "o que essa
  integração tentou fazer?".
- **Vencimento** — 10 minutos, conferido de novo na hora de executar. Um pedido aprovado aos 14
  minutos pode ter vencido no meio.
- **Contra replay** — `nonce` consumido na execução, e o navegador não consegue lê-lo (`select`
  por coluna, sem o nonce na lista).
- **Contra duplicata** — impressão digital do conteúdo, com índice único sobre os pedidos vivos.
  A ordem das chaves não muda a impressão; a integração muda.

### O Gateway nunca usa `service_role`

Toda leitura e escrita sai com o **token da pessoa**, então a RLS do Supabase continua valendo por
baixo. Se a verificação de permissão tivesse um defeito, a RLS ainda limitaria o alcance ao que
aquele usuário já podia ver.

Duas paredes, e a de baixo não depende de o código do portão estar correto. É por isso que
`service_role` não aparece nesta camada — com ele, a parede de baixo some.

## Como adicionar uma ferramenta nova

1. Uma linha em `FERRAMENTAS`, em `src/lib/mcp/gateway/catalogo.ts`, declarando a capacidade.
2. O schema de entrada em `ENTRADAS`, em `ferramentas.ts`.
3. Um `case` em `executar` — só para `leitura` e `escrita`. Solicitação não precisa: ela para no
   portão.

Não há passo 4, e não há como pular o portão: `construir()` é a única porta, e ela chama
`passarPeloPortao` antes de qualquer execução. Dezessete handlers escritos à mão tornariam o
portão uma convenção — e convenção é o que alguém esquece na décima oitava ferramenta,
exatamente a que precisava mais.

## Provado por

277 asserções, 0 falhas (`bateria-gateway`). Escritas para **contornar** o portão:

- os 64 pares de níveis, varridos — só a diagonal e as dependências declaradas passam;
- nenhuma `request_*` devolve `OK`, nem com todas as 23 capacidades concedidas;
- toda ferramenta de nível isolado é de solicitação;
- permissão revogada, vencida ou de outro projeto não vale;
- o limite recusa antes da autorização;
- argumento diferente não é duplicata, ordem de chaves não muda a impressão, integração diferente
  muda;
- toda recusa é auditada, e nenhuma cria pedido.

## O que falta

1. **Emitir token por integração**, com escopos `pathly:*`. É o que liga a validação de escopo e o
   que permite um `client_id` estável por ferramenta.
2. **Executar o que foi aprovado.** O pedido nasce `PENDING`; a execução vive em
   `/api/integracoes/executar`, e ligar os dois é um passo separado.
3. **A tela de aprovação** listando pedidos vindos do MCP. Hoje eles são gravados e aparecem na
   trilha, mas não há onde decidir sobre eles em um clique.
