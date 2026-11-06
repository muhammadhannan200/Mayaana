"use client";

import { useEffect } from "react";

// Warns before leaving the visit page while edits are unsaved.
export function useUnsavedGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const leave = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.("a[href]");
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.pathname === window.location.pathname
      )
        return;
      if (!window.confirm("لديك تعديلات غير محفوظة. مغادرة الزيارة؟")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", leave, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", leave, true);
    };
  }, [active]);
}
