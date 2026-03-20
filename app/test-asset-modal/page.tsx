"use client";

import { useState } from "react";
import AssetCreateModal from "@/components/assets/AssetCreateModal";

export default function TestAssetModalPage() {
  const [open, setOpen] = useState(false);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Asset Modal Test
      </h1>

      <button
        onClick={() => setOpen(true)}
        style={{
          border: "none",
          borderRadius: 10,
          padding: "12px 16px",
          background: "#0f172a",
          color: "#fff",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Open Asset Modal
      </button>

      <AssetCreateModal
        assetTypeId="bank-account"
        open={open}
        onClose={() => setOpen(false)}
      />
    </main>
  );
}