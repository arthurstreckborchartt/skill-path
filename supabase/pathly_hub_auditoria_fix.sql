-- Correção: a trilha de auditoria impedia apagar projeto e conta.
-- Rode no SQL Editor do Supabase, no mesmo projeto. Não apaga dado nenhum.

-- ============================================================================================
-- O QUE DEU ERRADO
-- ============================================================================================
--
-- Em `pathly_hub.sql` a trilha tinha duas chaves estrangeiras com `on delete set null`:
--
--   projeto_id uuid references public.pathly_projetos (id) on delete set null
--   acao_id    uuid references public.pathly_acoes_externas (id) on delete set null
--
-- E um gatilho `before update or delete` que barra qualquer alteração, para a trilha ser
-- append-only de verdade.
--
-- As duas coisas se contradizem. `on delete set null` é um **UPDATE** na trilha: ao apagar o
-- projeto, o Postgres tenta zerar `projeto_id` na linha de auditoria, o gatilho barra, e o
-- `delete` do projeto inteiro falha.
--
-- Sonda em 2026-09-20, com uma linha na trilha:
--   delete from pathly_projetos where id = ... -> P0001 "a trilha de auditoria nao muda e nao some"
--
-- Consequência: **nenhum projeto com atividade auditada poderia ser apagado.** E, pelo mesmo
-- caminho, nenhuma conta — o `on delete cascade` de `auth.users` tentaria apagar linhas da
-- trilha e esbarraria no mesmo gatilho.
--
-- Não foi revisão que encontrou: foi tentar apagar o projeto de teste.

-- ============================================================================================
-- A CORREÇÃO, EM DUAS PARTES
-- ============================================================================================
--
-- **1. A trilha guarda ids, não relacionamentos.**
--
-- Uma trilha de auditoria não deve mudar quando o que ela descreve some — se mudasse, não seria
-- append-only. O certo para um log é guardar o id como **dado**: a linha continua dizendo "isto
-- aconteceu no projeto X" mesmo depois de X deixar de existir, que é exatamente a informação que
-- alguém vai querer no dia em que investigar.
--
-- Então as duas chaves estrangeiras saem. As colunas ficam.

alter table public.pathly_hub_auditoria
  drop constraint if exists pathly_hub_auditoria_projeto_id_fkey;

alter table public.pathly_hub_auditoria
  drop constraint if exists pathly_hub_auditoria_acao_id_fkey;

-- **2. O gatilho barra alteração, não remoção.**
--
-- Imutabilidade de conteúdo é o que a trilha promete, e isso é `update`. Remoção é outra
-- pergunta, e a resposta certa não é "nunca": apagar a conta precisa levar os dados pessoais
-- junto, inclusive a trilha.
--
-- Quem remove passa a ser controlado por privilégio, que é onde já estava:
--   `authenticated` não tem `delete` — conferido por sonda, devolve 42501.
--   `service_role` tem, e é o mesmo nível de confiança que já pode tudo no banco.
--
-- A troca é deliberada: perde-se o bloqueio de remoção contra `service_role`, ganha-se poder
-- apagar projeto e conta. Bloquear remoção ao custo de tornar a conta indelével é o lado errado.

create or replace function public.pathly_hub_auditoria_append_only()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  raise exception 'a trilha de auditoria nao muda'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists pathly_hub_auditoria_append_only_trg on public.pathly_hub_auditoria;
create trigger pathly_hub_auditoria_append_only_trg
  before update on public.pathly_hub_auditoria
  for each row execute function public.pathly_hub_auditoria_append_only();

-- ============================================================================================
-- COMO CONFERIR DEPOIS DE RODAR
-- ============================================================================================
--
-- 1. Editar a trilha continua barrado, inclusive com privilégio total:
--      update pathly_hub_auditoria set detalhe = 'x' where id = ...  -> P0001
--
-- 2. Apagar um projeto com linha de auditoria agora funciona:
--      delete from pathly_projetos where id = ...  -> sem erro
--    e a linha da trilha continua lá, com o `projeto_id` preservado.
--
-- 3. Pelo navegador, `delete` na trilha continua 42501 (privilégio).
--
-- 4. As permissões daquele projeto somem junto, pelo CASCADE que elas têm de verdade.
