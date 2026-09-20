-- Schema do Pathly para um projeto Supabase proprio.
--
-- Gerado em 2026-09-20 a partir de `pathlyapp_260920.backup`, o export do
-- Lovable Cloud (pg_dump formato custom, PGDMP 1.16). Nao foi escrito a mao:
-- cada statement abaixo saiu do dump e foi conferido contra os catalogos do
-- banco vivo — 24 tabelas, 72 policies, 2 triggers, tudo batendo.
--
-- COMO RODAR
--   SQL Editor do Supabase, no projeto NOVO e vazio, de uma vez so.
--
-- O QUE ENTRA
--   So o schema `public`: tabelas, defaults, funcoes, chaves, indices,
--   triggers, RLS, policies e privilegios.
--
-- O QUE NAO ENTRA, e por que
--
--   * Dados — nenhum. Os 4 usuarios do banco antigo eram de teste; nao havia
--     usuario real. Comecar limpo evita remapear `user_id` em ~70 linhas, e de
--     quebra some com mensagens de teste que a tabela append-only nao deixava
--     apagar.
--
--   * Os schemas `auth`, `storage`, `realtime`, `vault` — o projeto novo ja
--     tem os dele. Recria-los quebraria o Supabase.
--
--   * Os 24 privilegios do papel `sandbox_exec`, e esta e a exclusao
--     deliberada. Esse papel e do Lovable Cloud: pode fazer login, ignora RLS e
--     tinha SELECT de tabela inteira nas 24 tabelas — inclusive
--     `pathly_conexoes.token_cifrado`, o dado que a cifragem, a RLS e o grant
--     por coluna existem para proteger. Migrar e a hora de nao recriar isso.
--
--   * `OWNER TO` — quem rodar vira dono.
--
-- CONFERIR DEPOIS DE RODAR, do console do app ja logado. As duas juntas,
-- porque uma sozinha nao separa "coluna protegida" de "tabela quebrada":
--
--   await supabase.from('pathly_conexoes').select('token_cifrado').limit(1)
--     -> esperado: 42501
--   await supabase.from('pathly_conexoes').select('provedor, conta').limit(1)
--     -> esperado: sem erro

-- ==========================================================================================
-- TABELAS (24)
-- ==========================================================================================

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    kind text NOT NULL,
    message text NOT NULL,
    page text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT feedback_kind_check CHECK ((kind = ANY (ARRAY['bug'::text, 'ideia'::text, 'outro'::text]))),
    CONSTRAINT feedback_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 2000)))
);

CREATE TABLE public.pathly_acoes_externas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    projeto_id uuid,
    provedor text NOT NULL,
    acao_id text NOT NULL,
    resumo text NOT NULL,
    destino text NOT NULL,
    impacto text DEFAULT 'escrita'::text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    estado text DEFAULT 'pendente'::text NOT NULL,
    resultado text,
    erro text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    decidido_em timestamp with time zone,
    executado_em timestamp with time zone,
    CONSTRAINT pathly_acoes_externas_estado_valido CHECK ((estado = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'executada'::text, 'recusada'::text, 'falhou'::text]))),
    CONSTRAINT pathly_acoes_externas_impacto_valido CHECK ((impacto = ANY (ARRAY['leitura'::text, 'escrita'::text, 'destrutiva'::text])))
);

CREATE TABLE public.pathly_apis (
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    mapa jsonb NOT NULL,
    testes_feitos integer[] DEFAULT '{}'::integer[] NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_arquitetura_ia (
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    plano jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_conexoes (
    user_id uuid NOT NULL,
    provedor text NOT NULL,
    token_cifrado text NOT NULL,
    escopos text[] DEFAULT '{}'::text[] NOT NULL,
    conta text DEFAULT ''::text NOT NULL,
    expira_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_copilot_decisoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    chave text NOT NULL,
    titulo text NOT NULL,
    valor text NOT NULL,
    motivo text NOT NULL,
    status text DEFAULT 'ativa'::text NOT NULL,
    substitui_decisao_id uuid,
    origem text DEFAULT 'usuario'::text NOT NULL,
    confirmado_em timestamp with time zone,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT pathly_copilot_decisoes_origem_check CHECK ((origem = ANY (ARRAY['copilot'::text, 'usuario'::text, 'importacao'::text, 'sistema'::text]))),
    CONSTRAINT pathly_copilot_decisoes_status_check CHECK ((status = ANY (ARRAY['proposta'::text, 'ativa'::text, 'substituida'::text, 'rejeitada'::text])))
);

CREATE TABLE public.pathly_copilot_mensagens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    papel text NOT NULL,
    conteudo jsonb DEFAULT '{}'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_copilot_mensagens_papel_check CHECK ((papel = ANY (ARRAY['usuario'::text, 'copilot'::text])))
);

CREATE TABLE public.pathly_copilot_propostas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    descricao text NOT NULL,
    campo_afetado text,
    valor_atual jsonb,
    valor_proposto jsonb,
    motivo text NOT NULL,
    impactos text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    decisao_id uuid,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    confirmado_em timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT pathly_copilot_propostas_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'aprovada'::text, 'rejeitada'::text, 'cancelada'::text])))
);

CREATE TABLE public.pathly_etapas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    ordem integer NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    conteudo jsonb,
    checklist_feito integer[] DEFAULT '{}'::integer[] NOT NULL,
    anotacoes text DEFAULT ''::text NOT NULL,
    iniciada_em timestamp with time zone,
    concluida_em timestamp with time zone,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_etapas_status_check CHECK ((status = ANY (ARRAY['pendente'::text, 'fazendo'::text, 'concluida'::text, 'pulada'::text])))
);

