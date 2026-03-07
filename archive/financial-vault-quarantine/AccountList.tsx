type FinancialAccount = {
  id: string;
  account_type: string;
  provider: string;
  account_name: string;
  account_number_last4: string;
  currency: string;
  balance: number;
  notes: string;
};

type Props = {
  items: FinancialAccount[];
  startEdit: (item: FinancialAccount) => void;
  remove: (id: string) => void;
};

export default function AccountList({ items, startEdit, remove }: Props) {
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
        return "Insurance";
      case "crypto":
        return "Crypto";
      case "liability":
        return "Liability";
      default:
        return "Other";
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {items.map((a) => (
        <div
          key={a.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 14,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800 }}>
              {a.account_name || a.provider || "(Unnamed account)"}
            </div>

            <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>
              {[labelForType(a.account_type), a.provider,
                a.account_number_last4 ? `****${a.account_number_last4}` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>

            {a.notes ? (
              <div style={{ color: "#6b7280", fontSize: 13, marginTop: 6 }}>
                {a.notes}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800 }}>
              £{Number(a.balance || 0).toFixed(2)}
            </div>

            <button onClick={() => startEdit(a)}>Edit</button>
            <button onClick={() => remove(a.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}