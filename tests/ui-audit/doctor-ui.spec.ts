import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function checkDoctorSurface(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  const main = page.getByRole("main");
  await expect(main).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  const shell = await main.boundingBox();
  const bar = await nav.boundingBox();
  expect(Math.abs(shell!.x - bar!.x)).toBeLessThanOrEqual(1);
  expect(bar!.width).toBe(shell!.width);
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  for (const image of await main.locator("img").all()) {
    expect(
      await image.evaluate(
        (node: HTMLImageElement) => node.complete && node.naturalWidth > 0
      )
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
  });
}

test("Doctor navigation uses the Figma icons, four destinations and RTL active states", async ({
  page,
}) => {
  await page.goto("/demo/doctor");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await expect(nav.getByRole("link", { name: "الرئيسية" })).toHaveAttribute(
    "href",
    "/demo/doctor"
  );
  await expect(nav.getByRole("link", { name: "الحساب" })).toHaveAttribute(
    "href",
    "/demo/secretary/account"
  );
  await expect(nav.locator('[aria-current="page"] img')).toHaveAttribute(
    "src",
    "/rashaqa/nav-home-active.svg"
  );
  await expect(nav.locator('[aria-current="page"]')).toHaveCSS(
    "color",
    "rgb(15, 23, 42)"
  );
  const first = await nav.getByRole("link").first().boundingBox();
  const last = await nav.getByRole("link").last().boundingBox();
  expect(first!.x).toBeGreaterThan(last!.x);
  await nav.getByRole("link", { name: "البحث" }).focus();
  await expect(nav.getByRole("link", { name: "البحث" })).toHaveCSS(
    "outline-style",
    "solid"
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/demo\/doctor\/search$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("البحث");
  await checkDoctorSurface(page, "search");
});

test("D1 presents existing current-patient metadata and queue status without changing links", async ({
  page,
}) => {
  await page.goto("/demo/doctor");
  const current = page.locator(".doctor-current");
  await expect(current).toContainText("نور الحسن");
  await expect(current.locator(".doctor-current-summary")).toContainText(
    "74.8 كغ"
  );
  await expect(
    current.getByRole("link", { name: "فتح الملف" })
  ).toHaveAttribute("href", "/demo/doctor/patients/demo-noor");
  await expect(current.locator(".visit-badge")).toHaveCount(0);
  await expect(page.locator(".doctor-queue .doctor-waiting")).toHaveCount(2);
  await expect(page.locator(".doctor-queue ol .doctor-ready")).toHaveCount(1);
  await expect(page.locator(".doctor-stats strong")).toHaveText(["6", "5"]);
  await checkDoctorSurface(page, "d1");
});

test("D3 matches the patient-row type scale and preserves filtering, empty state and record navigation", async ({
  page,
}) => {
  await page.goto("/demo/doctor/patients");
  const search = page.getByLabel("اسم المريض أو رقم هاتفه");
  const row = page.locator(".patient-result").first();
  await expect(row.locator("strong")).toHaveCSS("font-size", "16px");
  await expect(row.locator("strong")).toHaveCSS("font-weight", "600");
  await expect(row.locator("small")).toHaveCSS("line-height", "16px");
  await expect(search).toHaveCSS("background-color", "rgb(241, 245, 249)");
  await checkDoctorSurface(page, "d3");
  await search.fill("غير موجود");
  await expect(page.locator(".patient-result")).toHaveCount(0);
  await expect(
    page.getByText("لا توجد نتائج. جرّب اسماً أو رقماً آخر.")
  ).toBeVisible();
  await search.fill("نور");
  await expect(page.locator(".patient-result")).toHaveCount(1);
  await page.getByRole("button", { name: /^زيادة وزن/ }).click();
  await expect(page.locator(".patient-result")).toHaveCount(0);
  await page.getByRole("button", { name: /^الكل/ }).click();
  await page.getByRole("link", { name: /نور الحسن/ }).click();
  await expect(page).toHaveURL(/\/demo\/doctor\/patients\/demo-noor$/);
});

test("D4 preserves clinical content and visit access with aligned RTL header and primary typography", async ({
  page,
}) => {
  await page.goto("/demo/doctor/patients/demo-noor");
  const header = page.locator(".doctor-record-header");
  const back = await header.getByRole("link", { name: "العودة" }).boundingBox();
  const title = await header.locator("h1").boundingBox();
  expect(back!.x).toBeGreaterThan(title!.x);
  expect(back!.height).toBeGreaterThanOrEqual(44);
  await expect(header).toContainText("الهدف: نقص وزن");
  await expect(page.locator(".patient-progress h2")).toHaveCSS(
    "font-size",
    "14px"
  );
  await expect(page.locator(".demo-measurements > div")).toHaveCount(9);
  const visit = page.getByRole("link", { name: "زيارة اليوم", exact: true });
  await expect(visit).toHaveCSS("font-size", "16px");
  await expect(visit).toHaveCSS("font-weight", "700");
  await expect(visit).toHaveCSS("line-height", "24px");
  await checkDoctorSurface(page, "d4");
  await visit.click();
  await expect(
    page.getByRole("heading", { name: "زيارة اليوم", exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".visit-weight")).toContainText("74.8");
});

test("Doctor surfaces wrap long Arabic names and mixed-direction metadata without overflow or backend writes", async ({
  page,
}) => {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method()))
      writes.push(request.url());
  });
  await page.goto("/demo/secretary/confirm?patient=demo-reem");
  await page.getByRole("button", { name: "إضافة للدور", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/secretary\?added=1&/);
  // Change only this isolated browser context's fictional state, never a fixture
  // file or a hosted clinical record. App routes remain the real Next routes.
  await page.evaluate(() => {
    const key = "mayanaa-demo-v1:public";
    const state = JSON.parse(localStorage.getItem(key)!);
    state.patients.forEach((patient: { name: string; phone: string }) => {
      patient.name = "اسم مريض عربي طويل جداً لاختبار التفاف النص والاتجاه";
      patient.phone = "+12025550105";
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  // A fresh document reads the deliberately long public-only demo state.
  for (const route of [
    "/demo/doctor",
    "/demo/doctor/patients",
    "/demo/doctor/patients/demo-noor",
  ]) {
    await page.goto(route);
    await expect(
      page
        .getByText("اسم مريض عربي طويل جداً لاختبار التفاف النص والاتجاه", {
          exact: true,
        })
        .first()
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
  }
  expect(writes).toEqual([]);
});

test("patient record tabs show progress and visits", async ({ page }) => {
  await page.goto("/demo/doctor/patients/demo-reem");
  await page.getByRole("tab", { name: "التطور" }).click();
  await expect(page.getByRole("img", { name: /الوزن \(كغ\)/ })).toBeVisible();
  await page.getByRole("button", { name: "الدهون" }).click();
  await expect(page.getByRole("button", { name: "الدهون" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await page.getByRole("tab", { name: "الزيارات" }).click();
  await expect(page.locator(".record-visits li")).toHaveCount(2);
});
