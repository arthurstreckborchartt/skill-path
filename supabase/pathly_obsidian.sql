-- Integração com o Obsidian: a conexão do vault e o estado de sincronização por nota.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Aditivo: não toca em nada existente.

-- ============================================================================================
-- O QUE ESTAS TABELAS **NÃO** GUARDAM
-- ============================================================================================
--
-- Conteúdo de nota. Nenhum.
--
-- O vault é lido, comparado e escrito no navegador de quem usa, pela File System Access API. O
-- servidor guarda o caminho da nota e uma impressão digital de 8 caracteres — o bastante para
-- saber "isto mudou desde a última vez?", e insuficiente para reconstruir uma linha de texto.
--
-- Isso não é uma política que alguém precisa lembrar de respeitar: é o que as colunas permitem.
-- Não há onde escrever o conteúdo mesmo que alguém queira. A exigência "não envie o vault para
-- IA nenhuma" fica garantida pelo formato, e não pela boa vontade do próximo desenvolvedor.

-- ============================================================================================
-- A CONEXÃO
-- ============================================================================================

create table if not exists public.pathly_obsidian_conexao (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- pasta | rest-local | mcp-local | uri. Hoje só `pasta` é alcançável; os outros existem no
  -- catálogo para serem explicados na tela.
  mecanismo text not null default 'pasta',

  -- O NOME da pasta raiz, não o caminho. O navegador não entrega caminho absoluto, de propósito —
  -- e o Pathly não precisa dele.
  vault text not null,

  -- [{ caminho, ler, escrever }]. Nasce vazio: nenhuma pasta é liberada sem alguém liberar.
  pastas jsonb not null default '[]'::jsonb,

  -- Um interruptor por tipo de conteúdo. Todos desligados por padrão.
  tipos jsonb not null default '{}'::jsonb,

  -- O mapeamento de pastas, quando a pessoa não usa a estrutura sugerida.
  mapeamento jsonb not null default '{}'::jsonb,

  direcao text not null default 'pathly-para-obsidian',

  -- **Desligada por padrão**, e a tela explica o que será sincronizado antes de ligar.
  automatica boolean not null default false,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint pathly_obsidian_mecanismo_valido check (
    mecanismo in ('pasta','rest-local','mcp-local','uri')
  ),
  constraint pathly_obsidian_direcao_valida check (
    direcao in ('pathly-para-obsidian','obsidian-para-pathly','bidirecional')
  )
);

alter table public.pathly_obsidian_conexao enable row level security;

drop policy if exists "pathly_obsidian_conexao_select_own" on public.pathly_obsidian_conexao;
drop policy if exists "pathly_obsidian_conexao_insert_own" on public.pathly_obsidian_conexao;
drop policy if exists "pathly_obsidian_conexao_update_own" on public.pathly_obsidian_conexao;
drop policy if exists "pathly_obsidian_conexao_delete_own" on public.pathly_obsidian_conexao;

create policy "pathly_obsidian_conexao_select_own"
  on public.pathly_obsidian_conexao for select to authenticated using (auth.uid() = user_id);
create policy "pathly_obsidian_conexao_insert_own"
  on public.pathly_obsidian_conexao for insert to authenticated with check (auth.uid() = user_id);
create policy "pathly_obsidian_conexao_update_own"
  on public.pathly_obsidian_conexao for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pathly_obsidian_conexao_delete_own"
  on public.pathly_obsidian_conexao for delete to authenticated using (auth.uid() = user_id);

revoke all on public.pathly_obsidian_conexao from anon, authenticated;
grant select, insert, update, delete on public.pathly_obsidian_conexao to authenticated;
grant all on public.pathly_obsidian_conexao to service_role;

-- ============================================================================================
-- O ESTADO POR NOTA
-- ============================================================================================
--
-- Uma linha por nota que o Pathly já escreveu ou leu. É daqui que sai a detecção de conflito e o
-- corte do laço de sincronização — as duas do mesmo dado, o que é bom: não há um segundo sistema
-- para manter em pé.

create table if not exists public.pathly_obsidian_notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.pathly_projetos (id) on delete cascade,

  -- Caminho relativo à raiz do vault. É o identificador de verdade.
  caminho text not null,
  tipo text not null,

  -- ---- A coluna que faz tudo funcionar -----------------------------------------------------
  -- FNV-1a de 32 bits do texto que o Pathly escreveu por último, em hexadecimal.
  --
  -- Na sincronização seguinte o navegador lê o arquivo, calcula de novo e compara:
  --   igual    -> foi o próprio Pathly. Nada a fazer, e o laço morre aqui.
  --   diferente-> alguém mexeu fora do Pathly. Conflito, e quem decide é a pessoa.
  --
  -- Data de modificação não serviria: relógios de máquinas diferentes discordam, o Obsidian Sync
  -- reescreve mtime, e salvar sem mudar nada já gera mtime novo.
  impressao text not null,

  sincronizado_em timestamptz not null default now(),

  constraint pathly_obsidian_notas_tipo_valido check (
    tipo in ('blueprint','decisoes','estado','tarefas','erros','pesquisa','logs')
  ),
  -- 8 hex, e nada além disso. O `check` é o que impede alguém, um dia, de guardar o conteúdo
  -- aqui "só para facilitar" — a coluna não aceita.
  constraint pathly_obsidian_notas_impressao_valida check (impressao ~ '^[0-9a-f]{8}$'),

  -- Um caminho, um estado. Duas linhas para a mesma nota dariam duas respostas para "isto mudou?".
  unique (user_id, caminho)
);

