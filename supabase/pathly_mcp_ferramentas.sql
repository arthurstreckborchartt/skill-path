-- Cliente MCP, fase 1: as ferramentas descobertas em cada servidor conectado.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- ADITIVO: não cria, não altera e não apaga nada do que já existe.

-- ============================================================================================
-- O QUE **NÃO** ESTÁ AQUI, E POR QUÊ
-- ============================================================================================
--
-- Não há tabela de conexão. `pathly_conexoes` já guarda exatamente isto — provedor, credencial
-- cifrada, conta, escopos — e o `pathly_hub_ferramentas.sql` já registrou o argumento: "chave em
-- dois lugares é chave esquecida em um deles". Um servidor MCP entra lá como
-- `provedor = 'mcp'`.
--
-- Conferido no banco vivo em 2026-09-30: `pathly_conexoes.provedor` é `text` **sem check
-- constraint**, e `pathly_acoes_externas.acao_id` também. Então aceitar um provedor novo não
-- exige migration nenhuma — este arquivo é o único SQL que a fase 1 precisa.
--
-- Não há tabela de chamadas. Chamar ferramenta é a fase 2, e ela usa `pathly_acoes_externas`, que
-- já tem a máquina de estados validada.

create table if not exists public.pathly_mcp_ferramentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- O endereço do servidor. É a identidade dele, e por isso entra na chave única abaixo.
  servidor text not null,
  nome text not null,

  -- ============================================================================================
  -- TEXTO DO SERVIDOR, E A COLUNA DIZ ISSO NO NOME
  -- ============================================================================================
  --
  -- `descricao_do_servidor`, e não `descricao`. O nome é o aviso: isto foi escrito por quem opera
  -- o servidor, não por nós. Em todo o resto do Pathly a frase que a pessoa lê antes de aprovar é
  -- nossa — ver o comentário de `AcaoDisponivel.resumo`, que manda dizer o efeito e não o
  -- endpoint. Aqui não dá para prometer isso, então a coluna carrega a procedência até a tela.
  descricao_do_servidor text not null default '',

  -- O JSON Schema da entrada, como veio.
  entrada jsonb,

  -- ============================================================================================
  -- A IMPRESSÃO DIGITAL
  -- ============================================================================================
  --
  -- SHA-256 de nome + descrição + schema, em serialização canônica (chaves ordenadas). É o que
  -- sustenta a regra "mudou, aprova de novo": uma aprovação viva vale para a ferramenta que a
  -- pessoa leu, e um servidor que troca a descrição depois não herda o sim antigo.
  --
  -- A descrição entra de propósito. Trocar "lista os arquivos" por "lista e apaga os arquivos"
  -- muda o que foi aprovado mesmo com o schema idêntico — deixá-la de fora faria a impressão
  -- dizer "nada mudou" sobre exatamente a mudança que importa.
  impressao text not null,

  -- `escrita` por padrão. O servidor só sobe daqui (`destrutiva`); nada que ele diga baixa para
  -- `leitura`. Quem baixa é a pessoa, na tela, ferramenta por ferramenta.
  impacto text not null default 'escrita',

  descoberta_em timestamptz not null default now(),

  constraint pathly_mcp_ferramentas_impacto_valido check (
    impacto in ('leitura', 'escrita', 'destrutiva')
  ),
  constraint pathly_mcp_ferramentas_impressao_sha256 check (impressao ~ '^[0-9a-f]{64}$')
);

-- Uma linha por ferramenta de um servidor, por pessoa. Redescobrir atualiza no lugar.
create unique index if not exists pathly_mcp_ferramentas_unica_idx
  on public.pathly_mcp_ferramentas (user_id, servidor, nome);

create index if not exists pathly_mcp_ferramentas_user_idx
  on public.pathly_mcp_ferramentas (user_id, servidor);

alter table public.pathly_mcp_ferramentas enable row level security;

drop policy if exists "pathly_mcp_ferramentas_select_own" on public.pathly_mcp_ferramentas;
drop policy if exists "pathly_mcp_ferramentas_delete_own" on public.pathly_mcp_ferramentas;

create policy "pathly_mcp_ferramentas_select_own"
  on public.pathly_mcp_ferramentas for select to authenticated
  using (auth.uid() = user_id);

-- Desconectar um servidor é ato da pessoa, e o `delete` é como ele acontece.
create policy "pathly_mcp_ferramentas_delete_own"
  on public.pathly_mcp_ferramentas for delete to authenticated
  using (auth.uid() = user_id);

-- ============================================================================================
-- PRIVILÉGIO: O NAVEGADOR LÊ E APAGA, NÃO ESCREVE
-- ============================================================================================
--
-- Quem grava é o servidor, depois de falar com o servidor MCP de verdade. Se o navegador pudesse
-- inserir, alguém com o devtools aberto inventaria uma ferramenta com a descrição que quisesse —
-- e a impressão digital de uma linha forjada é a impressão de uma mentira.
--
-- `revoke all` antes do `grant`: um `grant` nunca restringe. As DEFAULT PRIVILEGES do schema
-- `public` já concedem tudo a `anon` e `authenticated`, então conceder de novo seria aditivo
-- sobre o que já existe. Só o `revoke` explícito declara o estado final.
revoke all on public.pathly_mcp_ferramentas from anon, authenticated;
grant select, delete on public.pathly_mcp_ferramentas to authenticated;
grant all on public.pathly_mcp_ferramentas to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado. As provas que importam:
--
--   1. A tabela responde:
--        await supabase.from('pathly_mcp_ferramentas').select('id').limit(1)   -> sem erro
--
--   2. O navegador não inventa ferramenta:
--        insert qualquer -> esperado: 42501 (privilégio, não RLS)
--
--   3. Ferramenta de outra pessoa não aparece nem some:
--        select sem filtro -> só as próprias linhas
--        delete com id alheio -> 0 linhas afetadas
--
--   4. Impressão fora do formato é recusada pelo banco, e não só pelo TypeScript:
--        insert com impressao = 'abc' (como service_role) -> esperado: 23514
--
--   5. A mesma ferramenta duas vezes no mesmo servidor -> esperado: 23505
