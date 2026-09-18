-- Confirmações do Validation Engine.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Idempotente e não destrutivo: não apaga nem altera dado existente.
--
-- ============================================================================================
-- POR QUE UMA LINHA POR PROJETO, E NÃO UMA POR CONFIRMAÇÃO
-- ============================================================================================
--
-- A confirmação não é decisão técnica: é a pessoa dizendo "conferi isto no meu código". Não
-- precisa de histórico versionado nem de supersedência — se ela desmarcar e marcar de novo, o
-- que importa é o estado atual.
--
-- E a leitura roda a cada abertura da tela de validação, junto com o blueprint, o modelo, o mapa
-- de API e o plano de IA. Uma linha por confirmação faria dessa tabela a que mais cresce do app
-- para responder uma pergunta que cabe num objeto.
--
-- O `jsonb` guarda `{ "<id-da-verificacao>": { "em": "<timestamp>" } }`. A data fica junto porque
-- "você confirmou há seis meses" é informação diferente de "você confirmou hoje" — o projeto pode
-- ter mudado desde então.

create table if not exists public.pathly_validacoes (
  projeto_id uuid primary key references public.pathly_projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  confirmacoes jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pathly_validacoes_user_id_idx on public.pathly_validacoes (user_id);

alter table public.pathly_validacoes enable row level security;

drop policy if exists "pathly_validacoes_select_own" on public.pathly_validacoes;
drop policy if exists "pathly_validacoes_insert_own" on public.pathly_validacoes;
drop policy if exists "pathly_validacoes_update_own" on public.pathly_validacoes;

create policy "pathly_validacoes_select_own"
  on public.pathly_validacoes for select to authenticated
  using (auth.uid() = user_id);

-- O `exists` confere a posse do projeto, e não só o `user_id`. Sem ele, alguém insere linhas com
-- o próprio user_id apontando para o projeto de outra pessoa: não vaza dado, mas suja um projeto
-- alheio com conteúdo que o dono não consegue nem enxergar para remover.
create policy "pathly_validacoes_insert_own"
  on public.pathly_validacoes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pathly_projetos p
      where p.id = projeto_id and p.user_id = auth.uid()
    )
  );

-- `using` e `with check` juntos: sem o `with check`, alguém poderia atualizar a própria linha
-- colocando o user_id de outra pessoa, e a linha sairia do alcance de todo mundo.
create policy "pathly_validacoes_update_own"
  on public.pathly_validacoes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================================
-- PRIVILÉGIOS
-- ============================================================================================
--
-- `REVOKE ALL` antes do `GRANT`, e não só o `GRANT`: no Supabase as DEFAULT PRIVILEGES do schema
-- `public` já concedem tudo a `anon` e `authenticated`, então conceder de novo é aditivo e nunca
-- restringe. Sem o revoke, esta tabela nasceria com `delete` liberado.
--
-- Custou um teste descobrir isso. Ver `supabase/ESTADO-SQL.md`.

revoke all on public.pathly_validacoes from anon, authenticated;
grant select, insert, update on public.pathly_validacoes to authenticated;
grant all on public.pathly_validacoes to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- No console do app, logado:
--
--   await supabase.from('pathly_validacoes').select('projeto_id').limit(0);   // sem erro
--   await supabase.from('pathly_validacoes').delete().eq('projeto_id', '...'); // 42501
--   // insert com user_id de outra pessoa                                      // 42501
