import { redirect } from "next/navigation";
import { RoleHome } from "@/app/role-home";
import { getCurrentAccount, homeForRole } from "@/lib/auth";

export const instant = false;

export default async function SecretaryHome() {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "secretary") redirect(homeForRole(account.role));
  return <RoleHome role="secretary" />;
}
