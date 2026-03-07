"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { financialSubtypes, financialTypeOptions, optionLabel } from "../../../../lib/categoryConfig";
import { computeFinancialTotals } from "../../../../lib/financialTotals";
import { formatCurrency } from "../../../../lib/currency";
import { supabase } from "../../../../lib/supabaseClient";
import { getBankLogoFromRecord } from "../../../../lib/bankLogos";
import FinancialSummary from "./components/FinancialSummary";
import BankLogo from "../../components/BankLogo";

type FinancialAccount = {
  id: string;
  account_type: string;
  account_subtype: string;
  custom_account_type: string;
  custom_account_subtype: string;
  provider: string;
  account_name: string;
  account_number_last4: string;
  currency: string;
  balance: number;
  notes: string;
};

type FinancialAccountRow = {
  id: string;
  account_type: string | null;
  account_subtype: string | null;
  custom_account_type: string | null;
  custom_account_subtype: string | null;
  provider: string | null;
  account_name: string | null;
  account_number_last4: string | null;
  currency: string | null;
  balance: number | null;
  notes: string | null;
};

const EMPTY: Omit<FinancialAccount, "id"> = {
  account_type: "bank",
  account_subtype: "",
  custom_account_type: "",
  custom_account_subtype: "",
  provider: "",
  account_name: "",
  account_number_last4: "",
  currency: "GBP",
  balance: 0,
  notes: "",
};

function mapFinancialAccountRow(row: FinancialAccountRow): FinancialAccount {
  return {
    id: row.id,
    account_type: row.account_type ?? "bank",
    account_subtype: row.account_subtype ?? "",
    custom_account_type: row.custom_account_type ?? "",
    custom_account_subtype: row.custom_account_subtype ?? "",
    provider: row.provider ?? "",
    account_name: row.account_name ?? "",
    account_number_last4: row.account_number_last4 ?? "",
    currency: row.currency ?? "GBP",
    balance: Number(row.balance ?? 0),
    notes: row.notes ?? "",
  };
}

function emptyExtractedForm() {
  return {
    account_type: "bank",
    provider: "",
    account_name: "",
    sort_code: "",
    account_number: "",
    balance: "",
    statement_date: "",
  };
}

