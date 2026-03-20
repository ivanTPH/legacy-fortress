import DynamicAssetForm from "@/components/assets/DynamicAssetForm";

export default function TestDynamicFormPage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Dynamic Asset Form Test
      </h1>
      <p style={{ marginBottom: 24, color: "#475569" }}>
        Testing the generated form for bank-account asset type.
      </p>

      <DynamicAssetForm assetTypeId="bank-account" />
    </main>
  );
}