CREATE TABLE public.pathly_learning_activity_progress (
    user_id uuid NOT NULL,
    route_signature text NOT NULL,
    activity_id text NOT NULL,
    step_id text NOT NULL,
    skill_names text[] DEFAULT '{}'::text[] NOT NULL,
    activity_type text DEFAULT 'lesson'::text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    score integer,
    attempts integer DEFAULT 0 NOT NULL,
    minutes_spent integer DEFAULT 0 NOT NULL,
    confidence integer,
    completed_at timestamp with time zone,
    review_due_at timestamp with time zone,
    last_answer_correct boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_learning_activity_progress_activity_type_check CHECK ((activity_type = ANY (ARRAY['lesson'::text, 'quiz'::text, 'challenge'::text, 'review'::text, 'project'::text]))),
    CONSTRAINT pathly_learning_activity_progress_attempts_check CHECK ((attempts >= 0)),
    CONSTRAINT pathly_learning_activity_progress_confidence_check CHECK (((confidence IS NULL) OR ((confidence >= 1) AND (confidence <= 5)))),
    CONSTRAINT pathly_learning_activity_progress_minutes_spent_check CHECK ((minutes_spent >= 0)),
    CONSTRAINT pathly_learning_activity_progress_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT pathly_learning_activity_progress_status_check CHECK ((status = ANY (ARRAY['available'::text, 'in_progress'::text, 'completed'::text])))
);

CREATE TABLE public.pathly_licoes (
    chave text NOT NULL,
    tarefa text NOT NULL,
    etapa text NOT NULL,
    habilidades text[] DEFAULT '{}'::text[] NOT NULL,
    conteudo jsonb NOT NULL,
    modelo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_modelos_dados (
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    modelo jsonb NOT NULL,
    dialeto text DEFAULT 'postgres'::text NOT NULL,
    checklist_feito integer[] DEFAULT '{}'::integer[] NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_modelos_dados_dialeto_check CHECK ((dialeto = ANY (ARRAY['postgres'::text, 'mysql'::text, 'sqlite'::text])))
);

CREATE TABLE public.pathly_profiles (
    user_id uuid NOT NULL,
    onboarding jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    goal_text text,
    plano text DEFAULT 'free'::text NOT NULL,
    stripe_customer_id text,
    assinatura_status text,
    assinatura_ate timestamp with time zone,
    assinatura_evento_em timestamp with time zone,
    CONSTRAINT pathly_profiles_goal_text_len CHECK (((goal_text IS NULL) OR (char_length(goal_text) <= 2000))),
    CONSTRAINT pathly_profiles_plano_valido CHECK ((plano = ANY (ARRAY['free'::text, 'pro'::text])))
);

CREATE TABLE public.pathly_project_progress (
    user_id uuid NOT NULL,
    route_signature text NOT NULL,
    project_id text NOT NULL,
    step_id text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    evidence_url text,
    reflection text,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_project_progress_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT pathly_project_progress_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'submitted'::text, 'completed'::text])))
);

CREATE TABLE public.pathly_projetos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nome text NOT NULL,
    ideia text NOT NULL,
    status text DEFAULT 'rascunho'::text NOT NULL,
    conteudo jsonb DEFAULT '{}'::jsonb NOT NULL,
    etapa_atual integer DEFAULT 0 NOT NULL,
    etapas_concluidas integer DEFAULT 0 NOT NULL,
    etapas_total integer DEFAULT 0 NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
    respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT pathly_projetos_status_check CHECK ((status = ANY (ARRAY['rascunho'::text, 'ativo'::text, 'pausado'::text, 'concluido'::text, 'arquivado'::text])))
);

CREATE TABLE public.pathly_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    url text NOT NULL,
    kind text NOT NULL,
    provider text,
    language text DEFAULT 'pt'::text NOT NULL,
    is_free boolean DEFAULT true NOT NULL,
    topics text[] DEFAULT '{}'::text[] NOT NULL,
    areas text[] DEFAULT '{}'::text[] NOT NULL,
    level text,
    summary text NOT NULL,
    source text NOT NULL,
    source_license text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_resources_kind_check CHECK ((kind = ANY (ARRAY['curso'::text, 'video'::text, 'artigo'::text, 'doc'::text, 'livro'::text, 'projeto'::text]))),
    CONSTRAINT pathly_resources_level_check CHECK (((level IS NULL) OR (level = ANY (ARRAY['iniciante'::text, 'intermediário'::text, 'avançado'::text]))))
);

CREATE TABLE public.pathly_revisoes (
    user_id uuid NOT NULL,
    chave_licao text NOT NULL,
    indice_pergunta integer NOT NULL,
    tarefa text NOT NULL,
    acertos_seguidos integer DEFAULT 0 NOT NULL,
    total_erros integer DEFAULT 0 NOT NULL,
    ultima_em timestamp with time zone DEFAULT now() NOT NULL,
    proxima_em timestamp with time zone NOT NULL
);

