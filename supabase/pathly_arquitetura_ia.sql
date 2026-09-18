-- Tabela do módulo de Arquitetura de IA.
-- Rode uma vez no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
--
-- Segue a convenção das demais tabelas de módulo (pathly_apis, pathly_modelos_dados,
-- pathly_seguranca): uma linha por projeto, dona identificada por user_id, RLS por dono.
--
-- Não há delete: apagar o projeto leva a linha junto pelo cascade de pathly_projetos.

create table if not exists public.pathly_arquitetura_ia (
  projeto_id uuid primary key references public.pathly_projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- O plano validado por contrato.ts. Só ele é guardado: custo, latência, prompts e relatório
  -- são derivados na tela, para uma mudança de preço no catálogo não deixar cópias erradas.
  plano jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Buscar "as arquiteturas deste usuário" sem varrer a tabela.
create index if not exists pathly_arquitetura_ia_user_id_idx
  on public.pathly_arquitetura_ia (user_id);

alter table public.pathly_arquitetura_ia enable row level security;

drop policy if exists "pathly_arquitetura_ia_select_own" on public.pathly_arquitetura_ia;
drop policy if exists "pathly_arquitetura_ia_insert_own" on public.pathly_arquitetura_ia;
drop policy if exists "pathly_arquitetura_ia_update_own" on public.pathly_arquitetura_ia;

create policy "pathly_arquitetura_ia_select_own"
  on public.pathly_arquitetura_ia for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_arquitetura_ia_insert_own"
  on public.pathly_arquitetura_ia for insert to authenticated
  with check (auth.uid() = user_id);

-- `using` e `with check` juntos: sem o `with check`, alguém poderia atualizar a própria linha
-- colocando o user_id de outra pessoa, e a linha sairia do alcance de todo mundo.
create policy "pathly_arquitetura_ia_update_own"
  on public.pathly_arquitetura_ia for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.pathly_arquitetura_ia to authenticated;
