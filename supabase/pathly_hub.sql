-- Integration Hub: permissões granulares, eventos e trilha de auditoria.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Idempotente e ADITIVO: não cria, não altera e não apaga nada do que já existe.

-- ============================================================================================
-- O QUE ESTE SCRIPT NÃO FAZ, E POR QUÊ
-- ============================================================================================
--
-- Ele NÃO recria `pathly_conexoes` nem `pathly_acoes_externas`. Essas duas já existem, já estão
-- validadas por sonda, e são exatamente o `IntegrationConnection` e o `IntegrationAction` do
-- Hub. Recriá-las seria refazer um sistema que funciona para chamá-lo de novo.
--
-- Este script acrescenta as três peças que faltavam:
--
--   pathly_hub_permissoes  -> IntegrationPermission
--   pathly_hub_eventos     -> IntegrationEvent
--   pathly_hub_auditoria   -> IntegrationAuditLog

-- ============================================================================================
-- PERMISSÕES — uma linha por capacidade concedida
-- ============================================================================================
--
-- Uma linha por capacidade, e não um vetor numa coluna, porque assim dá para saber QUANDO cada
-- uma foi concedida, revogar uma sem reescrever as outras, e referenciá-la na auditoria.
--
-- Revogar NÃO apaga: preenche `revogada_em`. Uma permissão que existiu é um fato, e apagar o
-- fato é apagar a única prova de que alguém teve aquele acesso.

create table if not exists public.pathly_hub_permissoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provedor text not null,
  capacidade text not null,
  -- `null` = vale para todos os projetos da pessoa. Preenchido = vale só para aquele.
  projeto_id uuid references public.pathly_projetos (id) on delete cascade,
  concedida_em timestamptz not null default now(),
  revogada_em timestamptz,
  -- Validade opcional: é o padrão certo para execução e para qualquer coisa destrutiva.
  expira_em timestamptz,
  constraint pathly_hub_permissoes_capacidade_valida check (
    capacidade in (
      'READ_PROJECT', 'UPDATE_BLUEPRINT',
      'READ_FILES', 'WRITE_FILES', 'CREATE_FILE', 'UPDATE_FILE', 'DELETE_FILE',
      'EXECUTE_COMMAND', 'RUN_TESTS',
      'READ_GIT', 'CREATE_BRANCH', 'CREATE_COMMIT', 'PUSH_GIT',
      'READ_OBSIDIAN', 'WRITE_OBSIDIAN', 'CREATE_OBSIDIAN_NOTE'
    )
  )
);

-- Uma concessão viva por (pessoa, provedor, capacidade, projeto). O índice parcial deixa o
-- histórico de revogadas conviver com a atual sem conflito.
create unique index if not exists pathly_hub_permissoes_viva_idx
  on public.pathly_hub_permissoes (user_id, provedor, capacidade, coalesce(projeto_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revogada_em is null;

create index if not exists pathly_hub_permissoes_user_idx
  on public.pathly_hub_permissoes (user_id, provedor);

alter table public.pathly_hub_permissoes enable row level security;

drop policy if exists "pathly_hub_permissoes_select_own" on public.pathly_hub_permissoes;
drop policy if exists "pathly_hub_permissoes_insert_own" on public.pathly_hub_permissoes;
drop policy if exists "pathly_hub_permissoes_update_own" on public.pathly_hub_permissoes;

create policy "pathly_hub_permissoes_select_own"
  on public.pathly_hub_permissoes for select to authenticated
  using (auth.uid() = user_id);

-- Conceder é ato da pessoa, e só dela. O servidor NÃO recebe `insert` aqui: se recebesse,
-- existiria um caminho em que o Pathly concede permissão a si mesmo — que é exatamente o que
-- este módulo inteiro existe para impedir.
create policy "pathly_hub_permissoes_insert_own"
  on public.pathly_hub_permissoes for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      projeto_id is null
      or exists (
        select 1 from public.pathly_projetos p
        where p.id = projeto_id and p.user_id = auth.uid()
      )
    )
  );

