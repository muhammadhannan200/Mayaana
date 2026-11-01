"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./components";
import "./queue-presentation.css";

export const HANDOFF_NOTICE_MS = 6000;

// Event-only feedback: never infer success from a URL, snapshot or stored state.
export function useHandoffFeedback() {
  const [notice, setNotice] = useState(false);
  const epoch = useRef(0);
  const busy = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const dismiss = () => {
      epoch.current++;
      clearTimeout(timer.current);
      setNotice(false);
    };
    const navigate = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]"))
        dismiss();
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") dismiss();
    };
    document.addEventListener("click", navigate, true);
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", dismiss);
    window.addEventListener("popstate", dismiss);
    return () => {
      dismiss();
      document.removeEventListener("click", navigate, true);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", dismiss);
      window.removeEventListener("popstate", dismiss);
    };
  }, []);

  async function confirmHandoff(operation: () => Promise<boolean>) {
    if (busy.current) return;
    busy.current = true;
    const ticket = ++epoch.current;
    const location = window.location.href;
    clearTimeout(timer.current);
    setNotice(false);
    try {
      const succeeded = await operation();
      if (
        succeeded &&
        ticket === epoch.current &&
        location === window.location.href &&
        document.visibilityState === "visible"
      ) {
        setNotice(true);
        timer.current = setTimeout(() => setNotice(false), HANDOFF_NOTICE_MS);
      }
    } finally {
      busy.current = false;
    }
  }

  return { notice, confirmHandoff };
}

export function HandoffSnackbar({ visible }: { visible: boolean }) {
  return (
    <div
      className="handoff-announcer"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      dir="rtl"
    >
      {visible && (
        <div className="handoff-snackbar">
          <Icon name="check" size={20} />
          <span>تم إدخال المريض عند الطبيب.</span>
        </div>
      )}
    </div>
  );
}
