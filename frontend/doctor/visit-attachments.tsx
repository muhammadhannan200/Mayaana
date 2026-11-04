"use client";

import { useEffect, useRef, useState } from "react";
import * as actions from "@/backend/actions/attachment-actions";
import { Icon } from "@/frontend/components/icon";
import {
  attachmentProblem,
  attachmentSizeLabel,
  type VisitAttachment,
} from "@/shared/visit-attachments";
import "./visit-attachments.css";

async function upload(entry: string, file: File) {
  const prepared = await actions.prepareAttachment(entry, {
    name: file.name,
    type: file.type,
    size: file.size,
  });
  if (!prepared.ok) return prepared.message;
  const sent = await fetch(prepared.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  }).catch(() => null);
  if (!sent?.ok || !(await actions.confirmAttachment(entry, prepared.id))) {
    await actions.deleteAttachment(entry, prepared.id).catch(() => false);
    return "تعذر رفع الملف. حاول مجدداً.";
  }
  return "";
}

function AttachmentLabel({ file }: { file: VisitAttachment }) {
  return (
    <>
      <span className="visit-attachment-icon">
        <Icon name="image" size={20} />
      </span>
      <span>
        <strong>
          <bdi>{file.name}</bdi>
        </strong>
        <small>
          {file.mime === "application/pdf" ? "ملف" : "صورة"} ·{" "}
          <bdi>{attachmentSizeLabel(file.size)}</bdi>
        </small>
      </span>
    </>
  );
}

export function VisitAttachments({
  entry,
  demo,
  readOnly,
}: {
  entry: string;
  demo?: boolean;
  readOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<VisitAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demo) return;
    let active = true;
    actions
      .listVisitAttachments(entry)
      .then((items) => active && setFiles(items))
      .catch(() => active && setError("تعذر تحميل المرفقات."));
    return () => {
      active = false;
    };
  }, [demo, entry]);

  async function add(file: File) {
    setError("");
    const problem = attachmentProblem(file);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      if (demo) {
        // Stays in this page only: the demo never uploads a file.
        const item = {
          id: crypto.randomUUID(),
          name: file.name,
          mime: file.type,
          size: file.size,
          url: "",
        };
        setFiles((current) => [...current, item]);
        return;
      }
      const failure = await upload(entry, file);
      if (failure) return setError(failure);
      setFiles(await actions.listVisitAttachments(entry));
    } catch {
      setError("تعذر رفع الملف. حاول مجدداً.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setError("");
    if (demo) return setFiles((items) => items.filter((f) => f.id !== id));
    setBusy(true);
    const removed = await actions
      .deleteAttachment(entry, id)
      .catch(() => false);
    setBusy(false);
    if (removed) setFiles((items) => items.filter((f) => f.id !== id));
    else setError("تعذر حذف المرفق. حاول مجدداً.");
  }

  if (readOnly && !files.length && !error) return null;
  return (
    <section className="visit-attachments">
      <h2>المرفقات ({files.length})</h2>
      {files.length > 0 && (
        <ul>
          {files.map((file) => (
            <li key={file.id}>
              {file.url.startsWith("https://") ? (
                <a href={file.url} target="_blank" rel="noreferrer">
                  <AttachmentLabel file={file} />
                </a>
              ) : (
                <div>
                  <AttachmentLabel file={file} />
                </div>
              )}
              {!readOnly && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`حذف ${file.name}`}
                  onClick={() => remove(file.id)}
                >
                  <Icon name="trash" size={18} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <>
          <input
            ref={input}
            type="file"
            hidden
            aria-label="اختيار مرفق"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void add(file);
            }}
          />
          <button
            type="button"
            className="secretary-outline"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <Icon name="image" size={20} />
            {busy ? "جارٍ الرفع…" : "إضافة صورة أو ملف"}
          </button>
        </>
      )}
      {error && (
        <p className="secretary-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
