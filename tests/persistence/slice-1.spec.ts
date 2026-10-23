import { randomBytes, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (
  process.env.PERSISTENCE_TEST_LOCAL !== "1" ||
  new URL(url).origin !== "http://127.0.0.1:55431"
) {
  throw new Error(
    "Persistence tests must be started by the isolated local runner"
  );
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, options);
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
type Actor = {
  id: string;
  email: string;
  password: string;
  db: SupabaseClient;
};
const actors: Actor[] = [];
const clinics: string[] = [];
let doctor: Actor,
  secretary: Actor,
  other: Actor,
  inactive: Actor,
  firstUse: Actor;
let clinic: string, clinicB: string;
const full = {
  weight: "74.8",
  fat: "31.2",
  muscle: "26.1",
  visceral: "8",
  bmr: "1460",
  waist: "86",
  arm: "28",
  thigh: "54",
  hip: "101",
};

async function actor(
  name: string,
  role: "doctor" | "secretary",
  clinicId?: string,
  flags = {}
) {
  const email = `slice1-${name}-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(18).toString("hex")}`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  const user = created.data.user!;
  const db = createClient(url, key, options);
  const result = { id: user.id, email, password, db };
  actors.push(result);
  let target = clinicId;
  if (!target) {
    target = randomUUID();
    expect(
      (
        await admin
          .from("clinics")
          .insert({
            id: target,
            name: "Synthetic test clinic",
            doctor_user_id: user.id,
          })
      ).error
    ).toBeNull();
    clinics.push(target);
  }
  expect(
    (
      await admin
        .from("clinic_staff")
        .insert({
          user_id: user.id,
          clinic_id: target,
          role,
          login_email: email,
          display_name: name,
          active: true,
          must_change_password: false,
          ...flags,
        })
    ).error
  ).toBeNull();
  expect(
    (await db.auth.signInWithPassword({ email, password })).error
  ).toBeNull();
  return { actor: result, clinic: target };
}
async function patient(db: SupabaseClient, name = "مريض خيالي") {
  const id = randomUUID();
  const args = {
    p_id: id,
    p_name: name,
    p_phone: `+1202${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`,
    p_height: "165",
    p_gender: "female",
    p_birth_year: "1994",
    p_goal: "نقص وزن",
  };
  const result = await db.rpc("clinical_create_patient", args);
  expect(result.error).toBeNull();
  return { id, args };
}
async function enqueue(db: SupabaseClient, id: string) {
  const result = await db.rpc("clinical_enqueue", {
    p_patient: id,
    p_kind: "full_exam",
  });
  expect(result.error).toBeNull();
  return String(result.data);
}
async function login(page: Page, who: Actor, path: string) {
  await page.goto("/");
  await page.getByLabel("البريد الإلكتروني").fill(who.email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
}

test.beforeAll(async () => {
  const a = await actor("doctor-a", "doctor");
  doctor = a.actor;
  clinic = a.clinic;
  secretary = (await actor("secretary-a", "secretary", clinic)).actor;
  const b = await actor("doctor-b", "doctor");
  other = b.actor;
  clinicB = b.clinic;
  inactive = (await actor("inactive", "secretary", clinic, { active: false }))
    .actor;
  firstUse = (
    await actor("first-use", "secretary", clinic, {
      must_change_password: true,
    })
  ).actor;
});

test.afterAll(async () => {
  // Only the disposable local database is reachable; the runner also discards it.
  for (const id of clinics) {
    for (const table of [
      "visit_measurements",
      "visits",
      "daily_queue",
      "patients",
      "clinic_staff",
    ]) {
      expect(
        (await admin.from(table).delete().eq("clinic_id", id)).error
      ).toBeNull();
    }
    expect(
      (await admin.from("clinics").delete().eq("id", id)).error
    ).toBeNull();
  }
  for (const a of actors) {
    await a.db.auth.signOut();
    expect((await admin.auth.admin.deleteUser(a.id)).error).toBeNull();
  }
});

test("patient and enqueue retries retain one patient, dated queue entry and visit", async () => {
  const p = await patient(secretary.db);
  expect((await secretary.db.rpc("clinical_create_patient", p.args)).data).toBe(
    p.id
  );
  const entries = await Promise.all([
    enqueue(secretary.db, p.id),
    enqueue(secretary.db, p.id),
  ]);
  expect(entries[0]).toBe(entries[1]);
  const q = await secretary.db
    .from("daily_queue")
    .select("id,queue_date,revision")
    .eq("patient_id", p.id);
  expect(q.data).toHaveLength(1);
  expect(q.data![0].queue_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(
    (await secretary.db.from("visits").select("id").eq("queue_id", entries[0]))
      .data
  ).toHaveLength(1);
});

test("anonymous, other-clinic, inactive and first-use users cannot read or mutate clinical data", async () => {
  const p = await patient(secretary.db);
  const entry = await enqueue(secretary.db, p.id);
  const anon = createClient(url, key, options);
  for (const db of [anon, other.db, inactive.db, firstUse.db]) {
    const snapshot = await db.rpc("clinical_snapshot");
    if (!snapshot.error) {
      expect(
        snapshot.data.patients.some((row: { id: string }) => row.id === p.id)
      ).toBe(false);
      expect(
        snapshot.data.entries.some((row: { id: string }) => row.id === entry)
      ).toBe(false);
    }
    for (const table of [
      "patients",
      "daily_queue",
      "visits",
      "visit_measurements",
    ]) {
      const result = await db.from(table).select("id").eq("clinic_id", clinic);
      expect(result.error !== null || result.data?.length === 0).toBe(true);
    }
    expect(
      (await db.rpc("clinical_handoff", { p_entry: entry, p_revision: 0 }))
        .error
    ).not.toBeNull();
    expect(
      (
        await db.rpc("clinical_enqueue", {
          p_patient: p.id,
          p_kind: "full_exam",
        })
      ).error
    ).not.toBeNull();
  }
  for (const who of [inactive, firstUse]) {
    expect(
      (
        await who.db.rpc("clinical_create_patient", {
          ...p.args,
          p_id: randomUUID(),
        })
      ).error
    ).not.toBeNull();
  }
  // Doctors have read-only Slice 1 access, even via direct API requests.
  expect(
    (
      await doctor.db.rpc("clinical_enqueue", {
        p_patient: p.id,
        p_kind: "full_exam",
      })
    ).error
  ).not.toBeNull();
});

test("composite foreign keys reject clinic and patient relationship substitution", async () => {
  const p = await patient(secretary.db);
  const second = await patient(secretary.db);
  const entry = randomUUID();
  expect(
    (
      await admin
        .from("daily_queue")
        .insert({
          id: entry,
          clinic_id: clinic,
          patient_id: p.id,
          visit_type: "full_exam",
        })
    ).error
  ).toBeNull();
  const wrongPatient = await admin
    .from("visits")
    .insert({
      clinic_id: clinic,
      queue_id: entry,
      patient_id: second.id,
      created_by: secretary.id,
    });
  expect(wrongPatient.error?.code).toBe("23503");
  const wrongClinic = await admin
    .from("visits")
    .insert({
      clinic_id: clinicB,
      queue_id: entry,
      patient_id: p.id,
      created_by: other.id,
    });
  expect(wrongClinic.error?.code).toBe("23503");
  await enqueue(secretary.db, p.id);
  const visit = await secretary.db
    .from("visits")
    .select("id")
    .eq("queue_id", entry)
    .single();
  expect(
    (
      await admin
        .from("visit_measurements")
        .insert({
          clinic_id: clinicB,
          visit_id: visit.data!.id,
          recorded_by: other.id,
          request_id: randomUUID(),
          request_payload: {},
          expected_revision: 0,
          weight_kg: 70,
        })
    ).error
  ).not.toBeNull();
});

test("measurements enforce ranges, revisions, retries, serialized races and immutable handoff", async () => {
  const p = await patient(secretary.db);
  const entry = await enqueue(secretary.db, p.id);
  expect(
    (
      await secretary.db.rpc("clinical_handoff", {
        p_entry: entry,
        p_revision: 0,
      })
    ).error
  ).not.toBeNull();
  const save = {
    p_entry: entry,
    p_revision: 0,
    p_request: randomUUID(),
    p_values: full,
  };
  expect(
    (
      await secretary.db.rpc("clinical_save_measurements", {
        ...save,
        p_values: { ...full, weight: "9999" },
      })
    ).error
  ).not.toBeNull();
  expect(
    (await secretary.db.rpc("clinical_save_measurements", save)).error
  ).toBeNull();
  expect(
    (await secretary.db.rpc("clinical_save_measurements", save)).error
  ).toBeNull();
  expect(
    (
      await secretary.db
        .from("daily_queue")
        .select("status,revision")
        .eq("id", entry)
        .single()
    ).data
  ).toMatchObject({ status: "ready", revision: 1 });
  expect(
    (
      await secretary.db.rpc("clinical_save_measurements", {
        ...save,
        p_request: randomUUID(),
        p_values: { ...full, weight: "75" },
      })
    ).error?.code
  ).toBe("40001");
  const races = await Promise.all(
    ["75", "76"].map((weight) =>
      secretary.db.rpc("clinical_save_measurements", {
        ...save,
        p_revision: 1,
        p_request: randomUUID(),
        p_values: { ...full, weight },
      })
    )
  );
  expect(races.filter((r) => !r.error)).toHaveLength(1);
  expect(races.filter((r) => r.error?.code === "40001")).toHaveLength(1);
  const handed = await Promise.all(
    [1, 2].map(() =>
      secretary.db.rpc("clinical_handoff", { p_entry: entry, p_revision: 2 })
    )
  );
  expect(handed.every((r) => !r.error)).toBe(true);
  expect(
    (
      await secretary.db
        .from("daily_queue")
        .select("status,revision")
        .eq("id", entry)
        .single()
    ).data
  ).toMatchObject({ status: "with_doctor", revision: 3 });
  expect(
    (
      await secretary.db.rpc("clinical_save_measurements", {
        ...save,
        p_revision: 3,
        p_request: randomUUID(),
      })
    ).error
  ).not.toBeNull();
  const before = await doctor.db
    .from("visit_measurements")
    .select("id,weight_kg")
    .eq("clinic_id", clinic);
  expect(before.error).toBeNull();
  expect(
    (
      await doctor.db
        .from("visit_measurements")
        .update({ weight_kg: 1 })
        .eq("clinic_id", clinic)
        .select("id")
    ).data ?? []
  ).toHaveLength(0);
  expect(
    (
      await secretary.db
        .from("visit_measurements")
        .update({ weight_kg: 1 })
        .eq(
          "visit_id",
          (
            await secretary.db
              .from("visits")
              .select("id")
              .eq("queue_id", entry)
              .single()
          ).data!.id
        )
    ).error
  ).not.toBeNull();
});

test("direct updates cannot bypass measurement readiness or revision rules", async () => {
  const p = await patient(secretary.db);
  const entry = await enqueue(secretary.db, p.id);
  expect(
    (
      await secretary.db
        .from("daily_queue")
        .update({ status: "with_doctor", revision: 1 })
        .eq("id", entry)
    ).error
  ).not.toBeNull();
  expect(
    (
      await secretary.db
        .from("daily_queue")
        .update({ status: "ready", revision: 1 })
        .eq("id", entry)
    ).error
  ).not.toBeNull();
  expect(
    (
      await secretary.db
        .from("daily_queue")
        .update({ status: "waiting", revision: 4 })
        .eq("id", entry)
    ).error
  ).not.toBeNull();
  const snapshot = await secretary.db.rpc("clinical_snapshot");
  expect(snapshot.error).toBeNull();
  expect(
    snapshot.data.entries.find((q: { id: string }) => q.id === entry)
  ).toMatchObject({ status: "waiting", revision: 0 });
});

test("two independent browser sessions see the persisted Secretary to Doctor handoff", async ({
  browser,
}) => {
  const reception = await browser.newContext();
  const consulting = await browser.newContext();
  try {
    const s = await reception.newPage();
    const d = await consulting.newPage();
    await login(s, secretary, "/secretary");
    await login(d, doctor, "/doctor");
    expect((await new AxeBuilder({ page: s }).analyze()).violations).toEqual(
      []
    );
    await s.goto("/secretary/patients/new");
    const name = `مريض خيالي ${randomUUID().slice(0, 8)}`;
    await s.getByLabel("الاسم الكامل *", { exact: true }).fill(name);
    await s.getByLabel("رقم الهاتف *", { exact: true }).fill("+12025550199");
    await s.getByLabel("الطول *", { exact: true }).fill("165");
    await s.getByRole("button", { name: "حفظ ومتابعة الإضافة للدور" }).click();
    await expect(s).toHaveURL(/\/secretary\/confirm\?patient=/);
    await s.getByRole("button", { name: "إضافة للدور", exact: true }).click();
    const card = s.locator(".queue-card").filter({ hasText: name });
    await card.getByRole("link", { name: "أخذ القياس" }).click();
    for (const [key, label] of Object.entries({
      weight: "الوزن",
      fat: "نسبة الدهون",
      muscle: "الكتلة العضلية",
      visceral: "الدهون الحشوية",
      bmr: "الحرق الأساسي",
      waist: "الخصر",
      arm: "الذراع",
      thigh: "الفخذ",
      hip: "الورك",
    })) {
      await s
        .getByRole("textbox", { name: label, exact: true })
        .fill(full[key as keyof typeof full]);
    }
    await s.getByRole("button", { name: "حفظ القياسات وتجهيز للدخول" }).click();
    await expect(s).toHaveURL(/measured=1/);
    await s
      .locator(".queue-card")
      .filter({ hasText: name })
      .getByRole("button", { name: "إدخال عند الطبيب" })
      .click();
    await expect(s).toHaveURL(/sent=1/);
    // No shared storage state, context or localStorage synchronization.
    await expect(
      d.locator(".queue-card").filter({ hasText: name })
    ).toBeVisible({ timeout: 15000 });
    const doctorCard = d.locator(".queue-card").filter({ hasText: name });
    await doctorCard.getByRole("link", { name: "فتح الملف والقياسات" }).click();
    const storedPatient = await secretary.db
      .from("patients")
      .select("id")
      .eq("full_name", name)
      .single();
    const storedVisit = await secretary.db
      .from("visits")
      .select("id")
      .eq("patient_id", storedPatient.data!.id)
      .single();
    await expect(d).toHaveURL(
      new RegExp(`/doctor/visits/${storedVisit.data!.id}$`)
    );
    await expect(d.getByRole("heading", { name })).toBeVisible();
    await expect(d.locator(".demo-measurements")).toContainText("74.8");
    expect((await new AxeBuilder({ page: d }).analyze()).violations).toEqual(
      []
    );
    await d.reload();
    await expect(d.locator(".demo-measurements")).toContainText("74.8");
    await expect(d.getByRole("button", { name: /إنهاء الزيارة/ })).toHaveCount(
      0
    );
    expect(
      await s.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith("mayanaa-demo-v1:"))
      )
    ).toBe(false);
    expect(
      await d.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith("mayanaa-demo-v1:"))
      )
    ).toBe(false);
  } finally {
    await reception.close();
    await consulting.close();
  }
});
