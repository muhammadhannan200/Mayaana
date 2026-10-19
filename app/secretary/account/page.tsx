import Link from "next/link";
import { signOut } from "@/app/actions";
import { getCurrentAccount } from "@/lib/auth";
import { Icon, SecretaryShell } from "../components";

export default async function SecretaryAccount() {
  const account = await getCurrentAccount();
  if (!account) return null;
  return <SecretaryShell active="account"><header className="secretary-subheader"><Link href="/secretary" aria-label="العودة للدور"><Icon name="arrow" /></Link><h1>الحساب</h1></header>
    <div className="secretary-content"><div className="account-summary"><span className="account-avatar"><Icon name="account" size={28} /></span><div><strong>حساب {account.role === "doctor" ? "الطبيب" : "السكرتيرة"}</strong><p>حساب العيادة</p></div></div>
      {account.role === "doctor" && <Link className="secretary-outline" href="/doctor">العودة إلى الرئيسية للطبيب</Link>}
      <form action={signOut}><button type="submit" className="secretary-outline signout">تسجيل الخروج</button></form>
    </div>
  </SecretaryShell>;
}
