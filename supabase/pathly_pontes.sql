-- Pontes locais: o agente que roda na máquina de quem usa.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Aditivo: não toca em nada existente.

-- ============================================================================================
-- O QUE **NÃO** ESTÁ AQUI
-- ============================================================================================
--
-- Tabela de permissão. `pathly_hub_permissoes` já guarda permissão por `provedor`, e uma ponte é
-- um provedor como outro qualquer: `provedor = 'ponte:<id>'`. Criar uma segunda tabela daria dois
-- lugares para responder "esta ponte pode?" — e um dia eles discordariam.
--
-- Trilha de auditoria também não: `pathly_hub_auditoria` recebe os atos da ponte com o mesmo
-- `provedor`.

-- ============================================================================================
-- A PONTE
-- ============================================================================================

create table if not exists public.pathly_pontes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  nome text not null,
  -- Informados pela ponte no pareamento. São dado, não prova: servem para a pessoa reconhecer
  -- qual máquina é qual, e para nada além disso.
  plataforma text not null default 'desconhecida',
  versao text not null default '0',
  adaptadores text[] not null default '{}',

  -- ---- O segredo, guardado como segredo -----------------------------------------------------
  -- SHA-256 do token que a ponte usa para se autenticar, em hexadecimal. O token em claro existe
  -- uma vez, na resposta do pareamento, e nunca mais: o servidor não consegue mostrá-lo de novo
  -- porque não o tem.
  --
  -- É o mesmo raciocínio de senha, e pela mesma razão: um vazamento desta tabela não deve dar a
  -- ninguém o direito de falar como a ponte de alguém.
  token_hash text not null,

  ultima_batida timestamptz,
  criada_em timestamptz not null default now(),
  revogada_em timestamptz,

  constraint pathly_pontes_token_hash_valido check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Um token, uma ponte. Duas linhas com o mesmo hash seriam duas pontes com a mesma identidade.
  unique (token_hash)
);

create index if not exists pathly_pontes_user_idx
  on public.pathly_pontes (user_id, criada_em desc);

alter table public.pathly_pontes enable row level security;

drop policy if exists "pathly_pontes_select_own" on public.pathly_pontes;
drop policy if exists "pathly_pontes_update_own" on public.pathly_pontes;
drop policy if exists "pathly_pontes_delete_own" on public.pathly_pontes;

create policy "pathly_pontes_select_own"
  on public.pathly_pontes for select to authenticated using (auth.uid() = user_id);
create policy "pathly_pontes_update_own"
  on public.pathly_pontes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pathly_pontes_delete_own"
  on public.pathly_pontes for delete to authenticated using (auth.uid() = user_id);

-- Sem `insert` para `authenticated`, de propósito: quem cria a linha é o servidor, no pareamento,
-- porque é ele que gera o token e grava o hash. Uma ponte criada pelo navegador teria que
-- carregar o token pelo navegador, e aí ele deixa de ser um segredo entre a ponte e o servidor.
revoke all on public.pathly_pontes from anon, authenticated;
grant select, update, delete on public.pathly_pontes to authenticated;
grant all on public.pathly_pontes to service_role;

-- O `token_hash` não é do navegador. A tela mostra nome, estado e adaptadores; o hash não serve
-- para nada lá e só aumenta a superfície de um vazamento.
revoke select on public.pathly_pontes from authenticated;
grant select (
  id, user_id, nome, plataforma, versao, adaptadores, ultima_batida, criada_em, revogada_em
) on public.pathly_pontes to authenticated;

-- ============================================================================================
-- O CÓDIGO DE PAREAMENTO
-- ============================================================================================
--
-- Seis caracteres, dez minutos, um uso. A pessoa gera na tela e digita na ponte.
--
-- Guardado como hash pela mesma razão do token: quem lê esta tabela não deve conseguir parear uma
-- ponte com a conta de ninguém.

create table if not exists public.pathly_ponte_codigos (
  codigo_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,

  constraint pathly_ponte_codigos_hash_valido check (codigo_hash ~ '^[0-9a-f]{64}$')
);

alter table public.pathly_ponte_codigos enable row level security;

drop policy if exists "pathly_ponte_codigos_select_own" on public.pathly_ponte_codigos;
create policy "pathly_ponte_codigos_select_own"
  on public.pathly_ponte_codigos for select to authenticated using (auth.uid() = user_id);

-- Nem insert, nem update, nem delete para `authenticated`. Só o servidor mexe aqui: o código é
-- gerado por ele e consumido por ele. E o `select` é por coluna, sem o hash — o navegador precisa
-- saber que existe um código válido e quando ele vence, não qual é.
revoke all on public.pathly_ponte_codigos from anon, authenticated;
grant select (user_id, criado_em, expira_em, usado_em) on public.pathly_ponte_codigos to authenticated;
grant all on public.pathly_ponte_codigos to service_role;

-- ============================================================================================
-- A FILA DE TAREFAS
-- ============================================================================================
--
-- O Pathly escreve aqui; a ponte busca. É a inversão que faz tudo funcionar: a nuvem não alcança
-- a máquina de ninguém, então quem procura é a ponte.

