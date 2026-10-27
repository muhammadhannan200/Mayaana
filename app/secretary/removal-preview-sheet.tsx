"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./components";
import "./queue-presentation.css";

const reasons = ["غادر العيادة", "أُضيف بالخطأ", "سبب آخر"];

// Deliberately no entry ID, operation, onRemove or submit callback.
export function RemovalPreviewSheet({
  patientName,
  queueNumber,
  onClose,
  returnFocus,
}: {
  patientName: string;
  queueNumber: number;
  onClose: () => void;
  returnFocus?: RefObject<HTMLButtonElement | null>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const title = useId();
  const explanation = useId();
  const [reason, setReason] = useState(reasons[0]);

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const restoreTarget = returnFocus?.current ?? previous;
    const overflow = document.body.style.overflow;
    element.showModal();
    close.current?.focus({ preventScroll: true });
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (restoreTarget instanceof HTMLElement && restoreTarget.isConnected)
        restoreTarget.focus({ preventScroll: true });
    };
  }, [returnFocus]);

  return createPortal(
    <dialog
      ref={dialog}
      className="removal-preview-sheet"
      dir="rtl"
      aria-labelledby={title}
      aria-describedby={explanation}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const selected =
          event.currentTarget.querySelector<HTMLInputElement>("input:checked");
        if (event.shiftKey && document.activeElement === close.current) {
          event.preventDefault();
          selected?.focus();
        } else if (!event.shiftKey && document.activeElement === selected) {
          event.preventDefault();
          close.current?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className="removal-preview-header">
        <h2 id={title}>
          {patientName} · دور <bdi>{queueNumber}</bdi>
        </h2>
        <button
          ref={close}
          type="button"
          className="removal-preview-close"
          aria-label="إغلاق الإجراءات"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>
      </header>
      <fieldset className="removal-preview-reasons">
        <legend>إزالة من الدور</legend>
        <div>
          {reasons.map((value) => (
            <label key={value}>
              <input
                type="radio"
                name={title}
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className="removal-preview-submit"
        disabled
        aria-describedby={explanation}
      >
        <Icon name="close" size={20} /> إزالة من الدور
      </button>
      <p id={explanation} className="removal-preview-note">
        معاينة فقط · الإزالة غير متاحة حالياً. لم يتغير الدور.
      </p>
    </dialog>,
    document.body
  );
}
