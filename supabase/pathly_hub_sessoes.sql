-- Integration Hub: Development Sessions — a orquestração do desenvolvimento.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Aditivo: não toca em nada existente.
--
-- PRÉ-REQUISITO: `pathly_hub_ferramentas.sql` precisa ter rodado antes. A sessão não referencia
-- aquelas tabelas por chave estrangeira, mas a tela lê as duas juntas — sem a primeira, a sessão
-- abre sem ferramenta escolhida e sem onde gravar o que aconteceu.

-- ============================================================================================
-- O QUE É UMA SESSÃO
-- ============================================================================================
--
-- Uma passagem por uma etapa da trilha, do planejamento ao blueprint atualizado. Ela guarda o
-- estado de uma coisa que acontece **fora** do Pathly: quem escreve código é a ferramenta, na
-- máquina de quem usa. O Pathly é o fio.
--
-- Por isso a tabela é pequena em colunas de ação e grande em colunas de contexto. Não há nada
-- aqui para disparar; há muito para lembrar.

create table if not exists public.pathly_hub_sessoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.pathly_projetos (id) on delete cascade,

  -- A integração do Hub que executa, quando houver uma. NULL para ferramenta local: não há
  -- integração porque o Pathly não executa nada. Guardar um id aqui sugeriria um caminho de
  -- execução que não existe.
  integration_id text,
  -- O id do AiDevelopmentProvider: claude-api, claude-code, codex, cursor.
  provider text,

  -- A tarefa. Hoje é sempre uma etapa da trilha, no formato `etapa:7`. Texto e não inteiro
  -- porque amanhã pode ser `revisao:3` ou `lancamento:checklist-seguranca`.
  task_id text not null,

  current_step text not null default 'planejar',

  -- ---- O snapshot, e por que a palavra é literal ------------------------------------------
  -- O Execution Brief congelado no instante em que foi entregue. O blueprint muda, as decisões
  -- mudam, e três dias depois ninguém consegue responder "o que a ferramenta sabia quando fez
  -- isso?". Com o snapshot, essa pergunta tem resposta — e é a primeira que se faz quando o
  -- resultado veio errado.
  context_snapshot jsonb,

  requested_actions jsonb not null default '[]'::jsonb,
  approved_actions jsonb not null default '[]'::jsonb,
  executed_actions jsonb not null default '[]'::jsonb,

  result jsonb,
  errors jsonb not null default '[]'::jsonb,
  technical_decisions jsonb not null default '[]'::jsonb,

  started_at timestamptz not null default now(),
  completed_at timestamptz,

  -- ---- A linha do tempo dos passos ---------------------------------------------------------
  -- Escrita pelo GATILHO, nunca pelo cliente. Ver a explicação antes do gatilho.
  steps jsonb not null default '[]'::jsonb,

  constraint pathly_hub_sessoes_passo_valido check (
    current_step in (
      'planejar','gerar-tarefa','preparar-contexto','escolher-ferramenta','solicitar-execucao',
      'autorizar','executar','receber-resultado','testar','validar','atualizar-blueprint',
      'concluida','cancelada','falhou'
    )
  ),

  -- Terminou tem data de fim; não terminou não tem. As duas direções, porque uma sessão viva com
  -- `completed_at` preenchido some dos relatórios sem ninguém perceber.
  constraint pathly_hub_sessoes_fim_coerente check (
    (current_step in ('concluida','cancelada','falhou')) = (completed_at is not null)
  )
);

-- ============================================================================================
-- UMA SESSÃO VIVA POR TAREFA
-- ============================================================================================
--
-- Duas sessões abertas para a mesma etapa produzem dois briefs, duas linhas do tempo e duas
-- versões do que aconteceu — e nenhuma delas completa. O índice parcial recusa a segunda.
--
-- Sessões encerradas não ocupam lugar: refazer uma etapa é legítimo, e o histórico das tentativas
-- anteriores é justamente o que torna a próxima melhor.
create unique index if not exists pathly_hub_sessoes_viva_idx
  on public.pathly_hub_sessoes (user_id, project_id, task_id)
  where current_step not in ('concluida','cancelada','falhou');