create table if not exists public.pathly_ponte_tarefas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ponte_id uuid not null references public.pathly_pontes (id) on delete cascade,
  project_id uuid references public.pathly_projetos (id) on delete cascade,

  acao_id text not null,
  parametros jsonb not null default '{}'::jsonb,
  modo text not null,

  -- Preenchidos só na execução de ação que altera. `plano_id` aponta para a tarefa de simulação
  -- que produziu o plano; `impressao_plano` é o que a ponte confere antes de agir.
  plano_id uuid references public.pathly_ponte_tarefas (id) on delete set null,
  impressao_plano text,

  estado text not null default 'pendente',
  -- O resultado, como a ponte devolveu. Numa simulação, é aqui que o plano fica.
  resultado jsonb,
  recusa text,

  criada_em timestamptz not null default now(),
  expira_em timestamptz not null,
  entregue_em timestamptz,
  concluida_em timestamptz,

  constraint pathly_ponte_tarefas_modo_valido check (modo in ('simulacao','execucao')),
  constraint pathly_ponte_tarefas_estado_valido check (
    estado in ('pendente','entregue','concluida','recusada','falhou','cancelada','vencida')
  ),
  -- Execução de ação que altera sem plano não deveria nem chegar ao banco. A regra vive no
  -- código da ponte E aqui: a do código dá mensagem boa, a daqui não tem como ser contornada.
  constraint pathly_ponte_tarefas_execucao_com_plano check (
    modo <> 'execucao' or plano_id is null or impressao_plano is not null
  )
);

create index if not exists pathly_ponte_tarefas_fila_idx
  on public.pathly_ponte_tarefas (ponte_id, estado, criada_em)
  where estado = 'pendente';

create index if not exists pathly_ponte_tarefas_user_idx
  on public.pathly_ponte_tarefas (user_id, criada_em desc);

alter table public.pathly_ponte_tarefas enable row level security;

drop policy if exists "pathly_ponte_tarefas_select_own" on public.pathly_ponte_tarefas;
drop policy if exists "pathly_ponte_tarefas_insert_own" on public.pathly_ponte_tarefas;
drop policy if exists "pathly_ponte_tarefas_update_own" on public.pathly_ponte_tarefas;

create policy "pathly_ponte_tarefas_select_own"
  on public.pathly_ponte_tarefas for select to authenticated using (auth.uid() = user_id);
create policy "pathly_ponte_tarefas_insert_own"
  on public.pathly_ponte_tarefas for insert to authenticated with check (auth.uid() = user_id);
create policy "pathly_ponte_tarefas_update_own"
  on public.pathly_ponte_tarefas for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.pathly_ponte_tarefas from anon, authenticated;
grant select, insert, update on public.pathly_ponte_tarefas to authenticated;
grant all on public.pathly_ponte_tarefas to service_role;

-- ============================================================================================
-- O GATILHO — a máquina de estados da tarefa
-- ============================================================================================
--
-- Sem ele, o navegador levaria uma tarefa de `pendente` direto para `concluida`, com o resultado
-- que quisesse — e a fila inteira viraria decoração. A ponte é quem conclui, e ela fala com o
-- servidor, não com o navegador.

create or replace function public.pathly_ponte_tarefas_transicao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $fn$
begin
  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'pendente' and new.estado in ('entregue','cancelada','vencida')) or
      (old.estado = 'entregue' and new.estado in ('concluida','recusada','falhou','vencida'))
    ) then
      raise exception 'transicao de tarefa invalida: % -> %', old.estado, new.estado
        using errcode = 'P0001';
    end if;
  end if;

  -- O que foi pedido não muda depois de pedido. Sem isto, aprovar uma leitura e trocar a ação
  -- para criar elemento antes de a ponte buscar seria escalada dentro de um `update`.
  if new.acao_id is distinct from old.acao_id
     or new.parametros is distinct from old.parametros
     or new.modo is distinct from old.modo
     or new.ponte_id is distinct from old.ponte_id
     or new.user_id is distinct from old.user_id
     or new.plano_id is distinct from old.plano_id
     or new.impressao_plano is distinct from old.impressao_plano then
    raise exception 'o conteudo de uma tarefa nao muda depois de criada'
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

drop trigger if exists pathly_ponte_tarefas_transicao_trg on public.pathly_ponte_tarefas;
create trigger pathly_ponte_tarefas_transicao_trg
  before update on public.pathly_ponte_tarefas
  for each row execute function public.pathly_ponte_tarefas_transicao();

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado:
--
--   1. `select token_hash` em `pathly_pontes` -> 42501, e `select id, nome` -> 200. As duas
--      juntas: é o par que separa "a coluna está protegida" de "a tabela quebrou".
--   2. `insert` em `pathly_pontes` -> 42501. Quem cria ponte é o servidor, no pareamento.
--   3. `select codigo_hash` em `pathly_ponte_codigos` -> 42501.
--   4. `insert` em `pathly_ponte_codigos` -> 42501.
--   5. `token_hash` fora do formato de 64 hex -> 23514 (pelo service_role).
--   6. Tarefa de `pendente` direto para `concluida` -> P0001.
--   7. Trocar `acao_id` de uma tarefa já criada -> P0001.
--   8. `modo = 'assobiar'` -> 23514.
--   9. `insert` de tarefa com `user_id` alheio -> 42501 de RLS.
