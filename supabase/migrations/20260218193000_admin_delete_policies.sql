-- Allow admins to perform delete operations needed by Admin panel actions

DROP POLICY IF EXISTS "Admins can delete audit logs" ON public.audit_logs;
CREATE POLICY "Admins can delete audit logs"
  ON public.audit_logs FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Admins can delete all generations" ON public.generations;
CREATE POLICY "Admins can delete all generations"
  ON public.generations FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

DROP POLICY IF EXISTS "Admins can delete all builds" ON public.builds;
CREATE POLICY "Admins can delete all builds"
  ON public.builds FOR DELETE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));
