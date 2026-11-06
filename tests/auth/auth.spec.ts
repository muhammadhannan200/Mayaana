import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServer, type Server } from "node:http";
import {
  exercisePasswordVisibility,
  expectPasswordToggleLayout,
} from "../password-visibility";

// Fault injection belongs to this test-only HTTP proxy, never to application code.
const upstream = "http://127.0.0.1:55431";
const password = process.env.AUTH_TEST_PASSWORD!;
const admin = createClient(upstream, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const roles = [
  "doctor",
  "secretary",
  "inactive",
  "first-doctor",
  "first-secretary",
  "first-activation",
] as const;
type Identity = (typeof roles)[number];
const ids = new Map<Identity, string>();
let clinic: string;
let server: Server;
let fault = false;
let failLogout = false;
let failActivation = false;
let hold: Promise<void> | undefined;
let release: (() => void) | undefined;
let passwordRequests = 0;
let logoutFailures = 0;

function checked(error: unknown) {
  if (error) throw error;
}
async function login(page: Page, role: Identity, secret = password) {
  await page.goto("/");
  await page.getByLabel("البريد الإلكتروني").fill(`${role}@auth.example.test`);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "دخول", exact: true }).click();
}

test.beforeAll(async () => {
  if (
    process.env.AUTH_TEST_LOCAL !== "1" ||
    !password ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55439"
  )
    throw new Error("Isolated runner required");
  server = createServer(async (req, res) => {
    try {
      if (
        (failLogout && req.url?.startsWith("/auth/v1/logout")) ||
        (failActivation &&
          req.method === "PATCH" &&
          req.url?.startsWith("/rest/v1/clinic_staff"))
      ) {
        if (failLogout && req.url?.startsWith("/auth/v1/logout"))
          logoutFailures++;
        res.writeHead(failActivation ? 403 : 503, {
          "content-type": "application/json",
        });
        res.end(JSON.stringify({ message: "Synthetic local auth failure" }));
        return;
      }
      if (req.url?.startsWith("/auth/v1/token?grant_type=password")) {
        passwordRequests++;
        if (hold) await hold;
        if (fault) {
          res.writeHead(503, { "content-type": "application/json" });
          res.end(JSON.stringify({ message: "Synthetic local outage" }));
          return;
        }
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value && !["host", "connection", "content-length"].includes(key))
          headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }
      const incoming = new URL(req.url ?? "/", "http://127.0.0.1:55439");
      const endpoints = [
        "http://127.0.0.1:55431/auth/v1/token",
        "http://127.0.0.1:55431/auth/v1/user",
        "http://127.0.0.1:55431/auth/v1/logout",
        "http://127.0.0.1:55431/rest/v1/clinic_staff",
        "http://127.0.0.1:55431/rest/v1/patients",
        "http://127.0.0.1:55431/rest/v1/daily_queue",
        "http://127.0.0.1:55431/rest/v1/visits",
        "http://127.0.0.1:55431/rest/v1/visit_measurements",
        "http://127.0.0.1:55431/rest/v1/visit_private_notes",
        "http://127.0.0.1:55431/rest/v1/diet_plans",
        "http://127.0.0.1:55431/rest/v1/appointments",
        "http://127.0.0.1:55431/rest/v1/rpc/clinical_snapshot",
      ];
      const endpoint = endpoints.find(
        (value) => new URL(value).pathname === incoming.pathname
      );
      if (!endpoint) {
        res.writeHead(404);
        res.end();
        return;
      }
      const destination = new URL(endpoint);
      destination.search = incoming.search;
      const response = await fetch(destination, {
        method: req.method,
        headers,
        body: chunks.length ? Buffer.concat(chunks) : undefined,
        redirect: "manual",
      });
      response.headers.forEach((value, key) => {
        if (
          !["content-encoding", "content-length", "transfer-encoding"].includes(
            key
          )
        )
          res.setHeader(key, value);
      });
      res.writeHead(response.status);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(502);
      res.end();
    }
  });
  await new Promise<void>((resolve) =>
    server.listen(55439, "127.0.0.1", resolve)
  );
  for (const role of roles) {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${role}@auth.example.test`,
      password,
      email_confirm: true,
    });
    checked(error);
    ids.set(role, data.user!.id);
  }
  const { data, error } = await admin
    .from("clinics")
    .insert({
      name: "Synthetic Auth Clinic",
      doctor_user_id: ids.get("doctor"),
    })
    .select("id")
    .single();
  checked(error);
  clinic = data!.id;
  // Only one doctor per clinic. Each first-use doctor gets a separate clinic.
  const firstClinic = await admin
    .from("clinics")
    .insert({
      name: "Synthetic First Use",
      doctor_user_id: ids.get("first-doctor"),
    })
    .select("id")
    .single();
  checked(firstClinic.error);
  for (const role of roles) {
    checked(
      (
        await admin.from("clinic_staff").insert({
          user_id: ids.get(role),
          clinic_id: role === "first-doctor" ? firstClinic.data!.id : clinic,
          role: role.includes("doctor") ? "doctor" : "secretary",
          login_email: `${role}@auth.example.test`,
          display_name: role,
          active: role !== "inactive",
          must_change_password: role.startsWith("first-"),
        })
      ).error
    );
  }
});

test.afterEach(() => {
  fault = false;
  failLogout = false;
  failActivation = false;
  release?.();
  release = undefined;
  hold = undefined;
});
test.afterAll(async () => {
  // Stack is also destroyed by the runner on every exit, including fixture failure.
  if (ids.size) {
    checked(
      (
        await admin
          .from("clinic_staff")
          .delete()
          .in("user_id", [...ids.values()])
      ).error
    );
    checked(
      (
        await admin
          .from("clinics")
          .delete()
          .in("doctor_user_id", [...ids.values()])
      ).error
    );
    for (const id of ids.values())
      checked((await admin.auth.admin.deleteUser(id)).error);
  }
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

for (const role of ["doctor", "secretary"] as const) {
  test(`${role}: real login, role denial, reload/navigation persistence, sign out`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(page).toHaveURL(`/${role}`);
    await expect(
      page.getByRole("heading", {
        name: role === "doctor" ? /الخير/ : "دور اليوم",
        exact: true,
      })
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(`/${role}`);
    await page.goto(role === "doctor" ? "/secretary" : "/doctor");
    await expect(page).toHaveURL(`/${role}`);
    await page.goto(role === "doctor" ? "/doctor/staff" : "/secretary/account");
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL("/");
    await page.goBack();
    await expect(page).toHaveURL("/");
    await page.goto(`/${role}`);
    await expect(page).toHaveURL("/");
  });
}

test("unauthenticated protected routes redirect", async ({ page }) => {
  for (const path of ["/doctor", "/secretary", "/change-password"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
  }
});

for (const width of [320, 1280]) {
  test(`doctor: optional password Back uses a fixed destination and keyboard focus in RTL at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page, "doctor");
    await expect(page).toHaveURL("/doctor");
    await page.goto("/change-password?next=%2Fsecretary");
    const back = page.getByRole("link", { name: "رجوع", exact: true });
    await expect(back).toHaveAttribute("href", "/doctor");
    await expect(
      page.getByRole("button", { name: "تسجيل الخروج" })
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const current = page.getByLabel("كلمة المرور الحالية", { exact: true });
    await current.fill("Synthetic-unsaved-50!");
    await page
      .getByLabel("كلمة المرور الجديدة", { exact: true })
      .fill("Synthetic-new-50!");
    await current.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(back).toBeFocused();
    await expect(back).toHaveCSS("outline-style", "solid");
    await expect(back).toHaveCSS("outline-width", "3px");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(width);
    let submissions = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        new URL(request.url()).pathname === "/change-password"
      )
        submissions++;
    });
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/doctor");
    expect(submissions).toBe(0);
    // Back neither submits the incomplete form nor changes the login credential.
    await page.goto("/doctor/staff");
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL("/");
    await login(page, "doctor");
    await expect(page).toHaveURL("/doctor");
  });
}

