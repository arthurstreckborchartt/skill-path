REVOKE ALL ON public.pathly_projetos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_projetos TO authenticated;
GRANT ALL ON public.pathly_projetos TO service_role;

REVOKE ALL ON public.pathly_etapas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_etapas TO authenticated;
GRANT ALL ON public.pathly_etapas TO service_role;

REVOKE ALL ON public.pathly_modelos_dados FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_modelos_dados TO authenticated;
GRANT ALL ON public.pathly_modelos_dados TO service_role;

REVOKE ALL ON public.pathly_apis FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_apis TO authenticated;
GRANT ALL ON public.pathly_apis TO service_role;

REVOKE ALL ON public.pathly_seguranca FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pathly_seguranca TO authenticated;
GRANT ALL ON public.pathly_seguranca TO service_role;

REVOKE ALL ON public.pathly_profiles FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.pathly_profiles TO authenticated;
GRANT UPDATE (user_id, onboarding, goal_text, updated_at) ON public.pathly_profiles TO authenticated;
GRANT ALL ON public.pathly_profiles TO service_role;

REVOKE ALL ON public.pathly_route_progress FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.pathly_route_progress TO authenticated;
GRANT ALL ON public.pathly_route_progress TO service_role;

REVOKE ALL ON public.feedback FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

DROP POLICY IF EXISTS "pathly_seguranca_insert_own" ON public.pathly_seguranca;
CREATE POLICY "pathly_seguranca_insert_own"
  ON public.pathly_seguranca
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pathly_projetos AS projeto
      WHERE projeto.id = pathly_seguranca.projeto_id
        AND projeto.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "pathly_seguranca_update_own" ON public.pathly_seguranca;
CREATE POLICY "pathly_seguranca_update_own"
  ON public.pathly_seguranca
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.pathly_projetos AS projeto
      WHERE projeto.id = pathly_seguranca.projeto_id
        AND projeto.user_id = auth.uid()
    )
  );