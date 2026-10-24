import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const instant = false;

export default async function SecretaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/");
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "secretary") redirect(homeForRole(account.role));
  return children;
}
