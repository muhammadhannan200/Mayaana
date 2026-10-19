import { redirect } from "next/navigation";
import { getCurrentAccount } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import "./secretary.css";

export const instant = false;

export default async function SecretaryLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured()) redirect("/");
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  // Doctors may perform essential reception work with their own account.
  if (account.role !== "secretary" && account.role !== "doctor") redirect("/");
  return children;
}
