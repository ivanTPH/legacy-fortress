CREATE OR REPLACE FUNCTION public.prevent_last_active_super_admin_loss()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  old_was_active_super boolean;
  new_is_active_super boolean;
  remaining_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('legacy_fortress_admin_active_super_admin_invariant'));

  old_was_active_super :=
    OLD.status = 'active'
    AND (coalesce(OLD.is_master, false) OR OLD.role = 'super_admin');

  IF TG_OP = 'DELETE' THEN
    new_is_active_super := false;
  ELSE
    new_is_active_super :=
      NEW.status = 'active'
      AND (coalesce(NEW.is_master, false) OR NEW.role = 'super_admin');
  END IF;

  IF old_was_active_super AND NOT new_is_active_super THEN
    SELECT count(*)
    INTO remaining_count
    FROM public.admin_users
    WHERE id <> OLD.id
      AND status = 'active'
      AND (coalesce(is_master, false) OR role = 'super_admin');

    IF remaining_count < 1 THEN
      RAISE EXCEPTION 'At least one active super administrator must remain.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_users_prevent_last_active_super_admin_update ON public.admin_users;
CREATE TRIGGER admin_users_prevent_last_active_super_admin_update
  BEFORE UPDATE OF status, role, is_master ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_active_super_admin_loss();

DROP TRIGGER IF EXISTS admin_users_prevent_last_active_super_admin_delete ON public.admin_users;
CREATE TRIGGER admin_users_prevent_last_active_super_admin_delete
  BEFORE DELETE ON public.admin_users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_last_active_super_admin_loss();
