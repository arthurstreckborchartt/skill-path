CREATE POLICY "database_export_bucket_no_client_access"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (bucket_id <> 'database_export_20_09_26')
WITH CHECK (bucket_id <> 'database_export_20_09_26');