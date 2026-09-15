GRANT SELECT, UPDATE, DELETE ON TABLE public.feedback TO authenticated;

CREATE POLICY "feedback_select_own"
ON public.feedback
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "feedback_update_own"
ON public.feedback
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "feedback_delete_own"
ON public.feedback
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);