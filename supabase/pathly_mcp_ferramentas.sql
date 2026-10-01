-- Cliente MCP, fase 1: os servidores conectados e as ferramentas descobertas em cada um.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- ADITIVO: não cria, não altera e não apaga nada do que já existe.

-- ============================================================================================
-- POR QUE NÃO REAPROVEITEI `pathly_conexoes`
-- ============================================================================================
--
-- O plano original dizia para guardar o servidor MCP lá, com `provedor = 'mcp'`, seguindo o
-- argumento de `pathly_hub_ferramentas.sql`: "chave em dois lugares é chave esquecida em um
-- deles". Era o desenho certo para uma conexão por provedor.
--
-- **Medido no banco vivo em 2026-10-01:** `pathly_conexoes` tem
-- `PRIMARY KEY (user_id, provedor)`. Uma linha por provedor, por pessoa. Com `provedor = 'mcp'`,
-- cada pessoa conectaria **um único** servidor MCP — e MCP é muitos-por-pessoa por natureza:
-- um servidor de documentação, outro de busca, outro da ferramenta que ela usa.
--
-- As saídas eram três. Enfiar o endereço dentro da coluna `provedor` (`mcp:https://...`) cabe sem
-- migration, e é exatamente o tipo de esperteza que ninguém entende seis meses depois — além de
-- quebrar `ROTULO_PROVEDOR`, que mapeia provedor para nome na tela. Mudar a chave primária de
-- `pathly_conexoes` mexeria numa tabela com 14 provas registradas, por um caso que ela não foi
-- feita para representar. Sobrou a terceira: tabela própria, aditiva, que não toca em nada.
--
-- O argumento do Hub continua valendo onde ele foi escrito — ele falava de não duplicar a MESMA
-- credencial em duas tabelas. Aqui a credencial é outra, de outra coisa, com outra cardinalidade.

-- ============================================================================================
-- OS SERVIDORES
-- ============================================================================================

create table if not exists public.pathly_mcp_servidores (
  user_id uuid not null references auth.users (id) on delete cascade,

  -- O endereço É a identidade do servidor. Dois endereços diferentes são dois servidores, mesmo
  -- que se apresentem com o mesmo nome — e um servidor hostil escolhe o nome que quiser.
  endereco text not null,

  -- O que o servidor disse sobre si no `initialize`. Texto dele, não nosso.
  nome text not null default '',
  versao text not null default '',
  protocolo text not null default '',

  -- ============================================================================================
  -- A CREDENCIAL
  -- ============================================================================================
  --
  -- `null` quando o servidor é aberto: nem todo MCP pede autenticação, e guardar string vazia
  -- faria "sem credencial" e "credencial vazia" virarem a mesma coisa no banco.
  --
  -- Cifrada, e o navegador não a lê — o `grant` abaixo é por coluna, e esta não está na lista.
  -- É o mesmo desenho de `pathly_conexoes.token_cifrado`, que já foi provado: `select` da coluna
  -- como `authenticated` devolve `42501`, enquanto `select` das outras responde `200`.
  token_cifrado text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  primary key (user_id, endereco),

  -- Só https. Em `http` o token viaja em claro e o conteúdo devolvido — que vai para o contexto
  -- do Copilot — pode ser trocado no caminho. A guarda em `src/lib/integracoes/destino.ts` já
  -- recusa antes de chegar aqui; este `check` é a segunda parede, para o caso de alguém gravar
  -- por outro caminho.
  constraint pathly_mcp_servidores_https check (endereco like 'https://%')
);

alter table public.pathly_mcp_servidores enable row level security;

drop policy if exists "pathly_mcp_servidores_select_own" on public.pathly_mcp_servidores;
drop policy if exists "pathly_mcp_servidores_delete_own" on public.pathly_mcp_servidores;

create policy "pathly_mcp_servidores_select_own"
  on public.pathly_mcp_servidores for select to authenticated
  using (auth.uid() = user_id);

-- Desconectar é ato da pessoa, e o `delete` é como ele acontece. As ferramentas vão junto, pelo
-- `cascade` da chave estrangeira abaixo.
create policy "pathly_mcp_servidores_delete_own"
  on public.pathly_mcp_servidores for delete to authenticated
  using (auth.uid() = user_id);

-- `revoke all` antes do `grant`: um `grant` nunca restringe. As DEFAULT PRIVILEGES do schema
-- `public` já concedem tudo a `anon` e `authenticated` — só o `revoke` explícito declara o estado
-- final. E o `grant` de leitura é **por coluna**, sem `token_cifrado`: conceder a tabela inteira
-- e tentar tirar a coluna depois não funciona, porque `revoke` de coluna não corta privilégio de
-- tabela. Isso foi descoberto em teste, em 2026-09-19, e corrigido em
-- `pathly_integracoes_colunas_fix.sql`.
revoke all on public.pathly_mcp_servidores from anon, authenticated;
grant select (user_id, endereco, nome, versao, protocolo, criado_em, atualizado_em)
  on public.pathly_mcp_servidores to authenticated;
grant delete on public.pathly_mcp_servidores to authenticated;
grant all on public.pathly_mcp_servidores to service_role;

-- ============================================================================================
-- AS FERRAMENTAS
-- ============================================================================================

create table if not exists public.pathly_mcp_ferramentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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

  -- Apagar o servidor leva as ferramentas junto. `cascade`, e não `set null`: a lição de
  -- `pathly_hub_auditoria_fix.sql` é que `on delete set null` é um UPDATE, e um UPDATE barrado
  -- por gatilho trava a remoção inteira. Aqui não há gatilho, e mesmo assim `cascade` é o certo —
  -- ferramenta de servidor que não existe mais não é histórico, é lixo.
  constraint pathly_mcp_ferramentas_servidor_fkey
    foreign key (user_id, servidor)
    references public.pathly_mcp_servidores (user_id, endereco) on delete cascade,

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
revoke all on public.pathly_mcp_ferramentas from anon, authenticated;
grant select, delete on public.pathly_mcp_ferramentas to authenticated;
grant all on public.pathly_mcp_ferramentas to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- Do console do app, logado. O par que importa vem primeiro:
--
--   1. A coluna da credencial está protegida, e a tabela NÃO está quebrada — as duas juntas:
--        await supabase.from('pathly_mcp_servidores').select('token_cifrado')  -> 42501
--        await supabase.from('pathly_mcp_servidores').select('endereco,nome')  -> 200
--      Só a primeira prova nada: ela também dá 42501 se a tabela inteira estiver inacessível.
--
--   2. O navegador não inventa ferramenta nem servidor:
--        insert em qualquer uma das duas -> esperado: 42501 (privilégio, não RLS)
--
--   3. Linha alheia não aparece nem some:
--        select sem filtro -> só as próprias
--        delete com id alheio -> 0 linhas afetadas
--
--   4. O banco recusa o que o TypeScript recusaria, e não depende dele:
--        insert (como service_role) com impressao = 'abc'        -> 23514
--        insert (como service_role) com endereco = 'http://x'    -> 23514
--
--   5. A mesma ferramenta duas vezes no mesmo servidor -> 23505
--
--   6. Apagar o servidor leva as ferramentas junto, e não sobra órfã.
