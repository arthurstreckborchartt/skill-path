-- Fundação relacional do Learning System (skills, lessons, activities, attempts,
-- mastery evidence, reviews espaçados, challenges, achievements, projects).
--
-- AUDITORIA DO ESTADO ATUAL (referências):
--   supabase/schema.sql:84-109  pathly_route_progress: 1 linha por usuário, chave
--     primária composta implicitamente em user_id (PK real é só user_id!), progress
--     é um blob jsonb {done:[], checks:[], lastActiveDate, streak} sem normalização —
--     não dá para consultar "quantas pessoas concluíram s4" sem escanear jsonb.
--   supabase/schema.sql:116-124 pathly_routes: guarda a rota gerada (steps jsonb),
--     mas os "steps" nunca viraram linhas próprias — vivem só em src/lib/route-map.ts
--     (extras hardcoded, route-map.ts:38-120) e src/lib/catalog.ts (431 linhas de
--     array em memória). Não existem hoje: `skills`, `lessons`, `activities`,
--     `activity_attempts`, `mastery_evidence`, `reviews`, `challenges`,
--     `achievements`, `projects`.
--   src/lib/cloud-sync.ts:85-124 loadCloudRouteProgress/saveCloudRouteProgress:
--     único ponto de leitura/escrita de progresso, upsert por (user_id) via
--     onConflict "user_id" — ATENÇÃO: se pathly_route_progress ganhar uma PK
--     composta (user_id, route_signature) no futuro, este onConflict quebra.
--     Por isso esta migração NÃO toca em pathly_route_progress: é só aditiva.
--   drizzle.config.ts:1-9 as migrações reais rodam por SQL puro nesta pasta
--     contra LOVABLE_DB_MIGRATION_URL; drizzle/schema.ts:1 é só um stub em
--     branco (Drizzle não é usado para inferir tipos, só para orquestrar o
--     `drizzle-kit push`/histórico de arquivos .sql).
--
-- ORDEM DE MIGRAÇÃO (por dependência de FK; cada bloco desta migração já respeita):
--   1) skills            -- sem dependências além de auth.users (nenhuma)
--   2) lessons            -- depende de skills
--   3) activities         -- depende de lessons
--   4) projects           -- depende de skills (opcional) e auth.users
--   5) activity_attempts  -- depende de activities + auth.users
--   6) mastery_evidence   -- depende de skills + auth.users (+ opcionalmente activity_attempts)
--   7) user_skill_mastery -- depende de skills + auth.users; é o snapshot agregado
--      lido pela UI (evita recalcular de mastery_evidence toda hora)
--   8) reviews            -- depende de skills + auth.users (fila de repetição espaçada)
--   9) challenges         -- catálogo, sem dependência de usuário
--  10) user_challenges    -- depende de challenges + auth.users
--  11) achievements       -- catálogo, sem dependência de usuário
--  12) user_achievements  -- depende de achievements + auth.users
--
-- pathly_route_progress (schema.sql:84-109) continua sendo a fonte de verdade do
-- MVP de "rota linear" enquanto a UI não migrar. A ponte é `route_step_skill_map`,
-- que só faz de-para entre o id de etapa hardcoded (ex.: "s1", route-map.ts:39) e o
-- novo `skills.id` — sem apagar nem alterar a tabela antiga. Quando a UI passar a
-- gravar evidência em `activity_attempts`/`mastery_evidence`, dá para popular
-- `pathly_route_progress.progress.done` a partir de `user_skill_mastery` (view de
-- compatibilidade, ao final deste arquivo) sem quebrar cloud-sync.ts:85-124.

-- ---------------------------------------------------------------- 1) skills

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  area text not null,
  description text,
  level text check (level is null or level in ('iniciante', 'intermediário', 'avançado')),
  prereq_skill_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.skills enable row level security;

drop policy if exists "skills_read_all" on public.skills;
create policy "skills_read_all"
  on public.skills for select to anon, authenticated
  using (true);
-- Sem policy de escrita: catálogo, só service role popula (mesmo padrão de
-- pathly_resources, supabase/schema.sql:171-180).

revoke all on public.skills from anon, authenticated;
grant select on public.skills to anon, authenticated;

create index if not exists skills_area_idx on public.skills (area);

