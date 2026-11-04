import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/backend/auth";
import { isSupabaseConfigured } from "@/backend/supabase/server";
import "../../frontend/doctor/doctor.css";

export const instant = false;

export default async function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/");
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "doctor") redirect(homeForRole(account.role));
  // The clinical header renders the shared, error-aware SignOutForm.
  return children;
}
