-- Turn the new-device check on (owner decision 4 Nov 2026). Everyone signed in right now stays signed in:
-- every open session is recorded as trusted first, so nobody is interrupted mid-task. From now on, a
-- password-only sign-in on a new phone or computer needs the emailed code (or a remembered device).
-- To turn it off again: UPDATE public.lf_security_switches SET new_device_check = false;
INSERT INTO public.trusted_sessions (session_id, user_id, method)
SELECT s.id, s.user_id, 'existing_session' FROM auth.sessions s
ON CONFLICT (session_id) DO NOTHING;
UPDATE public.lf_security_switches SET new_device_check = true, updated_at = timezone('utc', now()) WHERE id;
