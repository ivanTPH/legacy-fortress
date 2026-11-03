-- Cleared notifications follow the person across devices (owner decision 3 Nov 2026).
-- Holds only which notification ids the person cleared. Nobody else can read or write them,
-- and clearing never deletes or changes the notification or the event behind it.
CREATE TABLE public.notification_clears (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL,
  cleared_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, item_id)
);
ALTER TABLE public.notification_clears ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_clears FROM anon;
REVOKE UPDATE ON public.notification_clears FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.notification_clears TO authenticated;
CREATE POLICY notification_clears_own_select ON public.notification_clears FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notification_clears_own_insert ON public.notification_clears FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notification_clears_own_delete ON public.notification_clears FOR DELETE TO authenticated USING (user_id = auth.uid());
