-- Monthly summary email (V5.2 m3; AGENTS rule 40). Counts only, a link to the normal sign-in,
-- and Change frequency / Turn off links. Never names, record titles, values, documents or sign-in links.
-- Settings › Notifications: Monthly (default) · Weekly · Off.
-- Owner decision 3 Nov 2026: on TEST only the owner's own account receives it. Outside production the
-- sender only emails people who chose a frequency themselves (chosen_at is set), and synthetic
-- addresses are never emailed.
CREATE TABLE public.summary_email_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'weekly', 'off')),
  chosen_at timestamptz,
  last_sent_at timestamptz,
  unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.summary_email_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.summary_email_preferences FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.summary_email_preferences FROM authenticated;
GRANT SELECT ON public.summary_email_preferences TO authenticated;
GRANT ALL ON public.summary_email_preferences TO service_role;
CREATE POLICY summary_email_preferences_own_select ON public.summary_email_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- The person sets their own frequency. Nothing else about the row can be changed from a browser.
CREATE FUNCTION public.lf_set_summary_frequency(p_frequency text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  IF p_frequency NOT IN ('monthly', 'weekly', 'off') THEN RAISE EXCEPTION 'Choose Monthly, Weekly or Off'; END IF;
  INSERT INTO public.summary_email_preferences (user_id, frequency, chosen_at)
  VALUES (auth.uid(), p_frequency, timezone('utc', now()))
  ON CONFLICT (user_id) DO UPDATE SET frequency = EXCLUDED.frequency, chosen_at = EXCLUDED.chosen_at, updated_at = timezone('utc', now());
  RETURN p_frequency;
END;
$$;

-- Server only: counts for one person since a date. Counts, never details.
CREATE FUNCTION public.lf_summary_counts(p_user uuid, p_since timestamptz)
RETURNS TABLE (todo_count integer, update_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT
    ((SELECT count(*) FROM public.record_suggestions s WHERE s.owner_user_id = p_user AND s.status IN ('pending', 'approved'))
     + (SELECT count(*) FROM public.vault_early_access_requests r WHERE r.owner_user_id = p_user AND r.status = 'open'))::integer,
    ((SELECT count(*) FROM public.record_history h WHERE h.owner_user_id = p_user AND h.created_at >= p_since AND h.actor_kind <> 'owner')
     + (SELECT count(*) FROM public.user_notifications n WHERE n.recipient_user_id = p_user AND n.created_at >= p_since))::integer;
$$;

-- Server only: "Turn off" from the email, without signing in. Only switches the summary off.
CREATE FUNCTION public.lf_summary_unsubscribe(p_token uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  WITH changed AS (
    UPDATE public.summary_email_preferences SET frequency = 'off', chosen_at = timezone('utc', now()), updated_at = timezone('utc', now())
    WHERE unsubscribe_token = p_token RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM changed);
$$;

REVOKE ALL ON FUNCTION public.lf_set_summary_frequency(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lf_summary_counts(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.lf_summary_unsubscribe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lf_set_summary_frequency(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lf_summary_counts(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.lf_summary_unsubscribe(uuid) TO service_role;
