# Estado dos scripts SQL

**SQL existir neste diretório não significa que ele rodou.**

Esta nota existe para separar três coisas que o repositório sozinho não distinguia: um script
escrito, um script executado no Supabase, e uma estrutura verificada funcionando. Antes dela,
`supabase/` misturava scripts aplicados há meses com scripts escritos hoje, sem nada diferenciando.

## Os cinco estados

| Estado      | O que significa                                     | O que NÃO significa                 |
| ----------- | --------------------------------------------------- | ----------------------------------- |
| `gerado`    | O script foi escrito.                               | Que exista qualquer coisa no banco. |
| `aprovado`  | Foi revisado e liberado para execução.              | Que tenha sido executado.           |
| `executado` | Rodou no Supabase, com evidência.                   | Que esteja correto.                 |
| `validado`  | Depois de executado, o comportamento foi conferido. | —                                   |
| `falhou`    | Erro na execução ou na validação.                   | —                                   |

## O que conta como evidência

Confirmação humana ("rodei") é aceita e registrada **como confirmação humana**, não como prova.
Sempre que possível, prefira evidência técnica — uma consulta que só responde daquele jeito se a
estrutura existir.

A sonda barata, do console do app com a sessão aberta:

```js
const { error } = await supabase.from("nome_da_tabela").select("*").limit(0);
```

| Resposta   | Conclusão                                                                |
| ---------- | ------------------------------------------------------------------------ |
| sem erro   | a tabela existe e o papel atual pode lê-la                               |
| `42501`    | **a tabela existe** — permissão negada só acontece sobre algo que existe |
| `PGRST205` | **a tabela não existe** — ausente do schema cache do PostgREST           |

Para RLS, a evidência é comportamental: tentar `insert` com `user_id` de outra pessoa e receber
`42501` prova que a policy está valendo. Nenhuma linha é escrita nos dois desfechos, então a sonda
é segura.

> **`src/integrations/supabase/types.ts` não é evidência.** Acrescentar uma tabela lá faz o app
> inteiro compilar como se ela existisse. `tsc` limpo prova que o código está coerente com o que
> eu _declarei_, nunca com o que o banco _tem_.

> **Um `grant` nunca restringe.** O Supabase define DEFAULT PRIVILEGES no schema `public` dando
> tudo a `anon` e `authenticated`: toda tabela nova já nasce com `update` e `delete` liberados.
> Escrever `grant select, insert` e omitir `update` não tira nada — é aditivo sobre o que já foi
> concedido. Para restringir é preciso `revoke` explícito. Descoberto em teste, não na leitura.

> **Ausência de policy bloqueia em silêncio.** Com RLS ligada e sem policy de `update`, o comando
> volta sem erro e afeta zero linhas. Quem chamou não distingue "fui barrado" de "não havia o que
> atualizar" — e a proteção passa a depender de ninguém criar essa policy depois.

## Registro

Última verificação por sonda: **2026-09-18**, sessão anônima em `localhost:8080`.

