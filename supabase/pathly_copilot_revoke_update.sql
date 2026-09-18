-- Fecha os privilégios das tabelas do Copilot.
-- Rode no SQL Editor do Supabase. Idempotente e não destrutivo: não apaga linha nenhuma.
--
-- ============================================================================================
-- O QUE DEU ERRADO
-- ============================================================================================
--
-- `pathly_copilot.sql` concedeu `select, insert` às mensagens e, de propósito, NÃO concedeu
-- `update` — a ideia era que append-only virasse impossibilidade de privilégio, não regra de app.
--
-- Não funcionou, e o teste mostrou por quê: o Supabase define DEFAULT PRIVILEGES no schema
-- `public` concedendo tudo a `anon` e `authenticated`. Toda tabela nova já nasce com `update` e
-- `delete` liberados, e um `grant` a mais é aditivo — nunca restringe o que já foi dado.
--
-- Na prática o dado ficou protegido, mas pelo motivo errado: como não existe policy de UPDATE, a
-- RLS filtra todas as linhas e o comando afeta zero. O resultado é um no-op SILENCIOSO — a
-- operação volta sem erro, e quem chamou não distingue "fui barrado" de "não havia o que
-- atualizar".
--
-- Duas consequências ruins:
--
-- 1. Código que confia no retorno acha que atualizou.
-- 2. A proteção passa a depender da AUSÊNCIA de uma policy. No dia em que alguém criar uma policy
--    de update nesta tabela por engano, o append-only cai junto, sem nenhum aviso.
--
-- ============================================================================================
-- POR QUE `REVOKE ALL` E DEPOIS `GRANT`, EM VEZ DE `REVOKE UPDATE`
-- ============================================================================================
--
-- É o padrão que as migrations 0002 e 0003 já usam neste projeto. Tirar um privilégio específico
-- subtrai de uma base que ninguém sabe qual é; zerar e conceder o necessário DECLARA o estado
-- final. Depois deste script, o privilégio de cada tabela é exatamente o que está escrito aqui,
-- independente do que havia antes.

-- --- mensagens: append-only de verdade. Sem update, sem delete. ------------------------------

revoke all on public.pathly_copilot_mensagens from anon, authenticated;
grant select, insert on public.pathly_copilot_mensagens to authenticated;
grant all on public.pathly_copilot_mensagens to service_role;

-- --- decisões: update existe só para a supersedência, e o gatilho limita o que ele pode mudar.

revoke all on public.pathly_copilot_decisoes from anon, authenticated;
grant select, insert, update on public.pathly_copilot_decisoes to authenticated;
grant all on public.pathly_copilot_decisoes to service_role;

-- --- propostas: mudam de status ao serem aprovadas ou recusadas. -----------------------------

revoke all on public.pathly_copilot_propostas from anon, authenticated;
grant select, insert, update on public.pathly_copilot_propostas to authenticated;
grant all on public.pathly_copilot_propostas to service_role;

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
--
-- E confirmar que o que deve continuar funcionando funciona: gravar mensagem, marcar decisão como
-- substituida, aprovar proposta.