-- ---------------------------------------------------------------- 2) lessons

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.skills (id) on delete cascade,
  resource_id uuid references public.pathly_resources (id) on delete set null,
  slug text unique not null,
  title text not null,
  order_index int not null default 0,
  estimated_minutes int,
  created_at timestamptz not null default now()
);

alter table public.lessons enable row level security;

drop policy if exists "lessons_read_all" on public.lessons;
create policy "lessons_read_all"
  on public.lessons for select to anon, authenticated
  using (true);

revoke all on public.lessons from anon, authenticated;
grant select on public.lessons to anon, authenticated;

create index if not exists lessons_skill_idx on public.lessons (skill_id, order_index);

-- ---------------------------------------------------------------- 3) activities

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  kind text not null check (kind in ('quiz', 'exercicio', 'projeto_guiado', 'flashcard')),
  prompt jsonb not null,
  answer_key jsonb,
  max_score numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.activities enable row level security;

drop policy if exists "activities_read_all" on public.activities;
create policy "activities_read_all"
  on public.activities for select to authenticated
  using (true);
-- `answer_key` fica exposto pelo select acima só para authenticated; se algum dia
-- a resposta certa não puder vazar ao cliente, split em `activities_public`
-- (sem answer_key) + validação server-side antes de expor esta tabela via API.

revoke all on public.activities from anon, authenticated;
grant select on public.activities to authenticated;

create index if not exists activities_lesson_idx on public.activities (lesson_id);

-- ---------------------------------------------------------------- 4) projects

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  title text not null,
  repo_url text,
  demo_url text,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'entregue', 'avaliado', 'arquivado')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.projects from anon, authenticated;
grant select, insert, update, delete on public.projects to authenticated;

create index if not exists projects_user_idx on public.projects (user_id, created_at desc);

-- ---------------------------------------------------------------- 5) activity_attempts

create table if not exists public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  response jsonb not null,
  score numeric,
  is_correct boolean,
  attempted_at timestamptz not null default now()
);

alter table public.activity_attempts enable row level security;

drop policy if exists "activity_attempts_select_own" on public.activity_attempts;
create policy "activity_attempts_select_own"
  on public.activity_attempts for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "activity_attempts_insert_own" on public.activity_attempts;
create policy "activity_attempts_insert_own"
  on public.activity_attempts for insert to authenticated
  with check (auth.uid() = user_id);
-- Sem UPDATE/DELETE: tentativa é evento imutável, igual ao padrão de feedback
-- (supabase/schema.sql:201-207). Corrigir uma tentativa é inserir outra.

revoke all on public.activity_attempts from anon, authenticated;
grant select, insert on public.activity_attempts to authenticated;

create index if not exists activity_attempts_user_idx
  on public.activity_attempts (user_id, attempted_at desc);
create index if not exists activity_attempts_activity_idx
  on public.activity_attempts (activity_id);

-- ---------------------------------------------------------------- 6) mastery_evidence

-- Log de eventos que contribuem para o domínio de uma skill (tentativa de
-- atividade, review completado, projeto avaliado etc.). Fica separado de
-- activity_attempts porque nem toda evidência vem de uma atividade formal
-- (ex.: projeto avaliado por outra pessoa, importação de rota antiga).
create table if not exists public.mastery_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  source_type text not null check (source_type in ('activity_attempt', 'review', 'project', 'manual')),
  source_id uuid,
  weight numeric not null default 1,
  observed_at timestamptz not null default now()
);

alter table public.mastery_evidence enable row level security;

drop policy if exists "mastery_evidence_select_own" on public.mastery_evidence;
create policy "mastery_evidence_select_own"
  on public.mastery_evidence for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "mastery_evidence_insert_own" on public.mastery_evidence;
create policy "mastery_evidence_insert_own"
  on public.mastery_evidence for insert to authenticated
  with check (auth.uid() = user_id);

revoke all on public.mastery_evidence from anon, authenticated;
grant select, insert on public.mastery_evidence to authenticated;

create index if not exists mastery_evidence_user_skill_idx
  on public.mastery_evidence (user_id, skill_id, observed_at desc);

-- ---------------------------------------------------------------- 7) user_skill_mastery

