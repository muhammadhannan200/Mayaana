import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Refuse hosted infrastructure before constructing any privileged client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (process.env.CLINICAL_TEST_LOCAL !== "1" || url !== "http://127.0.0.1:55431")
  throw new Error(
    "Architecture characterization requires the disposable clinical runner"
  );
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, options);
const password = `${randomUUID()}aA1!`;
const actors: { id: string; email: string; role: "doctor" | "secretary" }[] =
  [];
let clinicId: string | undefined;

test.beforeAll(async () => {
  for (const role of ["doctor", "secretary"] as const) {
    const email = `architecture-${role}-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    actors.push({ id: created.data.user!.id, email, role });
  }
  const clinic = await admin
    .from("clinics")
    .insert({
      name: "Synthetic architecture clinic",
      doctor_user_id: actors[0].id,
    })
    .select("id")
    .single();
  if (clinic.error) throw clinic.error;
  clinicId = clinic.data.id;
  const staff = await admin.from("clinic_staff").insert(
    actors.map((actor) => ({
      user_id: actor.id,
      clinic_id: clinicId,
      role: actor.role,
      login_email: actor.email,
      display_name: `Synthetic ${actor.role}`,
      active: true,
      must_change_password: false,
    }))
  );
  if (staff.error) throw staff.error;
});

test.afterAll(async () => {
  // Only this file's synthetic records. The runner also destroys its owned
  // stack on every exit, including partial setup/cleanup failures.
  const errors: unknown[] = [];
  if (clinicId) {
    for (const table of ["patients", "clinic_staff", "clinics"]) {
      const result = await admin
        .from(table)
        .delete()
        .eq(table === "clinics" ? "id" : "clinic_id", clinicId);
      if (result.error) errors.push(result.error);
    }
  }
  for (const actor of actors) {
    const result = await admin.auth.admin.deleteUser(actor.id);
    if (result.error) errors.push(result.error);
  }
  expect(errors, "synthetic architecture fixture cleanup").toEqual([]);
});

for (const role of ["doctor", "secretary"] as const) {
  test(`${role}: direct live routes ignore poisoned local demo data and preserve the public store`, async ({
    page,
  }) => {
    const actor = actors.find((item) => item.role === role)!;
    const api = createClient(
      url,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      options
    );
    const secretary = actors.find((item) => item.role === "secretary")!;
    const signed = await api.auth.signInWithPassword({
      email: secretary.email,
      password,
    });
    if (signed.error) throw signed.error;
    const patientId = randomUUID();
    const patientName = `سجل معماري ${role}`;
    const created = await api.rpc("clinical_create_patient", {
      p_id: patientId,
      p_clinic: clinicId,
      p_name: patientName,
      p_phone: "+12025550192",
      p_height: 170,
      p_gender: "female",
      p_birth_year: 1990,
      p_goal: "نقص وزن",
    });
    if (created.error) throw created.error;
    await api.auth.signOut();

    await page.goto("/");
    const publicStore = JSON.stringify({
      patients: [
        {
          id: "architecture-local-only",
          name: "اسم مسموم محلي فقط",
          phone: "+12025550193",
          height: "170",
          gender: "female",
          birthYear: "1990",
          goal: "نقص وزن",
          visits: [],
        },
      ],
      queue: [],
    });
    await page.evaluate(
      ({ id, value }) => {
        localStorage.setItem("mayanaa-demo-v1:public", value);
        localStorage.setItem(`mayanaa-demo-v1:${id}`, value);
      },
      { id: clinicId!, value: publicStore }
    );
    await page.getByLabel("البريد الإلكتروني").fill(actor.email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "دخول", exact: true }).click();
    await expect(page).toHaveURL(`/${role}`);

    const path = `/${role}/patients`;
    // Live snapshots use same-origin Server Actions, not browser Supabase
    // Data API calls. Observe the transport as well as persisted read results.
    const snapshot = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        !!response.request().headers()["next-action"] &&
        new URL(response.url()).pathname === path
    );
    await page.goto(path);
    expect((await snapshot).ok()).toBe(true);
    await expect(
      page.getByRole("link", { name: new RegExp(patientName) })
    ).toBeVisible();
    await expect(page.getByText("اسم مسموم محلي فقط")).toHaveCount(0);
    await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
    await page.reload();
    await expect(
      page.getByRole("link", { name: new RegExp(patientName) })
    ).toBeVisible();
    await page.goto(
      role === "doctor" ? "/secretary/patients" : "/doctor/patients"
    );
    await expect(page).toHaveURL(`/${role}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      role === "doctor" ? "دور العيادة" : "دور اليوم"
    );
    await expect
      .poll(() =>
        page.evaluate(
          (id) => localStorage.getItem(`mayanaa-demo-v1:${id}`),
          clinicId!
        )
      )
      .toBeNull();
    const stores = await page.evaluate(() => ({
      local: Object.fromEntries(
        Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])
      ),
      session: Object.fromEntries(
        Object.keys(sessionStorage).map((key) => [
          key,
          sessionStorage.getItem(key),
        ])
      ),
    }));
    expect(stores).toEqual({
      local: { "mayanaa-demo-v1:public": publicStore },
      session: {},
    });
    const demoBackendRequests: string[] = [];
    page.on("request", (request) => {
      if (
        !["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
        /\/(rest|auth|storage)\/v1\//.test(new URL(request.url()).pathname)
      )
        demoBackendRequests.push(
          `${request.method()} ${new URL(request.url()).pathname}`
        );
    });
    await page.goto("/demo/doctor/patients/architecture-local-only");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "اسم مسموم محلي فقط"
    );
    await expect(page.getByText(patientName)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "اسم مسموم محلي فقط"
    );
    expect(
      demoBackendRequests,
      "demo must stay local even with a configured backend and signed-in session"
    ).toEqual([]);
  });
}