CREATE TABLE public.pathly_route_progress (
    user_id uuid NOT NULL,
    route_signature text NOT NULL,
    progress jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    area text NOT NULL,
    generator text DEFAULT 'regras'::text NOT NULL,
    signature text NOT NULL,
    steps jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_seguranca (
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    extras jsonb DEFAULT '[]'::jsonb NOT NULL,
    itens_feitos text[] DEFAULT '{}'::text[] NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_skill_mastery (
    user_id uuid NOT NULL,
    route_signature text NOT NULL,
    skill_key text NOT NULL,
    skill_name text NOT NULL,
    mastery integer DEFAULT 0 NOT NULL,
    evidence_count integer DEFAULT 0 NOT NULL,
    last_practiced_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_skill_mastery_evidence_count_check CHECK ((evidence_count >= 0)),
    CONSTRAINT pathly_skill_mastery_mastery_check CHECK (((mastery >= 0) AND (mastery <= 100)))
);

CREATE TABLE public.pathly_uso_ia (
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    janela timestamp with time zone NOT NULL,
    chamadas integer DEFAULT 0 NOT NULL
);

CREATE TABLE public.pathly_validacoes (
    projeto_id uuid NOT NULL,
    user_id uuid NOT NULL,
    confirmacoes jsonb DEFAULT '{}'::jsonb NOT NULL,
    criado_em timestamp with time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.pathly_xp_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    route_signature text NOT NULL,
    event_key text NOT NULL,
    source text NOT NULL,
    amount integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT pathly_xp_events_amount_check CHECK (((amount > 0) AND (amount <= 5000))),
    CONSTRAINT pathly_xp_events_source_check CHECK ((source = ANY (ARRAY['lesson'::text, 'quiz'::text, 'challenge'::text, 'review'::text, 'project'::text, 'mastery'::text, 'consistency'::text])))
);


-- ==========================================================================================
-- FUNCOES (6)
-- ==========================================================================================

CREATE FUNCTION public.pathly_acoes_externas_transicao() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
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

CREATE FUNCTION public.pathly_copilot_decisao_imutavel() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
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

CREATE FUNCTION public.registrar_uso_ia(p_endpoint text, p_janela_minutos integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_uid uuid;
  v_janela timestamptz;
  v_total int;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'sem sessao';
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

CREATE FUNCTION public.registrar_uso_ia_servidor(p_user_id uuid, p_endpoint text, p_janela_minutos integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
DECLARE
  v_uid uuid;
  v_janela timestamptz;
  v_total integer;
BEGIN
  v_uid := p_user_id;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'usuario ausente';
  END IF;

  IF p_endpoint IS NULL OR pg_catalog.length(p_endpoint) < 1 OR pg_catalog.length(p_endpoint) > 40 THEN
    RAISE EXCEPTION 'endpoint invalido';
  END IF;

  IF p_janela_minutos IS NULL OR p_janela_minutos < 1 OR p_janela_minutos > 1440 THEN
    RAISE EXCEPTION 'janela invalida';
  END IF;

  v_janela := pg_catalog.to_timestamp(
    pg_catalog.floor(
      pg_catalog.date_part('epoch', pg_catalog.now()) / (p_janela_minutos * 60)
    ) * (p_janela_minutos * 60)
  );

  INSERT INTO public.pathly_uso_ia (user_id, endpoint, janela, chamadas)
  VALUES (v_uid, p_endpoint, v_janela, 1)
  ON CONFLICT (user_id, endpoint, janela)
  DO UPDATE SET chamadas = public.pathly_uso_ia.chamadas + 1
  RETURNING chamadas INTO v_total;

  RETURN v_total;
END;
$$;

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
    -- Regclass of the table e.g. public.notes
    entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

    -- I, U, D, T: insert, update ...
    action realtime.action = (
        case wal ->> 'action'
            when 'I' then 'INSERT'
            when 'U' then 'UPDATE'
            when 'D' then 'DELETE'
            else 'ERROR'
        end
    );

    -- Is row level security enabled for the table
    is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

    subscriptions realtime.subscription[] = array_agg(subs)
        from
            realtime.subscription subs
        where
            subs.entity = entity_
            -- Filter by action early - only get subscriptions interested in this action
            -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
            and (subs.action_filter = '*' or subs.action_filter = action::text);

    -- Subscription vars
    working_role regrole;
    working_selected_columns text[];
    claimed_role regrole;
    claims jsonb;

    subscription_id uuid;
    subscription_has_access bool;
    visible_to_subscription_ids uuid[] = '{}';

    -- structured info for wal's columns
    columns realtime.wal_column[];
    -- previous identity values for update/delete
    old_columns realtime.wal_column[];

    error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

    -- Primary jsonb output for record
    output jsonb;

    -- Loop record for iterating unique roles (outer loop)
    role_record record;
    -- Loop record for iterating unique selected_columns within a role (inner loop)
    cols_record record;
    -- Subscription ids visible at the role level (before fanning out by selected_columns)
    visible_role_sub_ids uuid[] = '{}';

begin
    perform set_config('role', null, true);

    columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'columns') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    old_columns =
        array_agg(
            (
                x->>'name',
                x->>'type',
                x->>'typeoid',
                realtime.cast(
                    (x->'value') #>> '{}',
                    coalesce(
                        (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                        (x->>'type')::regtype
                    )
                ),
                (pks ->> 'name') is not null,
                true
            )::realtime.wal_column
        )
        from
            jsonb_array_elements(wal -> 'identity') x
            left join jsonb_array_elements(wal -> 'pk') pks
                on (x ->> 'name') = (pks ->> 'name');

    for role_record in
        select claims_role
        from (select distinct claims_role from unnest(subscriptions)) t
        order by claims_role::text
    loop
        working_role := role_record.claims_role;

        -- Update `is_selectable` for columns and old_columns (once per role)
        columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(columns) c;

        old_columns =
                array_agg(
                    (
                        c.name,
                        c.type_name,
                        c.type_oid,
                        c.value,
                        c.is_pkey,
                        pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                    )::realtime.wal_column
                )
                from
                    unnest(old_columns) c;

        if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
            -- Fan out 400 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 400: Bad Request, no primary key']
                )::realtime.wal_rls;
            end loop;

        -- The claims role does not have SELECT permission to the primary key of entity
        elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
            -- Fan out 401 error per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;
                return next (
                    jsonb_build_object(
                        'schema', wal ->> 'schema',
                        'table', wal ->> 'table',
                        'type', action
                    ),
                    is_rls_enabled,
                    (select array_agg(s.subscription_id) from unnest(subscriptions) as s where s.claims_role = working_role and (s.selected_columns is not distinct from working_selected_columns)),
                    array['Error 401: Unauthorized']
                )::realtime.wal_rls;
            end loop;

        else
            -- Create the prepared statement (once per role)
            if is_rls_enabled and action <> 'DELETE' then
                if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                    deallocate walrus_rls_stmt;
                end if;
                execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
            end if;

            -- Collect all visible subscription IDs for this role (filter check + RLS check)
            visible_role_sub_ids = '{}';

            for subscription_id, claims in (
                    select
                        subs.subscription_id,
                        subs.claims
                    from
                        unnest(subscriptions) subs
                    where
                        subs.entity = entity_
                        and subs.claims_role = working_role
                        and (
                            realtime.is_visible_through_filters(columns, subs.filters)
                            or (
                              action = 'DELETE'
                              and realtime.is_visible_through_filters(old_columns, subs.filters)
                            )
                        )
            ) loop

                if not is_rls_enabled or action = 'DELETE' then
                    visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                else
                    -- Check if RLS allows the role to see the record
                    perform
                        -- Trim leading and trailing quotes from working_role because set_config
                        -- doesn't recognize the role as valid if they are included
                        set_config('role', trim(both '"' from working_role::text), true),
                        set_config('request.jwt.claims', claims::text, true);

                    execute 'execute walrus_rls_stmt' into subscription_has_access;

                    -- Reset the role on every FOR..LOOP batch execution.
                    -- The first batch of 10 rows is pre-fetched using the current connection role (PG internal behaviour)
                    -- then we have to reset it again otherwise it would use the role defined in the `set_config` above
                    -- to fetch the remaining rows when rows>10, which could be a user-defined role that lacks execution grants.
                    -- The flow is:
                    --   1. run batch with conn role
                    --   2. set_config working_role
                    --   3. execute walrus
                    --   4. reset role (revert)
                    --   5. repeat
                    perform set_config('role', null, true);

                    if subscription_has_access then
                        visible_role_sub_ids = visible_role_sub_ids || subscription_id;
                    end if;
                end if;
            end loop;

            perform set_config('role', null, true);

            -- Inner loop: per distinct selected_columns for this role
            for cols_record in
                select selected_columns
                from (select distinct selected_columns from unnest(subscriptions) s where s.claims_role = working_role) t
                order by coalesce(array_to_string(selected_columns, ','), '')
            loop
                working_selected_columns := cols_record.selected_columns;

                output = jsonb_build_object(
                    'schema', wal ->> 'schema',
                    'table', wal ->> 'table',
                    'type', action,
                    'commit_timestamp', to_char(
                        ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
                    ),
                    'columns', (
                        select
                            jsonb_agg(
                                jsonb_build_object(
                                    'name', pa.attname,
                                    'type', pt.typname
                                )
                                order by pa.attnum asc
                            )
                        from
                            pg_attribute pa
                            join pg_type pt
                                on pa.atttypid = pt.oid
                            left join (
                                select unnest(conkey) as pkey_attnum
                                from pg_constraint
                                where conrelid = entity_ and contype = 'p'
                            ) pk on pk.pkey_attnum = pa.attnum
                        where
                            attrelid = entity_
                            and attnum > 0
                            and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
                            and (working_selected_columns is null or pa.attname = any(working_selected_columns) or pk.pkey_attnum is not null)
                    )
                )
                -- Add "record" key for insert and update
                || case
                    when action in ('INSERT', 'UPDATE') then
                        jsonb_build_object(
                            'record',
                            (
                                select
                                    jsonb_object_agg(
                                        -- if unchanged toast, get column name and value from old record
                                        coalesce((c).name, (oc).name),
                                        case
                                            when (c).name is null then (oc).value
                                            else (c).value
                                        end
                                    )
                                from
                                    unnest(columns) c
                                    full outer join unnest(old_columns) oc
                                        on (c).name = (oc).name
                                where
                                    coalesce((c).is_selectable, (oc).is_selectable)
                                    and (working_selected_columns is null or coalesce((c).name, (oc).name) = any(working_selected_columns) or coalesce((c).is_pkey, (oc).is_pkey))
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            )
                        )
                    else '{}'::jsonb
                end
                -- Add "old_record" key for update and delete
                || case
                    when action = 'UPDATE' then
                        jsonb_build_object(
                                'old_record',
                                (
                                    select jsonb_object_agg((c).name, (c).value)
                                    from unnest(old_columns) c
                                    where
                                        (c).is_selectable
                                        and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                        and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                )
                            )
                    when action = 'DELETE' then
                        jsonb_build_object(
                            'old_record',
                            (
                                select jsonb_object_agg((c).name, (c).value)
                                from unnest(old_columns) c
                                where
                                    (c).is_selectable
                                    and (working_selected_columns is null or (c).name = any(working_selected_columns) or (c).is_pkey)
                                    and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                                    and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                            )
                        )
                    else '{}'::jsonb
                end;

                -- Filter visible_role_sub_ids to those matching the current selected_columns group
                visible_to_subscription_ids = coalesce(
                    (
                        select array_agg(s.subscription_id)
                        from unnest(subscriptions) s
                        where s.claims_role = working_role
                          and (s.selected_columns is not distinct from working_selected_columns)
                          and s.subscription_id = any(visible_role_sub_ids)
                    ),
                    '{}'::uuid[]
                );

                return next (
                    output,
                    is_rls_enabled,
                    visible_to_subscription_ids,
                    case
                        when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                        else '{}'
                    end
                )::realtime.wal_rls;
            end loop;

        end if;
    end loop;

    perform set_config('role', null, true);
end;
$$;

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


-- ==========================================================================================
-- CHAVES PRIMARIAS (24)
-- ==========================================================================================

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_acoes_externas
    ADD CONSTRAINT pathly_acoes_externas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_apis
    ADD CONSTRAINT pathly_apis_pkey PRIMARY KEY (projeto_id);

ALTER TABLE ONLY public.pathly_arquitetura_ia
    ADD CONSTRAINT pathly_arquitetura_ia_pkey PRIMARY KEY (projeto_id);

ALTER TABLE ONLY public.pathly_conexoes
    ADD CONSTRAINT pathly_conexoes_pkey PRIMARY KEY (user_id, provedor);

ALTER TABLE ONLY public.pathly_copilot_decisoes
    ADD CONSTRAINT pathly_copilot_decisoes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_copilot_mensagens
    ADD CONSTRAINT pathly_copilot_mensagens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_copilot_propostas
    ADD CONSTRAINT pathly_copilot_propostas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_etapas
    ADD CONSTRAINT pathly_etapas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_learning_activity_progress
    ADD CONSTRAINT pathly_learning_activity_progress_pkey PRIMARY KEY (user_id, route_signature, activity_id);

ALTER TABLE ONLY public.pathly_licoes
    ADD CONSTRAINT pathly_licoes_pkey PRIMARY KEY (chave);

ALTER TABLE ONLY public.pathly_modelos_dados
    ADD CONSTRAINT pathly_modelos_dados_pkey PRIMARY KEY (projeto_id);

ALTER TABLE ONLY public.pathly_profiles
    ADD CONSTRAINT pathly_profiles_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.pathly_project_progress
    ADD CONSTRAINT pathly_project_progress_pkey PRIMARY KEY (user_id, route_signature, project_id);

ALTER TABLE ONLY public.pathly_projetos
    ADD CONSTRAINT pathly_projetos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_resources
    ADD CONSTRAINT pathly_resources_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_revisoes
    ADD CONSTRAINT pathly_revisoes_pkey PRIMARY KEY (user_id, chave_licao, indice_pergunta);

ALTER TABLE ONLY public.pathly_route_progress
    ADD CONSTRAINT pathly_route_progress_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.pathly_routes
    ADD CONSTRAINT pathly_routes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.pathly_seguranca
    ADD CONSTRAINT pathly_seguranca_pkey PRIMARY KEY (projeto_id);

ALTER TABLE ONLY public.pathly_skill_mastery
    ADD CONSTRAINT pathly_skill_mastery_pkey PRIMARY KEY (user_id, route_signature, skill_key);

ALTER TABLE ONLY public.pathly_uso_ia
    ADD CONSTRAINT pathly_uso_ia_pkey PRIMARY KEY (user_id, endpoint, janela);

ALTER TABLE ONLY public.pathly_validacoes
    ADD CONSTRAINT pathly_validacoes_pkey PRIMARY KEY (projeto_id);

ALTER TABLE ONLY public.pathly_xp_events
    ADD CONSTRAINT pathly_xp_events_pkey PRIMARY KEY (id);


-- ==========================================================================================
-- CHECK E UNIQUE (3)
-- ==========================================================================================

ALTER TABLE ONLY public.pathly_etapas
    ADD CONSTRAINT pathly_etapas_projeto_id_ordem_key UNIQUE (projeto_id, ordem);

ALTER TABLE ONLY public.pathly_resources
    ADD CONSTRAINT pathly_resources_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.pathly_xp_events
    ADD CONSTRAINT pathly_xp_events_user_id_route_signature_event_key_key UNIQUE (user_id, route_signature, event_key);


-- ==========================================================================================
-- INDICES (22)
-- ==========================================================================================

CREATE INDEX feedback_created_at_idx ON public.feedback USING btree (created_at DESC);

CREATE INDEX pathly_acoes_externas_pendentes_idx ON public.pathly_acoes_externas USING btree (user_id, estado, criado_em DESC);

CREATE INDEX pathly_acoes_externas_projeto_idx ON public.pathly_acoes_externas USING btree (projeto_id, criado_em DESC);

CREATE INDEX pathly_arquitetura_ia_user_id_idx ON public.pathly_arquitetura_ia USING btree (user_id);

CREATE INDEX pathly_copilot_decisoes_projeto_chave_status_idx ON public.pathly_copilot_decisoes USING btree (projeto_id, chave, status);

CREATE INDEX pathly_copilot_decisoes_projeto_status_idx ON public.pathly_copilot_decisoes USING btree (projeto_id, status);

CREATE INDEX pathly_copilot_mensagens_projeto_criado_idx ON public.pathly_copilot_mensagens USING btree (projeto_id, criado_em DESC);

CREATE INDEX pathly_copilot_propostas_projeto_status_idx ON public.pathly_copilot_propostas USING btree (projeto_id, status);

CREATE INDEX pathly_etapas_projeto_idx ON public.pathly_etapas USING btree (projeto_id, ordem);

CREATE INDEX pathly_learning_activity_due_idx ON public.pathly_learning_activity_progress USING btree (user_id, route_signature, review_due_at) WHERE (review_due_at IS NOT NULL);

CREATE INDEX pathly_learning_activity_step_idx ON public.pathly_learning_activity_progress USING btree (user_id, route_signature, step_id);

CREATE INDEX pathly_project_progress_route_idx ON public.pathly_project_progress USING btree (user_id, route_signature, status);

CREATE INDEX pathly_projetos_user_idx ON public.pathly_projetos USING btree (user_id, atualizado_em DESC);

CREATE INDEX pathly_resources_areas_idx ON public.pathly_resources USING gin (areas);

CREATE INDEX pathly_resources_topics_idx ON public.pathly_resources USING gin (topics);

CREATE INDEX pathly_revisoes_devidas_idx ON public.pathly_revisoes USING btree (user_id, proxima_em);

CREATE INDEX pathly_routes_user_idx ON public.pathly_routes USING btree (user_id, created_at DESC);

CREATE INDEX pathly_skill_mastery_route_idx ON public.pathly_skill_mastery USING btree (user_id, route_signature, mastery);

CREATE INDEX pathly_uso_ia_janela_idx ON public.pathly_uso_ia USING btree (janela);

CREATE INDEX pathly_validacoes_user_id_idx ON public.pathly_validacoes USING btree (user_id);

CREATE INDEX pathly_xp_events_route_idx ON public.pathly_xp_events USING btree (user_id, route_signature, created_at DESC);

CREATE UNIQUE INDEX pathly_profiles_stripe_customer_idx ON public.pathly_profiles USING btree (stripe_customer_id) WHERE (stripe_customer_id IS NOT NULL);


-- ==========================================================================================
-- CHAVES ESTRANGEIRAS (30)
-- ==========================================================================================

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pathly_acoes_externas
    ADD CONSTRAINT pathly_acoes_externas_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_acoes_externas
    ADD CONSTRAINT pathly_acoes_externas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_apis
    ADD CONSTRAINT pathly_apis_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_apis
    ADD CONSTRAINT pathly_apis_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_arquitetura_ia
    ADD CONSTRAINT pathly_arquitetura_ia_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_arquitetura_ia
    ADD CONSTRAINT pathly_arquitetura_ia_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_conexoes
    ADD CONSTRAINT pathly_conexoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_decisoes
    ADD CONSTRAINT pathly_copilot_decisoes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_decisoes
    ADD CONSTRAINT pathly_copilot_decisoes_substitui_decisao_id_fkey FOREIGN KEY (substitui_decisao_id) REFERENCES public.pathly_copilot_decisoes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pathly_copilot_decisoes
    ADD CONSTRAINT pathly_copilot_decisoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_mensagens
    ADD CONSTRAINT pathly_copilot_mensagens_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_mensagens
    ADD CONSTRAINT pathly_copilot_mensagens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_propostas
    ADD CONSTRAINT pathly_copilot_propostas_decisao_id_fkey FOREIGN KEY (decisao_id) REFERENCES public.pathly_copilot_decisoes(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.pathly_copilot_propostas
    ADD CONSTRAINT pathly_copilot_propostas_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_copilot_propostas
    ADD CONSTRAINT pathly_copilot_propostas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_etapas
    ADD CONSTRAINT pathly_etapas_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_etapas
    ADD CONSTRAINT pathly_etapas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_modelos_dados
    ADD CONSTRAINT pathly_modelos_dados_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_modelos_dados
    ADD CONSTRAINT pathly_modelos_dados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_profiles
    ADD CONSTRAINT pathly_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_projetos
    ADD CONSTRAINT pathly_projetos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_revisoes
    ADD CONSTRAINT pathly_revisoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_route_progress
    ADD CONSTRAINT pathly_route_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_routes
    ADD CONSTRAINT pathly_routes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_seguranca
    ADD CONSTRAINT pathly_seguranca_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_seguranca
    ADD CONSTRAINT pathly_seguranca_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_uso_ia
    ADD CONSTRAINT pathly_uso_ia_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_validacoes
    ADD CONSTRAINT pathly_validacoes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.pathly_projetos(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.pathly_validacoes
    ADD CONSTRAINT pathly_validacoes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ==========================================================================================
-- TRIGGERS (2)
-- ==========================================================================================

CREATE TRIGGER pathly_acoes_externas_transicao_trg BEFORE UPDATE ON public.pathly_acoes_externas FOR EACH ROW EXECUTE FUNCTION public.pathly_acoes_externas_transicao();

CREATE TRIGGER pathly_copilot_decisao_imutavel_tg BEFORE UPDATE ON public.pathly_copilot_decisoes FOR EACH ROW EXECUTE FUNCTION public.pathly_copilot_decisao_imutavel();


-- ==========================================================================================
-- ROW LEVEL SECURITY (24)
-- ==========================================================================================

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_acoes_externas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_apis ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_arquitetura_ia ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_conexoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_copilot_decisoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_copilot_mensagens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_copilot_propostas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_etapas ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_learning_activity_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_licoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_modelos_dados ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_project_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_projetos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_resources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_revisoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_route_progress ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_routes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_seguranca ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_skill_mastery ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_uso_ia ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_validacoes ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.pathly_xp_events ENABLE ROW LEVEL SECURITY;


-- ==========================================================================================
-- POLICIES (72)
-- ==========================================================================================

CREATE POLICY feedback_delete_own ON public.feedback FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY feedback_insert_own ON public.feedback FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY feedback_select_own ON public.feedback FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY feedback_update_own ON public.feedback FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY learning_activity_delete_own ON public.pathly_learning_activity_progress FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY learning_activity_insert_own ON public.pathly_learning_activity_progress FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY learning_activity_select_own ON public.pathly_learning_activity_progress FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY learning_activity_update_own ON public.pathly_learning_activity_progress FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_acoes_externas_insert_own ON public.pathly_acoes_externas FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND ((projeto_id IS NULL) OR (EXISTS ( SELECT 1
   FROM public.pathly_projetos p
  WHERE ((p.id = pathly_acoes_externas.projeto_id) AND (p.user_id = auth.uid())))))));

CREATE POLICY pathly_acoes_externas_select_own ON public.pathly_acoes_externas FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_acoes_externas_update_own ON public.pathly_acoes_externas FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_apis_delete_own ON public.pathly_apis FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_apis_insert_own ON public.pathly_apis FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_apis_select_own ON public.pathly_apis FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_apis_update_own ON public.pathly_apis FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_arquitetura_ia_insert_own ON public.pathly_arquitetura_ia FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_arquitetura_ia_select_own ON public.pathly_arquitetura_ia FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_arquitetura_ia_update_own ON public.pathly_arquitetura_ia FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_conexoes_delete_own ON public.pathly_conexoes FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_conexoes_select_own ON public.pathly_conexoes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_copilot_decisoes_insert_own ON public.pathly_copilot_decisoes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos p
  WHERE ((p.id = pathly_copilot_decisoes.projeto_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY pathly_copilot_decisoes_select_own ON public.pathly_copilot_decisoes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_copilot_decisoes_update_own ON public.pathly_copilot_decisoes FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_copilot_mensagens_insert_own ON public.pathly_copilot_mensagens FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos p
  WHERE ((p.id = pathly_copilot_mensagens.projeto_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY pathly_copilot_mensagens_select_own ON public.pathly_copilot_mensagens FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_copilot_propostas_insert_own ON public.pathly_copilot_propostas FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos p
  WHERE ((p.id = pathly_copilot_propostas.projeto_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY pathly_copilot_propostas_select_own ON public.pathly_copilot_propostas FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_copilot_propostas_update_own ON public.pathly_copilot_propostas FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_etapas_delete_own ON public.pathly_etapas FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_etapas_insert_own ON public.pathly_etapas FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_etapas_select_own ON public.pathly_etapas FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_etapas_update_own ON public.pathly_etapas FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_licoes_read_for_own_review ON public.pathly_licoes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.pathly_revisoes revisao
  WHERE ((revisao.user_id = auth.uid()) AND (revisao.chave_licao = pathly_licoes.chave)))));

CREATE POLICY pathly_modelos_delete_own ON public.pathly_modelos_dados FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_modelos_insert_own ON public.pathly_modelos_dados FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_modelos_select_own ON public.pathly_modelos_dados FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_modelos_update_own ON public.pathly_modelos_dados FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_profiles_delete_own ON public.pathly_profiles FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_profiles_insert_own ON public.pathly_profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_profiles_select_own ON public.pathly_profiles FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_profiles_update_own ON public.pathly_profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_projetos_delete_own ON public.pathly_projetos FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_projetos_insert_own ON public.pathly_projetos FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_projetos_select_own ON public.pathly_projetos FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_projetos_update_own ON public.pathly_projetos FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_revisoes_insert_own ON public.pathly_revisoes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_revisoes_select_own ON public.pathly_revisoes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_revisoes_update_own ON public.pathly_revisoes FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_route_progress_insert_own ON public.pathly_route_progress FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_route_progress_select_own ON public.pathly_route_progress FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_route_progress_update_own ON public.pathly_route_progress FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_routes_delete_own ON public.pathly_routes FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_routes_insert_own ON public.pathly_routes FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY pathly_routes_select_own ON public.pathly_routes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_seguranca_delete_own ON public.pathly_seguranca FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_seguranca_insert_own ON public.pathly_seguranca FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos projeto
  WHERE ((projeto.id = pathly_seguranca.projeto_id) AND (projeto.user_id = auth.uid()))))));

CREATE POLICY pathly_seguranca_select_own ON public.pathly_seguranca FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_seguranca_update_own ON public.pathly_seguranca FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos projeto
  WHERE ((projeto.id = pathly_seguranca.projeto_id) AND (projeto.user_id = auth.uid()))))));