for (const role of ["first-doctor", "first-secretary"] as const) {
  test(`${role}: mandatory password replacement retains Sign out without Back or route bypass`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page, role);
    await expect(page).toHaveURL("/change-password");
    await page.goto("/change-password?next=%2Fdoctor");
    await expect(
      page.getByRole("link", { name: "رجوع", exact: true })
    ).toHaveCount(0);
    await expect(
      page.locator('a[href="/doctor"], a[href="/secretary"]')
    ).toHaveCount(0);
    await expect(
      page.getByLabel("كلمة المرور الحالية", { exact: true })
    ).toHaveCount(0);
    const signOut = page.getByRole("button", { name: "تسجيل الخروج" });
    await expect(signOut).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(signOut).toBeFocused();
    for (const path of ["/doctor", "/secretary"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/change-password");
      await expect(
        page.getByRole("link", { name: "رجوع", exact: true })
      ).toHaveCount(0);
    }
    await signOut.click();
    await expect(page).toHaveURL("/");
    await page.goto("/change-password");
    await expect(page).toHaveURL("/");
  });
}

test("secretary: optional password change remains denied regardless of next", async ({
  page,
}) => {
  await login(page, "secretary");
  await expect(page).toHaveURL("/secretary");
  await page.goto("/change-password?next=%2Fdoctor");
  await expect(page).toHaveURL("/secretary");
  await expect(page.locator("form.auth-form")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "رجوع", exact: true })
  ).toHaveCount(0);
});