create policy "pathly_hub_permissoes_update_own"
  on public.pathly_hub_permissoes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================================
-- O gatilho que impede desfazer uma revogação
-- ============================================================================================
--
-- Sem ele, `update ... set revogada_em = null` devolveria o acesso sem deixar rastro, e a linha
-- passaria a mentir sobre a própria história. Também congela o que a permissão É: mudar
-- `capacidade` numa linha concedida transformaria "autorizei ler" em "autorizei apagar".

create or replace function public.pathly_hub_permissoes_imutavel()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if old.revogada_em is not null and new.revogada_em is null then
    raise exception 'uma permissao revogada nao volta; conceda de novo'
      using errcode = 'P0001';
  end if;

  if new.capacidade is distinct from old.capacidade
     or new.provedor is distinct from old.provedor
     or new.projeto_id is distinct from old.projeto_id
     or new.user_id is distinct from old.user_id then
    raise exception 'o que uma permissao concede nao muda depois de concedida'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists pathly_hub_permissoes_imutavel_trg on public.pathly_hub_permissoes;
create trigger pathly_hub_permissoes_imutavel_trg
  before update on public.pathly_hub_permissoes
  for each row execute function public.pathly_hub_permissoes_imutavel();

revoke all on public.pathly_hub_permissoes from anon, authenticated;
grant select, insert, update on public.pathly_hub_permissoes to authenticated;
grant all on public.pathly_hub_permissoes to service_role;

-- ============================================================================================
-- EVENTOS — o que chega de fora
-- ============================================================================================
--
-- Evento é DADO, nunca instrução. Um webhook dizendo "rode os testes" não roda nada: vira uma
-- linha aqui, e no máximo produz uma ação `pendente` em `pathly_acoes_externas` para a pessoa
-- aprovar. Sem essa regra, quem descobre a URL do webhook comanda o Pathly.

create table if not exists public.pathly_hub_eventos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provedor text not null,
  origem text not null default 'webhook',
  tipo text not null,
  projeto_id uuid references public.pathly_projetos (id) on delete cascade,
  -- Já normalizado pelo adaptador. Nunca contém credencial.
  dados jsonb not null default '{}'::jsonb,
  recebido_em timestamptz not null default now(),
  processado boolean not null default false,
  constraint pathly_hub_eventos_origem_valida
    check (origem in ('webhook', 'polling', 'bridge', 'manual'))
);

create index if not exists pathly_hub_eventos_pendentes_idx
  on public.pathly_hub_eventos (user_id, processado, recebido_em desc);

alter table public.pathly_hub_eventos enable row level security;

drop policy if exists "pathly_hub_eventos_select_own" on public.pathly_hub_eventos;

create policy "pathly_hub_eventos_select_own"
  on public.pathly_hub_eventos for select to authenticated
  using (auth.uid() = user_id);

-- Sem `insert` para `authenticated`, e isto é deliberado: evento vem de fora, pelo servidor, que
-- é o único que consegue conferir a assinatura do webhook. Deixar o navegador inserir seria
-- deixar qualquer pessoa fabricar um evento em nome do próprio provedor.
revoke all on public.pathly_hub_eventos from anon, authenticated;
grant select on public.pathly_hub_eventos to authenticated;
grant all on public.pathly_hub_eventos to service_role;

-- ============================================================================================
-- AUDITORIA — o que foi feito, e por quem
-- ============================================================================================
--
-- Append-only de verdade: sem `update`, sem `delete`, para ninguém. Uma trilha que pode ser
-- editada é uma trilha que não serve para desconfiar de nada.
--
-- `acesso-negado` é o registro mais valioso e o mais fácil de esquecer: é ele que mostra uma
-- integração tentando repetidamente algo que ninguém autorizou.

