-- Schema único do Pathly. Rode uma vez no SQL Editor do painel do Supabase.
-- É idempotente: rodar de novo não quebra nada.
--
-- Este arquivo unifica dois desenhos que existiam em paralelo:
--   - o que veio do Replit (pathly_profiles, pathly_route_progress), já usado por
--     src/lib/cloud-sync.ts — o prefixo pathly_ e a forma das duas tabelas foram mantidos
--     exatamente como estavam, para o código que já funciona continuar funcionando;
--   - o que faltava para o catálogo de conteúdo real e para a rota gerada por IA.
--
-- Regra geral: RLS ligada em tudo, cada pessoa só enxerga a própria linha via auth.uid().
-- A única exceção é o catálogo, que é conteúdo público e mesmo assim não aceita escrita
-- pelo app — só pela service role.

-- ---------------------------------------------------------------- perfil

create table if not exists public.pathly_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarding jsonb not null,
  updated_at timestamptz not null default now()
);

-- Campo livre: o que a pessoa escreve, com as próprias palavras, que quer fazer.
-- É o que a geração por IA vai ler além das respostas fechadas.
alter table public.pathly_profiles
  add column if not exists goal_text text;

alter table public.pathly_profiles
  drop constraint if exists pathly_profiles_goal_text_len;
alter table public.pathly_profiles
  add constraint pathly_profiles_goal_text_len
  check (goal_text is null or char_length(goal_text) <= 2000);

-- Plano da pessoa. Fica no banco, e não só no navegador, porque é o servidor que decide qual
-- provedor de IA usar: o gratuito chama um modelo gratuito, o Pro chama o Claude. Se essa
-- decisão saísse do localStorage, marcar "pro" pelo devtools passaria a gastar a conta da
-- Anthropic. Quem escreve esta coluna é a integração de pagamento — nunca o app.
alter table public.pathly_profiles
  add column if not exists plano text not null default 'free';

alter table public.pathly_profiles
  drop constraint if exists pathly_profiles_plano_valido;
alter table public.pathly_profiles
  add constraint pathly_profiles_plano_valido check (plano in ('free', 'pro'));

alter table public.pathly_profiles enable row level security;

drop policy if exists "pathly_profiles_select_own" on public.pathly_profiles;
create policy "pathly_profiles_select_own"
  on public.pathly_profiles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_profiles_insert_own" on public.pathly_profiles;
create policy "pathly_profiles_insert_own"
  on public.pathly_profiles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_profiles_update_own" on public.pathly_profiles;
create policy "pathly_profiles_update_own"
  on public.pathly_profiles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- A RLS acima deixa a pessoa editar a própria linha, e `plano` está nessa linha: sem isto ela
-- se promoveria a Pro com um único PATCH na API pública. O privilégio de coluna é o que fecha —
-- RLS controla QUAIS linhas, grant de coluna controla QUAIS colunas.
--
-- `user_id` PRECISA estar na lista, por mais estranho que pareça. O app salva o perfil com
-- upsert, que no PostgREST vira INSERT ... ON CONFLICT DO UPDATE com todas as colunas do corpo —
-- inclusive `user_id`. Sem ele, todo salvamento falha com 42501 e o perfil só sobrevive no
-- navegador. Conceder é seguro: o `with check (auth.uid() = user_id)` da RLS impede apontar a
-- linha para outra pessoa. O que fica de fora é o que importa: `plano`.
revoke update on public.pathly_profiles from authenticated;
grant update (user_id, onboarding, goal_text, updated_at) on public.pathly_profiles to authenticated;

drop policy if exists "pathly_profiles_delete_own" on public.pathly_profiles;
create policy "pathly_profiles_delete_own"
  on public.pathly_profiles for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.pathly_profiles to authenticated;

-- ---------------------------------------------------------------- progresso da rota

create table if not exists public.pathly_route_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  route_signature text not null,
  progress jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pathly_route_progress enable row level security;

drop policy if exists "pathly_route_progress_select_own" on public.pathly_route_progress;
create policy "pathly_route_progress_select_own"
  on public.pathly_route_progress for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_route_progress_insert_own" on public.pathly_route_progress;