for (const role of ["doctor", "first-doctor", "first-secretary"] as const) {
  test(`${role}: independent password visibility, keyboard and unchanged form submission`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(page).toHaveURL(
      role === "doctor" ? "/doctor" : "/change-password"
    );
    await page.goto("/change-password");
    const labels =
      role === "doctor"
        ? ["كلمة المرور الحالية", "كلمة المرور الجديدة", "تأكيد كلمة المرور"]
        : ["كلمة المرور الجديدة", "تأكيد كلمة المرور"];
    await expect(page.locator(".password-visibility-toggle")).toHaveCount(
      labels.length
    );
    const before = passwordRequests;
    await exercisePasswordVisibility(page, labels);
    await expectPasswordToggleLayout(page);
    expect(passwordRequests).toBe(before);
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).press("Enter");
    await expect(page.locator("form.auth-form")).toHaveAttribute(
      "data-test-submits",
      "1"
    );
    await expect(page).toHaveURL("/change-password");
    await page.reload();
    for (const label of labels) {
      await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
        "type",
        "password"
      );
    }
  });
}

for (const role of ["doctor", "first-doctor", "first-secretary"] as const) {
  test(`${role}: accessible password validation, correction and repeated submission`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(page).toHaveURL(
      role === "doctor" ? "/doctor" : "/change-password"
    );
    await page.goto("/change-password");
    const next = page.getByLabel("كلمة المرور الجديدة", { exact: true });
    const confirmation = page.getByLabel("تأكيد كلمة المرور", { exact: true });
    const save = page.getByRole("button", {
      name: "حفظ كلمة المرور",
      exact: true,
    });
    const current = page.getByLabel("كلمة المرور الحالية", { exact: true });
    const before = passwordRequests;
    await save.click();
    await expect(role === "doctor" ? current : next).toBeFocused();
    await expect(next).toHaveAttribute("aria-invalid", "true");
    await expect(next).toHaveAttribute(
      "aria-describedby",
      "newPassword-hint newPassword-error"
    );
    await expect(confirmation).toHaveAccessibleDescription(
      /أدخل تأكيد كلمة المرور/
    );
    await expect(page.locator("form.auth-form [role=alert]")).toHaveCount(1);
    if (role === "doctor") {
      await expect(current).toHaveAccessibleDescription(
        "أدخل كلمة المرور الحالية."
      );
      await current.fill("Synthetic-current-50!");
    }
    await next.fill("1234567");
    await confirmation.fill("1234567");
    await page
      .getByRole("button", { name: "إظهار كلمة المرور الجديدة", exact: true })
      .click();
    await save.click();
    await expect(next).toBeFocused();
    await expect(next).toHaveAccessibleDescription(/8 أحرف على الأقل/);
    await expect(next).toHaveValue("1234567");
    await expect(next).toHaveAttribute("type", "text");
    await next.fill("12345678");
    await expect(next).toHaveAttribute("aria-invalid", "false");
    await expect(confirmation).toHaveAttribute("aria-invalid", "true");
    await save.click();
    await expect(confirmation).toBeFocused();
    await expect(confirmation).toHaveAccessibleDescription(/غير مطابق/);
    await save.click();
    await expect(confirmation).toBeFocused();
    await expect(page.locator("#confirmation-error")).toHaveCount(1);
    await expect(page.locator("form.auth-form [role=alert]")).toHaveCount(1);
    await confirmation.fill("12345678");
    await expect(confirmation).toHaveAttribute("aria-invalid", "false");
    await expect(next).toHaveAccessibleDescription("استخدم 8 أحرف على الأقل.");
    await expect(confirmation).toHaveAccessibleDescription(
      "أعد إدخال كلمة المرور الجديدة نفسها."
    );
    await expect(next).toHaveAttribute("type", "text");
    await expect(next).toHaveAttribute("autocomplete", "new-password");
    await expectPasswordToggleLayout(page);
    // At the eight-character boundary, verify native submission without mutation.
    await page.locator("form.auth-form").evaluate((form) => {
      form.addEventListener(
        "submit",
        (event) => {
          event.preventDefault();
          form.setAttribute("data-valid-submit", "true");
        },
        { capture: true, once: true }
      );
    });
    await confirmation.press("Enter");
    await expect(page.locator("form.auth-form")).toHaveAttribute(
      "data-valid-submit",
      "true"
    );
    expect(passwordRequests).toBe(before);
  });
}

