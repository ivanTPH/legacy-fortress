"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Field,
  SettingsCard,
  SettingsPageShell,
  StatusNote,
  gridStyle,
  inputStyle,
  primaryBtn,
} from "../../components/settings/SettingsPrimitives";
import { supabase } from "../../../../lib/supabaseClient";
import { getSafeUserData } from "../../../../lib/auth/requireActiveUser";
import {
  ensureOwnerPlanProfile,
  getOwnerPlanLabel,
  getOwnerPlanSupportMessage,
  type OwnerPlanKey,
  type OwnerPlanStatus,
} from "../../../../lib/accountPlan";

type BillingForm = {
  monthly_charge: string;
  billing_currency: string;
  payment_method_type: string;
  payment_method_last4: string;
  direct_debit_reference: string;
  standing_order_reference: string;
  account_plan: OwnerPlanKey;
  plan_status: OwnerPlanStatus;
  plan_source: string;
  trial_ends_at: string;
  record_limit: string;
  invitation_limit: string;
};

const EMPTY: BillingForm = {
  monthly_charge: "0",
  billing_currency: "GBP",
  payment_method_type: "card",
  payment_method_last4: "",
  direct_debit_reference: "",
  standing_order_reference: "",
  account_plan: "starter",
  plan_status: "active",
  plan_source: "manual",
  trial_ends_at: "",
  record_limit: "25",
  invitation_limit: "5",
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<BillingForm>(EMPTY);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      const ensured = await ensureOwnerPlanProfile(supabase, userData.user.id);
      const { data, error } = await supabase
        .from("billing_profiles")
        .select("monthly_charge,billing_currency,payment_method_type,payment_method_last4,direct_debit_reference,standing_order_reference")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setStatus(`⚠️ ${error.message}`);
      } else if (data) {
        const row = data as {
          monthly_charge?: number | null;
          billing_currency?: string | null;
          payment_method_type?: string | null;
          payment_method_last4?: string | null;
          direct_debit_reference?: string | null;
          standing_order_reference?: string | null;
        };

        setForm({
          monthly_charge: String(row.monthly_charge ?? 0),
          billing_currency: row.billing_currency ?? "GBP",
          payment_method_type: row.payment_method_type ?? "card",
          payment_method_last4: row.payment_method_last4 ?? "",
          direct_debit_reference: row.direct_debit_reference ?? "",
          standing_order_reference: row.standing_order_reference ?? "",
          account_plan: ensured.accountPlan,
          plan_status: ensured.planStatus,
          plan_source: ensured.planSource,
          trial_ends_at: ensured.trialEndsAt ?? "",
          record_limit: String(ensured.recordLimit ?? ""),
          invitation_limit: String(ensured.invitationLimit ?? ""),
        });
      } else {
        setForm((current) => ({
          ...current,
          account_plan: ensured.accountPlan,
          plan_status: ensured.planStatus,
          plan_source: ensured.planSource,
          trial_ends_at: ensured.trialEndsAt ?? "",
          record_limit: String(ensured.recordLimit ?? ""),
          invitation_limit: String(ensured.invitationLimit ?? ""),
        }));
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const save = async () => {
    setSaving(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await getSafeUserData(supabase);
      if (authError || !userData.user) {
        router.replace("/sign-in");
        return;
      }

      const { error } = await supabase.from("billing_profiles").upsert(
        {
          user_id: userData.user.id,
          monthly_charge: Number(form.monthly_charge || 0),
          billing_currency: form.billing_currency || "GBP",
          payment_method_type: form.payment_method_type || "card",
          payment_method_last4: form.payment_method_last4 || null,
          direct_debit_reference: form.direct_debit_reference || null,
          standing_order_reference: form.standing_order_reference || null,
          account_plan: form.account_plan,
          plan_status: form.plan_status,
          plan_source: form.plan_source || "manual",
          trial_ends_at: form.trial_ends_at || null,
          record_limit: Number(form.record_limit || 0) || null,
          invitation_limit: Number(form.invitation_limit || 0) || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
      setStatus("✅ Billing profile saved.");
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const openBillingPortal = async () => {
    setStatus("");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setStatus(`⚠️ ${body.error ?? "Billing portal unavailable."}`);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setStatus("⚠️ Billing portal unavailable.");
    }
  };

  return (
    <SettingsPageShell title="Subscription and billing" subtitle="Review owner plan status, subscription readiness, and billing controls in one place.">
      <SettingsCard title="Subscription overview" description="Review the current owner plan, live status labels, and the secure subscription-management entry point without exposing provider secrets in the client.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}
        {searchParams.get("reason") === "plan-limit" ? (
          <div style={{ marginBottom: 14, padding: 12, border: "1px solid #fecaca", borderRadius: 14, background: "#fff1f2", color: "#991b1b", fontSize: 13 }}>
            Your current plan limit was reached. Review this subscription panel to upgrade or manage billing before sending more invites or saving additional records.
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10, marginBottom: 14, padding: 14, border: "1px solid #e5e7eb", borderRadius: 14, background: "#f8fafc" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...primaryBtn, cursor: "default" }}>{getOwnerPlanLabel(form.account_plan)}</span>
            <span style={{ ...inputStyle, cursor: "default", width: "auto", paddingInline: 12 }}>{form.plan_status.replace(/_/g, " ")}</span>
          </div>
          <div style={{ color: "#475569", fontSize: 14 }}>
            {getOwnerPlanSupportMessage({
              userId: "",
              accountPlan: form.account_plan,
              planStatus: form.plan_status,
              planSource: form.plan_source,
              trialEndsAt: form.trial_ends_at || null,
              recordLimit: Number(form.record_limit || 0) || null,
              invitationLimit: Number(form.invitation_limit || 0) || null,
              monthlyCharge: Number(form.monthly_charge || 0),
              billingCurrency: form.billing_currency || "GBP",
            })}
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Linked invitees stay separate from your owner subscription. Use the secure subscription controls below to upgrade or manage billing when entitlements change.
          </div>
        </div>

        <div style={gridStyle}>
          <Field label="Current plan">
            <select value={form.account_plan} onChange={(e) => setForm({ ...form, account_plan: e.target.value as OwnerPlanKey })} style={inputStyle}>
              <option value="starter">Starter</option>
              <option value="premium">Premium</option>
            </select>
          </Field>
          <Field label="Plan status">
            <select value={form.plan_status} onChange={(e) => setForm({ ...form, plan_status: e.target.value as OwnerPlanStatus })} style={inputStyle}>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="past_due">Past due</option>
              <option value="canceled">Canceled</option>
            </select>
          </Field>
          <Field label="Record allowance">
            <input type="number" value={form.record_limit} onChange={(e) => setForm({ ...form, record_limit: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Invitation allowance">
            <input type="number" value={form.invitation_limit} onChange={(e) => setForm({ ...form, invitation_limit: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Monthly charge">
            <input type="number" step="0.01" value={form.monthly_charge} onChange={(e) => setForm({ ...form, monthly_charge: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Currency">
            <select value={form.billing_currency} onChange={(e) => setForm({ ...form, billing_currency: e.target.value })} style={inputStyle}>
              <option value="GBP">GBP</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          <Field label="Payment method type">
            <select value={form.payment_method_type} onChange={(e) => setForm({ ...form, payment_method_type: e.target.value })} style={inputStyle}>
              <option value="card">Card</option>
              <option value="direct_debit">Direct Debit</option>
              <option value="standing_order">Standing Order</option>
            </select>
          </Field>
          <Field label="Payment method last 4">
            <input value={form.payment_method_last4} onChange={(e) => setForm({ ...form, payment_method_last4: e.target.value.replace(/\D/g, "").slice(0, 4) })} style={inputStyle} />
          </Field>
          <Field label="Direct Debit reference">
            <input value={form.direct_debit_reference} onChange={(e) => setForm({ ...form, direct_debit_reference: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Standing Order reference">
            <input value={form.standing_order_reference} onChange={(e) => setForm({ ...form, standing_order_reference: e.target.value })} style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button type="button" style={primaryBtn} disabled={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save billing settings"}
          </button>
          <button type="button" style={inputStyle} onClick={() => void openBillingPortal()}>
            Upgrade plan / Manage subscription
          </button>
          <StatusNote message={status} />
        </div>
      </SettingsCard>
    </SettingsPageShell>
  );
}
