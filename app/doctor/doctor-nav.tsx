import { AppNav, type AppNavTab } from "@/components/app-nav";

const doctorTabs: AppNavTab[] = [
  { key: "home", title: "الرئيسية", href: "/doctor" },
  { key: "patients", title: "المرضى", href: "/doctor/patients" },
  { key: "search", title: "البحث", href: "/doctor/search" },
  // Keep master's existing destination until Account/Profile is implemented.
  { key: "account", title: "الحساب", href: "/doctor/staff" },
];

export function DoctorNav({ route }: { route: string }) {
  const active = route.startsWith("doctor/patients")
    ? "patients"
    : route === "doctor/search"
      ? "search"
      : route === "doctor/staff"
        ? "account"
        : "home";
  return <AppNav tabs={doctorTabs} active={active} />;
}
