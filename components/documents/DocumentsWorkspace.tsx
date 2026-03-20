"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { waitForActiveUser } from "../../lib/auth/session";
import {
  createCanonicalAssetDocument,
  resolveCanonicalAssetDocumentContext,
  getStoredFileSignedUrl,
  isPrintableDocumentMimeType,
  loadCanonicalDocumentWorkspaceData,
  type CanonicalDocumentWorkspaceAsset,
  type CanonicalDocumentWorkspaceItem,
  type SupportedDocumentSectionKey,
} from "../../lib/assets/documentLinks";
import { supabase } from "../../lib/supabaseClient";
import { validateUploadFile } from "../../lib/validation/upload";
import { FileDropzone, FormField, SelectInput, TextInput } from "../forms/asset/AssetFormControls";
import {
  filterDiscoveryDocuments,
  formatDiscoveryCategoryLabel,
  formatDiscoverySectionLabel,
} from "../../lib/records/discovery";
import Icon from "../ui/Icon";

type DocumentsWorkspaceProps = {
  title: string;
  subtitle: string;
  sectionFilter?: SupportedDocumentSectionKey;
};

export default function DocumentsWorkspace({ title, subtitle, sectionFilter }: DocumentsWorkspaceProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [assets, setAssets] = useState<CanonicalDocumentWorkspaceAsset[]>([]);
  const [documents, setDocuments] = useState<CanonicalDocumentWorkspaceItem[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [selectedKind, setSelectedKind] = useState<"document" | "photo">("document");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [documentKindFilter, setDocumentKindFilter] = useState<"all" | "document" | "photo">("all");
  const [documentSectionFilter, setDocumentSectionFilter] = useState<"all" | SupportedDocumentSectionKey>(
    sectionFilter ?? "all",
  );

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      const user = await requireUser(router);
      if (!user) return;

      try {
        const result = await loadCanonicalDocumentWorkspaceData(supabase, {
          ownerUserId: user.id,
          sectionKeys: sectionFilter ? [sectionFilter] : undefined,
        });
        if (!mounted) return;
        setAssets(result.assets);
        setDocuments(result.documents);
      } catch (error) {
        if (!mounted) return;
        setStatus(error instanceof Error ? `Could not load documents: ${error.message}` : "Could not load documents.");
        setAssets([]);
        setDocuments([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [router, sectionFilter]);

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.id,
        label: `${asset.parentLabel} · ${formatDiscoverySectionLabel(asset.sectionKey)} · ${formatDiscoveryCategoryLabel(asset.categoryKey)}`,
      })),
    [assets],
  );

  const filteredDocuments = useMemo(
    () =>
      filterDiscoveryDocuments(documents, {
        query: search,
        kindFilter: documentKindFilter,
        sectionFilter: sectionFilter ?? documentSectionFilter,
      }),
    [documentKindFilter, documentSectionFilter, documents, search, sectionFilter],
  );
  const sectionOptions = useMemo(
    () => [
      { value: "all", label: "All sections" },
      ...Array.from(new Set(assets.map((asset) => asset.sectionKey)))
        .filter(Boolean)
        .map((value) => ({
          value,
          label: formatDiscoverySectionLabel(value),
        })),
    ],
    [assets],
  );
  const hasDocumentFilters = Boolean(search.trim()) || documentKindFilter !== "all" || (!sectionFilter && documentSectionFilter !== "all");

  async function reloadDocuments() {
    const user = await requireUser(router);
    if (!user) return;
    try {
      const result = await loadCanonicalDocumentWorkspaceData(supabase, {
        ownerUserId: user.id,
        sectionKeys: sectionFilter ? [sectionFilter] : undefined,
      });
      setAssets(result.assets);
      setDocuments(result.documents);
    } catch (error) {
      setStatus(error instanceof Error ? `Could not refresh documents: ${error.message}` : "Could not refresh documents.");
    }
  }

  async function handleUpload() {
    setFormError("");
    const user = await requireUser(router);
    if (!user) return;

    if (!selectedAssetId) {
      setFormError("Select an asset before linking a document.");
      return;
    }
    if (!pendingFile) {
      setFormError("Choose a file before linking a document.");
      return;
    }
    if (!reviewConfirmed) {
      setFormError("Confirm the extracted details and asset link before saving.");
      return;
    }

    const validation = validateUploadFile(pendingFile, {
      allowedMimeTypes:
        selectedKind === "photo" ? ["image/jpeg", "image/png"] : ["application/pdf", "image/jpeg", "image/png"],
      maxBytes: 15 * 1024 * 1024,
    });
    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }

    setSaving(true);
    const asset = assets.find((item) => item.id === selectedAssetId) ?? null;
    const resolvedContext = asset
      ? await resolveCanonicalAssetDocumentContext(supabase, {
          assetId: asset.id,
          ownerUserId: user.id,
        })
      : null;

    if (!resolvedContext) {
      setSaving(false);
      setFormError("Document link blocked because the selected asset context could not be resolved.");
      return;
    }

    const result = await createCanonicalAssetDocument(supabase, {
      context: resolvedContext,
      file: pendingFile,
      kind: selectedKind,
    });

    setSaving(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setPendingFile(null);
    setReviewConfirmed(false);
    setStatus(`Document linked to ${asset?.parentLabel ?? "the selected asset"}.`);
    await reloadDocuments();
  }

  async function openDocument(item: CanonicalDocumentWorkspaceItem) {
    const signedUrl = await getStoredFileSignedUrl(supabase, {
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      expiresInSeconds: 120,
    });
    if (!signedUrl) {
      setStatus(`Could not open ${item.fileName || "this file"}.`);
      return;
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer");
  }

  async function downloadDocument(item: CanonicalDocumentWorkspaceItem) {
    const signedUrl = await getStoredFileSignedUrl(supabase, {
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      expiresInSeconds: 120,
    });
    if (!signedUrl) {
      setStatus(`Could not download ${item.fileName || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`Could not download file: ${response.status} ${response.statusText}`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = item.fileName || "document";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error) {
      setStatus(`Could not download file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function printDocument(item: CanonicalDocumentWorkspaceItem) {
    if (!isPrintableDocumentMimeType(item.mimeType)) {
      setStatus("Print is available for PDF and image files only.");
      return;
    }

    const signedUrl = await getStoredFileSignedUrl(supabase, {
      storageBucket: item.storageBucket,
      storagePath: item.storagePath,
      expiresInSeconds: 120,
    });
    if (!signedUrl) {
      setStatus(`Could not print ${item.fileName || "this file"}.`);
      return;
    }

    try {
      const response = await fetch(signedUrl);
      if (!response.ok) {
        setStatus(`Could not prepare file for print: ${response.status} ${response.statusText}`);
        return;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const printFrame = document.createElement("iframe");
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      document.body.appendChild(printFrame);
      printFrame.onload = () => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } finally {
          setTimeout(() => {
            URL.revokeObjectURL(objectUrl);
            printFrame.remove();
          }, 10_000);
        }
      };
      printFrame.src = objectUrl;
    } catch (error) {
      setStatus(`Could not print file: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async function removeDocument(item: CanonicalDocumentWorkspaceItem) {
    const confirmed = window.confirm(`Remove "${item.fileName}" from ${item.parentLabel}?`);
    if (!confirmed) return;

    const user = await requireUser(router);
    if (!user) return;

    const storageResult = await supabase.storage.from(item.storageBucket).remove([item.storagePath]);
    if (storageResult.error) {
      setStatus(`Could not remove file from storage: ${storageResult.error.message}`);
      return;
    }

    const deleteResult = await supabase.from("documents").delete().eq("id", item.id).eq("owner_user_id", user.id);
    if (deleteResult.error) {
      setStatus(`File removed, but document delete failed: ${deleteResult.error.message}`);
      return;
    }

    setStatus("Document removed.");
    await reloadDocuments();
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
        <p style={{ margin: 0, color: "#64748b" }}>{subtitle}</p>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Documents are always linked through the canonical chain: organisation to wallet to asset to document.
        </div>
      </div>

      <div style={workspaceCardStyle}>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <Icon name="upload_file" size={18} />
            Link a document
          </div>
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Choose the parent asset first, then drag in the file you want to attach.
          </div>
        </div>

        <div className="lf-content-grid">
          <FormField
            label="Parent asset"
            iconName="account_tree"
            required
            error={!selectedAssetId && formError ? "A canonical parent asset is required." : undefined}
            helpText="Files cannot be saved here without a linked asset."
          >
            <SelectInput
              value={selectedAssetId}
              onChange={(value) => {
                setSelectedAssetId(value);
                setFormError("");
              }}
              options={assetOptions}
              disabled={loading || saving || assets.length === 0}
              placeholder={assets.length === 0 ? "Create an asset first" : "Select an asset"}
            />
          </FormField>

          <FormField label="Document kind" iconName="category" required helpText="Use Photo for images you want grouped as photos.">
            <SelectInput
              value={selectedKind}
              onChange={(value) => {
                setSelectedKind(value === "photo" ? "photo" : "document");
                setFormError("");
              }}
              options={[
                { value: "document", label: "Document" },
                { value: "photo", label: "Photo" },
              ]}
              disabled={saving}
            />
          </FormField>
        </div>

        <FormField
          label="File"
          iconName="description"
          required
          error={!pendingFile && formError ? "Choose a file to upload." : undefined}
          helpText={selectedKind === "photo" ? "Accepted formats: JPG, PNG up to 15MB." : "Accepted formats: PDF, JPG, PNG up to 15MB."}
        >
          <FileDropzone
            label={pendingFile ? "Replace selected file" : "Drop a file here"}
            accept={
              selectedKind === "photo"
                ? ".jpg,.jpeg,.png,image/jpeg,image/png"
                : ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            }
            file={pendingFile}
            onFileSelect={(file) => {
              setPendingFile(file);
              setFormError("");
            }}
            onClear={() => {
              setPendingFile(null);
              setFormError("");
            }}
            disabled={saving}
          />
        </FormField>

        <label style={confirmWrapStyle}>
          <input
            type="checkbox"
            checked={reviewConfirmed}
            onChange={(event) => {
              setReviewConfirmed(event.target.checked);
              setFormError("");
            }}
            disabled={saving}
          />
          I confirm this file, its extracted details, and the selected parent asset are correct before linking.
        </label>
        {formError ? <div style={{ color: "#b91c1c", fontSize: 12 }}>{formError}</div> : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtnStyle} onClick={() => void handleUpload()} disabled={saving || loading || assets.length === 0}>
            <Icon name="save" size={16} />
            {saving ? "Linking..." : "Link document"}
          </button>
          {status ? <div style={{ color: "#475569", fontSize: 13, alignSelf: "center" }}>{status}</div> : null}
        </div>
      </div>

      <div style={workspaceCardStyle}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
          <Icon name="folder_managed" size={18} />
          Linked documents
        </div>
        <div className="lf-content-grid">
          <FormField label="Search" iconName="search" helpText="Search file names, parent assets, and document types.">
            <TextInput value={search} onChange={setSearch} placeholder="Find document, parent asset, or section" />
          </FormField>
          {!sectionFilter ? (
            <FormField label="Section" iconName="filter_alt">
              <SelectInput value={documentSectionFilter} onChange={(value) => setDocumentSectionFilter((value || "all") as typeof documentSectionFilter)} options={sectionOptions} />
            </FormField>
          ) : null}
          <FormField label="Kind" iconName="category">
            <SelectInput
              value={documentKindFilter}
              onChange={(value) => setDocumentKindFilter((value || "all") as typeof documentKindFilter)}
              options={[
                { value: "all", label: "All kinds" },
                { value: "document", label: "Documents" },
                { value: "photo", label: "Photos" },
              ]}
            />
          </FormField>
        </div>
        {loading ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>Loading documents...</div>
        ) : filteredDocuments.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: 13 }}>
            {hasDocumentFilters ? "No linked documents match the current search or filters." : "No linked documents yet."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredDocuments.map((item) => (
              <article key={item.id} style={documentCardStyle}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Icon name={item.documentKind === "photo" ? "photo_camera" : "description"} size={18} />
                    <button type="button" style={inlineLinkBtn} onClick={() => void openDocument(item)}>
                      {item.fileName}
                    </button>
                  </div>
                  <div style={{ color: "#475569", fontSize: 13 }}>
                    Linked to <strong>{item.parentLabel}</strong> in {formatDiscoverySectionLabel(item.sectionKey)} / {formatDiscoveryCategoryLabel(item.categoryKey)}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>
                    {item.documentKind === "photo" ? "Photo" : "Document"} · {formatDate(item.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={miniGhostBtn} onClick={() => void openDocument(item)}>
                    <Icon name="open_in_new" size={16} />
                    View
                  </button>
                  <button type="button" style={miniGhostBtn} onClick={() => void downloadDocument(item)}>
                    <Icon name="download" size={16} />
                    Download
                  </button>
                  <button type="button" style={miniGhostBtn} onClick={() => router.push(getAssetWorkspaceHref(item.sectionKey, item.categoryKey))}>
                    <Icon name="account_tree" size={16} />
                    Open asset
                  </button>
                  {isPrintableDocumentMimeType(item.mimeType) ? (
                    <button type="button" style={miniGhostBtn} onClick={() => void printDocument(item)}>
                      <Icon name="print" size={16} />
                      Print
                    </button>
                  ) : null}
                  <button type="button" style={dangerGhostBtn} onClick={() => void removeDocument(item)}>
                    <Icon name="delete" size={16} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

async function requireUser(router: ReturnType<typeof useRouter>) {
  const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
  if (!user) {
    router.replace("/signin");
    return null;
  }
  return user;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getAssetWorkspaceHref(sectionKey: string, categoryKey: string) {
  if (sectionKey === "finances") return "/finances/bank";
  if (sectionKey === "property") return "/property";
  if (sectionKey === "business") return "/business";
  if (sectionKey === "digital") return "/vault/digital";
  if (sectionKey === "personal" && categoryKey === "beneficiaries") return "/personal/beneficiaries";
  if (sectionKey === "personal" && categoryKey === "tasks") return "/personal/tasks";
  if (sectionKey === "personal" && categoryKey === "executors") return "/trust";
  if (sectionKey === "personal" && categoryKey === "wishes") return "/personal/wishes";
  return "/dashboard";
}

const workspaceCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
  display: "grid",
  gap: 12,
};

const documentCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const inlineLinkBtn: CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#0f172a",
  padding: 0,
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 700,
};

const miniGhostBtn: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  borderRadius: 10,
  padding: "7px 10px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  fontSize: 13,
};

const dangerGhostBtn: CSSProperties = {
  ...miniGhostBtn,
  color: "#991b1b",
  borderColor: "#fecaca",
  background: "#fff7f7",
};

const primaryBtnStyle: CSSProperties = {
  border: "1px solid #111827",
  background: "#111827",
  color: "#fff",
  borderRadius: 10,
  padding: "9px 12px",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};

const confirmWrapStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#334155",
  flexWrap: "wrap",
};
