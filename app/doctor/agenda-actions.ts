"use server";

import { accountForUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AgendaBoundError, readDoctorAgenda } from "@/lib/doctor-agenda";
import { readDoctorWeek } from "@/lib/doctor-week";

export async function getDoctorAgenda() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user)
      return {
        ok: false as const,
        message: "سجّل الدخول بحساب الطبيب لعرض المواعيد.",
      };
    const account = await accountForUser(client, user);
    if (!account || account.role !== "doctor" || account.mustChangePassword)
      return {
        ok: false as const,
        message: "عرض المواعيد متاح للطبيب المصرّح له فقط.",
      };
    return { ok: true as const, data: await readDoctorAgenda(client, account) };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof AgendaBoundError
          ? "تجاوزت المواعيد أو سجلاتها حد العرض الآمن. لم تُعرض قائمة جزئية؛ راجع ملفات المرضى."
          : "تعذّر تحميل المواعيد. أعد المحاولة.",
    };
  }
}

export async function getDoctorWeek() {
  try {
    const client = await createClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return { ok: false as const };
    const account = await accountForUser(client, user);
    if (!account || account.role !== "doctor" || account.mustChangePassword)
      return { ok: false as const };
    return { ok: true as const, data: await readDoctorWeek(client, account) };
  } catch {
    return { ok: false as const };
  }
}
