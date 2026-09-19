-- Integrações externas: conexões da pessoa e ações que exigem aprovação antes de sair.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Idempotente e não destrutivo: não apaga nem altera dado existente.
--
-- ============================================================================================
-- O QUE ESTE SCRIPT PROTEGE, E COMO
-- ============================================================================================
--
-- `pathly_conexoes.token_cifrado` é o dado mais perigoso que este app vai guardar. Ele vale mais
-- que a senha do Pathly: abre a conta da pessoa em OUTRO serviço.
--
-- Por isso ele tem três camadas, e nenhuma delas sozinha basta:
--
--   1. Cifrado pela aplicação (AES-GCM, chave num secret do Worker). Vazar o banco sem vazar o
--      Worker não entrega token nenhum.
--   2. RLS por dono, como o resto do app.
--   3. `GRANT SELECT` **por coluna**, sem o token na lista — e esta é a que mais importa. O
--      navegador pode ler QUE existe conexão, com quais escopos e de qual conta. O token, não.
--      Sem isso, um XSS no app viraria roubo do GitHub da pessoa.
--
-- Privilégio de coluna é privilégio, não policy: acontece antes da RLS e não depende de ninguém
-- lembrar de filtrar `select`.
--
-- ATENÇÃO — a primeira versão deste script fazia `grant select` na tabela inteira e depois
-- `revoke select (token_cifrado)`, achando que bastava o revoke vir por último. Não bastou: a
-- sonda mostrou o token legível por `authenticated`. A documentação do Postgres, em REVOKE, diz
-- por quê: "if a role has been granted privileges on a table, then revoking the same privileges
-- from individual columns will have no effect." Privilégio de tabela não se corta por coluna.
-- Por isso o `select` aqui nunca é concedido na tabela: só na lista de colunas permitidas.

-- ============================================================================================
-- CONEXÕES
-- ============================================================================================

create table if not exists public.pathly_conexoes (
  user_id uuid not null references auth.users (id) on delete cascade,
  provedor text not null,
  -- `v1.<iv>.<cifrado>`, produzido por `src/lib/integracoes/cripto.ts`. Nunca texto claro.
  token_cifrado text not null,
  escopos text[] not null default '{}',
  -- Login ou nome da conta do outro lado, para a pessoa reconhecer qual conexão é qual.
  conta text not null default '',
  expira_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Uma conexão por provedor por pessoa: reconectar substitui, não acumula token velho.
  primary key (user_id, provedor)
);

alter table public.pathly_conexoes enable row level security;

drop policy if exists "pathly_conexoes_select_own" on public.pathly_conexoes;
drop policy if exists "pathly_conexoes_delete_own" on public.pathly_conexoes;

create policy "pathly_conexoes_select_own"
  on public.pathly_conexoes for select to authenticated
  using (auth.uid() = user_id);

-- Desconectar é da pessoa, e é a única escrita que ela faz aqui direto.
-- Criar e atualizar conexão passa pelo servidor, que é quem tem o token para cifrar.
create policy "pathly_conexoes_delete_own"
  on public.pathly_conexoes for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.pathly_conexoes from anon, authenticated;

-- O `select` sai por coluna, e `token_cifrado` não está na lista. Não existe aqui um privilégio
-- de tabela para depois tentar recortar — é essa ausência que protege o token.
--
-- Efeito colateral, e ele é desejado: `select *` nesta tabela passa a falhar com 42501 para
-- `authenticated`. Quem escrever `select('*')` aqui descobre na hora, em vez de vazar o token em
-- silêncio. O cliente já lê colunas explícitas em `src/lib/integracoes/usar-integracoes.ts`.
grant select (user_id, provedor, escopos, conta, expira_em, criado_em, atualizado_em)
  on public.pathly_conexoes to authenticated;

-- Desconectar continua sendo da pessoa. O `delete` é de tabela porque apaga a linha inteira;
-- não existe delete de coluna.
grant delete on public.pathly_conexoes to authenticated;

grant all on public.pathly_conexoes to service_role;

-- ============================================================================================
-- AÇÕES EXTERNAS
-- ============================================================================================
--
-- Append-only por estado, como as decisões do Copilot: nada é apagado, o que muda é o `estado`.
-- Uma ação recusada continua visível — saber o que o Pathly quis fazer e foi barrado é tão útil
-- quanto saber o que ele fez.

