"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { QueueRemovalReason } from "@/shared/clinical-types";
import { RemovalSheet } from "./removal-sheet";

const LONG_PRESS_MS = 550;
const MOVEMENT_LIMIT = 10;

export function QueuePatientCard({
  patientName,
  queueNumber,
  pending,
  onRemove,
  children,
}: {
  patientName: string;
  queueNumber: number;
  pending?: boolean;
  onRemove: (reason: QueueRemovalReason) => Promise<boolean>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);

  useEffect(() => {
    function cancel() {
      clearTimeout(timer.current);
      gesture.current = null;
    }
    function move(event: PointerEvent) {
      const start = gesture.current;
      if (
        start?.id === event.pointerId &&
        Math.hypot(event.clientX - start.x, event.clientY - start.y) >
          MOVEMENT_LIMIT
      )
        cancel();
    }
    function anotherPointer(event: PointerEvent) {
      if (gesture.current && gesture.current.id !== event.pointerId) cancel();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") cancel();
    }
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", anotherPointer, true);
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("scroll", cancel, true);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", escape);
    document.addEventListener("visibilitychange", cancel);
    return () => {
      cancel();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", anotherPointer, true);
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("scroll", cancel, true);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", escape);
      document.removeEventListener("visibilitychange", cancel);
    };
  }, []);

  return (
    <li
      className="queue-card queue-action-card"
      onPointerDown={(event) => {
        if (
          !(event.target instanceof Node) ||
          !event.currentTarget.contains(event.target)
        )
          return;
        held.current = false;
        clearTimeout(timer.current);
        gesture.current = null;
        if (
          event.pointerType !== "touch" ||
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target instanceof Element &&
            event.target.closest("a,button,input,select,textarea,label"))
        )
          return;
        gesture.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
        };
        timer.current = setTimeout(() => {
          gesture.current = null;
          held.current = true;
          setOpen(true);
        }, LONG_PRESS_MS);
      }}
      onPointerLeave={() => {
        clearTimeout(timer.current);
        gesture.current = null;
      }}
      onLostPointerCapture={() => {
        clearTimeout(timer.current);
        gesture.current = null;
      }}
      onContextMenu={(event) => {
        if (gesture.current || held.current) event.preventDefault();
      }}
      onClickCapture={(event) => {
        if (
          held.current &&
          event.target instanceof Node &&
          event.currentTarget.contains(event.target)
        ) {
          event.preventDefault();
          event.stopPropagation();
          held.current = false;
        }
      }}
    >
      {children}
      <button
        type="button"
        className="queue-actions-trigger"
        aria-label={`إزالة ${patientName} من الدور`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        إزالة من الدور
      </button>
      {open && (
        <RemovalSheet
          patientName={patientName}
          queueNumber={queueNumber}
          pending={pending}
          onClose={() => {
            held.current = false;
            setOpen(false);
          }}
          onRemove={async (reason) => {
            if (await onRemove(reason)) setOpen(false);
          }}
        />
      )}
    </li>
  );
}
