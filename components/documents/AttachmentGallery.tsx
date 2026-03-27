"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Icon from "../ui/Icon";

export type AttachmentGalleryItem = {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt?: string;
  thumbnailUrl?: string;
  metaLabel?: string;
};

export function AttachmentGallerySummary<T extends AttachmentGalleryItem>({
  items,
  maxItems = 2,
}: {
  items: T[];
  maxItems?: number;
}) {
  const visibleItems = items.slice(0, maxItems);
  if (visibleItems.length === 0) return null;

  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
          {items.length} attachment{items.length === 1 ? "" : "s"}
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>Ready to open from this record</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {visibleItems.map((item, index) => {
          const image = isImageMime(item.mimeType);
          return (
            <div key={getAttachmentItemKey(item, index)} style={summaryCardStyle}>
              {image && item.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnailUrl}
                  alt={item.fileName || "Attachment preview"}
                  width={34}
                  height={34}
                  style={summaryThumbStyle}
                />
              ) : (
                <div style={summaryFileBadgeStyle}>
                  <Icon name={image ? "image" : "description"} size={14} />
                </div>
              )}
              <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.fileName || "Untitled file"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{formatMime(item.mimeType)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type AttachmentGalleryProps<T extends AttachmentGalleryItem> = {
  items: T[];
  emptyText: string;
  loadingText?: string;
  onResolvePreviewUrl: (item: T) => Promise<string | null>;
  onDownload?: (item: T) => void;
  onPrint?: (item: T) => void;
  onRemove?: (item: T) => void;
  onOpenRelated?: (item: T) => void;
  openRelatedLabel?: string;
};

type PreviewState<T extends AttachmentGalleryItem> = {
  item: T;
  url: string;
};

export default function AttachmentGallery<T extends AttachmentGalleryItem>({
  items,
  emptyText,
  loadingText = "Preparing preview...",
  onResolvePreviewUrl,
  onDownload,
  onPrint,
  onRemove,
  onOpenRelated,
  openRelatedLabel = "Open related record",
}: AttachmentGalleryProps<T>) {
  const [preview, setPreview] = useState<PreviewState<T> | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [previewError, setPreviewError] = useState("");

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
    [items],
  );

  async function openPreview(item: T) {
    setPreviewError("");
    setPreviewLoadingId(item.id);
    try {
      const url = await onResolvePreviewUrl(item);
      if (!url) {
        setPreviewError(`Could not open ${item.fileName || "this file"}.`);
        return;
      }
      setPreview({ item, url });
    } finally {
      setPreviewLoadingId("");
    }
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {sortedItems.length === 0 ? (
        <div style={{ color: "#64748b", fontSize: 13 }}>{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sortedItems.map((item, index) => {
            const image = isImageMime(item.mimeType);
            const printable = isPrintableMime(item.mimeType);
            return (
              <article key={getAttachmentItemKey(item, index)} style={cardStyle}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {image && item.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl}
                      alt={item.fileName || "Attachment preview"}
                      width={68}
                      height={68}
                      style={thumbStyle}
                    />
                  ) : (
                    <div style={fileBadgeStyle}>
                      <Icon name={image ? "image" : "description"} size={18} />
                    </div>
                  )}
                  <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{item.fileName || "Untitled file"}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>
                      {formatMime(item.mimeType)}
                      {item.createdAt ? ` · ${formatDate(item.createdAt)}` : ""}
                    </div>
                    {item.metaLabel ? <div style={{ color: "#475569", fontSize: 12 }}>{item.metaLabel}</div> : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" style={miniGhostBtn} onClick={() => void openPreview(item)}>
                    <Icon name="visibility" size={16} />
                    {previewLoadingId === item.id ? loadingText : isImageMime(item.mimeType) || isIframePreviewMime(item.mimeType) ? "Open preview" : "Open file"}
                  </button>
                  {onDownload ? (
                    <button type="button" style={miniGhostBtn} onClick={() => onDownload(item)}>
                      <Icon name="download" size={16} />
                      Download
                    </button>
                  ) : null}
                  {onOpenRelated ? (
                    <button type="button" style={miniGhostBtn} onClick={() => onOpenRelated(item)}>
                      <Icon name="account_tree" size={16} />
                      {openRelatedLabel}
                    </button>
                  ) : null}
                  {onPrint && printable ? (
                    <button type="button" style={miniGhostBtn} onClick={() => onPrint(item)}>
                      <Icon name="print" size={16} />
                      Print
                    </button>
                  ) : null}
                  {onRemove ? (
                    <button type="button" style={dangerGhostBtn} onClick={() => onRemove(item)}>
                      <Icon name="delete" size={16} />
                      Remove
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {previewError ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{previewError}</div> : null}

      {preview ? (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={`${preview.item.fileName} preview`}>
          <div style={dialogStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{preview.item.fileName || "Attachment preview"}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{formatMime(preview.item.mimeType)}</div>
              </div>
              <button type="button" style={miniGhostBtn} onClick={() => setPreview(null)}>
                <Icon name="close" size={16} />
                Close
              </button>
            </div>
            <div style={viewerStyle}>
              {isImageMime(preview.item.mimeType) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.url} alt={preview.item.fileName || "Attachment preview"} style={viewerImageStyle} />
              ) : isIframePreviewMime(preview.item.mimeType) ? (
                <iframe title={preview.item.fileName || "Attachment preview"} src={preview.url} style={viewerFrameStyle} />
              ) : (
                <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    This file cannot be previewed safely in the app yet. Download it to inspect it locally.
                  </div>
                  {onDownload ? (
                    <button type="button" style={miniGhostBtn} onClick={() => onDownload(preview.item)}>
                      <Icon name="download" size={16} />
                      Download file
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isImageMime(mimeType: string | null | undefined) {
  return String(mimeType ?? "").toLowerCase().startsWith("image/");
}

function isPrintableMime(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("image/");
}

function isIframePreviewMime(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("text/");
}

function getAttachmentItemKey(item: AttachmentGalleryItem, index = 0) {
  return [item.id, item.createdAt ?? "", item.fileName ?? "", index].join(":");
}

function formatMime(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").trim();
  if (!normalized) return "File";
  if (normalized === "application/pdf") return "PDF document";
  if (normalized.startsWith("image/")) return "Image";
  if (normalized === "application/msword") return "Word document";
  if (normalized.includes("spreadsheet") || normalized.includes("excel")) return "Spreadsheet";
  return normalized;
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const cardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 12,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const thumbStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 10,
  objectFit: "cover",
  border: "1px solid #dbeafe",
  background: "#f8fafc",
};

const fileBadgeStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
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

const summaryCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  borderRadius: 10,
  padding: "6px 8px",
  display: "flex",
  gap: 8,
  alignItems: "center",
  minWidth: 0,
  maxWidth: 260,
};

const summaryThumbStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  objectFit: "cover",
  border: "1px solid #dbeafe",
  background: "#fff",
  flexShrink: 0,
};

const summaryFileBadgeStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "#fff",
  border: "1px solid #e2e8f0",
  color: "#334155",
  flexShrink: 0,
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.72)",
  display: "grid",
  placeItems: "center",
  padding: 20,
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  width: "min(980px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#fff",
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 14,
  boxShadow: "0 30px 80px rgba(15, 23, 42, 0.24)",
};

const viewerStyle: CSSProperties = {
  minHeight: 320,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#f8fafc",
  padding: 12,
  display: "grid",
  placeItems: "center",
};

const viewerImageStyle: CSSProperties = {
  maxWidth: "100%",
  maxHeight: "72vh",
  borderRadius: 10,
  objectFit: "contain",
};

const viewerFrameStyle: CSSProperties = {
  width: "100%",
  minHeight: "72vh",
  border: "none",
  borderRadius: 10,
  background: "#fff",
};