for (const role of [
  "doctor",
  "secretary",
  "first-doctor",
  "first-secretary",
] as const) {
  test(`${role}: legacy recovery guidance preserves the existing session and route restrictions`, async ({
    page,
  }) => {
    await login(page, role);
    const destination = role.startsWith("first-")
      ? "/change-password"
      : `/${role}`;
    await expect(page).toHaveURL(destination);
    const before = passwordRequests;
    await page.goto(
      "/?code=synthetic-legacy-code&next=https://example.invalid"
    );
    await expect(
      page.getByRole("heading", { name: "استعادة الوصول للحساب", exact: true })
    ).toBeVisible();
    await expect(page.locator("form, input")).toHaveCount(0);
    await page
      .getByRole("link", { name: "العودة لتسجيل الدخول", exact: true })
      .click();
    await expect(page).toHaveURL(destination);
    expect(passwordRequests).toBe(before);
  });
}

test("invalid credentials and inactive staff use generic denial", async ({
  page,
}) => {
  await login(page, "doctor", password + "wrong");
  await expect(page.locator("p[role=alert]")).toHaveText(
    "البريد الإلكتروني أو كلمة المرور غير صحيحة."
  );
  await login(page, "inactive");
  await expect(page.locator("p[role=alert]")).toHaveText(
    "البريد الإلكتروني أو كلمة المرور غير صحيحة."
  );
  await page.goto("/secretary");
  await expect(page).toHaveURL("/");
});

test("backend failure is distinct from credentials", async ({ page }) => {
  fault = true;
  await login(page, "doctor");
  await expect(page.locator("p[role=alert]")).toHaveText(
    "تعذّر الاتصال بالخدمة. حاول مرة أخرى."
  );
  await expect(page).toHaveURL("/");
});

test("pending login prevents duplicate submit", async ({ page }) => {
  hold = new Promise((resolve) => {
    release = resolve;
  });
  const before = passwordRequests;
  await login(page, "secretary");
  await expect(
    page.getByRole("button", { name: "جارٍ الدخول…" })
  ).toBeDisabled();
  await page.getByLabel("كلمة المرور", { exact: true }).press("Enter");
  await expect.poll(() => passwordRequests).toBe(before + 1);
  release!();
  hold = undefined;
  await expect(page).toHaveURL("/secretary");
  expect(passwordRequests).toBe(before + 1);
});

test("failed sign-out is visible, does not claim success, and can be retried", async ({
  page,
}) => {
  await login(page, "doctor");
  await expect(page).toHaveURL("/doctor");
  await expect(page.getByRole("heading", { name: /الخير/ })).toBeVisible();
  await page.goto("/doctor/staff");
  const failuresBefore = logoutFailures;
  failLogout = true;
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText(
    "تعذّر تسجيل الخروج. حاول مرة أخرى."
  );
  await expect(page).toHaveURL("/doctor/staff");
  expect(logoutFailures).toBeGreaterThan(failuresBefore);
  await page.reload();
  await expect(page).toHaveURL("/doctor/staff");
  failLogout = false;
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/doctor");
  await expect(page).toHaveURL("/");
});

test("password update with failed activation stays protected and recovers with the new session", async ({
  page,
}) => {
  await login(page, "first-activation");
  await expect(page).toHaveURL("/change-password");
  failActivation = true;
  await page
    .getByLabel("كلمة المرور الجديدة", { exact: true })
    .fill(password + "partial");
  await page
    .getByLabel("تأكيد كلمة المرور", { exact: true })
    .fill(password + "partial");
  await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(page.locator("p[role=alert]")).toContainText(
    "تغيّرت كلمة المرور، لكن تعذّر إكمال التفعيل"
  );
  const staff = await admin
    .from("clinic_staff")
    .select("must_change_password")
    .eq("user_id", ids.get("first-activation")!)
    .single();
  checked(staff.error);
  expect(staff.data!.must_change_password).toBe(true);
  await page.goto("/secretary");
  await expect(page).toHaveURL("/change-password");
  await page.reload();
  await expect(page).toHaveURL("/change-password");
  failActivation = false;
  await page
    .getByLabel("كلمة المرور الجديدة", { exact: true })
    .fill(password + "recovered");
  await page
    .getByLabel("تأكيد كلمة المرور", { exact: true })
    .fill(password + "recovered");
  await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await expect(page).toHaveURL("/secretary");
  await page.goto("/secretary/account");
  await page.getByRole("button", { name: "تسجيل الخروج" }).click();
  await expect(page).toHaveURL("/");
  await login(page, "first-activation", password + "recovered");
  await expect(page).toHaveURL("/secretary");
});

