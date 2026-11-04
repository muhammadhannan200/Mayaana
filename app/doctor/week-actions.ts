"use server";

import { accountForUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readDoctorWeek } from "@/lib/doctor-week";

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
