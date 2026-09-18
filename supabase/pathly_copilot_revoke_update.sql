-- Correção do append-only das mensagens do Copilot.
-- Rode no SQL Editor do Supabase, no mesmo projeto. Idempotente e não destrutivo.
--
-- ============================================================================================
-- O QUE DEU ERRADO
-- ============================================================================================
--
-- `pathly_copilot.sql` concedeu `select, insert` às mensagens e, de propósito, NÃO concedeu
-- `update` — a ideia era que append-only virasse impossibilidade de privilégio, não regra de app.
--
-- Isso não funcionou, e o teste mostrou por quê: o Supabase define DEFAULT PRIVILEGES no schema
-- `public` concedendo tudo a `anon` e `authenticated`. Toda tabela nova já nasce com `update`
-- liberado, e um `grant` a mais é aditivo — nunca restringe o que já foi dado.
--
-- Na prática o dado ficou protegido mesmo assim, mas pelo motivo errado: como não existe policy
-- de UPDATE, a RLS filtra todas as linhas e o comando afeta zero. O resultado é um no-op
-- SILENCIOSO — a operação volta sem erro, e quem chamou não tem como distinguir "fui barrado" de
-- "não havia o que atualizar".
--
-- Duas consequências ruins:
--
-- 1. Código que confia no retorno acha que atualizou.
-- 2. A proteção passa a depender da AUSÊNCIA de uma policy. No dia em que alguém criar uma policy
--    de update nesta tabela por engano, o append-only cai junto, sem nenhum aviso.
--
-- O revoke abaixo devolve o comportamento pretendido: a tentativa falha alto, com 42501.

revoke update on public.pathly_copilot_mensagens from authenticated;
revoke update on public.pathly_copilot_mensagens from anon;

-- Delete nunca foi concedido por este projeto, mas o default privilege do Supabase concede.
-- A convenção do app é não ter delete nas tabelas de módulo: apagar o projeto leva as linhas
-- junto pelo cascade de pathly_projetos.
revoke delete on public.pathly_copilot_mensagens from authenticated;
revoke delete on public.pathly_copilot_mensagens from anon;
revoke delete on public.pathly_copilot_decisoes from authenticated;
revoke delete on public.pathly_copilot_decisoes from anon;
revoke delete on public.pathly_copilot_propostas from authenticated;
revoke delete on public.pathly_copilot_propostas from anon;

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- No console do app, logado:
--
--   const { error } = await supabase
--     .from('pathly_copilot_mensagens')
--     .update({ papel: 'copilot' })
--     .eq('id', '<id de uma mensagem sua>');
--
-- Esperado: `error.code === '42501'`. Antes deste script, vinha `error === null` com zero linhas
-- afetadas.
