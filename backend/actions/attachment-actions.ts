"use server";

import * as attachments from "@/backend/visit-attachments";

export async function listVisitAttachments(entry: string) {
  return attachments.listVisitAttachments(entry);
}
export async function prepareAttachment(
  entry: string,
  file: { name: string; type: string; size: number }
) {
  return attachments.prepareAttachment(entry, file);
}
export async function confirmAttachment(entry: string, attachment: string) {
  return attachments.confirmAttachment(entry, attachment);
}
export async function deleteAttachment(entry: string, attachment: string) {
  return attachments.deleteAttachment(entry, attachment);
}
