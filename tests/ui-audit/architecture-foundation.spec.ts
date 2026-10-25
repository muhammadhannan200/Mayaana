import AxeBuilder from "@axe-core/playwright";
import { expect, test as base } from "@playwright/test";

// Uses the existing blank-backend UI audit server. No test configuration or
// application switches are added. Each test receives a fresh browser context.
const test = base.extend<{ publicRequests: string[] }>({
  publicRequests: [
    async ({ page }, use) => {
      const unexpected: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (
          !["GET", "HEAD", "OPTIONS"].includes(request.method()) ||
          /\/rest\/v1\/|\/auth\/v1\/|\/storage\/v1\//.test(url.pathname) ||
          /(^|\.)supabase\.(co|in)$/.test(url.hostname)
        )
          unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
      });
      await use(unexpected);
      expect(
        unexpected,
        "public flows must not call clinical/Auth backends or write server actions"
      ).toEqual([]);
    },
    { auto: true },
  ],
});

test("direct demo and preview entry preserves role screens, RTL and accessibility", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/demo/secretary", "دور اليوم"],
    ["/demo/doctor", "صباح الخير دكتور"],
    ["/demo/doctor/patients/demo-noor", "نور الحسن"],
    ["/demo/doctor/visits/demo-featured", "زيارة اليوم"],
    ["/measurement-preview/full-exam", "قياس كامل"],
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    await expect(page.getByRole("main")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    const result = await new AxeBuilder({ page }).analyze();
    expect(
      result.violations,
      JSON.stringify(result.violations, null, 2)
    ).toEqual([]);
  }
});

test("demo intake persists only in the public browser key and survives direct Doctor reload", async ({
  page,
}) => {
  await page.goto("/demo/secretary/patients/new");
  await page.getByLabel("الاسم الكامل").fill("مريض أساس معماري خيالي");
  await page.getByLabel("رقم الهاتف").fill("+12025550191");
  await page.getByLabel("الطول").fill("170");
  await page.getByRole("button", { name: /حفظ ومتابعة/ }).click();
  await expect(page).toHaveURL(/\/demo\/secretary\/confirm\?patient=/);
  const id = new URL(page.url()).searchParams.get("patient")!;
  const stored = await page.evaluate(() => ({
    keys: Object.keys(localStorage).filter((key) =>
      key.startsWith("mayanaa-demo-v1:")
    ),
    state: JSON.parse(localStorage.getItem("mayanaa-demo-v1:public")!),
  }));
  expect(stored.keys).toEqual(["mayanaa-demo-v1:public"]);
  expect(stored.state.patients).toContainEqual(
    expect.objectContaining({ id, name: "مريض أساس معماري خيالي" })
  );
  await page.goto(`/demo/doctor/patients/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "مريض أساس معماري خيالي"
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "مريض أساس معماري خيالي"
  );
  await page.goto("/secretary");
  await expect(page).toHaveURL("/");
  expect(
    await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))
  ).toBe(JSON.stringify(stored.state));
});

test("signed-out direct Secretary and Doctor routes stay protected without demo fallback", async ({
  page,
}) => {
  for (const path of [
    "/secretary",
    "/secretary/search",
    "/secretary/confirm",
    "/secretary/patients/new",
    "/secretary/account",
    "/secretary/measurements/full-exam?entry=missing",
    "/doctor",
    "/doctor/patients",
    "/doctor/patients/missing",
    "/doctor/visits/missing",
    "/doctor/staff",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL("/");
    await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();
  }
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test("invalid public routes retain not-found behavior", async ({ page }) => {
  for (const path of [
    "/demo/unknown",
    "/demo/doctor/staff",
    "/measurement-preview/unknown",
  ]) {
    const response = await page.goto(path);
    // Existing Next streaming behavior can send the shell before notFound().
    expect([200, 404]).toContain(response?.status());
    await expect(
      page.getByRole("heading", { name: "404", exact: true })
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
      "content",
      /noindex/
    );
  }
});

test("valid demo routes with unknown records show recovery rather than another role screen", async ({
  page,
}) => {
  await page.goto("/demo/doctor/visits/missing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "الزيارة غير متاحة"
  );
  await expect(
    page.getByRole("link", { name: "العودة للرئيسية" })
  ).toHaveAttribute("href", "/demo/doctor");
  await page.goto("/demo/secretary/measurements/follow-up?entry=missing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "اختر مريضاً من الدور"
  );
  await expect(
    page.getByRole("link", { name: "العودة للدور" })
  ).toHaveAttribute("href", "/demo/secretary");
});
