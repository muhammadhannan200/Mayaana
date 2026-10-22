export function Icon({
  name,
  size = 22,
}: {
  name:
    | "queue"
    | "patients"
    | "search"
    | "account"
    | "plus"
    | "arrow"
    | "bell"
    | "scale"
    | "close"
    | "check"
    | "edit"
    | "info"
    | "down"
    | "ruler";
  size?: number;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    queue: (
      <>
        <path d="M3 7h18M3 12h18M3 17h18" />
        <path d="M17 4v6" />
      </>
    ),
    patients: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8a3 3 0 0 1 0 6m2 6v-2a5 5 0 0 0-2-4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    account: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="m15 5-7 7 7 7" />,
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4" />
      </>
    ),
    scale: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 10a4 4 0 0 1 6 0m-3 0v3" />
      </>
    ),
    close: <path d="M6 6l12 12M18 6 6 18" />,
    check: <path d="m4 12 5 5L20 6" />,
    edit: (
      <>
        <path d="M13 5l6 6M4 20l4-.7L19 8a2 2 0 0 0-3-3L5 16l-1 4Z" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </>
    ),
    down: <path d="M12 4v16m-6-6 6 6 6-6" />,
    ruler: (
      <>
        <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M8 3v4m4-4v3m4-3v4m5 5h-4m4 4h-3" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