create index if not exists pathly_hub_sessoes_projeto_idx
  on public.pathly_hub_sessoes (user_id, project_id, started_at desc);

alter table public.pathly_hub_sessoes enable row level security;

drop policy if exists "pathly_hub_sessoes_select_own" on public.pathly_hub_sessoes;
drop policy if exists "pathly_hub_sessoes_insert_own" on public.pathly_hub_sessoes;
drop policy if exists "pathly_hub_sessoes_update_own" on public.pathly_hub_sessoes;
drop policy if exists "pathly_hub_sessoes_delete_own" on public.pathly_hub_sessoes;

create policy "pathly_hub_sessoes_select_own"
  on public.pathly_hub_sessoes for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_hub_sessoes_insert_own"
  on public.pathly_hub_sessoes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "pathly_hub_sessoes_update_own"
  on public.pathly_hub_sessoes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pathly_hub_sessoes_delete_own"
  on public.pathly_hub_sessoes for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================================
-- O GATILHO — a máquina de estados, e a linha do tempo que não pode discordar dela
-- ============================================================================================
--
-- Duas responsabilidades, e é de propósito que sejam a mesma função.
--
-- 1. **Recusar transição inválida.** A tabela vive em `contrato.ts` também; quem escreve do
--    cliente pode estar errado, quem escreve do banco não deveria conseguir errar.
--
-- 2. **Escrever `steps`.** O cliente manda só `current_step`; o gatilho anexa
--    `{passo, em: now()}`. Isso resolve dois problemas de uma vez: não há read-modify-write (duas
--    abas não se atropelam) e, sobretudo, a linha do tempo **não pode divergir do estado**, porque
--    as duas saem do mesmo UPDATE. Uma linha do tempo escrita à parte é uma segunda fonte da
--    verdade, e uma hora ela discorda.
--
-- As voltas são três e cada uma existe porque o desenvolvimento real tem aquela volta: teste que
-- falha, validação que reprova, e resultado que veio inaproveitável. Sem elas, a pessoa cancelaria
-- e abriria outra sessão — e o histórico diria que a etapa foi feita de primeira.

create or replace function public.pathly_hub_sessoes_transicao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.current_step is distinct from old.current_step then
    if not (
      (old.current_step = 'planejar'            and new.current_step in ('gerar-tarefa','cancelada')) or
      (old.current_step = 'gerar-tarefa'        and new.current_step in ('preparar-contexto','cancelada')) or
      (old.current_step = 'preparar-contexto'   and new.current_step in ('escolher-ferramenta','cancelada')) or
      (old.current_step = 'escolher-ferramenta' and new.current_step in ('solicitar-execucao','cancelada')) or
      (old.current_step = 'solicitar-execucao'  and new.current_step in ('autorizar','cancelada')) or
      (old.current_step = 'autorizar'           and new.current_step in ('executar','cancelada','falhou')) or
      (old.current_step = 'executar'            and new.current_step in ('receber-resultado','cancelada','falhou')) or
      (old.current_step = 'receber-resultado'   and new.current_step in ('testar','executar','cancelada','falhou')) or
      (old.current_step = 'testar'              and new.current_step in ('validar','executar','cancelada','falhou')) or
      (old.current_step = 'validar'             and new.current_step in ('atualizar-blueprint','executar','cancelada','falhou')) or
      (old.current_step = 'atualizar-blueprint' and new.current_step in ('concluida','cancelada','falhou'))
    ) then
      raise exception 'transicao de sessao invalida: % -> %', old.current_step, new.current_step
        using errcode = 'P0001';
    end if;

    new.steps := old.steps || jsonb_build_object('passo', new.current_step, 'em', now());
  else
    -- Sem mudança de passo, `steps` não muda. O cliente não escreve esta coluna: se tentar,
    -- o valor antigo prevalece em silêncio, e é o comportamento certo — a coluna é do gatilho.
    new.steps := old.steps;
  end if;

  -- O que foi pedido não muda depois de pedido. Trocar o projeto ou a tarefa de uma sessão em
  -- andamento faria a linha do tempo descrever um trabalho que não aconteceu ali.
  if new.project_id is distinct from old.project_id
     or new.task_id is distinct from old.task_id
     or new.user_id is distinct from old.user_id
     or new.started_at is distinct from old.started_at then
    raise exception 'projeto, tarefa, dono e inicio de uma sessao nao mudam'
      using errcode = 'P0001';
  end if;

  -- O snapshot é snapshot. Reescrevê-lo depois de entregue apagaria a resposta para "o que a
  -- ferramenta sabia quando fez isso?" — que é a única pergunta que ele existe para responder.
  if old.context_snapshot is not null
     and new.context_snapshot is distinct from old.context_snapshot then
    raise exception 'o contexto congelado de uma sessao nao muda'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists pathly_hub_sessoes_transicao_trg on public.pathly_hub_sessoes;