for (const role of ["first-doctor", "first-secretary"] as const) {
  test(`${role}: forced password setup, validations, activation and valid session`, async ({
    page,
  }) => {
    await login(page, role);
    await expect(page).toHaveURL("/change-password");
    for (const path of ["/doctor", "/secretary"]) {
      await page.goto(path);
      await expect(page).toHaveURL("/change-password");
    }
    // Remove HTML minLength only in the test to exercise trusted server validation.
    await page
      .locator("input")
      .evaluateAll((inputs) =>
        inputs.forEach((input) => input.removeAttribute("minlength"))
      );
    await page.getByLabel("كلمة المرور الجديدة", { exact: true }).fill("short");
    await page.getByLabel("تأكيد كلمة المرور", { exact: true }).fill("short");
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page.locator("#newPassword-error")).toContainText("8 أحرف");
    await page
      .getByLabel("كلمة المرور الجديدة", { exact: true })
      .fill(password + "new");
    await page
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill(password + "different");
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    await expect(page.locator("#confirmation-error")).toContainText(
      "غير مطابق"
    );
    await page
      .getByLabel("كلمة المرور الجديدة", { exact: true })
      .fill(password + "new");
    await page
      .getByLabel("تأكيد كلمة المرور", { exact: true })
      .fill(password + "new");
    await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
    const destination = role === "first-doctor" ? "/doctor" : "/secretary";
    await expect(page).toHaveURL(destination);
    const staff = await admin
      .from("clinic_staff")
      .select("must_change_password")
      .eq("user_id", ids.get(role)!)
      .single();
    checked(staff.error);
    expect(staff.data!.must_change_password).toBe(false);
    await page.reload();
    await expect(page).toHaveURL(destination);
    await page.goto("/");
    await expect(page).toHaveURL(destination);
    await page.goto(
      role === "first-secretary" ? "/secretary/account" : "/doctor/staff"
    );
    await page.getByRole("button", { name: "تسجيل الخروج" }).click();
    await expect(page).toHaveURL("/");
    await login(page, role, password + "new");
    await expect(page).toHaveURL(destination);
  });
}

// Keep the optional mutation last: earlier doctor cases use the original fixture
// password. This requires real isolated Auth; offline preflight is not a substitute.
test("doctor: wrong current password retains fields; corrected optional change takes effect", async ({
  page,
}) => {
  await login(page, "doctor");
  await expect(page).toHaveURL("/doctor");
  await page.goto("/change-password");
  const current = page.getByLabel("كلمة المرور الحالية", { exact: true });
  const next = page.getByLabel("كلمة المرور الجديدة", { exact: true });
  const confirmation = page.getByLabel("تأكيد كلمة المرور", { exact: true });
  const replacement = password + "optional";
  await current.fill(password + "wrong");
  await next.fill(replacement);
  await confirmation.fill(replacement);
  await page
    .getByRole("button", { name: "إظهار كلمة المرور الجديدة", exact: true })
    .click();
  await page
    .getByRole("button", { name: "حفظ كلمة المرور", exact: true })
    .click();
  await expect(page.locator("form.auth-form [role=alert]")).toHaveText(
    "تعذّر تغيير كلمة المرور. تحقق من البيانات وحاول مجدداً."
  );
  await expect(page).toHaveURL("/change-password");
  await expect(current).toHaveValue(password + "wrong");
  await expect(next).toHaveValue(replacement);
  await expect(confirmation).toHaveValue(replacement);
  await expect(next).toHaveAttribute("type", "text");
  await current.fill(password);
  await page
    .getByRole("button", { name: "حفظ كلمة المرور", exact: true })
    .click();
  await expect(page).toHaveURL("/doctor");
  await page.goto("/doctor/staff");
  await page.getByRole("button", { name: "تسجيل الخروج", exact: true }).click();
  await expect(page).toHaveURL("/");
  await login(page, "doctor", password);
  await expect(page.locator("form.auth-form [role=alert]")).toHaveText(
    "البريد الإلكتروني أو كلمة المرور غير صحيحة."
  );
  await login(page, "doctor", replacement);
  await expect(page).toHaveURL("/doctor");
  await page.reload();
  await expect(page).toHaveURL("/doctor");
});
