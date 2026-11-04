import "server-only";
import { createClient } from "./supabase/server";
import {
  attachmentProblem,
  type VisitAttachment,
} from "../shared/visit-attachments";

const bucket = "visit-attachments";
const linkSeconds = 300;
const failed = { ok: false as const, message: "تعذر حفظ المرفق. حاول مجدداً." };

export async function listVisitAttachments(
  entry: string
): Promise<VisitAttachment[]> {
  const client = await createClient();
  const visit = await client
    .from("visits")
    .select("id")
    .eq("queue_entry_id", entry)
    .maybeSingle();
  if (visit.error || !visit.data) return [];
  const rows = await client
    .from("visit_attachments")
    .select("id,file_name,mime_type,size_bytes,storage_path")
    .eq("visit_id", visit.data.id)
    .not("uploaded_at", "is", null)
    .order("created_at");
  if (rows.error || !rows.data.length) return [];
  const links = await client.storage.from(bucket).createSignedUrls(
    rows.data.map((row) => row.storage_path as string),
    linkSeconds
  );
  if (links.error) return [];
  return rows.data.map((row, index) => ({
    id: row.id as string,
    name: row.file_name as string,
    mime: row.mime_type as string,
    size: row.size_bytes as number,
    url: links.data[index]?.signedUrl ?? "",
  }));
}

export async function prepareAttachment(
  entry: string,
  file: { name: string; type: string; size: number }
) {
  const problem = attachmentProblem(file);
  if (problem) return { ok: false as const, message: problem };
  const client = await createClient();
  const added = await client.rpc("clinical_add_attachment", {
    p_queue: entry,
    p_name: file.name.slice(0, 200),
    p_mime: file.type,
    p_size: file.size,
  });
  if (added.error)
    return added.error.details === "attachment_limit"
      ? { ok: false as const, message: "الحد الأقصى 10 مرفقات لكل زيارة." }
      : failed;
  const row = added.data as { id: string; storage_path: string };
  const upload = await client.storage
    .from(bucket)
    .createSignedUploadUrl(row.storage_path);
  if (upload.error) {
    await client.rpc("clinical_delete_attachment", {
      p_queue: entry,
      p_attachment: row.id,
    });
    return failed;
  }
  return { ok: true as const, id: row.id, uploadUrl: upload.data.signedUrl };
}

export async function confirmAttachment(entry: string, attachment: string) {
  const client = await createClient();
  const { error } = await client.rpc("clinical_confirm_attachment", {
    p_queue: entry,
    p_attachment: attachment,
  });
  return !error;
}

export async function deleteAttachment(entry: string, attachment: string) {
  const client = await createClient();
  const { data, error } = await client.rpc("clinical_delete_attachment", {
    p_queue: entry,
    p_attachment: attachment,
  });
  if (error) return false;
  await client.storage.from(bucket).remove([data as string]);
  return true;
}
