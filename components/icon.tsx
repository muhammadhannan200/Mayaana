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
    | "ruler"
    | "trash"
    | "lock"
    | "logout"
    | "mail"
    | "print"
    | "dots";
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
    lock: (
      <>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </>
    ),
    logout: (
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    print: (
      <>
        <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" />
        <rect x="6" y="14" width="12" height="7" />
      </>
    ),
    dots: <path d="M12 5.5h.01M12 12h.01M12 18.5h.01" strokeWidth="3" />,
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
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
    check: <path d="m4 12 5 5L20 6" />,
    edit: (
      <>
        <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L5 16l-1 4Z" />
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
