"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "../ui/Icon";
import { supabase } from "../../lib/supabaseClient";

/**
 * "Protect your access" (owner decision 4 Nov 2026). People linked to someone else's Vault are mostly
 * younger and comfortable with an authenticator app, so suggest two-step once they're connected.
 * Never required; hidden once it's on or dismissed.
 */
const DISMISS_KEY = "lf:security-nudge-dismissed";

export default function SecurityNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let active = true;
    try { if (window.localStorage.getItem(DISMISS_KEY)) return; } catch { /* optional */ }
    void supabase.auth.mfa.listFactors().then((result) => {
      if (!active || result.error) return;
      setShow(!(result.data?.totp ?? []).some((factor) => factor.status === "verified"));
    });
    return () => { active = false; };
  }, []);
  if (!show) return null;
  const dismiss = () => { try { window.localStorage.setItem(DISMISS_KEY, "1"); } catch { /* optional */ } setShow(false); };
  return (
    <aside className="lf-security-nudge" aria-labelledby="lf-security-nudge-title">
      <span className="lf-security-nudge-icon" aria-hidden="true"><Icon name="phonelink_lock" size={24} /></span>
      <div>
        <strong id="lf-security-nudge-title">Protect your access</strong>
        <p>You can see records someone trusts you with. Add two-step sign-in with an authenticator app, so a stolen password is never enough.</p>
        <div className="lf-security-nudge-actions">
          <Link className="lf-primary-btn" href="/account/security?setup=two-step">Turn on two-step</Link>
          <button type="button" className="lf-link-button" onClick={dismiss}>Not now</button>
        </div>
      </div>
    </aside>
  );
}