create policy "pathly_route_progress_insert_own"
  on public.pathly_route_progress for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_route_progress_update_own" on public.pathly_route_progress;
create policy "pathly_route_progress_update_own"
  on public.pathly_route_progress for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.pathly_route_progress to authenticated;

-- ---------------------------------------------------------------- rota gerada

-- Guarda a rota que a pessoa recebeu. Necessário quando a geração passar a ser por IA:
-- a chamada acontece uma vez, no fim do onboarding, e o resultado precisa sobreviver.
-- `signature` casa com pathly_route_progress.route_signature.
create table if not exists public.pathly_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  area text not null,
  generator text not null default 'regras',
  signature text not null,
  steps jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.pathly_routes enable row level security;

drop policy if exists "pathly_routes_select_own" on public.pathly_routes;
create policy "pathly_routes_select_own"
  on public.pathly_routes for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "pathly_routes_insert_own" on public.pathly_routes;
create policy "pathly_routes_insert_own"
  on public.pathly_routes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "pathly_routes_delete_own" on public.pathly_routes;
create policy "pathly_routes_delete_own"
  on public.pathly_routes for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, delete on public.pathly_routes to authenticated;

create index if not exists pathly_routes_user_idx
  on public.pathly_routes (user_id, created_at desc);

-- ---------------------------------------------------------------- catálogo de conteúdo

-- Conteúdo real para onde as etapas apontam (ver src/lib/catalog.ts).
-- `source` e `source_license` são obrigatórios de propósito: nem toda fonte gratuita permite
-- redistribuição, e cada linha precisa ser auditável. Ver supabase/FONTES-DE-CONTEUDO.md.
create table if not exists public.pathly_resources (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  url text not null,
  kind text not null check (kind in ('curso', 'video', 'artigo', 'doc', 'livro', 'projeto')),
  provider text,
  language text not null default 'pt',
  is_free boolean not null default true,
  topics text[] not null default '{}',
  areas text[] not null default '{}',
  level text check (level is null or level in ('iniciante', 'intermediário', 'avançado')),
  summary text not null,
  source text not null,
  source_license text not null,
  created_at timestamptz not null default now()
);

alter table public.pathly_resources enable row level security;

-- Leitura para todo mundo, inclusive quem não entrou: o catálogo aparece na rota de exemplo.
drop policy if exists "pathly_resources_read_all" on public.pathly_resources;
create policy "pathly_resources_read_all"
  on public.pathly_resources for select to anon, authenticated
  using (true);
-- Sem policy de escrita: só a service role popula o catálogo.

grant select on public.pathly_resources to anon, authenticated;

create index if not exists pathly_resources_areas_idx
  on public.pathly_resources using gin (areas);
create index if not exists pathly_resources_topics_idx
  on public.pathly_resources using gin (topics);

-- ---------------------------------------------------------------- feedback

-- Mantido igual ao supabase/feedback.sql, que pode já ter sido aplicado.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('bug', 'ideia', 'outro')),
  message text not null check (char_length(message) between 1 and 2000),
  page text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert to authenticated
  with check (auth.uid() = user_id);
-- Sem policy de SELECT: ninguém lê o feedback de outra pessoa pelo app. Você lê pelo painel.

grant insert on public.feedback to authenticated;

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- ---------------------------------------------------------------- privilégio mínimo

-- O Supabase concede TODOS os privilégios por padrão nas tabelas de `public` para `anon` e
-- `authenticated` — inclusive TRUNCATE. E TRUNCATE **não passa por RLS**: quem tem esse
-- privilégio esvazia a tabela inteira, independente de qualquer política. Como a chave `anon`
-- é pública (vai no JavaScript do navegador), isso é um buraco real.
--
-- Os grants acima são aditivos e não corrigem isso sozinhos. Este bloco zera e devolve só o
-- necessário. Rode sempre depois de criar tabela nova em `public`.

revoke all on public.pathly_profiles       from anon, authenticated;
revoke all on public.pathly_route_progress from anon, authenticated;
revoke all on public.pathly_routes         from anon, authenticated;
revoke all on public.pathly_resources      from anon, authenticated;
revoke all on public.feedback              from anon, authenticated;

