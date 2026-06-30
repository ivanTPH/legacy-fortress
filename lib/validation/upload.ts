export type UploadValidationOptions = {
  allowedMimeTypes: string[];
  maxBytes: number;
};

export const DOCUMENT_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

export const IMAGE_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png"];

export const DOCUMENT_UPLOAD_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,image/jpeg,image/png";

export const IMAGE_UPLOAD_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";

export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validateUploadFile(file: File, options: UploadValidationOptions) {
  if (!options.allowedMimeTypes.includes(file.type)) {
    return { ok: false, error: `Unsupported file type: ${file.type || "unknown"}` };
  }

  if (file.size > options.maxBytes) {
    return { ok: false, error: `File exceeds max size of ${Math.round(options.maxBytes / (1024 * 1024))}MB` };
  }

  return { ok: true as const };
}
