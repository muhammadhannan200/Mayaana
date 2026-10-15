import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { PasswordForm } from "./password-form";

export const instant = false;

export default async function ChangePasswordPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.role === "secretary" && !account.mustChangePassword) redirect(homeForRole(account.role));

  return <PasswordForm firstUse={account.mustChangePassword} />;
}