-- Snapshot agregado por (user, skill) — o que a UI lê para pintar a rota. Evita
-- recalcular de mastery_evidence a cada render; é recalculado por trigger/job,
-- não escrito diretamente pelo cliente.
create table if not exists public.user_skill_mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  mastery_score numeric not null default 0,
  status text not null default 'não_iniciado'
    check (status in ('não_iniciado', 'em_progresso', 'dominado')),
  last_evidence_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

alter table public.user_skill_mastery enable row level security;

drop policy if exists "user_skill_mastery_select_own" on public.user_skill_mastery;
create policy "user_skill_mastery_select_own"
  on public.user_skill_mastery for select to authenticated
  using (auth.uid() = user_id);
-- Sem insert/update pelo cliente: só a service role (ou uma function
-- security definer futura) recalcula a partir de mastery_evidence.

revoke all on public.user_skill_mastery from anon, authenticated;
grant select on public.user_skill_mastery to authenticated;

-- ---------------------------------------------------------------- 8) reviews (repetição espaçada)

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  due_at timestamptz not null default now(),
  interval_days int not null default 1,
  ease_factor numeric not null default 2.5,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own"
  on public.reviews for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.reviews from anon, authenticated;
grant select, insert, update on public.reviews to authenticated;

create index if not exists reviews_due_idx on public.reviews (user_id, due_at);

-- ---------------------------------------------------------------- 9) challenges (catálogo)

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  skill_id uuid references public.skills (id) on delete set null,
  points int not null default 10,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.challenges enable row level security;

drop policy if exists "challenges_read_all" on public.challenges;
create policy "challenges_read_all"
  on public.challenges for select to anon, authenticated
  using (true);

revoke all on public.challenges from anon, authenticated;
grant select on public.challenges to anon, authenticated;

-- ---------------------------------------------------------------- 10) user_challenges

create table if not exists public.user_challenges (
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluído', 'expirado')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

alter table public.user_challenges enable row level security;

drop policy if exists "user_challenges_select_own" on public.user_challenges;
create policy "user_challenges_select_own"
  on public.user_challenges for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_challenges_insert_own" on public.user_challenges;
create policy "user_challenges_insert_own"
  on public.user_challenges for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_challenges_update_own" on public.user_challenges;
create policy "user_challenges_update_own"
  on public.user_challenges for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_challenges from anon, authenticated;
grant select, insert, update on public.user_challenges to authenticated;

-- ---------------------------------------------------------------- 11) achievements (catálogo)

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  icon text,
  criteria jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.achievements enable row level security;

drop policy if exists "achievements_read_all" on public.achievements;
create policy "achievements_read_all"
  on public.achievements for select to anon, authenticated
  using (true);

revoke all on public.achievements from anon, authenticated;
grant select on public.achievements to anon, authenticated;

-- ---------------------------------------------------------------- 12) user_achievements

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

drop policy if exists "user_achievements_select_own" on public.user_achievements;
create policy "user_achievements_select_own"
  on public.user_achievements for select to authenticated
  using (auth.uid() = user_id);
-- Sem insert pelo cliente: conquista é concedida por trigger/job que avalia
-- `criteria`, nunca autodeclarada.

revoke all on public.user_achievements from anon, authenticated;
grant select on public.user_achievements to authenticated;

-- ---------------------------------------------------------------- ponte com a rota atual

-- De-para entre o id de etapa hardcoded hoje em route-map.ts:38-120 ("s1".."s9")
-- e o skills.id novo. Não substitui pathly_route_progress; permite popular
-- user_skill_mastery a partir do progress.done existente num job de backfill,
-- e popular route-map a partir de skills quando a UI migrar — sem exigir os
-- dois em produção ao mesmo tempo.
create table if not exists public.route_step_skill_map (
  route_step_id text primary key,
  skill_id uuid not null references public.skills (id) on delete cascade
);

alter table public.route_step_skill_map enable row level security;

drop policy if exists "route_step_skill_map_read_all" on public.route_step_skill_map;
create policy "route_step_skill_map_read_all"
  on public.route_step_skill_map for select to anon, authenticated
  using (true);

revoke all on public.route_step_skill_map from anon, authenticated;
grant select on public.route_step_skill_map to anon, authenticated;
