"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BankLogo from "../../components/BankLogo";
import { getBankLogoFromRecord } from "../../../../lib/bankLogos";
import { formatCurrency } from "../../../../lib/currency";
import { supabase } from "../../../../lib/supabaseClient";

type BankAccountRow = {
  id: string;
  account_type: string | null;
  account_name: string | null;
  provider: string | null;
  account_number_last4: string | null;
  currency: string | null;
  balance: number | null;
};

type BankAccount = {
  id: string;
  account_type: string;
  account_name: string;
  provider: string;
  account_number_last4: string;
  currency: string;
  balance: number;
};

function mapRow(row: BankAccountRow): BankAccount {
  return {
    id: row.id,
    account_type: row.account_type ?? "bank",
    account_name: row.account_name ?? "",
    provider: row.provider ?? "",
    account_number_last4: row.account_number_last4 ?? "",
    currency: row.currency ?? "GBP",
    balance: Number(row.balance ?? 0),
  };
}

export default function FinancesBankPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<BankAccount[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData.user;
        if (!user) {
          router.replace("/signin");
          return;
        }

        const { data, error } = await supabase
          .from("financial_accounts")
          .select("id,account_type,account_name,provider,account_number_last4,currency,balance")
          .eq("user_id", user.id)
          .in("account_type", ["bank", "savings"])
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setStatus("⚠️ Could not load bank accounts yet.");
          setItems([]);
          return;
        }

        setItems(((data ?? []) as BankAccountRow[]).map(mapRow));
      } catch (error) {
        if (!mounted) return;
        setStatus(`⚠️ Could not load bank accounts: ${error instanceof Error ? error.message : "Unknown error"}`);
        setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const totalBalance = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.balance || 0), 0),
    [items],
  );

  const displayCurrency = items.find((item) => item.currency)?.currency || "GBP";

  return (
    <div style={{ display: "grid", gap: 14, maxWidth: 980 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28 }}>Finances · Bank</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280" }}>
          Review your current and savings accounts. Logos are shown when the provider is recognized.
        </p>
      </div>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 14,
          background: "#fff",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 700 }}>Bank accounts</div>
          <div style={{ color: "#6b7280", fontSize: 13 }}>
            Total: {formatCurrency(totalBalance, displayCurrency)}
          </div>
        </div>

        {loading ? <div style={{ color: "#6b7280" }}>Loading bank accounts...</div> : null}
        {!loading && !items.length ? <div style={{ color: "#6b7280" }}>No bank accounts added yet.</div> : null}
        {status ? <div style={{ color: "#6b7280", fontSize: 13 }}>{status}</div> : null}

        {items.map((account) => {
          const bank = getBankLogoFromRecord({ bank_name: account.provider, provider: account.provider });
          const typeLabel = account.account_type === "savings" ? "Savings Account" : "Current Account";

          return (
            <article
              key={account.id}
              style={{
                border: "1px solid #eef2f7",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", minWidth: 0 }}>
                <BankLogo bank={{ bank_name: account.provider, provider: account.provider }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>{account.account_name || "Unnamed account"}</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>{bank.bankLabel}</div>
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>{typeLabel}</div>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800 }}>{formatCurrency(account.balance, account.currency || displayCurrency)}</div>
                {account.account_number_last4 ? (
                  <div style={{ color: "#9ca3af", fontSize: 12 }}>****{account.account_number_last4}</div>
                ) : null}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
