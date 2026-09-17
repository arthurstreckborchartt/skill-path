CREATE OR REPLACE FUNCTION public.registrar_uso_ia_servidor(
  p_user_id uuid,
  p_endpoint text,
  p_janela_minutos integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.registrar_uso_ia(text, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_uso_ia_servidor(uuid, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_uso_ia_servidor(uuid, text, integer) TO service_role;