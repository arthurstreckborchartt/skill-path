DROP POLICY IF EXISTS "pathly_licoes_leitura" ON public.pathly_licoes;
CREATE POLICY "pathly_licoes_read_for_own_review"
  ON public.pathly_licoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pathly_revisoes AS revisao
      WHERE revisao.user_id = auth.uid()
        AND revisao.chave_licao = pathly_licoes.chave
    )
  );
REVOKE ALL ON public.pathly_licoes FROM anon, authenticated;
GRANT SELECT ON public.pathly_licoes TO authenticated;
GRANT ALL ON public.pathly_licoes TO service_role;

DROP POLICY IF EXISTS "pathly_resources_read_all" ON public.pathly_resources;
REVOKE ALL ON public.pathly_resources FROM anon, authenticated;
GRANT ALL ON public.pathly_resources TO service_role;

REVOKE ALL ON public.pathly_uso_ia FROM anon, authenticated;
GRANT SELECT ON public.pathly_uso_ia TO authenticated;
GRANT ALL ON public.pathly_uso_ia TO service_role;
DROP POLICY IF EXISTS "pathly_uso_ia_select_own" ON public.pathly_uso_ia;
CREATE POLICY "pathly_uso_ia_select_own"
  ON public.pathly_uso_ia
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);