-- Note o update por COLUNA: `plano` fica de fora de propósito. Um `grant update` na tabela
-- inteira aqui desfaria a proteção da seção do perfil e deixaria a pessoa se promover a Pro
-- sozinha, com um PATCH na API pública.
grant select, insert, delete                     on public.pathly_profiles       to authenticated;
grant update (user_id, onboarding, goal_text, updated_at) on public.pathly_profiles to authenticated;
grant select, insert, update         on public.pathly_route_progress to authenticated;
grant select, insert, delete         on public.pathly_routes         to authenticated;
grant select                         on public.pathly_resources      to anon, authenticated;
grant insert                         on public.feedback              to authenticated;

-- ---------------------------------------------------------------- limite de uso da IA

/*
  Sem isto, /api/licao e /api/pratica sao um proxy de LLM gratuito e ilimitado: cadastro e
  aberto, o texto do prompt vem do corpo da requisicao, e nada impede criar uma conta e disparar
  em laco. No plano gratuito isso esgota a cota e nega servico a quem esta estudando; com a chave
  da Anthropic ativa, gasta dinheiro.

  A contagem vive aqui, nao em memoria: o Worker nao guarda estado entre requisicoes.
*/
create table if not exists public.pathly_uso_ia (
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  janela timestamptz not null,
  chamadas int not null default 0,
  primary key (user_id, endpoint, janela)
);

alter table public.pathly_uso_ia enable row level security;

-- Sem policy nenhuma e sem grant: se o cliente pudesse escrever aqui, zeraria o proprio contador.
revoke all on public.pathly_uso_ia from anon, authenticated;

create index if not exists pathly_uso_ia_janela_idx on public.pathly_uso_ia (janela);

/*
  Incremento ATOMICO.

  INSERT ... ON CONFLICT DO UPDATE ... RETURNING e uma unica instrucao: cem requisicoes
  simultaneas recebem cem valores diferentes. Ler e depois gravar deixaria todas lerem zero e
  passarem juntas — exatamente o furo que este limite existe para fechar.

  SECURITY DEFINER com search_path vazio e tudo qualificado: sem isso, um schema malicioso no
  caminho de busca sequestraria a funcao, que roda com os privilegios do dono. Esta funcao aceita
  o id ja validado pelo servidor e so pode ser executada pela service role; usuarios autenticados
  nao recebem EXECUTE direto sobre nenhuma funcao privilegiada.
*/
create or replace function public.registrar_uso_ia_servidor(
  p_user_id uuid,
  p_endpoint text,
  p_janela_minutos int
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_janela timestamptz;
  v_total int;
begin
  v_uid := p_user_id;
  if v_uid is null then
    raise exception 'usuario ausente';
  end if;

  if p_endpoint is null or pg_catalog.length(p_endpoint) < 1 or pg_catalog.length(p_endpoint) > 40 then
    raise exception 'endpoint invalido';
  end if;

  if p_janela_minutos is null or p_janela_minutos < 1 or p_janela_minutos > 1440 then
    raise exception 'janela invalida';
  end if;

  v_janela := pg_catalog.to_timestamp(
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.now()) / (p_janela_minutos * 60)
    ) * (p_janela_minutos * 60)
  );

  insert into public.pathly_uso_ia (user_id, endpoint, janela, chamadas)
  values (v_uid, p_endpoint, v_janela, 1)
  on conflict (user_id, endpoint, janela)
  do update set chamadas = public.pathly_uso_ia.chamadas + 1
  returning chamadas into v_total;

  return v_total;
end;
$$;

-- Remove a permissao da funcao legada, caso ela exista em uma instalacao anterior.
revoke all on function public.registrar_uso_ia(text, int) from public, anon, authenticated;
revoke all on function public.registrar_uso_ia_servidor(uuid, text, int)
  from public, anon, authenticated;
grant execute on function public.registrar_uso_ia_servidor(uuid, text, int) to service_role;

-- Instante do ultimo evento do Stripe aplicado. O Stripe nao garante ordem de entrega: um
-- subscription.deleted atrasado rebaixaria um assinante pagante sem esta guarda.
alter table public.pathly_profiles
  add column if not exists assinatura_evento_em timestamptz;
