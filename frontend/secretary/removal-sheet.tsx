"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/frontend/components/icon";
import type { QueueRemovalReason } from "@/shared/clinical-types";
import "./queue-removal.css";

const reasons: { value: QueueRemovalReason; label: string }[] = [
  { value: "left_clinic", label: "غادر العيادة" },
  { value: "added_by_mistake", label: "أُضيف بالخطأ" },
  { value: "other", label: "سبب آخر" },
];

export function RemovalSheet({
  patientName,
  queueNumber,
  pending,
  onClose,
  onRemove,
}: {
  patientName: string;
  queueNumber: number;
  pending?: boolean;
  onClose: () => void;
  onRemove: (reason: QueueRemovalReason) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [reason, setReason] = useState(reasons[0].value);

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="removal-sheet"
      dir="rtl"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself landed on its backdrop.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 id={title}>
        {patientName} · دور <bdi>{queueNumber}</bdi>
      </h2>
      <fieldset className="removal-reasons">
        <legend>إزالة من الدور</legend>
        <div>
          {reasons.map((item) => (
            <label key={item.value}>
              <input
                type="radio"
                name={title}
                value={item.value}
                checked={reason === item.value}
                onChange={() => setReason(item.value)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        className="removal-submit"
        disabled={pending}
        onClick={() => onRemove(reason)}
      >
        <Icon name="close" size={20} /> إزالة من الدور
      </button>
    </dialog>,
    document.body
  );
}
