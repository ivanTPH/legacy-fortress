-- What the person has read in their Inbox follows them across devices (owner decision 10 Nov 2026).
-- Holds only which Inbox items (things to do and updates) the person has opened, by key. Nobody else can read
-- or write them. Reading never completes, clears or changes the item or anything behind it.
CREATE TABLE public.inbox_reads (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_key text NOT NULL CHECK (char_length(item_key) BETWEEN 1 AND 200),
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, item_key)
);
ALTER TABLE public.inbox_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inbox_reads FROM anon;
REVOKE UPDATE ON public.inbox_reads FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.inbox_reads TO authenticated;
CREATE POLICY inbox_reads_own_select ON public.inbox_reads FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY inbox_reads_own_insert ON public.inbox_reads FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY inbox_reads_own_delete ON public.inbox_reads FOR DELETE TO authenticated USING (user_id = auth.uid());