| Script                                       | Objetivo                                                                                                     | Estado         | Evidência                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.sql`                                 | `feedback`, `pathly_profiles`, `pathly_resources`, `pathly_route_progress`, `pathly_routes`, `pathly_uso_ia` | `executado`    | `feedback`, `pathly_profiles` e `pathly_route_progress` responderam `42501`. As outras três não foram sondadas. O conteúdo do script não foi comparado com o schema vivo.                                                                                                                                                                                                                                                                                                                    |
| `feedback.sql`                               | `feedback`                                                                                                   | `executado`    | `feedback` respondeu `42501`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `pathly_persistence.sql`                     | `pathly_profiles`, `pathly_route_progress`                                                                   | `executado`    | ambas responderam `42501`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `seed-catalogo.sql`                          | popular o catálogo                                                                                           | `desconhecido` | não sondado. É seed, não estrutura.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `pathly_arquitetura_ia.sql`                  | `pathly_arquitetura_ia`                                                                                      | `executado`    | 2026-09-18: a tabela responde à leitura logado. A RLS ainda não foi exercitada.                                                                                                                                                                                                                                                                                                                                                                                                              |
| `pathly_copilot.sql`                         | `pathly_copilot_mensagens`, `_decisoes`, `_propostas`                                                        | `validado`     | 2026-09-18, bateria em projeto descartável apagado depois: RLS `user_id` alheio `42501`; posse de projeto alheio `42501`; gatilho de imutabilidade `P0001` com o valor intacto; `status` mudando normalmente; supersedência com histórico preservado; paginação em ordem; `CASCADE` sem resíduo. A ressalva do `update` silencioso foi corrigida por `pathly_copilot_revoke_update.sql`.                                                                                                     |
| `pathly_copilot_revoke_update.sql`           | declara o privilégio final das três tabelas do Copilot                                                       | `validado`     | 2026-09-18: `update` e `delete` em mensagem agora respondem `42501` (antes: sem erro, zero linhas). Gravar mensagem, supersedência de decisão, criar e aprovar proposta continuam funcionando; o gatilho de imutabilidade segue devolvendo `P0001`. `CASCADE` ao apagar o projeto continua limpando tudo — ele roda como dono da tabela, não como quem chamou.                                                                                                                               |
| `0004_restore_core_authenticated_access.sql` | restaurar GRANTs mínimos das tabelas centrais e escrita própria em `pathly_seguranca`                        | `validado`     | 2026-09-18: `authenticated` possui os privilégios necessários nas oito tabelas afetadas; `anon` continua sem leitura de `pathly_projetos`; a tela de projetos autenticada carregou dados reais sem `permission denied`; `pathly_seguranca` exige usuário e projeto do mesmo proprietário.                                                                                                                                                                                                    |
| `pathly_validacoes.sql`                      | `pathly_validacoes` — as confirmações do Validation Engine                                                   | `validado`     | 2026-09-18, bateria de 7 provas em projeto real: leitura responde (antes `PGRST205`); `delete` devolve `42501 permission denied for table` — privilégio, não RLS; `insert` com `user_id` alheio e com projeto alheio devolvem `42501 violates row-level security policy`; marcar gravou e sobreviveu a recarga completa; desmarcar atualizou a linha (`atualizado_em` avançou) e o progresso voltou de 13% para 8%. As duas mensagens diferentes provam os dois mecanismos agindo separados. |
| `pathly_integracoes.sql`                     | `pathly_conexoes` e `pathly_acoes_externas` — conexões externas e o portão de aprovação                      | `gerado`       | Nenhuma. O script foi escrito e nunca rodou. A tela de Integrações detecta a ausência por `PGRST205` e diz isso em voz alta em vez de mostrar lista vazia. **O ponto a conferir na validação é o `revoke select (token_cifrado)`**: `select` dessa coluna como `authenticated` tem que dar `42501`. E o gatilho de transição: `pendente` direto para `executada` tem que dar `P0001`.                                                                                                        |

### Tabelas que existem sem script neste repositório

`pathly_projetos`, `pathly_etapas`, `pathly_modelos_dados`, `pathly_apis`, `pathly_seguranca` —
todas responderam `42501`, logo existem; nenhuma tem SQL versionado aqui. Foram criadas fora do
repositório, pelo painel do Supabase ou pelo Lovable. Procurar migração no repo para conferir o
schema delas é caminho morto: confira no Supabase.

`pathly_seguranca` é a única com RLS **validada** por sonda comportamental: insert com `user_id`
alheio recusado com `42501`, leitura sem filtro devolvendo só as linhas do próprio usuário
(2026-09-17).

## O fluxo

```
NECESSIDADE → SQL GERADO → REVISÃO → APROVADO → EXECUÇÃO REAL → EXECUTADO → VALIDAÇÃO → VALIDADO
                                                       ↓
                                                    FALHOU → ANÁLISE → NOVO SQL
```

Ao mudar um estado aqui, registre a evidência junto. Um estado sem evidência ao lado é um palpite
com aparência de fato — que é exatamente o problema que esta nota resolve.

O registro operacional completo (quem executou, quando, resultado) fica no vault, em
`04-DATABASE/executions/` e `04-DATABASE/validations/`.
