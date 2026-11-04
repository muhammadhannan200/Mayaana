import "server-only";
import { createClient } from "./supabase/server";
import { accountForUser } from "./auth";
import type { ClinicalFailure, ClinicalResult } from "./clinical-types";
import {
  cancelUnavailableMessage,
  doctorOccupiedMessage,
} from "./queue-handoff";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const validId = (id: unknown): id is string =>
  typeof id === "string" && uuidPattern.test(id);
export const normalizeClinicalNumber = (value: string) =>
  value
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace("٫", ".");
export const invalid = () => {
  throw { code: "22023" };
};
export function failure(error: unknown): ClinicalFailure {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "PT409" &&
    "details" in error &&
    error.details === "clinic_occupied"
  )
    return { ok: false, kind: "conflict", message: doctorOccupiedMessage };
  if (
    error &&
    typeof error === "object" &&
    "details" in error &&
    error.details === "cancel_unavailable"
  )
    return { ok: false, kind: "conflict", message: cancelUnavailableMessage };
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  if (["AUTH", "42501", "PGRST301", "PGRST302", "PGRST303"].includes(code))
    return {
      ok: false,
      kind: "auth",
      message: "انتهت الجلسة أو لم يعد لديك صلاحية. سجّل الدخول مجدداً.",
    };
  if (["PT409", "40001", "23505", "55000"].includes(code))
    return {
      ok: false,
      kind: "conflict",
      message:
        "تغيّرت البيانات في جلسة أخرى. احتفظ بمدخلاتك وحدّث البيانات قبل المحاولة مجدداً.",
    };
  if (["22023", "22P02", "22007", "23514", "23502", "23503"].includes(code))
    return {
      ok: false,
      kind: "validation",
      message: "تعذّر الحفظ. تحقق من البيانات المطلوبة والقياسات والموعد.",
    };
  return {
    ok: false,
    kind: "network",
    message:
      "تعذّر الاتصال بالخدمة. لم يتم تأكيد الحفظ. احتفظ بمدخلاتك وحاول مجدداً.",
  };
}
export async function session(doctor = false) {
  const client = await createClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw { code: "AUTH" };
  const account = await accountForUser(client, user);
  if (
    !account ||
    account.mustChangePassword ||
    (doctor && account.role !== "doctor")
  )
    throw { code: "AUTH" };
  return { client, account };
}
export async function attempt<T>(
  operation: () => Promise<T>
): Promise<ClinicalResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return failure(error);
  }
}
export async function mutate(
  name: string,
  args: Record<string, unknown>,
  doctor = false
): Promise<ClinicalResult<null>> {
  return attempt(async () => {
    const { client } = await session(doctor);
    const { error } = await client.rpc(name, args);
    if (error) throw error;
    return null;
  });
}
