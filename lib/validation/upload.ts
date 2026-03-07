export type UploadValidationOptions = {
  allowedMimeTypes: string[];
  maxBytes: number;
};

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

