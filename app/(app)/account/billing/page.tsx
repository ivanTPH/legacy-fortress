"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

type BillingForm = {
  monthly_charge: string;
  billing_currency: string;
  payment_method_type: string;
  payment_method_last4: string;
  direct_debit_reference: string;
  standing_order_reference: string;
};

const EMPTY: BillingForm = {
  monthly_charge: "0",
  billing_currency: "GBP",
  payment_method_type: "card",
  payment_method_last4: "",
  direct_debit_reference: "",
  standing_order_reference: "",
};

export default function BillingPage() {
  const router = useRouter();
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
        router.replace("/signin");
        return;
      }

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
        });
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
        router.replace("/signin");
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
    <SettingsPageShell title="Billing and Account" subtitle="Review monthly charges and maintain payment metadata safely.">
      <SettingsCard title="Billing overview" description="Sensitive payment operations should run via secure server-side provider sessions.">
        {loading ? <div style={{ color: "#6b7280" }}>Loading...</div> : null}

        <div style={gridStyle}>
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
            Open secure billing portal
          </button>
          <StatusNote message={status} />
        </div>
      </SettingsCard>
    </SettingsPageShell>
  );
}
