import { AppNav, type AppNavTab } from "@/frontend/components/app-nav";

const doctorTabs: AppNavTab[] = [
  { key: "home", title: "الرئيسية", href: "/doctor" },
  { key: "patients", title: "المرضى", href: "/doctor/patients" },
  { key: "search", title: "البحث", href: "/doctor/search" },
  // Keep master's existing destination until Account/Profile is implemented.
  { key: "account", title: "الحساب", href: "/doctor/staff" },
];

export function DoctorNav({
  route,
  demo = false,
}: {
  route: string;
  demo?: boolean;
}) {
  const tabs = demo
    ? doctorTabs.map((tab) => ({
        ...tab,
        href: `/demo${tab.key === "account" ? "/secretary/account" : tab.href}`,
      }))
    : doctorTabs;
  const active = route.startsWith("doctor/patients")
    ? "patients"
    : route === "doctor/search"
      ? "search"
      : route === "doctor/staff"
        ? "account"
        : "home";
  return <AppNav tabs={tabs} active={active} className="doctor-navigation" />;
}
