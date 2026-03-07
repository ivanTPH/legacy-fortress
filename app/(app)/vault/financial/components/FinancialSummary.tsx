import { formatCurrency } from "../../../../../lib/currency";

type FinancialSummaryProps = {
  assets: number;
  liabilities: number;
  net: number;
  currency: string;
};

export default function FinancialSummary({ assets, liabilities, net, currency }: FinancialSummaryProps) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 18,
        background: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>Financial summary</div>
        <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
          Liabilities reduce the total automatically.
        </div>
        <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 4 }}>
          Totals assume all balances are in {currency}.
        </div>
      </div>

      <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Assets: {formatCurrency(assets, currency)}</div>
        <div style={{ fontSize: 13, color: "#6b7280" }}>Liabilities: {formatCurrency(liabilities, currency)}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Net: {formatCurrency(net, currency)}</div>
      </div>
    </div>
  );
}
