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
import {
  DOCUMENT_UPLOAD_ACCEPT,
  DOCUMENT_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_ACCEPT,
  IMAGE_UPLOAD_MIME_TYPES,
  validateUploadFile,
} from "../../lib/validation/upload";
import { ExtractionConfirmationPanel, FileDropzone, FormField, SelectInput, TextInput } from "../forms/asset/AssetFormControls";
import AttachmentGallery from "./AttachmentGallery";
import {
  filterDiscoveryDocuments,
  formatDiscoveryCategoryLabel,
  formatDiscoverySectionLabel,
} from "../../lib/records/discovery";
import Icon from "../ui/Icon";
import { useViewerAccess } from "../access/ViewerAccessContext";
import { canEditAssetForViewer, filterAssetIdsForViewer } from "../../lib/access-control/viewerAccess";
import InfoTip from "../ui/InfoTip";

type DocumentsWorkspaceProps = {
  title: string;
  subtitle: string;
  sectionFilter?: SupportedDocumentSectionKey;
  showPageHeading?: boolean;
};

export default function DocumentsWorkspace({ title, subtitle, sectionFilter, showPageHeading = false }: DocumentsWorkspaceProps) {
  const router = useRouter();
  const { viewer } = useViewerAccess();
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
  const canManageAnyDocuments = viewer.mode !== "linked" || viewer.editableAssetIds.length > 0;

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setStatus("");
      const user = await requireUser(router);
      if (!user) return;

      try {
        const result = await loadCanonicalDocumentWorkspaceData(supabase, {
          ownerUserId: viewer.targetOwnerUserId || user.id,
          sectionKeys: sectionFilter ? [sectionFilter] : undefined,
        });
        if (!mounted) return;
        const scopedAssets = filterAssetIdsForViewer(result.assets, viewer);
        const allowedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
        setAssets(scopedAssets);
        setDocuments(result.documents.filter((item) => allowedAssetIds.has(item.assetId)));
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
  }, [router, sectionFilter, viewer]);

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
        ownerUserId: viewer.targetOwnerUserId || user.id,
        sectionKeys: sectionFilter ? [sectionFilter] : undefined,
      });
      const scopedAssets = filterAssetIdsForViewer(result.assets, viewer);
      const allowedAssetIds = new Set(scopedAssets.map((asset) => asset.id));
      setAssets(scopedAssets);
      setDocuments(result.documents.filter((item) => allowedAssetIds.has(item.assetId)));
    } catch (error) {
      setStatus(error instanceof Error ? `Could not refresh documents: ${error.message}` : "Could not refresh documents.");
    }
  }

  async function handleUpload() {
    if (!canEditAssetForViewer(selectedAssetId, viewer)) {
      setFormError("This shared view is read-only. The vault owner controls changes.");
      return;
    }
    setFormError("");
    const user = await requireUser(router);
    if (!user) return;

    if (!selectedAssetId) {
      setFormError("Choose the saved record this document belongs to.");
      return;
    }
    if (!pendingFile) {
      setFormError("Choose a file to upload to your vault.");
      return;
    }
    if (!reviewConfirmed) {
      setFormError("Confirm the extracted details and asset link before saving.");
      return;
    }

    const validation = validateUploadFile(pendingFile, {
      allowedMimeTypes:
        selectedKind === "photo" ? IMAGE_UPLOAD_MIME_TYPES : DOCUMENT_UPLOAD_MIME_TYPES,
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
      setFormError("Upload paused: choose a saved record first so the file is stored with the right item.");
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
    setStatus(`Document uploaded securely to ${asset?.parentLabel ?? "the selected record"}.`);
    await reloadDocuments();
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
    if (!canEditAssetForViewer(item.assetId, viewer)) {
      setStatus("This shared view is read-only. The vault owner controls changes.");
      return;
    }
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

  async function replaceDocument(item: CanonicalDocumentWorkspaceItem, file: File) {
    if (!canEditAssetForViewer(item.assetId, viewer)) {
      setStatus("This shared view is read-only. The vault owner controls changes.");
      return;
    }
    const kind = file.type.toLowerCase().startsWith("image/") ? "photo" : "document";
    const validation = validateUploadFile(file, {
      allowedMimeTypes: kind === "photo" ? IMAGE_UPLOAD_MIME_TYPES : DOCUMENT_UPLOAD_MIME_TYPES,
      maxBytes: 15 * 1024 * 1024,
    });
    if (!validation.ok) {
      setStatus(`${validation.error}. Allowed: PDF, DOCX, XLSX, CSV, JPG, PNG up to 15MB.`);
      return;
    }

    const user = await requireUser(router);
    if (!user) return;
    const context = await resolveCanonicalAssetDocumentContext(supabase, {
      assetId: item.assetId,
      ownerUserId: user.id,
    });
    if (!context) {
      setStatus("Replace paused: choose a saved record first so the file is stored with the right item.");
      return;
    }

    setSaving(true);
    const replacement = await createCanonicalAssetDocument(supabase, {
      context,
      file,
      kind,
    });
    if (!replacement.ok) {
      setSaving(false);
      setStatus(replacement.error);
      return;
    }

    await supabase.storage.from(item.storageBucket).remove([item.storagePath]);
    const deleteResult = await supabase.from("documents").delete().eq("id", item.id).eq("owner_user_id", user.id);
    setSaving(false);
    if (deleteResult.error) {
      setStatus(`Replacement uploaded, but old document delete failed: ${deleteResult.error.message}`);
      await reloadDocuments();
      return;
    }

    setStatus(`Document replaced with ${file.name}.`);
    await reloadDocuments();
  }

  return (
    <section style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 6 }}>
        {showPageHeading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
            <InfoTip
              label={`Explain ${title}`}
              message="Link and review supporting documents here. Every file stays attached to its parent asset so people can understand what it belongs to."
            />
          </div>
        ) : null}
        <p style={{ margin: 0, color: "#64748b" }}>{subtitle}</p>
        <div style={{ color: "#64748b", fontSize: 13 }}>
          Files stay attached to the right record in your vault so trusted people can understand them when needed.
        </div>
        {viewer.mode === "linked" ? (
          <div style={linkedPanelChipStyle}>
            <Icon name="visibility_lock" size={14} />
            {viewer.readOnly ? "Read-only shared panel" : "Shared panel"}
          </div>
        ) : null}
      </div>

      {canManageAnyDocuments ? (
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
            error={!selectedAssetId && formError ? "Choose a saved record before uploading." : undefined}
            helpText="This keeps each document connected to the right item in your vault."
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
          helpText={selectedKind === "photo" ? "Accepted formats: JPG, PNG up to 15MB." : "Accepted formats: PDF, DOCX, XLSX, CSV, JPG, PNG up to 15MB."}
          >
            <FileDropzone
              label={pendingFile ? "Replace selected file" : "Drop a file here"}
              accept={
                selectedKind === "photo"
                  ? IMAGE_UPLOAD_ACCEPT
                  : DOCUMENT_UPLOAD_ACCEPT
              }
            file={pendingFile}
            helperText={selectedKind === "photo" ? "Drop a photo here or choose one from your device. JPG and PNG are supported up to 15MB." : "Drop a document here or choose one from your device. PDF, DOCX, XLSX, CSV, JPG, and PNG are supported up to 15MB."}
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

        <ExtractionConfirmationPanel
          status={pendingFile ? "ready" : "idle"}
          message={pendingFile ? "Check the selected file and parent asset before saving. Any extracted details remain editable before they become part of your vault." : "Choose a file first. If details can be read from it, you will still confirm them before saving."}
        >
          <label style={confirmWrapStyle}>
            <input
              type="checkbox"
              checked={reviewConfirmed}
              onChange={(event) => {
                setReviewConfirmed(event.target.checked);
                setFormError("");
              }}
              disabled={saving || !pendingFile}
            />
            I confirm this file and the selected parent asset are correct before linking.
          </label>
          {formError ? <div role="alert" style={{ color: "#b91c1c", fontSize: 12, fontWeight: 700 }}>{formError}</div> : null}
        </ExtractionConfirmationPanel>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={primaryBtnStyle} onClick={() => void handleUpload()} disabled={saving || loading || assets.length === 0}>
            <Icon name="save" size={16} />
            {saving ? "Linking..." : "Link document"}
          </button>
          {status ? <div style={{ color: "#475569", fontSize: 13, alignSelf: "center" }}>{status}</div> : null}
        </div>
      </div>
      ) : null}

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
          <AttachmentGallery
            items={filteredDocuments.map((item) => ({
              id: item.id,
              fileName: item.fileName,
              mimeType: item.mimeType,
              createdAt: item.createdAt,
              metaLabel: `Linked to ${item.parentLabel} in ${formatDiscoverySectionLabel(item.sectionKey)} / ${formatDiscoveryCategoryLabel(item.categoryKey)}`,
              document: item,
            }))}
            emptyText={hasDocumentFilters ? "No linked documents match the current search or filters." : "No linked documents yet."}
            onResolvePreviewUrl={(entry) => getStoredFileSignedUrl(supabase, {
              storageBucket: entry.document.storageBucket,
              storagePath: entry.document.storagePath,
              expiresInSeconds: 120,
            })}
            onDownload={(entry) => void downloadDocument(entry.document)}
            onPrint={(entry) => void printDocument(entry.document)}
            onReplace={(entry, file) => void replaceDocument(entry.document, file)}
            replaceAccept={DOCUMENT_UPLOAD_ACCEPT}
            onRemove={(entry) => {
              if (!canEditAssetForViewer(entry.document.assetId, viewer)) return;
              void removeDocument(entry.document);
            }}
            onOpenRelated={(entry) => router.push(getAssetWorkspaceHref(entry.document.sectionKey, entry.document.categoryKey))}
            openRelatedLabel="Open asset"
          />
        )}
      </div>
    </section>
  );
}

async function requireUser(router: ReturnType<typeof useRouter>) {
  const user = await waitForActiveUser(supabase, { attempts: 5, delayMs: 120 });
  if (!user) {
    router.replace("/sign-in");
    return null;
  }
  return user;
}

function getAssetWorkspaceHref(sectionKey: string, categoryKey: string) {
  if (sectionKey === "finances") return "/finances/bank";
  if (sectionKey === "property") return "/property";
  if (sectionKey === "business") return "/business";
  if (sectionKey === "digital") return "/vault/digital";
  if (sectionKey === "personal" && categoryKey === "beneficiaries") return "/personal/beneficiaries";
  if (sectionKey === "personal" && categoryKey === "tasks") return "/personal/tasks";
  if (sectionKey === "personal" && categoryKey === "executors") return "/contacts?group=executors";
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

const linkedPanelChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  width: "fit-content",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#475569",
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 700,
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
