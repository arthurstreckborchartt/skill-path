-- Integration Hub: pedidos de aprovação.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Aditivo: não toca em nada existente.

-- ============================================================================================
-- POR QUE UMA TABELA NOVA, E NÃO `pathly_acoes_externas`
-- ============================================================================================
--
-- As duas guardam "uma ação externa esperando decisão", e a sobreposição é real — vale dizer em
-- vez de esconder.
--
-- `pathly_acoes_externas` tem 5 estados e serve a camada `src/lib/integracoes/`, que está
-- validada e em uso. Este sistema precisa de 8 estados, de reserva por nonce, de impressão
-- digital e de vínculo. Enxertar isso na outra significaria reescrever um gatilho validado e
-- migrar dados, para ganhar o quê — uma tabela a menos.
--
-- Então: esta tabela é a canônica do Hub. A migração da camada antiga para cá é um passo
-- separado, já descrito em `docs/INTEGRATION-HUB.md`, e não tem pressa.

create table if not exists public.pathly_hub_aprovacoes (
  id uuid primary key default gen_random_uuid(),

  -- ---- Os campos que toda ação registra ----------------------------------------------------
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid,
  integration_id text not null,
  action text not null,
  requested_permission text not null,
  capability text not null,
  scope text not null default 'uma-vez',
  status text not null default 'PENDING',
  -- Sempre o `user_id` de uma pessoa. Nunca um sistema: se o Pathly pudesse se aprovar, tudo
  -- acima disto seria decoração.
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  executed_at timestamptz,
  result text,
  error text,
  metadata jsonb not null default '{}'::jsonb,

  -- ---- As proteções ------------------------------------------------------------------------
  -- Vence sem uso. Uma aprovação que espera indefinidamente é uma aprovação esquecida, e o que
  -- ela autorizava pode não ser mais o que aconteceria agora.
  expires_at timestamptz not null,
  -- Impressão digital do conteúdo: duas iguais são a mesma ação, não duas.
  fingerprint text not null,
  -- Consumido na execução. Contra replay.
  nonce text not null,
  created_at timestamptz not null default now(),

  constraint pathly_hub_aprovacoes_status_valido check (
    status in ('PENDING','APPROVED','REJECTED','EXPIRED','EXECUTING','SUCCESS','FAILED','CANCELLED')
  ),
  constraint pathly_hub_aprovacoes_nivel_valido check (
    requested_permission in ('READ','SUGGEST','WRITE','EXECUTE','COMMIT','PUSH','DEPLOY','DELETE')
  ),
  constraint pathly_hub_aprovacoes_escopo_valido check (
    scope in ('uma-vez','sessao','persistente')
  ),
  -- Níveis que nunca viram permissão permanente. A regra está no código e aqui: uma delas
  -- sozinha é uma regra que alguém contorna pelo outro caminho.
  constraint pathly_hub_aprovacoes_persistente_proibida check (
    scope <> 'persistente'
    or requested_permission not in ('COMMIT','PUSH','DEPLOY','DELETE')
  ),
  -- Aprovada sem quem aprovou e quando é uma aprovação sem autor.
  constraint pathly_hub_aprovacoes_aprovacao_completa check (
    status <> 'APPROVED' or (approved_by is not null and approved_at is not null)
  )
);

-- Contra ação duplicada: um pedido vivo por impressão digital. `PENDING`, `APPROVED` e
-- `EXECUTING` ocupam lugar; os terminais não — repetir um deploy que falhou é legítimo.
create unique index if not exists pathly_hub_aprovacoes_viva_idx
  on public.pathly_hub_aprovacoes (user_id, fingerprint)
  where status in ('PENDING','APPROVED','EXECUTING');

create index if not exists pathly_hub_aprovacoes_user_idx
  on public.pathly_hub_aprovacoes (user_id, status, created_at desc);

alter table public.pathly_hub_aprovacoes enable row level security;

drop policy if exists "pathly_hub_aprovacoes_select_own" on public.pathly_hub_aprovacoes;
drop policy if exists "pathly_hub_aprovacoes_insert_own" on public.pathly_hub_aprovacoes;
drop policy if exists "pathly_hub_aprovacoes_update_own" on public.pathly_hub_aprovacoes;

create policy "pathly_hub_aprovacoes_select_own"
  on public.pathly_hub_aprovacoes for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_hub_aprovacoes_insert_own"
  on public.pathly_hub_aprovacoes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "pathly_hub_aprovacoes_update_own"
  on public.pathly_hub_aprovacoes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================================
