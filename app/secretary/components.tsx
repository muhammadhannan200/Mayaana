import Link from "next/link";

export function Icon({ name, size = 22 }: { name: "queue" | "patients" | "search" | "account" | "plus" | "arrow" | "bell" | "scale"; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    queue: <><path d="M3 7h18M3 12h18M3 17h18"/><path d="M17 4v6"/></>,
    patients: <><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 8a3 3 0 0 1 0 6m2 6v-2a5 5 0 0 0-2-4"/></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    account: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="m15 5-7 7 7 7"/>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9ZM10 21h4"/></>,
    scale: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 10a4 4 0 0 1 6 0m-3 0v3"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function SecretaryNav({ active }: { active: "queue" | "patients" | "search" | "account" }) {
  const items = [
    { id: "queue", label: "الدور", href: "/secretary" },
    { id: "patients", label: "المرضى", href: "/secretary/patients" },
    { id: "search", label: "البحث", href: "/secretary/search" },
    { id: "account", label: "الحساب", href: "/secretary/account" },
  ] as const;
  return <nav className="secretary-nav" aria-label="التنقل الرئيسي">{items.map((item) =>
    <Link key={item.id} href={item.href} className={active === item.id ? "secretary-nav-item active" : "secretary-nav-item"} aria-current={active === item.id ? "page" : undefined}>
      <span className="secretary-nav-icon"><Icon name={item.id} /></span><span>{item.label}</span>
    </Link>
  )}</nav>;
}

export function SecretaryShell({ children, active }: { children: React.ReactNode; active: "queue" | "patients" | "search" | "account" }) {
  return <main className="secretary-shell"><div className="secretary-scroll">{children}</div><SecretaryNav active={active} /></main>;
}
