-- Copilot do Pathly — conversa, decisões técnicas e propostas de alteração.
-- Rode uma vez no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Idempotente: pode rodar de novo sem quebrar nada. Não apaga nem altera dado existente.
--
-- ============================================================================================
-- O DESENHO EM UMA FRASE
-- ============================================================================================
--
-- O Copilot conversa (mensagens), propõe (propostas) e, só depois que a pessoa confirma,
-- registra o que ficou valendo (decisões). As três coisas são tabelas diferentes porque têm
-- padrões de leitura opostos: decisões ativas são lidas a CADA mensagem e são poucas; mensagens
-- crescem sem limite e são paginadas; propostas são consultadas por status.
--
-- ============================================================================================
-- POR QUE AS POLICIES CHECAM O DONO DO PROJETO, E NÃO SÓ `user_id`
-- ============================================================================================
--
-- `auth.uid() = user_id` sozinho deixa uma pessoa inserir linhas com o PRÓPRIO user_id apontando
-- para o `projeto_id` de OUTRA pessoa. Não vaza dado — o dono do projeto nunca veria essas linhas,
-- porque a leitura dele também filtra por user_id — mas suja um projeto alheio com conteúdo que o
-- dono não consegue nem enxergar para remover.
--
-- Por isso todo INSERT confere também a posse do projeto. A subconsulta em pathly_projetos roda
-- com a RLS daquela tabela aplicada, então já enxergaria apenas os projetos de quem chama; o
-- `p.user_id = auth.uid()` explícito existe para a regra não depender desse detalhe.

-- ============================================================================================
-- 1. MENSAGENS — append-only de verdade
-- ============================================================================================

create table if not exists public.pathly_copilot_mensagens (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.pathly_projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- `usuario` é o que a pessoa escreveu; `copilot` é a resposta estruturada.
  papel text not null check (papel in ('usuario', 'copilot')),

  -- Para o papel `usuario`, o texto puro. Para `copilot`, a resposta validada pelo contrato
  -- (modo, blocos, passos, artefato, proximoPasso). Guardar a resposta inteira é o que permite
  -- reabrir a conversa sem regerar nada.
  conteudo jsonb not null default '{}'::jsonb,

  -- Facetas usadas, modelo que respondeu, tokens do contexto. Diagnóstico, não conteúdo.
  metadata jsonb not null default '{}'::jsonb,

  criado_em timestamptz not null default now()
);

-- A consulta real é sempre "as últimas N mensagens deste projeto": desc para a paginação ler o
-- índice na ordem em que ele já está.
create index if not exists pathly_copilot_mensagens_projeto_criado_idx
  on public.pathly_copilot_mensagens (projeto_id, criado_em desc);

-- ============================================================================================
-- 2. DECISÕES — append-only, com supersedência
-- ============================================================================================

create table if not exists public.pathly_copilot_decisoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.pathly_projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- O assunto da decisão, estável entre versões: 'banco', 'auth', 'hospedagem', 'ia-nivel'.
  -- É por ela que se acha "a decisão ATIVA sobre banco" sem varrer o histórico.
  chave text not null,
  titulo text not null,
  -- O que ficou decidido: 'PostgreSQL', 'Supabase Auth', 'sem agentes no MVP'.
  valor text not null,
  -- Por quê. É este campo que faz a decisão valer mais que o Blueprint sozinho.
  motivo text not null,

  status text not null default 'ativa'
    check (status in ('proposta', 'ativa', 'substituida', 'rejeitada')),

  -- A decisão que esta aqui aposentou. Encadeia o histórico sem apagar nada.
  substitui_decisao_id uuid references public.pathly_copilot_decisoes (id) on delete set null,

  origem text not null default 'usuario'
    check (origem in ('copilot', 'usuario', 'importacao', 'sistema')),

  confirmado_em timestamptz,
  criado_em timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- "As decisões ativas deste projeto" — roda em toda mensagem do Copilot.
create index if not exists pathly_copilot_decisoes_projeto_status_idx
  on public.pathly_copilot_decisoes (projeto_id, status);

-- "A decisão ativa sobre banco" — roda quando o Copilot precisa de um assunto específico.
create index if not exists pathly_copilot_decisoes_projeto_chave_status_idx
  on public.pathly_copilot_decisoes (projeto_id, chave, status);

/**
 * O gatilho que torna "append-only" verdade, e não intenção.
 *
 * Sem ele, append-only é só uma regra no código do app — e o código do app é justamente a parte
 * que pode ter bug. Um cliente que reescrevesse `valor` de uma decisão existente destruiria a
 * trilha de auditoria silenciosamente, que é a única coisa que esta tabela existe para garantir.
 *
 * O que continua podendo mudar é só o que o fluxo de supersedência precisa: `status`,
 * `confirmado_em` e `metadata`. Conteúdo é imutável.
 */
