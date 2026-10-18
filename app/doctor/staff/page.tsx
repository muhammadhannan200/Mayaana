import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAccount, homeForRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ClinicStaffPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/");
  if (account.mustChangePassword) redirect("/change-password");
  if (account.role !== "doctor") redirect(homeForRole(account.role));

  const supabase = await createClient();
  const { data: staff, error } = await supabase.from("clinic_staff")
    .select("user_id, display_name, login_email, role, active, must_change_password")
    .eq("clinic_id", account.clinicId)
    .order("created_at", { ascending: true });

  return (
    <main className="auth-shell">
      <div className="auth-panel logged-in">
        <div className="page-header">
          <h1>حسابات العيادة</h1>
          <Link className="text-link" href="/doctor">العودة</Link>
        </div>
        <p className="message message-info">حسابات الطبيب والسكرتيرة المرتبطة بهذه العيادة.</p>
        {error ? (
          <p className="message message-error" role="alert">
            تعذّر تحميل الحسابات. حاول مرة أخرى.
          </p>
        ) : staff?.length === 0 ? (
          <p className="message message-info">
            لا توجد حسابات في هذه العيادة حتى الآن.
          </p>
        ) : (
          <ul className="staff-list">
            {staff?.map((member) => (
              <li className="staff-item" key={member.user_id}>
                <strong>{member.display_name}</strong>
                <span dir="ltr">{member.login_email}</span>
                <span>
                  {member.role === "doctor" ? "طبيب" : "سكرتيرة"} · {member.active ? "نشط" : "موقوف"}
                </span>
                {member.must_change_password && <span>ينتظر تعيين كلمة مرور جديدة</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
