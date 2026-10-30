"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import { supabase } from "@/lib/supabaseClient";
import { resolveWorkspaceAccountLinks, type WorkspaceAccountContext, type WorkspaceAccountLink } from "@/lib/navigation/workspaceAccountLinks";

type AdminSessionPayload = {
  ok?: boolean;
  admin?: { isMasterAdmin?: boolean; role?: string | null; capabilities?: string[] };
};

/**
 * Account-menu links between the Personal Vault, Platform Admin and Partner Portal.
 * Visibility comes from the server-verified admin session; each destination still
 * applies its own sign-in and permission checks, so a link never grants access.
 */
export default function WorkspaceAccountLinks({ current, onNavigate, linkClassName, iconSize = 17, asMenuItems = true }: { current: WorkspaceAccountContext; onNavigate?: () => void; linkClassName?: string; iconSize?: number; asMenuItems?: boolean }) {
  const [links, setLinks] = useState<WorkspaceAccountLink[]>(() => resolveWorkspaceAccountLinks(current, null));

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return;
        const response = await fetch("/api/internal/admin/session", { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
        const payload = response.ok ? ((await response.json().catch(() => null)) as AdminSessionPayload | null) : null;
        if (mounted) setLinks(resolveWorkspaceAccountLinks(current, payload?.ok ? payload.admin ?? null : null));
      } catch {
        // Fail closed: without a verified admin session only the Personal Vault link is offered.
      }
    })();
    return () => { mounted = false; };
  }, [current]);

  if (links.length === 0) return null;
  return (
    <>
      {links.map((link) => (
        <Link key={link.href} href={link.href} role={asMenuItems ? "menuitem" : undefined} className={linkClassName} prefetch={false} onClick={onNavigate}>
          <Icon name={link.icon} size={iconSize} />
          <span>{link.label}</span>
        </Link>
      ))}
    </>
  );
}
