# Auditoria de persistência + fundação relacional do Learning System

## 1. Estado atual (auditoria)

| Onde                                            | O que faz                                                                                                                                                 | Problema                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/schema.sql:84-109`                    | `pathly_route_progress`: 1 linha por `user_id` (PK = `user_id`), `progress` é um blob `jsonb` (`{done:[], checks:[], lastActiveDate, streak}`)            | Não normalizado: impossível consultar "quantas pessoas dominam a skill X" sem escanear jsonb; não guarda histórico, só o estado atual                                                                     |
| `supabase/schema.sql:116-124`                   | `pathly_routes`: guarda a rota gerada (`steps jsonb`)                                                                                                     | Etapas nunca viram linhas — vivem hardcoded em `src/lib/route-map.ts:38-120` (`extras`, 9 objetos fixos "s1".."s9")                                                                                       |
| `src/lib/route-map.ts:1-120`                    | Define `RouteStep` e os dados de cada etapa (`why`, `prereqs`, `hours`, `week`, `demandPct`...) inteiramente em memória, sem tabela própria               | Não há `skills`/`lessons` no banco; qualquer edição exige deploy de código                                                                                                                                |
| `src/lib/catalog.ts:1-431`                      | Catálogo de recursos (cursos/vídeos/artigos) também em array TS, espelhado manualmente para `supabase/seed-catalogo.sql` (comentário em catalog.ts:10-11) | Fonte de verdade duplicada (TS + SQL), risco de dessincronia                                                                                                                                              |
| `src/lib/cloud-sync.ts:49-124`                  | Único ponto de leitura/gravação de progresso e perfil; `upsert(..., { onConflict: "user_id" })` em `saveCloudRouteProgress` (linha 110-118)               | Acoplado à PK atual de `pathly_route_progress` ser só `user_id`; qualquer migração que troque essa PK quebra esta função silenciosamente (o `catch` engole o erro e cai para localStorage, linha 121-124) |
| `drizzle.config.ts:1-9` + `drizzle/migrations/` | Migrações reais são SQL puro aplicado via `drizzle-kit` contra `LOVABLE_DB_MIGRATION_URL`                                                                 | `drizzle/schema.ts:1` é só um stub em branco — Drizzle não infere tipos aqui, só versiona os `.sql`                                                                                                       |
| Não existem hoje                                | `skills`, `lessons`, `activities`, `activity_attempts`, `mastery_evidence`, `reviews`, `challenges`, `achievements`, `projects`                           | —                                                                                                                                                                                                         |

**Ponto de risco central:** qualquer redesenho tem que preservar o contrato de
`cloud-sync.ts:85-124` (`onConflict: "user_id"` sobre `pathly_route_progress`).
Por isso a fundação abaixo é **aditiva** — nenhuma tabela existente é alterada,
renomeada ou tem sua PK trocada.

## 2. Esquema relacional proposto

```
skills (catálogo)
  └─ lessons (conteúdo por skill, aponta para pathly_resources)
       └─ activities (quiz/exercício/flashcard por lesson)
            └─ activity_attempts (evento imutável por usuário)
                    ↘
mastery_evidence (evento: activity_attempt | review | project | manual)
  → user_skill_mastery (snapshot agregado por user+skill, recalculado por job)

reviews (fila de repetição espaçada por user+skill/lesson)

projects (entregas do usuário, ligadas opcionalmente a skill)

challenges (catálogo) → user_challenges (progresso do usuário)
achievements (catálogo) → user_achievements (concedido por critério, não autodeclarado)

route_step_skill_map (ponte: "s1".."s9" do route-map.ts ↔ skills.id)
```

Regra de RLS seguida em todas as tabelas novas (mesmo padrão de
`supabase/schema.sql:10-12,211-235`):

- Catálogo (`skills`, `lessons`, `activities`, `challenges`, `achievements`):
  `select` liberado, **zero** política de escrita — só service role popula.
- Dados do usuário (`activity_attempts`, `mastery_evidence`, `projects`,
  `reviews`, `user_challenges`): RLS `auth.uid() = user_id` em todas as
  operações liberadas ao cliente.
- Eventos imutáveis (`activity_attempts`, `mastery_evidence`): só
  `select`+`insert`, nunca `update`/`delete` — corrigir é inserir de novo,
  mesmo padrão do `feedback` (`schema.sql:201-207`).
- Agregados calculados (`user_skill_mastery`, `user_achievements`): só
  `select` para o cliente; escrita é responsabilidade de trigger/job/service
  role, nunca do app — evita a pessoa "se dar" mastery ou conquista via PATCH,
  o mesmo motivo que já protege a coluna `plano` em `pathly_profiles`
  (`schema.sql:63-73`).
- `revoke all ... from anon, authenticated` seguido do `grant` mínimo em toda
  tabela nova, pelo mesmo motivo documentado em `schema.sql:211-220`
  (TRUNCATE não passa por RLS).

## 3. Migração sem quebrar `pathly_route_progress`

1. **Nada na tabela existente muda** — sem `alter table pathly_route_progress`,
   sem trocar a PK, sem tocar nas policies de `schema.sql:91-109`.
   `cloud-sync.ts:85-124` continua funcionando exatamente como está.
2. A ponte é só `route_step_skill_map` (de-para `"s1" → skills.id`), que
   permite rodar os dois modelos em paralelo:
   - a UI atual continua lendo/escrevendo `pathly_route_progress` normalmente;
   - um job de backfill lê `progress.done` (array de ids tipo `"s1"`), junta
     com `route_step_skill_map` e grava eventos em `mastery_evidence`
     (`source_type = 'manual'`), populando `user_skill_mastery` sem exigir
     que o usuário refaça nada.
3. Quando uma tela nova passar a gravar `activity_attempts` diretamente, ela
   pode continuar espelhando o resultado em `pathly_route_progress.progress`
   (upsert de sempre) até o dia em que a UI parar de ler aquela tabela — troca
   é feita por _feature flag_ na leitura, não por migração destrutiva.
4. Só depois que nenhuma tela mais ler `pathly_route_progress`/`pathly_routes`
   é seguro considerar depreciá-las (não fazer isso nesta etapa).

## 4. Tabelas mínimas a criar primeiro (ordem de dependência de FK)

1. `skills` — sem dependências, tudo mais referencia ela.
2. `lessons` — depende de `skills` (+ `pathly_resources`, já existe).
3. `activities` — depende de `lessons`.
4. `projects` — depende de `skills` (opcional) e `auth.users`.
5. `activity_attempts` — depende de `activities` + `auth.users`.
6. `mastery_evidence` — depende de `skills` + `auth.users`.
7. `user_skill_mastery` — depende de `skills` + `auth.users`; é o snapshot que
   a UI de fato lê.
8. `reviews` — depende de `skills`/`lessons` + `auth.users`.
9. `challenges` → `user_challenges` — catálogo primeiro, progresso depois.
10. `achievements` → `user_achievements` — idem.
11. `route_step_skill_map` — por último, depois que `skills` já existir; é só
    o de-para de compatibilidade.

A migração prática desta execução está em
`drizzle/migrations/0001_learning_system_foundation.sql`, já na ordem acima,
idempotente (`create table if not exists`, `drop policy if exists` antes de
recriar) e sem tocar em nenhuma tabela `pathly_*` existente. Para aplicar:

```
drizzle-kit push --config drizzle.config.ts
```

(ou colar o arquivo no SQL Editor do Supabase, como já é feito com
`supabase/schema.sql`).
