-- Estrutura de dados do Pathly: perfil, catálogo de conteúdo, rota gerada e progresso.
--
-- Este projeto não usa migrações locais — o schema é gerenciado pelo Supabase/Lovable.
-- Rode este arquivo uma vez no SQL Editor do painel. É idempotente (if not exists), então
-- rodar de novo não quebra nada.
--
-- Regra que vale para todas as tabelas de usuário: RLS ligada e cada pessoa só enxerga a própria
-- linha, via auth.uid(). O catálogo (resources) é o único com leitura pública, porque é conteúdo,
-- não dado pessoal — e mesmo ele não aceita escrita por quem usa o app.

-- ---------------------------------------------------------------- perfil

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- respostas do onboarding no formato que o app já usa (OnboardingProfile)
  onboarding jsonb not null default '{}'::jsonb,
  -- campo livre: o que a pessoa escreve que quer fazer, com as próprias palavras
  goal_text text check (goal_text is null or char_length(goal_text) <= 2000),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------- catálogo

-- Conteúdo real que as etapas apontam. `source` e `source_license` existem para auditoria:
-- toda linha precisa saber de onde veio e sob qual licença, porque nem toda fonte gratuita
-- permite redistribuição (ver README ao lado deste arquivo).
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  url text not null,
  kind text not null check (kind in ('curso', 'video', 'artigo', 'doc', 'livro', 'projeto')),
  provider text,
  language text not null default 'pt',
  is_free boolean not null default true,
  -- assuntos ("python", "sql") e áreas do onboarding ("tech", "data")
  topics text[] not null default '{}',
  areas text[] not null default '{}',
  level text check (level is null or level in ('iniciante', 'intermediário', 'avançado')),
  source text not null,
  source_license text not null,
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

-- Leitura para todo mundo, inclusive quem não entrou: o catálogo aparece na rota de exemplo.
drop policy if exists "resources_read_all" on public.resources;
create policy "resources_read_all" on public.resources
  for select to anon, authenticated using (true);
-- Sem policy de escrita: só a service role (importador) grava.

create index if not exists resources_areas_idx on public.resources using gin (areas);
create index if not exists resources_topics_idx on public.resources using gin (topics);

-- ---------------------------------------------------------------- rota gerada

create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area text not null,
  -- como a rota foi montada: 'regras' (determinístico) ou 'claude' (gerada)
  generator text not null default 'regras',
  -- muda quando as respostas mudam; serve para saber que o progresso antigo não vale mais
  signature text not null,
  steps jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.routes enable row level security;

drop policy if exists "routes_select_own" on public.routes;
create policy "routes_select_own" on public.routes
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "routes_insert_own" on public.routes;
create policy "routes_insert_own" on public.routes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "routes_delete_own" on public.routes;
create policy "routes_delete_own" on public.routes
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists routes_user_idx on public.routes (user_id, created_at desc);

-- ---------------------------------------------------------------- progresso

create table if not exists public.route_progress (
  route_id uuid primary key references public.routes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  done text[] not null default '{}',
  checks text[] not null default '{}',
  streak integer not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table public.route_progress enable row level security;

drop policy if exists "route_progress_select_own" on public.route_progress;
create policy "route_progress_select_own" on public.route_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "route_progress_insert_own" on public.route_progress;
create policy "route_progress_insert_own" on public.route_progress
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "route_progress_update_own" on public.route_progress;
create policy "route_progress_update_own" on public.route_progress
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
