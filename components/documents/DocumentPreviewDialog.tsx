"use client";

import { useState, type CSSProperties } from "react";
import { IconButton } from "../ui/IconButton";
import Icon from "../ui/Icon";

export type DocumentPreviewDialogItem = {
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  previewUrl: string;
  metaLabel?: string;
  helperText?: string;
  relatedHref?: string;
  relatedLabel?: string;
};

export default function DocumentPreviewDialog({
  item,
  onClose,
  onDownload,
  onPrint,
  onReplace,
  onRemove,
  onRename,
  replaceAccept,
}: {
  item: DocumentPreviewDialogItem;
  onClose: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  onReplace?: (file: File) => void;
  onRemove?: () => void;
  onRename?: (title: string) => Promise<boolean>;
  replaceAccept?: string;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(item.fileName);
  const [titleError, setTitleError] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  return (
    <div className="lf-v52-document-overlay" style={overlayStyle} role="dialog" aria-modal="true" aria-label={`${item.fileName} preview`}>
      <div className="lf-v52-document-dialog" style={dialogStyle}>
        <div className="lf-v52-document-dialog-header" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, wordBreak: "break-word" }}>{item.fileName || "Attachment preview"}</div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{formatMime(item.mimeType)}</div>
            {item.metaLabel ? <div style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{item.metaLabel}</div> : null}
            {item.originalFileName ? <div style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>Original filename: {item.originalFileName}</div> : null}
          </div>
          <IconButton icon="close" label="Close preview" className="lf-v52-document-dialog-close" onClick={onClose} />
        </div>
        <div className="lf-v52-document-viewer" style={viewerStyle}>
          {isImageMime(item.mimeType) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.previewUrl} alt={item.fileName || "Attachment preview"} style={viewerImageStyle} />
          ) : isIframePreviewMime(item.mimeType) ? (
            <iframe title={item.fileName || "Attachment preview"} src={item.previewUrl} style={viewerFrameStyle} />
          ) : (
            <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
              <div style={{ color: "#475569", fontSize: 14 }}>
                This file cannot be previewed safely in the app yet. Open the related record to inspect it.
              </div>
            </div>
          )}
        </div>
        {onRename ? (
          editingTitle ? <form onSubmit={(event) => {
            event.preventDefault();
            setTitleSaving(true);
            setTitleError("");
            void onRename(titleInput).then((saved) => {
              if (!saved) setTitleError("Could not save title. Check the title and try again.");
            }).finally(() => setTitleSaving(false));
          }} style={{ display: "grid", gap: 8 }}>
            <label htmlFor="lf-document-display-title">Document title</label>
            <input id="lf-document-display-title" value={titleInput} onChange={(event) => setTitleInput(event.target.value)} maxLength={160} style={{ minHeight: 44, fontSize: 16, padding: 10 }} />
            {titleError ? <span role="alert">{titleError}</span> : null}
            <div className="lf-v52-document-dialog-actions">
              <button type="submit" disabled={titleSaving}>{titleSaving ? "Saving…" : "Save title"}</button>
              <button type="button" onClick={() => setEditingTitle(false)}>Cancel</button>
            </div>
          </form> : null
        ) : null}
        {onDownload || onPrint || onReplace || onRemove || onRename ? <div className="lf-v52-document-dialog-actions">
          {onRename && !editingTitle ? <button type="button" onClick={() => setEditingTitle(true)}><Icon name="edit" size={18} />Edit details</button> : null}
          {onDownload ? <button type="button" onClick={onDownload}><Icon name="download" size={18} />Download</button> : null}
          {onPrint ? <button type="button" onClick={onPrint}><Icon name="print" size={18} />Print</button> : null}
          {onReplace ? <label><Icon name="upload_file" size={18} />Replace<input type="file" accept={replaceAccept} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onReplace(file); event.currentTarget.value = ""; }} /></label> : null}
          {onRemove ? <button type="button" className="is-danger" onClick={onRemove}><Icon name="delete" size={18} />Delete</button> : null}
        </div> : null}
        {item.helperText || item.relatedHref ? (
          <div style={{ display: "grid", gap: 10 }}>
            {item.helperText ? <div style={{ color: "#475569", fontSize: 14 }}>{item.helperText}</div> : null}
            {item.relatedHref ? (
              <a href={item.relatedHref} style={relatedLinkStyle}>
                {item.relatedLabel || "Open related record"}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function isImageMime(mimeType: string | null | undefined) {
  return String(mimeType ?? "").toLowerCase().startsWith("image/");
}

function isIframePreviewMime(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").toLowerCase();
  return normalized === "application/pdf" || normalized.startsWith("text/");
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

const relatedLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  width: "fit-content",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  padding: "8px 12px",
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 700,
};
