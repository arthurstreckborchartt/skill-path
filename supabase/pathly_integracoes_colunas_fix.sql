-- Correção de privilégio em `pathly_conexoes`: esconder `token_cifrado` de verdade.
-- Rode no SQL Editor do Supabase, no mesmo projeto das outras tabelas pathly_*.
-- Não cria nem apaga nada: só troca privilégios. Não toca em dado.

-- ============================================================================================
-- O QUE DEU ERRADO
-- ============================================================================================
--
-- O `pathly_integracoes.sql` fazia, nesta ordem:
--
--   grant select, delete on public.pathly_conexoes to authenticated;
--   revoke select (token_cifrado) on public.pathly_conexoes from anon, authenticated;
--
-- E o comentário ao lado afirmava que o revoke precisava vir depois do grant. A ordem nunca foi o
-- problema: **privilégio de tabela não se corta por coluna.** Da documentação do Postgres, em
-- REVOKE: "if a role has been granted privileges on a table, then revoking the same privileges
-- from individual columns will have no effect."
--
-- O revoke rodou sem erro e não fez nada. A sonda em 2026-09-19, como `authenticated`:
--
--   supabase.from('pathly_conexoes').select('token_cifrado').limit(1)  ->  sem erro
--
-- Deveria ser `42501`. Ou seja: a camada que existe justamente para que um XSS no app não vire
-- roubo da conta do GitHub da pessoa estava ausente, enquanto o script dizia que estava lá.
--
-- Hoje isso não expôs token de ninguém — a tabela está vazia e o fluxo de OAuth ainda não
-- existe. É por isso que vale corrigir agora, antes de haver o que vazar.

-- ============================================================================================
-- A CORREÇÃO
-- ============================================================================================
--
-- Nunca conceder `select` na tabela. Conceder `select` só na lista de colunas permitidas — assim
-- não existe privilégio largo para tentar recortar depois.
--
-- O `revoke all` abaixo também zera os privilégios de coluna: revogar na tabela derruba as
-- colunas junto. É o que deixa o estado final declarado, e não dependente do que havia antes.

revoke all on public.pathly_conexoes from anon, authenticated;

-- `token_cifrado` não está nesta lista, e é esse o ponto.
--
-- Efeito colateral desejado: `select *` nesta tabela passa a falhar com 42501 para
-- `authenticated`. Quem escrever `select('*')` aqui descobre na hora, em vez de vazar o token em
-- silêncio. O cliente já lê colunas explícitas em `src/lib/integracoes/usar-integracoes.ts`.
grant select (user_id, provedor, escopos, conta, expira_em, criado_em, atualizado_em)
  on public.pathly_conexoes to authenticated;

-- Desconectar continua sendo da pessoa. `delete` é de tabela porque apaga a linha inteira;
-- não existe delete de coluna.
grant delete on public.pathly_conexoes to authenticated;

grant all on public.pathly_conexoes to service_role;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- No console do app, com sessão aberta. As duas provas juntas, porque uma sozinha não separa
-- "a coluna está protegida" de "a tabela inteira quebrou":
--
--   await supabase.from('pathly_conexoes').select('token_cifrado').limit(1)
--     -> esperado: 42501, permission denied for column token_cifrado (ou for table)
--
--   await supabase.from('pathly_conexoes').select('provedor, conta, escopos').limit(1)
--     -> esperado: sem erro
--
-- Se a segunda também der 42501, o que está barrando é outra coisa — e aí não rode mais nada,
-- investigue.

-- ============================================================================================
-- ROLLBACK
-- ============================================================================================
--
-- Volta ao estado anterior (o inseguro), caso algo quebre:
--
--   revoke all on public.pathly_conexoes from anon, authenticated;
--   grant select, delete on public.pathly_conexoes to authenticated;
--   grant all on public.pathly_conexoes to service_role;
--
-- Nenhum dado é afetado pelo rollback nem por este script.