create table if not exists public.pathly_acoes_externas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  projeto_id uuid references public.pathly_projetos (id) on delete cascade,
  provedor text not null,
  acao_id text not null,
  -- O que a pessoa lê antes de aprovar, e para onde vai. Aprovar sem isto é aprovar às cegas.
  resumo text not null,
  destino text not null,
  impacto text not null default 'escrita',
  -- O corpo exato que será enviado, gravado ANTES da aprovação. Se fosse remontado na execução,
  -- o que saiu não seria necessariamente o que ela viu.
  payload jsonb not null default '{}'::jsonb,
  estado text not null default 'pendente',
  resultado text,
  erro text,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  executado_em timestamptz,
  constraint pathly_acoes_externas_estado_valido
    check (estado in ('pendente', 'aprovada', 'executada', 'recusada', 'falhou')),
  constraint pathly_acoes_externas_impacto_valido
    check (impacto in ('leitura', 'escrita', 'destrutiva'))
);

create index if not exists pathly_acoes_externas_pendentes_idx
  on public.pathly_acoes_externas (user_id, estado, criado_em desc);

create index if not exists pathly_acoes_externas_projeto_idx
  on public.pathly_acoes_externas (projeto_id, criado_em desc);

alter table public.pathly_acoes_externas enable row level security;

drop policy if exists "pathly_acoes_externas_select_own" on public.pathly_acoes_externas;
drop policy if exists "pathly_acoes_externas_insert_own" on public.pathly_acoes_externas;
drop policy if exists "pathly_acoes_externas_update_own" on public.pathly_acoes_externas;

create policy "pathly_acoes_externas_select_own"
  on public.pathly_acoes_externas for select to authenticated
  using (auth.uid() = user_id);

-- O `exists` confere a posse do projeto, e não só o `user_id`. Sem ele alguém insere ações com o
-- próprio user_id apontando para o projeto de outra pessoa: não vaza dado, mas suja um projeto
-- alheio com conteúdo que o dono não consegue nem enxergar para remover.
create policy "pathly_acoes_externas_insert_own"
  on public.pathly_acoes_externas for insert to authenticated
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

-- `using` e `with check` juntos: sem o `with check`, alguém atualizaria a própria linha colocando
-- o user_id de outra pessoa, e a linha sairia do alcance de todo mundo.
create policy "pathly_acoes_externas_update_own"
  on public.pathly_acoes_externas for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================================
-- O GATILHO QUE SUSTENTA O PORTÃO
-- ============================================================================================
--
-- A RLS decide QUEM escreve. Ela não olha o valor antigo, então não consegue dizer "de pendente
-- só dá para ir a aprovada ou recusada". Sem este gatilho, alguém com sessão válida faria um
-- `update` levando a própria ação direto de `pendente` para `executada` — e o executor, que só
-- checa `estado = 'aprovada'`, nunca veria a diferença.
--
-- Ele também congela o que foi aprovado: `payload`, `destino` e `resumo` não mudam depois de
-- criados. Aprovar um texto e executar outro é o jeito mais silencioso de furar o portão.

create or replace function public.pathly_acoes_externas_transicao()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'pendente' and new.estado in ('aprovada', 'recusada')) or
      (old.estado = 'aprovada' and new.estado in ('executada', 'falhou', 'recusada'))
    ) then
      raise exception 'transicao de estado invalida: % -> %', old.estado, new.estado
        using errcode = 'P0001';
    end if;
  end if;

  if new.payload is distinct from old.payload
     or new.destino is distinct from old.destino
     or new.resumo is distinct from old.resumo
     or new.provedor is distinct from old.provedor
     or new.acao_id is distinct from old.acao_id then
    raise exception 'o conteudo de uma acao nao muda depois de criada'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists pathly_acoes_externas_transicao_trg on public.pathly_acoes_externas;
create trigger pathly_acoes_externas_transicao_trg
  before update on public.pathly_acoes_externas
  for each row execute function public.pathly_acoes_externas_transicao();

revoke all on public.pathly_acoes_externas from anon, authenticated;
grant select, insert, update on public.pathly_acoes_externas to authenticated;
grant all on public.pathly_acoes_externas to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- No console do app, logado:
--
--   await supabase.from('pathly_conexoes').select('provedor').limit(0);        // sem erro
--   await supabase.from('pathly_conexoes').select('token_cifrado').limit(1);   // 42501
--   await supabase.from('pathly_acoes_externas').delete().eq('id', '...');     // 42501
--   // insert com user_id alheio                                               // 42501
--   // update de 'pendente' direto para 'executada'                            // P0001
--   // update mudando o payload de uma acao existente                          // P0001