create or replace function public.pathly_copilot_decisao_imutavel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.projeto_id is distinct from old.projeto_id
     or new.user_id is distinct from old.user_id
     or new.chave is distinct from old.chave
     or new.titulo is distinct from old.titulo
     or new.valor is distinct from old.valor
     or new.motivo is distinct from old.motivo
     or new.origem is distinct from old.origem
     or new.substitui_decisao_id is distinct from old.substitui_decisao_id
     or new.criado_em is distinct from old.criado_em then
    raise exception
      'Decisão técnica é append-only: para mudar de ideia, marque esta como substituida e crie uma nova.';
  end if;
  return new;
end;
$$;

drop trigger if exists pathly_copilot_decisao_imutavel_tg on public.pathly_copilot_decisoes;
create trigger pathly_copilot_decisao_imutavel_tg
  before update on public.pathly_copilot_decisoes
  for each row execute function public.pathly_copilot_decisao_imutavel();

-- ============================================================================================
-- 3. PROPOSTAS — o que o Copilot quer mudar, esperando confirmação
-- ============================================================================================

create table if not exists public.pathly_copilot_propostas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references public.pathly_projetos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Que tipo de mudança: 'stack', 'banco', 'api', 'auth', 'seguranca', 'funcionalidade',
  -- 'arquitetura', 'requisito', 'decisao'.
  tipo text not null,
  titulo text not null,
  descricao text not null,

  -- Onde a mudança bate, em caminho de ponto: 'tecnico.stack.banco'. É o que permite responder
  -- "o que mudou" sem guardar o Blueprint inteiro duas vezes.
  campo_afetado text,
  -- jsonb e não text porque o campo afetado tanto pode ser uma string quanto um objeto ou lista.
  valor_atual jsonb,
  valor_proposto jsonb,

  motivo text not null,
  -- O que mais é afetado se isto for aprovado. Lista, porque uma troca de banco mexe em várias
  -- partes e a pessoa precisa ver o tamanho antes de clicar em aprovar.
  impactos text[] not null default '{}',

  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'rejeitada', 'cancelada')),

  -- A decisão criada quando esta proposta foi aprovada. Fecha a rastreabilidade:
  -- proposta → aprovação → decisão.
  decisao_id uuid references public.pathly_copilot_decisoes (id) on delete set null,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  confirmado_em timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

-- "As propostas pendentes deste projeto" — entra no contexto de toda mensagem.
create index if not exists pathly_copilot_propostas_projeto_status_idx
  on public.pathly_copilot_propostas (projeto_id, status);

-- ============================================================================================
-- RLS
-- ============================================================================================

alter table public.pathly_copilot_mensagens enable row level security;
alter table public.pathly_copilot_decisoes enable row level security;
alter table public.pathly_copilot_propostas enable row level security;

-- --- mensagens: select + insert. SEM update: append-only garantido por privilégio. -----------

drop policy if exists "pathly_copilot_mensagens_select_own" on public.pathly_copilot_mensagens;
drop policy if exists "pathly_copilot_mensagens_insert_own" on public.pathly_copilot_mensagens;

create policy "pathly_copilot_mensagens_select_own"
  on public.pathly_copilot_mensagens for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_copilot_mensagens_insert_own"
  on public.pathly_copilot_mensagens for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pathly_projetos p
      where p.id = projeto_id and p.user_id = auth.uid()
    )
  );

-- --- decisões: select + insert + update (só status/confirmado_em/metadata, pelo gatilho) -----

drop policy if exists "pathly_copilot_decisoes_select_own" on public.pathly_copilot_decisoes;
drop policy if exists "pathly_copilot_decisoes_insert_own" on public.pathly_copilot_decisoes;
drop policy if exists "pathly_copilot_decisoes_update_own" on public.pathly_copilot_decisoes;

create policy "pathly_copilot_decisoes_select_own"
  on public.pathly_copilot_decisoes for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_copilot_decisoes_insert_own"
  on public.pathly_copilot_decisoes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pathly_projetos p
      where p.id = projeto_id and p.user_id = auth.uid()
    )
  );

create policy "pathly_copilot_decisoes_update_own"
  on public.pathly_copilot_decisoes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --- propostas: select + insert + update ------------------------------------------------------

drop policy if exists "pathly_copilot_propostas_select_own" on public.pathly_copilot_propostas;
drop policy if exists "pathly_copilot_propostas_insert_own" on public.pathly_copilot_propostas;
drop policy if exists "pathly_copilot_propostas_update_own" on public.pathly_copilot_propostas;

create policy "pathly_copilot_propostas_select_own"
  on public.pathly_copilot_propostas for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_copilot_propostas_insert_own"
  on public.pathly_copilot_propostas for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.pathly_projetos p
      where p.id = projeto_id and p.user_id = auth.uid()
    )
  );

create policy "pathly_copilot_propostas_update_own"
  on public.pathly_copilot_propostas for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================================
-- GRANTS
-- ============================================================================================
--
-- Mensagem não recebe update: o privilégio ausente é a garantia mais forte de append-only que
-- existe, e mais barata que um gatilho. Nenhuma tabela recebe delete, seguindo a convenção do
-- app — apagar o projeto leva tudo junto pelo cascade.

grant select, insert on public.pathly_copilot_mensagens to authenticated;
grant select, insert, update on public.pathly_copilot_decisoes to authenticated;
grant select, insert, update on public.pathly_copilot_propostas to authenticated;
