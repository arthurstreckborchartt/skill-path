-- Integration Hub: ferramentas de IA por projeto, e o registro do trabalho feito nelas.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Aditivo: não toca em nada existente.

-- ============================================================================================
-- O QUE **NÃO** ESTÁ AQUI, E POR QUÊ
-- ============================================================================================
--
-- Não há tabela de conexão. A única ferramenta que o Pathly de fato chama é a API da Anthropic,
-- e uma conexão com ela é exatamente o que `pathly_conexoes` já guarda: provedor, credencial
-- cifrada, conta, escopos. Criar uma segunda tabela com as mesmas cinco colunas seria duplicar o
-- lugar onde a chave mora — e chave em dois lugares é chave esquecida em um deles.
--
-- As outras três ferramentas rodam na máquina de quem usa. Não há credencial para guardar,
-- porque o Pathly não se autentica em lugar nenhum para falar com elas: ele escreve um arquivo
-- que elas leem. Uma linha de "conexão" para o Cursor seria uma linha descrevendo nada.

-- ============================================================================================
-- A FERRAMENTA DE CADA PROJETO
-- ============================================================================================

create table if not exists public.pathly_hub_ferramentas_projeto (
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.pathly_projetos (id) on delete cascade,
  -- principal | secundaria | documentacao | git
  papel text not null,
  -- O id do provedor em `src/lib/hub/ia/catalogo.ts`. Texto, e não enum: o catálogo é código, e
  -- uma ferramenta nova não deve exigir migration.
  provedor_id text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Um papel por projeto. Dois "principal" no mesmo projeto é uma pergunta sem resposta na hora
  -- de decidir para onde o contexto vai.
  primary key (user_id, project_id, papel),

  constraint pathly_hub_ferramentas_papel_valido check (
    papel in ('principal','secundaria','documentacao','git')
  )
);

alter table public.pathly_hub_ferramentas_projeto enable row level security;

drop policy if exists "pathly_hub_ferramentas_select_own" on public.pathly_hub_ferramentas_projeto;
drop policy if exists "pathly_hub_ferramentas_insert_own" on public.pathly_hub_ferramentas_projeto;
drop policy if exists "pathly_hub_ferramentas_update_own" on public.pathly_hub_ferramentas_projeto;
drop policy if exists "pathly_hub_ferramentas_delete_own" on public.pathly_hub_ferramentas_projeto;

create policy "pathly_hub_ferramentas_select_own"
  on public.pathly_hub_ferramentas_projeto for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_hub_ferramentas_insert_own"
  on public.pathly_hub_ferramentas_projeto for insert to authenticated
  with check (auth.uid() = user_id);

create policy "pathly_hub_ferramentas_update_own"
  on public.pathly_hub_ferramentas_projeto for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "pathly_hub_ferramentas_delete_own"
  on public.pathly_hub_ferramentas_projeto for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.pathly_hub_ferramentas_projeto from anon, authenticated;
grant select, insert, update, delete on public.pathly_hub_ferramentas_projeto to authenticated;
grant all on public.pathly_hub_ferramentas_projeto to service_role;

-- ============================================================================================
-- O REGISTRO DO TRABALHO
-- ============================================================================================
--
-- O que aconteceu numa etapa: tarefa iniciada, tarefa concluída, arquivos alterados, testes
-- executados, erros, decisões técnicas, observações, próximo passo.

create table if not exists public.pathly_hub_registros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.pathly_projetos (id) on delete cascade,
  -- A etapa em que isto aconteceu. Null quando o registro não pertence a nenhuma.
  etapa_ordem integer,
  provedor_id text not null,
  tipo text not null,

  -- ---- A coluna que dá sentido a todas as outras -------------------------------------------
  -- `ferramenta` quando a própria ferramenta reportou ao Pathly. `pessoa` quando alguém digitou.
  -- "Os testes passaram" vale coisas diferentes nos dois casos, e sem esta coluna o histórico
  -- apresenta as duas afirmações como se fossem uma só.
  origem text not null,

  texto text not null,
  -- Caminhos de arquivo, saída de comando. Lista, porque alguns tipos têm muitos.
  itens text[] not null default '{}',
  criado_em timestamptz not null default now(),

  constraint pathly_hub_registros_tipo_valido check (
    tipo in (
      'tarefa-iniciada','tarefa-concluida','arquivos-alterados','testes-executados',
      'erro','decisao-tecnica','observacao','proximo-passo'
    )
  ),
  constraint pathly_hub_registros_origem_valida check (origem in ('ferramenta','pessoa'))
);

create index if not exists pathly_hub_registros_projeto_idx
  on public.pathly_hub_registros (user_id, project_id, criado_em desc);

-- Para montar `KNOWN_ERRORS` da etapa sem varrer o histórico inteiro.
create index if not exists pathly_hub_registros_etapa_idx
  on public.pathly_hub_registros (project_id, etapa_ordem, tipo);

alter table public.pathly_hub_registros enable row level security;

drop policy if exists "pathly_hub_registros_select_own" on public.pathly_hub_registros;
drop policy if exists "pathly_hub_registros_insert_own" on public.pathly_hub_registros;
drop policy if exists "pathly_hub_registros_delete_own" on public.pathly_hub_registros;

create policy "pathly_hub_registros_select_own"
  on public.pathly_hub_registros for select to authenticated
  using (auth.uid() = user_id);

create policy "pathly_hub_registros_insert_own"
  on public.pathly_hub_registros for insert to authenticated
  with check (auth.uid() = user_id);

create policy "pathly_hub_registros_delete_own"
  on public.pathly_hub_registros for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================================
-- SEM `UPDATE`, DE PROPÓSITO — E SEM GATILHO PARA ISSO
-- ============================================================================================
--
-- `origem` é a coluna que diz se uma afirmação foi verificada ou relatada. Se ela pudesse mudar
-- depois, um relato viraria verificação num `update`, e o histórico inteiro perderia o valor.
--
-- Dava para proteger com gatilho. Não conceder `update` protege melhor, porque não há caminho:
-- um gatilho é uma regra que alguém desliga, e um privilégio que não existe não se desliga.
-- Registro errado se apaga e se escreve de novo — e apagar deixa de existir, em vez de virar
-- outra coisa.
--
-- Isto NÃO é a trilha de auditoria. Auditoria de ação externa vive em `pathly_hub_auditoria`,
-- que é append-only de verdade (nem apagar). Aqui é o caderno da pessoa sobre o próprio
-- trabalho, e o dono do caderno pode arrancar uma página.
revoke all on public.pathly_hub_registros from anon, authenticated;
grant select, insert, delete on public.pathly_hub_registros to authenticated;
grant all on public.pathly_hub_registros to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado:
--
--   1. `select` nas duas tabelas -> sem erro (existem, e a policy deixa ler).
--   2. `update` em `pathly_hub_registros` -> 42501. É o ponto principal deste arquivo.
--   3. `insert` em `pathly_hub_registros` com `origem = 'chute'` -> 23514.
--   4. `insert` em `pathly_hub_ferramentas_projeto` com `papel = 'qualquer'` -> 23514.
--   5. Dois `insert` com o mesmo (project_id, papel) -> 23505 no segundo.
--   6. `insert` com `user_id` alheio -> 42501 de RLS.
