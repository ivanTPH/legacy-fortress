"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  getStoredLinkedGrantId,
  loadViewerAccessState,
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
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [viewer, setViewer] = useState<ViewerAccessState | null>(null);
  const [message, setMessage] = useState("");

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
          preferredGrantId: getStoredLinkedGrantId(),
          fallbackDisplayName: String(user.user_metadata?.full_name ?? user.email ?? "Secure account"),
        });
        if (!mounted) return;
        if (access.mode !== "linked") {
          setViewer(null);
          setState("empty");
          setMessage("No active supporting relationships are linked to this identity yet.");
          return;
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
  }, []);

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
            <p className="lf-eyebrow">Verified Contact Wallet</p>
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
          value={viewer.readOnly ? "Read-only" : "Limited edit"}
          detail="Explicit grants, not broad role labels."
        />
      </section>

      <PlatformSection
        icon="person_pin"
        title="Supported person"
        detail="Relationship context for the active Contact Wallet workspace."
        emphasis="primary"
      >
        {supportedPerson ? (
          <div className="lf-dashboard-grid">
            <PlatformInfoTile label="Supporting" value={supportedPerson.accountHolderName} />
            <PlatformInfoTile label="Your role" value={getRoleLabel(supportedPerson.role)} />
            <PlatformInfoTile label="Status" value={supportedPerson.activationStatus.replace(/_/g, " ")} />
            <PlatformInfoTile label="Permitted sections" value={supportedPerson.allowedSections.length ? supportedPerson.allowedSections.join(", ") : "Grant scoped"} />
          </div>
        ) : null}
      </PlatformSection>

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
        detail="Creating your own Legacy Fortress vault is separate from the free Contact Wallet duties shown above."
        action={<Link className="lf-link-btn" href="/account/billing">Review personal vault options</Link>}
      >
        <PlatformNotice>
          You can continue required supporting tasks without activating a paid personal subscription. Existing supporting relationships stay attached to the same identity if you later subscribe.
        </PlatformNotice>
      </PlatformSection>
    </main>
  );
}
