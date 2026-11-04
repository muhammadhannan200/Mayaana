"use client";

import { useEffect, useState } from "react";
import type { ClinicNotification } from "@/lib/clinic-notifications";
import { Icon } from "./icon";
import "./notification-bell.css";

function readSeen(key: string): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "[]");
  } catch {
    return [];
  }
}

export function NotificationBell({
  items,
  scope,
  className,
}: {
  items: ClinicNotification[];
  scope: string;
  className: string;
}) {
  const key = `mayaana-seen-notifications:${scope}`;
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    const stored = readSeen(key);
    const timer = window.setTimeout(() => setSeen(stored));
    return () => window.clearTimeout(timer);
  }, [key]);
  const unread = items.filter((item) => !seen.includes(item.id)).length;

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    const ids = items.map((item) => item.id);
    setSeen(ids);
    try {
      window.localStorage.setItem(key, JSON.stringify(ids));
    } catch {
      /* Read state is a convenience; the list still works without storage. */
    }
  }

  return (
    <div className="notification-bell">
      <button
        type="button"
        className={className}
        aria-label={unread ? `الإشعارات، ${unread} جديدة` : "الإشعارات"}
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="bell" />
        {unread > 0 && <span aria-hidden="true">{unread}</span>}
      </button>
      {open && (
        <div
          className="notification-panel"
          role="region"
          aria-label="الإشعارات"
        >
          <h2>الإشعارات</h2>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <span>{item.text}</span>
                  {item.time && (
                    <small>
                      <bdi>{item.time}</bdi>
                    </small>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد إشعارات اليوم.</p>
          )}
        </div>
      )}
    </div>
  );
}