export default function FinancialVaultPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<FinancialAccount[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [extractedForm, setExtractedForm] = useState(emptyExtractedForm());

  const totals = useMemo(() => computeFinancialTotals(items), [items]);
  // MVP assumption: totals are shown in a single display currency.
  const displayCurrency = items.find((item) => item.currency)?.currency || form.currency || "GBP";

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      try {
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const user = userData.user;
        if (!user) {
          router.replace("/signin");
          return;
        }

        const { data, error } = await supabase
          .from("financial_accounts")
          .select("id,account_type,account_subtype,custom_account_type,custom_account_subtype,provider,account_name,account_number_last4,currency,balance,notes")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setStatus("⚠️ Could not load financial accounts yet (table may not exist).");
          setItems([]);
        } else {
          setItems(((data ?? []) as FinancialAccountRow[]).map(mapFinancialAccountRow));
        }
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load financial accounts: ${error instanceof Error ? error.message : "Unknown error"}`);
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [router]);

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setStatus("");
    setShowAccountForm(false);
  };

  const startEdit = (a: FinancialAccount) => {
    setShowAccountForm(true);
    setEditingId(a.id);
    setForm({
      account_type: a.account_type,
      account_subtype: a.account_subtype,
      custom_account_type: a.custom_account_type,
      custom_account_subtype: a.custom_account_subtype,
      provider: a.provider,
      account_name: a.account_name,
      account_number_last4: a.account_number_last4,
      currency: a.currency,
      balance: Number(a.balance || 0),
      notes: a.notes,
    });
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reloadAccounts = async (userId: string) => {
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("id,account_type,account_subtype,custom_account_type,custom_account_subtype,provider,account_name,account_number_last4,currency,balance,notes")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setStatus("✅ Saved, but refresh failed");
      return;
    }

    setItems(((data ?? []) as FinancialAccountRow[]).map(mapFinancialAccountRow));
  };

  const saveAccount = async (account: Omit<FinancialAccount, "id">, forceInsert = false) => {
    setSaving(true);
    setStatus("");

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;
      if (!user) {
        router.replace("/signin");
        return;
      }

      const payload = {
        user_id: user.id,
        account_type: account.account_type,
        account_subtype: account.account_subtype || null,
        custom_account_type: account.account_type === "other" ? account.custom_account_type || null : null,
        custom_account_subtype:
          account.account_subtype === "other" ? account.custom_account_subtype || null : null,
        provider: account.provider || null,
        account_name: account.account_name || null,
        account_number_last4: account.account_number_last4 || null,
        currency: account.currency || "GBP",
        balance: Number(account.balance || 0),
        notes: account.notes || null,
        updated_at: new Date().toISOString(),
      };

      const res =
        editingId && !forceInsert
          ? await supabase.from("financial_accounts").update(payload).eq("id", editingId).eq("user_id", user.id)
          : await supabase.from("financial_accounts").insert(payload);

      if (res.error) {
        setStatus("❌ Save failed: " + res.error.message);
        return;
      }

      await reloadAccounts(user.id);
      if (!forceInsert) resetForm();
      setStatus("✅ Saved");
    } catch (error) {
      setStatus(`❌ Save failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    await saveAccount(form);
  };

  const remove = async (id: string) => {
    setStatus("");
    const ok = window.confirm("Delete this financial account?");
    if (!ok) return;

    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = userData.user;
      if (!user) {
        router.replace("/signin");
        return;
      }

      const { error } = await supabase.from("financial_accounts").delete().eq("id", id).eq("user_id", user.id);
      if (error) {
        setStatus("❌ Delete failed: " + error.message);
        return;
      }

      setItems((current) => current.filter((x) => x.id !== id));
      if (editingId === id) resetForm();
      setStatus("✅ Deleted");
    } catch (error) {
      setStatus(`❌ Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1040 }}>
      <div>
        <h1 style={{ fontSize: 26, margin: 0 }}>Financial Vault</h1>
        <p style={{ marginTop: 6, color: "#6b7280" }}>
          Record bank accounts, savings, pensions, investments and liabilities so key financial
          information is easy to find.
        </p>
      </div>
      <FinancialSummary
        assets={totals.assets}
        liabilities={totals.liabilities}
        net={totals.net}
        currency={displayCurrency}
      />
      {!showAccountForm && status ? (
        <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div>
      ) : null}
      
   <section style={card}>
        <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
          <h2 style={cardTitle}>Your accounts</h2>
         <p style={cardText}>
  Your saved accounts appear here. Add one account at a time to keep things clear.
</p>

        </div>

        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No financial records added yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((a) => (
              <div key={a.id} style={rowStyle}>
                <div style={{ minWidth: 0, display: "flex", alignItems: "flex-start" }}>
                  <BankLogo bank={{ bank_name: a.provider, provider: a.provider }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>
                      {a.account_name || "(Unnamed account)"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                      {getBankLogoFromRecord({ bank_name: a.provider, provider: a.provider }).bankLabel}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
                      {[
                        a.account_type === "other" ? a.custom_account_type || "Other account" : labelForType(a.account_type),
                        a.account_subtype
                          ? a.account_subtype === "other"
                            ? a.custom_account_subtype || "Other subtype"
                            : optionLabel(
                                financialSubtypes[a.account_type] ?? [],
                                a.account_subtype,
                                a.account_subtype,
                              )
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {a.account_number_last4 ? (
                      <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
                        ****{a.account_number_last4}
                      </div>
                    ) : null}
                  </div>
                  {a.notes ? (
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>{a.notes}</div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800 }}>
                    {formatCurrency(Number(a.balance || 0), a.currency || displayCurrency)}
                  </div>
                  <button onClick={() => startEdit(a)} style={ghostBtn}>
                    Edit
                  </button>
                  <button onClick={() => remove(a.id)} style={ghostBtn}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowAccountForm(true)}
            style={primaryBtn}
          >
            Add account
          </button>

          {showAccountForm && (
            <button
              onClick={() => {
                resetForm();
                setShowAccountForm(false);
              }}
              style={ghostBtn}
            >
              Cancel
            </button>
          )}
        </div>
      </section>



      {showAccountForm && (
      <div style={twoCol}>
        <section style={card}>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={cardTitle}>{editingId ? "Edit financial account" : "Financial accounts"}</h2>
            <p style={cardText}>
              Add important accounts and approximate balances. Saved entries will appear below.
            </p>
          </div>

          <div style={fieldGrid}>
            <Field label="Account type">
              <select
                value={form.account_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    account_type: e.target.value,
                    account_subtype: "",
                    custom_account_type: e.target.value === "other" ? form.custom_account_type : "",
                    custom_account_subtype: "",
                  })
                }
                style={inputStyle}
              >
                {financialTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            {form.account_type === "other" ? (
              <Field label="Custom account type">
                <input
                  value={form.custom_account_type}
                  onChange={(e) => setForm({ ...form, custom_account_type: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Family trust account"
                />
              </Field>
            ) : null}

            {(financialSubtypes[form.account_type] ?? []).length > 0 ? (
              <Field label="Account subtype">
                <select
                  value={form.account_subtype}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      account_subtype: e.target.value,
                      custom_account_subtype: e.target.value === "other" ? form.custom_account_subtype : "",
                    })
                  }
                  style={inputStyle}
                >
                  <option value="">Select subtype</option>
                  {(financialSubtypes[form.account_type] ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {form.account_subtype === "other" ? (
              <Field label="Custom account subtype">
                <input
                  value={form.custom_account_subtype}
                  onChange={(e) => setForm({ ...form, custom_account_subtype: e.target.value })}
                  style={inputStyle}
                  placeholder="e.g. Employer legacy plan"
                />
              </Field>
            ) : null}

            <Field label="Provider / institution">
              <input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Barclays"
              />
            </Field>

            <Field label="Account name">
              <input
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                style={inputStyle}
                placeholder="e.g. Joint current account"
              />
            </Field>

            <Field label="Last 4 digits">
              <input
                value={form.account_number_last4}
                onChange={(e) => setForm({ ...form, account_number_last4: e.target.value })}
                style={inputStyle}
                placeholder="1234"
              />
            </Field>

            <Field label="Currency">
              <input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                style={inputStyle}
                placeholder="GBP"
              />
            </Field>

            <Field label="Approximate value">
              <input
                type="number"
                step="0.01"
                value={String(form.balance)}
                onChange={(e) => setForm({ ...form, balance: Number(e.target.value) })}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Notes">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={inputStyle}
              placeholder="Optional notes"
            />
          </Field>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? "Saving..." : editingId ? "Update account" : "Save account"}
            </button>

            {editingId && (
              <button onClick={resetForm} style={ghostBtn}>
                Cancel
              </button>
            )}

            {status && <span style={{ color: "#6b7280", fontSize: 13 }}>{status}</span>}
          </div>

          {status.includes("table may not exist") && (
            <div style={{ color: "#6b7280", fontSize: 13 }}>
              The layout is ready. Next we can create the underlying Supabase table if needed.
            </div>
          )}
        </section>

<section style={card}>
  <div style={{ display: "grid", gap: 4 }}>
    <h2 style={cardTitle}>Upload statement</h2>
    <p style={cardText}>
      Upload a bank statement or financial document, review the extracted details,
      then save the account securely.
    </p>
  </div>

  <div
    style={{
      border: "1px dashed #d1d5db",
      borderRadius: 14,
      padding: 16,
      background: "#f9fafb",
      display: "grid",
      gap: 10,
    }}
  >
    <label style={{ display: "grid", gap: 8 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>
        Choose PDF, JPG or PNG statement
      </span>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const baseName = file.name.replace(/\.[^/.]+$/, "");
            setUploadedFileName(file.name);
            setExtractedForm({ ...emptyExtractedForm(), provider: baseName });
          }}
        style={inputStyle}
      />
    </label>

    {uploadedFileName ? (
      <div style={softNote}>
        Selected file: <strong>{uploadedFileName}</strong>
      </div>
    ) : (
      <div style={softNote}>
        No file selected yet.
      </div>
    )}
  </div>

  {uploadedFileName && (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ fontWeight: 800 }}>Review extracted details</div>

      <div style={fieldGrid}>
        <Field label="Account type">
          <select
            value={extractedForm.account_type}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, account_type: e.target.value })
            }
            style={inputStyle}
          >
            {financialTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
    
          </select>
        </Field>

        <Field label="Provider / bank name">
          <input
            value={extractedForm.provider}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, provider: e.target.value })
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Account name">
          <input
            value={extractedForm.account_name}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, account_name: e.target.value })
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Sort code">
          <input
            value={extractedForm.sort_code}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, sort_code: e.target.value })
            }
            style={inputStyle}
            placeholder="12-34-56"
          />
        </Field>

        <Field label="Account number">
          <input
            value={extractedForm.account_number}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, account_number: e.target.value })
            }
            style={inputStyle}
          />
        </Field>

        <Field label="Value">
          <input
            type="number"
            step="0.01"
            value={extractedForm.balance}
            onChange={(e) =>
              setExtractedForm({ ...extractedForm, balance: e.target.value })
            }
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Statement date">
        <input
          value={extractedForm.statement_date}
          onChange={(e) =>
            setExtractedForm({ ...extractedForm, statement_date: e.target.value })
          }
          style={inputStyle}
          placeholder="DD/MM/YYYY"
        />
      </Field>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          onClick={async () => {
            const last4 = extractedForm.account_number.slice(-4);
            const notes = [
              extractedForm.sort_code
                ? `Sort code: ${extractedForm.sort_code}`
                : null,
              extractedForm.statement_date
                ? `Statement date: ${extractedForm.statement_date}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            const extractedAccount: Omit<FinancialAccount, "id"> = {
              account_type: extractedForm.account_type || "bank",
              account_subtype: "",
              custom_account_type: "",
              custom_account_subtype: "",
              provider: extractedForm.provider || "",
              account_name: extractedForm.account_name || "",
              account_number_last4: last4,
              currency: "GBP",
              balance: Number(extractedForm.balance || 0),
              notes,
            };

            await saveAccount(extractedAccount, true);

            setUploadedFileName("");
            setExtractedForm(emptyExtractedForm());
          }}
          style={primaryBtn}
        >
          Save extracted account
        </button>

        <button
          onClick={() => {
            setUploadedFileName("");
            setExtractedForm(emptyExtractedForm());
          }}
          style={ghostBtn}
        >
          Clear
        </button>
      </div>
      </div>
    )}
  </section>

      </div>
    )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 13, color: "#374151" }}>{label}</span>
      {children}
    </label>
  );
}

function labelForType(type: string) {
  switch (type) {
    case "bank":
      return "Bank account";
    case "savings":
      return "Savings";
    case "investment":
      return "Investment";
    case "pension":
      return "Pension";
    case "insurance":
      return "Insurance policy";
    case "crypto":
      return "Crypto";
    case "liability":
      return "Liability / debt";
    default:
      return "Other";
  }
}

const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  alignItems: "start",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const fieldGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const cardTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
};

const cardText: React.CSSProperties = {
  margin: 0,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const softNote: React.CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.5,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  fontSize: 15,
  background: "#fff",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 12,
  border: "1px solid #eee",
  borderRadius: 14,
  flexWrap: "wrap",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
};

const primaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
};