create table if not exists public.pathly_hub_auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provedor text not null,
  ato text not null,
  capacidade text,
  -- Sem chave estrangeira, e isto é deliberado: uma trilha de auditoria guarda **ids**, não
  -- relacionamentos. `on delete set null` seria um UPDATE na trilha, que o gatilho abaixo barra —
  -- e o resultado é que nenhum projeto com atividade auditada poderia ser apagado. A linha
  -- continua dizendo "isto aconteceu no projeto X" mesmo depois de X sumir, que é exatamente a
  -- informação que alguém vai querer no dia em que investigar.
  acao_id uuid,
  projeto_id uuid,
  -- Uma frase em português. Nunca contém token nem cabeçalho de autorização.
  detalhe text not null default '',
  em timestamptz not null default now(),
  constraint pathly_hub_auditoria_ato_valido check (
    ato in (
      'conexao-criada', 'conexao-revogada',
      'permissao-concedida', 'permissao-revogada',
      'acao-criada', 'acao-aprovada', 'acao-recusada', 'acao-executada', 'acao-falhou',
      'evento-recebido', 'acesso-negado'
    )
  )
);

create index if not exists pathly_hub_auditoria_user_idx
  on public.pathly_hub_auditoria (user_id, em desc);

alter table public.pathly_hub_auditoria enable row level security;

drop policy if exists "pathly_hub_auditoria_select_own" on public.pathly_hub_auditoria;
drop policy if exists "pathly_hub_auditoria_insert_own" on public.pathly_hub_auditoria;

create policy "pathly_hub_auditoria_select_own"
  on public.pathly_hub_auditoria for select to authenticated
  using (auth.uid() = user_id);

-- A pessoa pode inserir na própria trilha (a tela registra concessão e revogação, que acontecem
-- no navegador). O servidor registra o resto com `service_role`.
create policy "pathly_hub_auditoria_insert_own"
  on public.pathly_hub_auditoria for insert to authenticated
  with check (auth.uid() = user_id);

revoke all on public.pathly_hub_auditoria from anon, authenticated;
grant select, insert on public.pathly_hub_auditoria to authenticated;
grant all on public.pathly_hub_auditoria to service_role;

-- Nem o dono edita a própria trilha, e nem quem tem privilégio total: o gatilho barra `update`
-- para todos. Privilégio é uma camada, o gatilho é outra.
--
-- **Remoção é outra pergunta, e o gatilho não responde a ela.** Barrar `delete` aqui tornaria a
-- conta indelével — apagar a conta precisa levar os dados pessoais junto, inclusive a trilha. Quem
-- remove é controlado por privilégio: `authenticated` não tem `delete`, e `service_role` tem, que
-- é o mesmo nível de confiança que já pode tudo.
create or replace function public.pathly_hub_auditoria_append_only()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'a trilha de auditoria nao muda'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists pathly_hub_auditoria_append_only_trg on public.pathly_hub_auditoria;
create trigger pathly_hub_auditoria_append_only_trg
  before update on public.pathly_hub_auditoria
  for each row execute function public.pathly_hub_auditoria_append_only();

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, já logado. As provas que importam:
--
--   1. As três tabelas respondem:
--      await supabase.from('pathly_hub_permissoes').select('id').limit(1)   -> sem erro
--
--   2. Ninguém desfaz uma revogação:
--      conceder, revogar (update revogada_em), e tentar `update ... revogada_em = null`
--      -> esperado: P0001
--
--   3. A trilha não muda:
--      inserir uma linha e tentar `update` nela -> esperado: P0001
--      (o `delete` pelo navegador dá 42501, por privilégio — o gatilho não trata remoção)
--
--   3b. Apagar um projeto com linha de auditoria funciona, e a linha fica:
--      delete from pathly_projetos where id = ... -> sem erro
--
--   4. Evento não nasce do navegador:
--      await supabase.from('pathly_hub_eventos').insert({...})
--      -> esperado: 42501 (privilégio, não RLS)
--
--   5. Permissão de outra pessoa é recusada:
--      insert com `user_id` alheio -> esperado: 42501 violates row-level security policy
