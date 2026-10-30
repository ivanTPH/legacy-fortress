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
        border: "1px solid var(--lf-border)",
        borderRadius: 16,
        padding: 18,
        background: "var(--lf-surface-card)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>Financial summary</div>
        <div style={{ color: "var(--lf-text-secondary)", fontSize: 13, marginTop: 4 }}>
          Liabilities reduce the total automatically.
        </div>
        <div style={{ color: "var(--lf-text-secondary)", fontSize: 12, marginTop: 4 }}>
          Totals assume all balances are in {currency}.
        </div>
      </div>

      <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
        <div style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>Assets: {formatCurrency(assets, currency)}</div>
        <div style={{ fontSize: 13, color: "var(--lf-text-secondary)" }}>Liabilities: {formatCurrency(liabilities, currency)}</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Net: {formatCurrency(net, currency)}</div>
      </div>
    </div>
  );
}