CREATE POLICY pathly_uso_ia_select_own ON public.pathly_uso_ia FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_validacoes_insert_own ON public.pathly_validacoes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.pathly_projetos p
  WHERE ((p.id = pathly_validacoes.projeto_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY pathly_validacoes_select_own ON public.pathly_validacoes FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY pathly_validacoes_update_own ON public.pathly_validacoes FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY project_progress_delete_own ON public.pathly_project_progress FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY project_progress_insert_own ON public.pathly_project_progress FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY project_progress_select_own ON public.pathly_project_progress FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY project_progress_update_own ON public.pathly_project_progress FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY skill_mastery_delete_own ON public.pathly_skill_mastery FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY skill_mastery_insert_own ON public.pathly_skill_mastery FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY skill_mastery_select_own ON public.pathly_skill_mastery FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY skill_mastery_update_own ON public.pathly_skill_mastery FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY xp_events_insert_own ON public.pathly_xp_events FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY xp_events_select_own ON public.pathly_xp_events FOR SELECT TO authenticated USING ((auth.uid() = user_id));


-- ==========================================================================================
-- PRIVILEGIOS (73)
-- ==========================================================================================

GRANT ALL ON FUNCTION public.pathly_acoes_externas_transicao() TO anon;

GRANT ALL ON FUNCTION public.pathly_acoes_externas_transicao() TO authenticated;

GRANT ALL ON FUNCTION public.pathly_acoes_externas_transicao() TO service_role;

GRANT ALL ON FUNCTION public.pathly_copilot_decisao_imutavel() TO anon;

GRANT ALL ON FUNCTION public.pathly_copilot_decisao_imutavel() TO authenticated;

GRANT ALL ON FUNCTION public.pathly_copilot_decisao_imutavel() TO service_role;

GRANT ALL ON FUNCTION public.registrar_uso_ia(p_endpoint text, p_janela_minutos integer) TO service_role;

GRANT ALL ON FUNCTION public.registrar_uso_ia_servidor(p_user_id uuid, p_endpoint text, p_janela_minutos integer) TO service_role;

GRANT ALL ON TABLE public.feedback TO service_role;

GRANT ALL ON TABLE public.pathly_acoes_externas TO service_role;

GRANT ALL ON TABLE public.pathly_apis TO service_role;

GRANT ALL ON TABLE public.pathly_arquitetura_ia TO anon;

GRANT ALL ON TABLE public.pathly_arquitetura_ia TO authenticated;

GRANT ALL ON TABLE public.pathly_arquitetura_ia TO service_role;

GRANT ALL ON TABLE public.pathly_conexoes TO service_role;

GRANT ALL ON TABLE public.pathly_copilot_decisoes TO service_role;

GRANT ALL ON TABLE public.pathly_copilot_mensagens TO service_role;

GRANT ALL ON TABLE public.pathly_copilot_propostas TO service_role;

GRANT ALL ON TABLE public.pathly_etapas TO service_role;

GRANT ALL ON TABLE public.pathly_learning_activity_progress TO anon;

GRANT ALL ON TABLE public.pathly_learning_activity_progress TO authenticated;

GRANT ALL ON TABLE public.pathly_learning_activity_progress TO service_role;

GRANT ALL ON TABLE public.pathly_licoes TO service_role;

GRANT ALL ON TABLE public.pathly_modelos_dados TO service_role;

GRANT ALL ON TABLE public.pathly_profiles TO service_role;

GRANT ALL ON TABLE public.pathly_project_progress TO anon;

GRANT ALL ON TABLE public.pathly_project_progress TO authenticated;

GRANT ALL ON TABLE public.pathly_project_progress TO service_role;

GRANT ALL ON TABLE public.pathly_projetos TO service_role;

GRANT ALL ON TABLE public.pathly_resources TO service_role;

GRANT ALL ON TABLE public.pathly_revisoes TO service_role;

GRANT ALL ON TABLE public.pathly_route_progress TO service_role;

GRANT ALL ON TABLE public.pathly_routes TO service_role;

GRANT ALL ON TABLE public.pathly_seguranca TO service_role;

GRANT ALL ON TABLE public.pathly_skill_mastery TO anon;

GRANT ALL ON TABLE public.pathly_skill_mastery TO authenticated;

GRANT ALL ON TABLE public.pathly_skill_mastery TO service_role;

GRANT ALL ON TABLE public.pathly_uso_ia TO service_role;

GRANT ALL ON TABLE public.pathly_validacoes TO service_role;

GRANT ALL ON TABLE public.pathly_xp_events TO anon;

GRANT ALL ON TABLE public.pathly_xp_events TO authenticated;

GRANT ALL ON TABLE public.pathly_xp_events TO service_role;

GRANT DELETE ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT ON TABLE public.pathly_licoes TO authenticated;

GRANT SELECT ON TABLE public.pathly_uso_ia TO authenticated;

GRANT SELECT(atualizado_em) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(conta) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(criado_em) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(escopos) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(expira_em) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(provedor) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT(user_id) ON TABLE public.pathly_conexoes TO authenticated;

GRANT SELECT,INSERT ON TABLE public.pathly_copilot_mensagens TO authenticated;

GRANT SELECT,INSERT,DELETE ON TABLE public.pathly_profiles TO authenticated;

GRANT SELECT,INSERT,DELETE ON TABLE public.pathly_routes TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.feedback TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pathly_apis TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pathly_etapas TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pathly_modelos_dados TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pathly_projetos TO authenticated;

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.pathly_seguranca TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_acoes_externas TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_copilot_decisoes TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_copilot_propostas TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_revisoes TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_route_progress TO authenticated;

GRANT SELECT,INSERT,UPDATE ON TABLE public.pathly_validacoes TO authenticated;

GRANT UPDATE(goal_text) ON TABLE public.pathly_profiles TO authenticated;

GRANT UPDATE(onboarding) ON TABLE public.pathly_profiles TO authenticated;

GRANT UPDATE(updated_at) ON TABLE public.pathly_profiles TO authenticated;

GRANT UPDATE(user_id) ON TABLE public.pathly_profiles TO authenticated;

REVOKE ALL ON FUNCTION public.registrar_uso_ia(p_endpoint text, p_janela_minutos integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.registrar_uso_ia_servidor(p_user_id uuid, p_endpoint text, p_janela_minutos integer) FROM PUBLIC;