create index if not exists pathly_obsidian_notas_projeto_idx
  on public.pathly_obsidian_notas (user_id, project_id, sincronizado_em desc);

alter table public.pathly_obsidian_notas enable row level security;

drop policy if exists "pathly_obsidian_notas_select_own" on public.pathly_obsidian_notas;
drop policy if exists "pathly_obsidian_notas_insert_own" on public.pathly_obsidian_notas;
drop policy if exists "pathly_obsidian_notas_update_own" on public.pathly_obsidian_notas;
drop policy if exists "pathly_obsidian_notas_delete_own" on public.pathly_obsidian_notas;

create policy "pathly_obsidian_notas_select_own"
  on public.pathly_obsidian_notas for select to authenticated using (auth.uid() = user_id);
create policy "pathly_obsidian_notas_insert_own"
  on public.pathly_obsidian_notas for insert to authenticated with check (auth.uid() = user_id);
create policy "pathly_obsidian_notas_update_own"
  on public.pathly_obsidian_notas for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pathly_obsidian_notas_delete_own"
  on public.pathly_obsidian_notas for delete to authenticated using (auth.uid() = user_id);

revoke all on public.pathly_obsidian_notas from anon, authenticated;
grant select, insert, update, delete on public.pathly_obsidian_notas to authenticated;
grant all on public.pathly_obsidian_notas to service_role;

-- ============================================================================================
-- OS EVENTOS
-- ============================================================================================
--
-- NOTE_CREATED, NOTE_UPDATED, NOTE_DELETED, BLUEPRINT_SYNCED, DECISION_SYNCED, TASK_SYNCED.
--
-- Append-only: o histórico do que o Pathly mexeu no vault de alguém não se reescreve. Se ele
-- apagou uma nota, essa linha fica.

create table if not exists public.pathly_obsidian_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.pathly_projetos (id) on delete cascade,
  evento text not null,
  caminho text not null,
  -- `pathly` quando a escrita partiu daqui; `obsidian` quando a mudança veio de fora.
  origem text not null,
  detalhe text,
  criado_em timestamptz not null default now(),

  constraint pathly_obsidian_eventos_valido check (
    evento in ('NOTE_CREATED','NOTE_UPDATED','NOTE_DELETED','BLUEPRINT_SYNCED','DECISION_SYNCED','TASK_SYNCED')
  ),
  constraint pathly_obsidian_eventos_origem_valida check (origem in ('pathly','obsidian'))
);

create index if not exists pathly_obsidian_eventos_idx
  on public.pathly_obsidian_eventos (user_id, criado_em desc);

alter table public.pathly_obsidian_eventos enable row level security;

drop policy if exists "pathly_obsidian_eventos_select_own" on public.pathly_obsidian_eventos;
drop policy if exists "pathly_obsidian_eventos_insert_own" on public.pathly_obsidian_eventos;

create policy "pathly_obsidian_eventos_select_own"
  on public.pathly_obsidian_eventos for select to authenticated using (auth.uid() = user_id);
create policy "pathly_obsidian_eventos_insert_own"
  on public.pathly_obsidian_eventos for insert to authenticated with check (auth.uid() = user_id);

-- Sem `update` e sem `delete`, pelo mesmo motivo de `pathly_hub_registros`: um privilégio que não
-- existe protege melhor que um gatilho, porque não há o que desligar. O que o Pathly fez no vault
-- de alguém é registro, não rascunho.
revoke all on public.pathly_obsidian_eventos from anon, authenticated;
grant select, insert on public.pathly_obsidian_eventos to authenticated;
grant all on public.pathly_obsidian_eventos to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado:
--
--   1. `select` nas três -> sem erro.
--   2. `update` em `pathly_obsidian_eventos` -> 42501. É a prova principal aqui.
--   3. `delete` em `pathly_obsidian_eventos` -> 42501.
--   4. `insert` em notas com `impressao = 'conteudo inteiro da nota'` -> 23514. É o `check` que
--      impede alguém de guardar texto nesta coluna.
--   5. `insert` em notas com `impressao = 'ABCD1234'` (maiúsculas) -> 23514.
--   6. Duas linhas com o mesmo `caminho` -> 23505.
--   7. `insert` com `evento = 'NOTE_MOVED'` -> 23514.
--   8. `insert` com `user_id` alheio -> 42501 de RLS, nas três.
