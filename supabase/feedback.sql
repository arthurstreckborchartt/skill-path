-- Tabela de feedback do app (bug, ideia, outro).
--
-- Este projeto não usa migrações locais: o schema é gerenciado pelo Supabase/Lovable.
-- Rode este arquivo uma vez no SQL Editor do painel do Supabase.
--
-- Leitura fica fora de propósito: não existe policy de SELECT, então nem o próprio autor lê de
-- volta pelo app. Quem lê é você, pelo painel — é o caminho mais simples que não expõe o
-- feedback de uma pessoa para outra.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'ideia', 'outro')),
  message text not null check (char_length(message) between 1 and 2000),
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Cada pessoa só consegue inserir feedback em nome dela mesma.
create policy "feedback_insert_own"
  on public.feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
