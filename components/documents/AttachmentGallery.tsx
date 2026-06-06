"use client";

import { useMemo, useState, type CSSProperties } from "react";
import dynamic from "next/dynamic";
import Icon from "../ui/Icon";

const DocumentPreviewDialog = dynamic(() => import("./DocumentPreviewDialog"), {
  ssr: false,
});

export type AttachmentGalleryItem = {
  id: string;
  fileName: string;
  mimeType: string;
  createdAt?: string;
  thumbnailUrl?: string;
  metaLabel?: string;
  statusLabel?: string;
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
          const fileKind = getFileTypeLabel(item.mimeType, item.fileName);
          return (
            <div key={getAttachmentItemKey(item, index)} style={summaryCardStyle}>
              <AttachmentVisual item={item} size="summary" />
              <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.fileName || "Untitled file"}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>{fileKind}</div>
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
  onReplace?: (item: T) => void;
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
  onReplace,
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
    <div className="lf-attachment-gallery" style={{ display: "grid", gap: 10 }}>
      {sortedItems.length === 0 ? (
        <div style={emptyStateStyle}>{emptyText}</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {sortedItems.map((item, index) => {
            const printable = isPrintableMime(item.mimeType);
            const fileKind = getFileTypeLabel(item.mimeType, item.fileName);
            return (
              <article key={getAttachmentItemKey(item, index)} className="lf-attachment-card" style={cardStyle}>
                <div className="lf-attachment-card-main" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <AttachmentVisual item={item} size="large" />
                  <div style={{ display: "grid", gap: 4, minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{item.fileName || "Untitled file"}</div>
                    <div style={metadataRowStyle}>
                      <span style={fileTypePillStyle}>{fileKind}</span>
                      {item.createdAt ? <span>Uploaded {formatDate(item.createdAt)}</span> : null}
                      {item.statusLabel ? <span style={statusPillStyle}>{item.statusLabel}</span> : null}
                    </div>
                    {item.metaLabel ? <div style={{ color: "#475569", fontSize: 12 }}>{item.metaLabel}</div> : null}
                  </div>
                </div>
                <div className="lf-attachment-actions" style={actionRowStyle}>
                  <AttachmentActionButton
                    icon="visibility"
                    label="View"
                    ariaLabel={
                      previewLoadingId === item.id
                        ? loadingText
                        : isImageMime(item.mimeType) || isIframePreviewMime(item.mimeType)
                          ? `Open preview for ${item.fileName || "this file"}`
                          : `Open ${item.fileName || "this file"}`
                    }
                    onClick={() => void openPreview(item)}
                  />
                  {onDownload ? (
                    <AttachmentActionButton icon="download" label="Download" ariaLabel={`Download ${item.fileName || "this file"}`} onClick={() => onDownload(item)} />
                  ) : null}
                  {onPrint && printable ? (
                    <AttachmentActionButton icon="print" label="Print" ariaLabel={`Print ${item.fileName || "this file"}`} onClick={() => onPrint(item)} />
                  ) : null}
                  {onReplace ? (
                    <AttachmentActionButton icon="upload_file" label="Replace" ariaLabel={`Replace ${item.fileName || "this file"}`} onClick={() => onReplace(item)} />
                  ) : null}
                  {onOpenRelated ? (
                    <AttachmentActionButton icon="open_in_new" label={openRelatedLabel} ariaLabel={openRelatedLabel} onClick={() => onOpenRelated(item)} />
                  ) : null}
                  {onRemove ? (
                    <AttachmentActionButton icon="delete" label="Remove" ariaLabel={`Remove ${item.fileName || "this file"}`} danger onClick={() => onRemove(item)} />
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {previewError ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{previewError}</div> : null}

      {preview ? (
        <DocumentPreviewDialog
          item={{
            fileName: preview.item.fileName || "Attachment preview",
            mimeType: preview.item.mimeType,
            previewUrl: preview.url,
            metaLabel: formatMime(preview.item.mimeType),
            helperText: !isImageMime(preview.item.mimeType) && !isIframePreviewMime(preview.item.mimeType)
              ? "This file cannot be previewed safely in the app yet. Download it to inspect it locally."
              : undefined,
          }}
          onClose={() => setPreview(null)}
        />
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

function AttachmentVisual<T extends AttachmentGalleryItem>({
  item,
  size,
}: {
  item: T;
  size: "summary" | "large";
}) {
  const visual = getAttachmentVisual(item);
  const dimensions = size === "large" ? { width: 68, height: 68 } : { width: 34, height: 34 };
  const imageStyle = size === "large" ? thumbStyle : summaryThumbStyle;
  const badgeStyle = size === "large" ? fileBadgeStyle : summaryFileBadgeStyle;

  if (visual.kind === "thumbnail" && item.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.thumbnailUrl}
        alt={visual.alt}
        width={dimensions.width}
        height={dimensions.height}
        style={imageStyle}
      />
    );
  }

  return (
    <div style={badgeStyle} aria-label={visual.alt} title={visual.alt}>
      <Icon name={visual.icon} size={size === "large" ? 26 : 14} />
      {size === "large" ? <span style={fileBadgeLabelStyle}>{visual.label}</span> : null}
    </div>
  );
}

function AttachmentActionButton({
  icon,
  label,
  ariaLabel,
  danger = false,
  onClick,
}: {
  icon: string;
  label: string;
  ariaLabel: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={danger ? "lf-attachment-action is-danger" : "lf-attachment-action"}
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      style={danger ? dangerActionButtonStyle : actionButtonStyle}
      onClick={onClick}
    >
      <Icon name={icon} size={17} />
      <span>{label}</span>
    </button>
  );
}

function getAttachmentVisual(item: AttachmentGalleryItem) {
  const fileKind = getFileKind(item.mimeType, item.fileName);
  if ((fileKind === "image" || fileKind === "pdf") && item.thumbnailUrl) {
    return {
      kind: "thumbnail" as const,
      icon: getFileIcon(item.mimeType, item.fileName),
      label: getFileTypeLabel(item.mimeType, item.fileName),
      alt: `${getFileTypeLabel(item.mimeType, item.fileName)} preview for ${item.fileName || "attachment"}`,
    };
  }
  return {
    kind: "icon" as const,
    icon: getFileIcon(item.mimeType, item.fileName),
    label: getFileTypeLabel(item.mimeType, item.fileName),
    alt: `${getFileTypeLabel(item.mimeType, item.fileName)} file: ${item.fileName || "attachment"}`,
  };
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

function getFileTypeLabel(mimeType: string | null | undefined, fileName?: string | null) {
  const kind = getFileKind(mimeType, fileName);
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "Image";
  if (kind === "word") return "DOC";
  if (kind === "calendar") return "ICS";
  if (kind === "spreadsheet") return "Sheet";
  if (kind === "unknown") return formatMime(mimeType);
  return "File";
}

function getFileKind(mimeType: string | null | undefined, fileName?: string | null) {
  const normalized = String(mimeType ?? "").toLowerCase();
  const extension = String(fileName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (normalized === "application/pdf" || extension === "pdf") return "pdf";
  if (normalized.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "image";
  if (normalized.includes("word") || normalized.includes("officedocument.wordprocessingml") || ["doc", "docx"].includes(extension)) return "word";
  if (normalized.includes("calendar") || normalized === "text/calendar" || extension === "ics") return "calendar";
  if (normalized.includes("spreadsheet") || normalized.includes("excel") || normalized.includes("officedocument.spreadsheetml") || ["xls", "xlsx", "csv"].includes(extension)) return "spreadsheet";
  return "unknown";
}

function getFileIcon(mimeType: string | null | undefined, fileName?: string | null) {
  const kind = getFileKind(mimeType, fileName);
  if (kind === "pdf") return "picture_as_pdf";
  if (kind === "image") return "image";
  if (kind === "word") return "article";
  if (kind === "calendar") return "calendar_month";
  if (kind === "spreadsheet") return "table_chart";
  return "description";
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

const cardStyle: CSSProperties = {
  border: "1px solid #eee8e3",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
  display: "grid",
  gap: 10,
};

const thumbStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 10,
  objectFit: "cover",
  border: "1px solid #eadfd8",
  background: "#fffefd",
  flexShrink: 0,
};

const fileBadgeStyle: CSSProperties = {
  width: 68,
  height: 68,
  borderRadius: 10,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  background: "#f7f3f0",
  border: "1px solid #eadfd8",
  color: "#3a2118",
  flexShrink: 0,
};

const fileBadgeLabelStyle: CSSProperties = {
  color: "#5f4b3f",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
  textTransform: "uppercase",
};

const metadataRowStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  display: "flex",
  gap: 6,
  alignItems: "center",
  flexWrap: "wrap",
};

const statusPillStyle: CSSProperties = {
  border: "1px solid #d7eadb",
  borderRadius: 999,
  background: "#f7fbf7",
  color: "#166534",
  padding: "2px 7px",
  fontSize: 11,
  fontWeight: 800,
};

const actionRowStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const actionButtonStyle: CSSProperties = {
  border: "1px solid #d9d1cb",
  borderRadius: 10,
  background: "#fff",
  color: "#2b201b",
  minHeight: 38,
  padding: "0 12px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontSize: 13,
  fontWeight: 750,
  cursor: "pointer",
};

const dangerActionButtonStyle: CSSProperties = {
  ...actionButtonStyle,
  border: "1px solid #fecaca",
  background: "#fff",
  color: "#991b1b",
};

const fileTypePillStyle: CSSProperties = {
  border: "1px solid #eadfd8",
  borderRadius: 999,
  background: "#fffefd",
  color: "#5f4b3f",
  padding: "2px 7px",
  fontSize: 11,
  fontWeight: 800,
};

const emptyStateStyle: CSSProperties = {
  border: "1px solid #eee8e3",
  borderRadius: 12,
  background: "#fffefd",
  color: "#64748b",
  fontSize: 13,
  padding: 12,
  lineHeight: 1.45,
};

const summaryCardStyle: CSSProperties = {
  border: "1px solid #eee8e3",
  background: "#fff",
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
  border: "1px solid #eadfd8",
  background: "#fffefd",
  flexShrink: 0,
};

const summaryFileBadgeStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "#f7f3f0",
  border: "1px solid #eadfd8",
  color: "#3a2118",
  flexShrink: 0,
};
