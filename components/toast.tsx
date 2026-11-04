"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icon";

export function Toast({
  message,
  duration = 4000,
}: {
  message: string;
  duration?: number;
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(timer);
  }, [duration]);
  if (!visible) return null;
  return (
    <p className="app-toast" role="status">
      <Icon name="check" size={18} />
      <span>{message}</span>
    </p>
  );
}