create trigger pathly_hub_sessoes_transicao_trg
  before update on public.pathly_hub_sessoes
  for each row execute function public.pathly_hub_sessoes_transicao();

-- O primeiro passo também entra na linha do tempo. Sem isto, a sessão nasceria com `steps` vazio
-- e a linha do tempo começaria no segundo passo — perdendo justamente a hora em que tudo começou.
create or replace function public.pathly_hub_sessoes_nascimento()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.steps := jsonb_build_array(jsonb_build_object('passo', new.current_step, 'em', now()));
  return new;
end;
$$;

drop trigger if exists pathly_hub_sessoes_nascimento_trg on public.pathly_hub_sessoes;
create trigger pathly_hub_sessoes_nascimento_trg
  before insert on public.pathly_hub_sessoes
  for each row execute function public.pathly_hub_sessoes_nascimento();

revoke all on public.pathly_hub_sessoes from anon, authenticated;
grant select, insert, update, delete on public.pathly_hub_sessoes to authenticated;
grant all on public.pathly_hub_sessoes to service_role;

-- ============================================================================================
-- A COLUNA `origem` GANHA UM TERCEIRO VALOR
-- ============================================================================================
--
-- `pathly_hub_registros` nasceu com dois: `ferramenta` (o Pathly leu direto) e `pessoa` (alguém
-- digitou). A orquestração revelou um terceiro caso, que não é nem um nem outro: **a ferramenta
-- escreveu o bloco de resultado, e a pessoa colou**.
--
-- O texto é da ferramenta, com o detalhe que só quem executou tem — então não é relato. E o
-- Pathly não viu acontecer, e o caminho passou por um Ctrl+C — então não é verificação. Achatar
-- isso em `pessoa` subestima a informação; achatar em `ferramenta` mente sobre ela.
alter table public.pathly_hub_registros
  drop constraint if exists pathly_hub_registros_origem_valida;

alter table public.pathly_hub_registros
  add constraint pathly_hub_registros_origem_valida
  check (origem in ('ferramenta','colado','pessoa'));

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado:
--
--   1. `insert` numa sessão -> `steps` já vem com uma entrada, escrita pelo gatilho de nascimento.
--   2. `planejar` direto para `executar` -> P0001.
--   3. `planejar` -> `gerar-tarefa` -> passa, e `steps` cresce para 2 sozinho.
--   4. `testar` -> `executar` (a volta) -> passa. É a transição que o fluxo linear não teria.
--   5. Escrever `steps` à mão no update -> o valor é ignorado, `steps` mantém o do gatilho.
--   6. Trocar `task_id` de uma sessão em andamento -> P0001.
--   7. Reescrever `context_snapshot` depois de preenchido -> P0001.
--   8. Duas sessões vivas para o mesmo `task_id` -> 23505 na segunda.
--   9. `current_step = 'concluida'` sem `completed_at` -> 23514.
--  10. `insert` em `pathly_hub_registros` com `origem = 'colado'` -> passa (antes: 23514).
--  11. `insert` com `user_id` alheio -> 42501 de RLS.