-- O GATILHO — a máquina de estados, e o que não muda depois de pedido
-- ============================================================================================
--
-- Sem ele, o navegador levaria uma linha de PENDING direto para SUCCESS. A tabela de transições
-- vive em `aprovacao.ts` **e** aqui: quem escreve do cliente pode estar errado; quem escreve do
-- banco não deveria conseguir errar.

create or replace function public.pathly_hub_aprovacoes_transicao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    if not (
      (old.status = 'PENDING'   and new.status in ('APPROVED','REJECTED','EXPIRED','CANCELLED')) or
      (old.status = 'APPROVED'  and new.status in ('EXECUTING','EXPIRED','CANCELLED')) or
      (old.status = 'EXECUTING' and new.status in ('SUCCESS','FAILED'))
    ) then
      raise exception 'transicao de aprovacao invalida: % -> %', old.status, new.status
        using errcode = 'P0001';
    end if;
  end if;

  -- O que foi pedido não muda depois de pedido. Sem isto, aprovar uma leitura e trocar o nível
  -- para PUSH antes de executar seria uma escalada de permissão em um `update`.
  if new.integration_id is distinct from old.integration_id
     or new.action is distinct from old.action
     or new.requested_permission is distinct from old.requested_permission
     or new.capability is distinct from old.capability
     or new.project_id is distinct from old.project_id
     or new.user_id is distinct from old.user_id
     or new.metadata is distinct from old.metadata
     or new.fingerprint is distinct from old.fingerprint then
    raise exception 'o conteudo de uma aprovacao nao muda depois de criada'
      using errcode = 'P0001';
  end if;

  -- O nonce é consumido, nunca reescrito: trocá-lo devolveria validade a um replay.
  if new.nonce is distinct from old.nonce then
    raise exception 'o nonce de uma aprovacao nao muda'
      using errcode = 'P0001';
  end if;

  -- Ninguém estende a validade da própria aprovação para depois de ela ter vencido.
  if new.expires_at is distinct from old.expires_at then
    raise exception 'a validade de uma aprovacao nao se estende'
      using errcode = 'P0001';
  end if;

  -- Aprovar é ato de pessoa, e a pessoa é a dona. `approved_by` diferente do dono seria uma
  -- aprovação assinada por outra pessoa.
  if new.status = 'APPROVED' and new.approved_by is distinct from new.user_id then
    raise exception 'uma aprovacao e assinada pelo dono da acao'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists pathly_hub_aprovacoes_transicao_trg on public.pathly_hub_aprovacoes;
create trigger pathly_hub_aprovacoes_transicao_trg
  before update on public.pathly_hub_aprovacoes
  for each row execute function public.pathly_hub_aprovacoes_transicao();

revoke all on public.pathly_hub_aprovacoes from anon, authenticated;
grant select, insert, update on public.pathly_hub_aprovacoes to authenticated;
grant all on public.pathly_hub_aprovacoes to service_role;

-- O nonce é segredo: o navegador cria a linha, mas não precisa reler o nonce depois. Quem o
-- confere na execução é o servidor, com `service_role`.
--
-- ATENÇÃO, e foi lição cara ontem: um `revoke select (coluna)` NÃO corta um `grant select` de
-- tabela. Por isso o `select` aqui é concedido por coluna, sem o nonce na lista.
revoke select on public.pathly_hub_aprovacoes from authenticated;
grant select (
  id, user_id, project_id, integration_id, action, requested_permission, capability,
  scope, status, approved_by, approved_at, executed_at, result, error, metadata,
  expires_at, fingerprint, created_at
) on public.pathly_hub_aprovacoes to authenticated;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado:
--
--   1. `select nonce` -> 42501, e `select id, status` -> sem erro. As duas juntas.
--   2. PENDING direto para SUCCESS -> P0001.
--   3. PENDING -> APPROVED com `approved_by` diferente do dono -> P0001.
--   4. Trocar `requested_permission` depois de criada -> P0001.
--   5. Esticar `expires_at` -> P0001.
--   6. Dois pedidos com a mesma `fingerprint` vivos -> 23505.
--   7. `scope = 'persistente'` com `requested_permission = 'PUSH'` -> 23514.
--   8. `insert` com `user_id` alheio -> 42501 de RLS.
