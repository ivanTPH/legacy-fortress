"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PlatformActionRow,
  PlatformChip,
  PlatformEmptyState,
  PlatformInfoTile,
  PlatformNotice,
  PlatformSection,
  PlatformStatCard,
} from "../../../components/ui/PlatformPrimitives";
import { supabase } from "../../../lib/supabaseClient";
import { waitForActiveUser } from "../../../lib/auth/session";
import {
  getRoleLabel,
  clearStoredLinkedGrantId,
  getStoredLinkedGrantId,
  loadViewerAccessState,
  selectOwnVault,
  setStoredLinkedGrantId,
  type ViewerAccessState,
} from "../../../lib/access-control/viewerAccess";
import {
  CONTACT_WALLET_ASSURANCE_LEVELS,
  CONTACT_WALLET_ENTITLEMENT,
  buildContactWalletTasks,
  buildSupportedPersonSummary,
  getContactWalletAssuranceLevel,
} from "../../../lib/contactWallet";

export default function ContactWalletPage() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [viewer, setViewer] = useState<ViewerAccessState | null>(null);
  const [message, setMessage] = useState("");
  const [attorneyIdentifications, setAttorneyIdentifications] = useState<Array<{ category: string; institution: string }>>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setState("loading");
      setMessage("");
      const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
      if (!user) {
        if (!mounted) return;
        setState("empty");
        setMessage("Sign in to open your Contact Wallet.");
        return;
      }

      try {
        const access = await loadViewerAccessState(supabase, user.id, {
          preferredGrantId: searchParams.get("grant") || getStoredLinkedGrantId(),
          fallbackDisplayName: String(user.user_metadata?.full_name ?? user.email ?? "Secure account"),
          includePreVerificationGrants: true,
        });
        if (!mounted) return;
        if (access.mode !== "linked") {
          setViewer(null);
          setState("empty");
          setMessage("No active supporting relationships are linked to this identity yet.");
          return;
        }
        if (access.grantId) setStoredLinkedGrantId(access.grantId);
        if (access.releaseState === "ATTORNEY_LIMITED" && access.grantId) {
          const details = await supabase.rpc("lf_linked_attorney_identifications", { p_grant_id: access.grantId });
          if (!mounted) return;
          setAttorneyIdentifications(Array.isArray(details.data) ? details.data as Array<{ category: string; institution: string }> : []);
        } else {
          setAttorneyIdentifications([]);
        }
        setViewer(access);
        setState("ready");
      } catch (error) {
        if (!mounted) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Could not load Contact Wallet.");
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const assuranceLevel = useMemo(() => getContactWalletAssuranceLevel({
    emailVerified: true,
    phoneVerified: false,
    mfaEnabled: false,
    kycVerified: false,
    recentStrongAuth: false,
  }), []);
  const assurance = CONTACT_WALLET_ASSURANCE_LEVELS[assuranceLevel];
  const supportedPerson = viewer ? buildSupportedPersonSummary(viewer) : null;
  const tasks = viewer ? buildContactWalletTasks(viewer, assuranceLevel) : [];

  if (state === "loading") {
    return (
      <main className="lf-page-shell">
        <section className="lf-page-card">
          <h1>Opening Contact Wallet</h1>
          <p className="lf-muted-note">Checking your linked responsibilities and permitted workspaces...</p>
        </section>
      </main>
    );
  }

  if (!viewer || state === "empty" || state === "error") {
    return (
      <main className="lf-page-shell">
        <section className="lf-page-card">
          <h1>Contact Wallet</h1>
          <PlatformEmptyState
            icon="wallet"
            title={state === "error" ? "Wallet unavailable" : "No supporting relationships yet"}
            detail={message || "Accepted invitations and verified contact responsibilities will appear here."}
            action={<Link className="lf-primary-btn" href="/dashboard">Return to personal dashboard</Link>}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="lf-page-shell">
      <section className="lf-page-card">
        <div className="lf-page-header">
          <div>
            <p className="lf-eyebrow">Contact Wallet</p>
            <h1>People you support</h1>
            <p className="lf-muted-note">
              Your Contact Wallet is a free, limited workspace for responsibilities accepted through Legacy Fortress invitations.
            </p>
          </div>
          <PlatformChip tone="success">{CONTACT_WALLET_ENTITLEMENT.label}</PlatformChip>
        </div>

        <PlatformNotice icon="shield_lock">
          Protected documents, evidence upload and probate actions remain locked until the required security and verification level is confirmed server-side.
        </PlatformNotice>
      </section>

      <section className="lf-dashboard-grid">
        <PlatformStatCard
          icon="verified_user"
          label="Current assurance"
          value={`Level ${assuranceLevel}`}
          detail={assurance.label}
          tone={assuranceLevel >= 2 ? "success" : "warning"}
        />
        <PlatformStatCard
          icon="groups"
          label="Supported people"
          value="1"
          detail="Loaded from active linked-access grants."
        />
        <PlatformStatCard
          icon="lock"
          label="Access mode"
          value={viewer.releaseState === "ESTATE_RELEASED" ? "Estate released" : viewer.releaseState === "ATTORNEY_LIMITED" ? "Limited attorney" : "Locked"}
          detail="Identity and record designation alone do not unlock information."
        />
      </section>

      <PlatformSection
        icon="person_pin"
        title={`Your relationship with ${supportedPerson?.accountHolderName ?? "this person"}`}
        detail="Your relationship, identity checks and access to records are separate decisions."
        emphasis="primary"
      >
        {supportedPerson ? (
          <div className="lf-dashboard-grid">
            <PlatformInfoTile label="Acting for" value={supportedPerson.accountHolderName} />
            <PlatformInfoTile label="Role" value={getRoleLabel(supportedPerson.role)} />
            <PlatformInfoTile label="Role acceptance" value={supportedPerson.activationStatus === "invited" ? "Pending" : "Accepted"} />
            <PlatformInfoTile label="Identity" value={viewer.identityAssuranceLevel >= 2 ? "Verified" : "Required"} />
            <PlatformInfoTile label="Authority" value={viewer.releaseState === "ESTATE_RELEASED" ? "Estate release approved" : viewer.releaseState === "ATTORNEY_LIMITED" ? "Limited attorney authority verified" : "Not established / pending"} />
            <PlatformInfoTile label="Record access" value={viewer.releaseState === "ESTATE_RELEASED" ? "Specifically released records only" : "Locked"} />
            <PlatformInfoTile label="Permitted sections" value={viewer.releaseState === "ESTATE_RELEASED" && supportedPerson.allowedSections.length ? supportedPerson.allowedSections.join(", ") : "None released"} />
          </div>
        ) : null}
      </PlatformSection>

      {viewer.releaseState === "ATTORNEY_LIMITED" ? <PlatformSection icon="account_balance" title="Approved institution identification" detail="Only the reviewed institution names and categories below are available. Balances, account identifiers and Vault records remain private.">
        <div className="lf-dashboard-grid">{attorneyIdentifications.map((item, index) => <PlatformInfoTile key={`${item.category}-${index}`} label={item.category} value={item.institution} />)}</div>
      </PlatformSection> : null}

      <PlatformNotice icon="arrow_forward">
        <strong>Next step:</strong> complete any required security, identity or authority review. Identity verification alone does not establish legal authority or activate estate access.
      </PlatformNotice>

      <PlatformSection
        icon="task_alt"
        title="Required actions"
        detail="Tasks stay separate from marketing and resolve only when their security or workflow condition is satisfied."
      >
        <div style={{ display: "grid", gap: 10 }}>
          {tasks.map((task) => (
            <PlatformActionRow
              key={task.id}
              title={task.title}
              detail={task.detail}
              status={<PlatformChip tone={task.status === "complete" ? "success" : task.status === "blocked" ? "warning" : "default"}>{task.status.replace(/_/g, " ")}</PlatformChip>}
            />
          ))}
        </div>
      </PlatformSection>

      <PlatformSection
        icon="description"
        title="Documents and evidence"
        detail="Only documents explicitly shared through the relationship grant will appear here."
      >
        <PlatformEmptyState
          icon="folder_open"
          title="No protected documents available in this wallet yet"
          detail="Document viewing, download and evidence upload require explicit permission, the right assurance level and short-lived signed access."
        />
      </PlatformSection>

      <PlatformSection
        icon="workspace_premium"
        title="Optional personal vault"
        detail="Your Personal Vault is separate from the supporting relationships shown above."
        action={<Link className="lf-link-btn" href="/onboarding" onClick={() => { if (viewer?.sessionUserId) selectOwnVault(viewer.sessionUserId); else clearStoredLinkedGrantId(); }}>Set up my Personal Vault</Link>}
      >
        <PlatformNotice>
          Your supporting relationships stay attached to this Legacy Fortress identity. Set up your own Personal Vault separately when you are ready.
        </PlatformNotice>
      </PlatformSection>
    </main>
  );
}
