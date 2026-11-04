import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// This suite runs only in the disposable Docker-backed PR CI stack.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (process.env.CLINICAL_TEST_LOCAL !== "1" || url !== "http://127.0.0.1:55431")
  throw new Error("Print plan tests require the disposable clinical runner");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, options);
const password = `${randomUUID()}aA1!`;
const privateNote = `PRIVATE-PRINT-NOTE-${randomUUID()}`;
const meal = `وجبة اختبار الطباعة ${randomUUID()}`;
const actors: {
  email: string;
  id: string;
  role: "doctor" | "secretary";
  clinic: string;
}[] = [];
let entryId: string;
let pendingId: string;
const patientName = "مريض الطباعة الخيالي";

test.beforeAll(async () => {
  for (const [index, role] of (
    ["doctor", "secretary", "doctor"] as const
  ).entries()) {
    const email = `print-${randomUUID()}@example.test`;
    const user = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (user.error) throw user.error;
    let clinic = actors[0]?.clinic;
    if (index !== 1) {
      const created = await admin
        .from("clinics")
        .insert({
          name: "عيادة الطباعة الخيالية",
          doctor_user_id: user.data.user!.id,
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      clinic = created.data.id;
    }
    const actor = { email, id: user.data.user!.id, role, clinic };
    actors.push(actor);
    const staff = await admin.from("clinic_staff").insert({
      user_id: actor.id,
      clinic_id: clinic,
      role,
      login_email: email,
      display_name: "Synthetic print actor",
      active: true,
      must_change_password: false,
    });
    if (staff.error) throw staff.error;
  }
  const api = createClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    options
  );
  const signed = await api.auth.signInWithPassword({
    email: actors[1].email,
    password,
  });
  if (signed.error) throw signed.error;
  async function rpc(name: string, args: Record<string, unknown>) {
    const result = await api.rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }
  const patientId = randomUUID();
  await rpc("clinical_create_patient", {
    p_id: patientId,
    p_clinic: actors[0].clinic,
    p_name: patientName,
    p_phone: "+12025550197",
    p_height: 170,
    p_gender: "female",
    p_birth_year: 1990,
    p_goal: "نقص وزن",
  });
  let queue = await rpc("clinical_enqueue", {
    p_clinic: actors[0].clinic,
    p_patient: patientId,
    p_kind: "full_exam",
  });
  queue = await rpc("clinical_save_measurements", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_values: {
      weight: 80,
      fat: 20,
      muscle: 30,
      visceral: 7,
      bmr: 1600,
      waist: 85,
      arm: 30,
      thigh: 50,
      hip: 100,
    },
  });
  queue = await rpc("clinical_handoff", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_request: randomUUID(),
  });
  const doctor = await api.auth.signInWithPassword({
    email: actors[0].email,
    password,
  });
  if (doctor.error) throw doctor.error;
  await rpc("clinical_finish", {
    p_queue: queue.id,
    p_revision: queue.revision,
    p_request: randomUUID(),
    p_notes: privateNote,
    p_days: [
      {
        id: randomUUID(),
        meals: [{ id: randomUUID(), type: "فطور", description: meal }],
      },
    ],
    p_appointment: new Date(Date.now() + 7 * 86400000)
      .toISOString()
      .slice(0, 10),
  });
  entryId = queue.id;
  const pendingPatient = randomUUID();
  await rpc("clinical_create_patient", {
    p_id: pendingPatient,
    p_clinic: actors[0].clinic,
    p_name: "مريض زيارة غير مكتملة",
    p_phone: "+12025550198",
    p_height: 170,
    p_gender: "male",
    p_birth_year: 1990,
    p_goal: "نقص وزن",
  });
  pendingId = (
    await rpc("clinical_enqueue", {
      p_clinic: actors[0].clinic,
      p_patient: pendingPatient,
      p_kind: "full_exam",
    })
  ).id;
  await api.auth.signOut();
  // Completed records are immutable; the owning runner destroys the entire
  // disposable stack on exit. Do not bypass guards to delete this fixture.
});

async function login(page: Page, index: number) {
  await page.goto("/");
  await page.getByLabel("البريد الإلكتروني").fill(actors[index].email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
  await expect(page).toHaveURL(`/${actors[index].role}`);
}

test("owning doctor: server HTML and hydrated print document never contain private notes", async ({
  page,
}) => {
  await login(page, 0);
  const response = await page.goto(`/doctor/visits/${entryId}/print`);
  const html = await response!.text();
  expect(html).not.toContain(privateNote);
  await expect(page.getByRole("article")).toContainText(patientName);
  await expect(page.getByRole("article")).toContainText(meal);
  await expect(page.getByRole("article")).toContainText(
    "عيادة الطباعة الخيالية"
  );
  expect(await page.content()).not.toContain(privateNote);
  await page.goto(`/doctor/visits/${entryId}`);
  await expect(page.getByLabel("ملاحظاتي")).toHaveValue(privateNote);
  await page.getByRole("link", { name: "طباعة البرنامج" }).click();
  await expect(page.getByRole("article")).toContainText(meal);
  expect(await page.content()).not.toContain(privateNote);
  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByRole("button", { name: "طباعة", exact: true })
  ).toBeHidden();
});

test("owning doctor gets a clear Arabic message for an incomplete visit", async ({
  page,
}) => {
  await login(page, 0);
  await page.goto(`/doctor/visits/${pendingId}/print`);
  await expect(page.getByRole("status")).toContainText(
    "لا يمكن طباعة البرنامج قبل اكتمال الزيارة"
  );
  await expect(page.getByRole("article")).toHaveCount(0);
});

for (const [index, name] of [
  [1, "secretary"],
  [2, "other clinic doctor"],
] as const) {
  test(`${name} receives no print plan in server HTML or DOM`, async ({
    page,
  }) => {
    await login(page, index);
    const response = await page.goto(`/doctor/visits/${entryId}/print`);
    const html = await response!.text();
    expect(html).not.toContain(privateNote);
    expect(html).not.toContain(meal);
    if (index === 1) await expect(page).toHaveURL("/secretary");
    else
      await expect(page.getByRole("status")).toContainText("الزيارة غير متاحة");
    await expect(page.getByRole("article")).toHaveCount(0);
    expect(await page.content()).not.toContain(meal);
    expect(await page.content()).not.toContain(privateNote);
  });
}
