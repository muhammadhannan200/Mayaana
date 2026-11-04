export const maxAttachmentBytes = 10 * 1024 * 1024;
export const attachmentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export type VisitAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
};

export function attachmentProblem(file: { type: string; size: number }) {
  if (!attachmentTypes.includes(file.type))
    return "الملف يجب أن يكون صورة أو PDF.";
  if (file.size > maxAttachmentBytes) return "حجم الملف أكبر من 10 MB.";
  return "";
}

export function attachmentSizeLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
