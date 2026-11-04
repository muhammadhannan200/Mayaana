"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";

type PasswordInputProps = Omit<ComponentProps<"input">, "type" | "ref"> & {
  visibilityLabel: string;
};

export function PasswordInput({
  visibilityLabel,
  children,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selection = useRef<{
    start: number | null;
    end: number | null;
    direction: "forward" | "backward" | "none" | null;
    scrollLeft: number;
  } | null>(null);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const saved = selection.current;
    if (input && saved) {
      if (saved.start !== null && saved.end !== null) {
        input.setSelectionRange(
          saved.start,
          saved.end,
          saved.direction ?? "none"
        );
      }
      input.scrollLeft = saved.scrollLeft;
      selection.current = null;
    }
  }, [visible]);

  return (
    <div className="input-wrap password-input-wrap">
      {children}
      <input {...props} ref={inputRef} type={visible ? "text" : "password"} />
      <button
        className="password-visibility-toggle"
        type="button"
        aria-label={`${visible ? "إخفاء" : "إظهار"} ${visibilityLabel}`}
        aria-controls={props.id}
        onPointerDown={(event) => {
          // Pointer users can keep editing; keyboard users retain button focus.
          if (document.activeElement === inputRef.current)
            event.preventDefault();
        }}
        onClick={() => {
          const input = inputRef.current;
          if (input) {
            selection.current = {
              start: input.selectionStart,
              end: input.selectionEnd,
              direction: input.selectionDirection,
              scrollLeft: input.scrollLeft,
            };
          }
          setVisible((current) => !current);
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  );
}
