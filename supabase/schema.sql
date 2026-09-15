-- Schema único do Pathly. Rode uma vez no SQL Editor do painel do Supabase.
-- É idempotente: rodar de novo não quebra nada.
--
-- Este arquivo unifica dois desenhos que existiam em paralelo:
--   - o que veio do Replit (pathly_profiles, pathly_route_progress), já usado por
--     src/lib/cloud-sync.ts — o prefixo pathly_ e a forma das duas tabelas foram mantidos
--     exatamente como estavam, para o código que já funciona continuar funcionando;
--   - o que faltava para o catálogo de conteúdo real e para a rota gerada por IA.
--
-- Regra geral: RLS ligada em tudo, cada pessoa só enxerga a própria linha via auth.uid().
-- A única exceção é o catálogo, que é conteúdo público e mesmo assim não aceita escrita
-- pelo app — só pela service role.

-- ---------------------------------------------------------------- perfil

create table if not exists public.pathly_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding jsonb not null,
  updated_at timestamptz not null default now()
);

-- Campo livre: o que a pessoa escreve, com as próprias palavras, que quer fazer.
-- É o que a geração por IA vai ler além das respostas fechadas.
alter table public.pathly_profiles
  add column if not exists goal_text text;

alter table public.pathly_profiles
  drop constraint if exists pathly_profiles_goal_text_len;
alter table public.pathly_profiles
  add constraint pathly_profiles_goal_text_len
  check (goal_text is null or char_length(goal_text) <= 2000);

alter table public.pathly_profiles enable row level security;

drop policy if exists "pathly_profiles_select_own" on public.pathly_profiles;
create policy "pathly_profiles_select_own"
  on public.pathly_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_profiles_insert_own" on public.pathly_profiles;
create policy "pathly_profiles_insert_own"
  on public.pathly_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_profiles_update_own" on public.pathly_profiles;
create policy "pathly_profiles_update_own"
  on public.pathly_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "pathly_profiles_delete_own" on public.pathly_profiles;
create policy "pathly_profiles_delete_own"
  on public.pathly_profiles for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.pathly_profiles to authenticated;

-- ---------------------------------------------------------------- progresso da rota

create table if not exists public.pathly_route_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  route_signature text not null,
  progress jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pathly_route_progress enable row level security;

drop policy if exists "pathly_route_progress_select_own" on public.pathly_route_progress;
create policy "pathly_route_progress_select_own"
  on public.pathly_route_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_route_progress_insert_own" on public.pathly_route_progress;
create policy "pathly_route_progress_insert_own"
  on public.pathly_route_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_route_progress_update_own" on public.pathly_route_progress;
create policy "pathly_route_progress_update_own"
  on public.pathly_route_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.pathly_route_progress to authenticated;

-- ---------------------------------------------------------------- rota gerada

-- Guarda a rota que a pessoa recebeu. Necessário quando a geração passar a ser por IA:
-- a chamada acontece uma vez, no fim do onboarding, e o resultado precisa sobreviver.
-- `signature` casa com pathly_route_progress.route_signature.
create table if not exists public.pathly_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area text not null,
  generator text not null default 'regras',
  signature text not null,
  steps jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pathly_routes enable row level security;

drop policy if exists "pathly_routes_select_own" on public.pathly_routes;
create policy "pathly_routes_select_own"
  on public.pathly_routes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_routes_insert_own" on public.pathly_routes;
create policy "pathly_routes_insert_own"
  on public.pathly_routes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_routes_delete_own" on public.pathly_routes;
create policy "pathly_routes_delete_own"
  on public.pathly_routes for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.pathly_routes to authenticated;

create index if not exists pathly_routes_user_idx
  on public.pathly_routes (user_id, created_at desc);

-- ---------------------------------------------------------------- catálogo de conteúdo

-- Conteúdo real para onde as etapas apontam (ver src/lib/catalog.ts).
-- `source` e `source_license` são obrigatórios de propósito: nem toda fonte gratuita permite
-- redistribuição, e cada linha precisa ser auditável. Ver supabase/FONTES-DE-CONTEUDO.md.
create table if not exists public.pathly_resources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  url text not null,
  kind text not null check (kind in ('curso', 'video', 'artigo', 'doc', 'livro', 'projeto')),
  provider text,
  language text not null default 'pt',
  is_free boolean not null default true,
  topics text[] not null default '{}',
  areas text[] not null default '{}',
  level text check (level is null or level in ('iniciante', 'intermediário', 'avançado')),
  summary text not null,
  source text not null,
  source_license text not null,
  created_at timestamptz not null default now()
);

alter table public.pathly_resources enable row level security;

-- Leitura para todo mundo, inclusive quem não entrou: o catálogo aparece na rota de exemplo.
drop policy if exists "pathly_resources_read_all" on public.pathly_resources;
create policy "pathly_resources_read_all"
  on public.pathly_resources for select to anon, authenticated
  using (true);
-- Sem policy de escrita: só a service role popula o catálogo.

grant select on public.pathly_resources to anon, authenticated;

create index if not exists pathly_resources_areas_idx
  on public.pathly_resources using gin (areas);
create index if not exists pathly_resources_topics_idx
  on public.pathly_resources using gin (topics);

-- ---------------------------------------------------------------- feedback

-- Mantido igual ao supabase/feedback.sql, que pode já ter sido aplicado.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'ideia', 'outro')),
  message text not null check (char_length(message) between 1 and 2000),
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert to authenticated
  with check (auth.uid() = user_id);
-- Sem policy de SELECT: ninguém lê o feedback de outra pessoa pelo app. Você lê pelo painel.

grant insert on public.feedback to authenticated;

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------- privilégio mínimo

-- O Supabase concede TODOS os privilégios por padrão nas tabelas de `public` para `anon` e
-- `authenticated` — inclusive TRUNCATE. E TRUNCATE **não passa por RLS**: quem tem esse
-- privilégio esvazia a tabela inteira, independente de qualquer política. Como a chave `anon`
-- é pública (vai no JavaScript do navegador), isso é um buraco real.
--
-- Os grants acima são aditivos e não corrigem isso sozinhos. Este bloco zera e devolve só o
-- necessário. Rode sempre depois de criar tabela nova em `public`.

revoke all on public.pathly_profiles       from anon, authenticated;
revoke all on public.pathly_route_progress from anon, authenticated;
revoke all on public.pathly_routes         from anon, authenticated;
revoke all on public.pathly_resources      from anon, authenticated;
revoke all on public.feedback              from anon, authenticated;

grant select, insert, update, delete on public.pathly_profiles       to authenticated;
grant select, insert, update         on public.pathly_route_progress to authenticated;
grant select, insert, delete         on public.pathly_routes         to authenticated;
grant select                         on public.pathly_resources      to anon, authenticated;
grant insert                         on public.feedback              to authenticated;
