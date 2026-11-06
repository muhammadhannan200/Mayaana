import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// URL-shape checks only. These are deliberately fake values, not Auth tokens.
const arrivals = [
  "/?code=synthetic-code&next=https://example.invalid",
  "/?error=access_denied&error_code=otp_expired",
  "/?token_hash=synthetic-hash&type=recovery",
  "/#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery",
  "/#error=access_denied&error_code=otp_expired",
  "/auth/confirm?token_hash=synthetic-hash&type=recovery&next=//example.invalid",
];

test("legacy recovery arrivals explain administrator recovery without accepting tokens", async ({
  page,
  context,
}, testInfo) => {
  const unsafeRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      new URL(request.url()).origin !==
        new URL(testInfo.project.use.baseURL!).origin
    )
      unsafeRequests.push(request.method());
  });
  for (const arrival of arrivals) {
    await page.goto(arrival);
    await expect(
      page.getByRole("heading", { name: "استعادة الوصول للحساب", exact: true })
    ).toBeVisible();
    await expect(
      page.getByText("روابط البريد لا تغيّر كلمة المرور في هذا النظام.")
    ).toBeVisible();
    await expect(
      page.getByText(
        "السكرتيرة: تواصلي مع الطبيب · الطبيب: تواصل مع مسؤول النظام"
      )
    ).toBeVisible();
    await expect(page.locator("form, input")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("synthetic-");
    const back = page.getByRole("link", {
      name: "العودة لتسجيل الدخول",
      exact: true,
    });
    await expect(back).toHaveAttribute("href", "/");
    await back.focus();
    await expect(back).toBeFocused();
    await expect(back).toHaveCSS("outline-style", "solid");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  expect(await context.cookies()).toEqual([]);
  expect(
    await page.evaluate(() => [localStorage.length, sessionStorage.length])
  ).toEqual([0, 0]);
  expect(unsafeRequests).toEqual([]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if ([320, 1280].includes(page.viewportSize()!.width))
    await page.screenshot({
      path: testInfo.outputPath("recovery-guidance.png"),
      fullPage: true,
    });
  await page
    .getByRole("link", { name: "العودة لتسجيل الدخول", exact: true })
    .press("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByLabel("كلمة المرور", { exact: true })).toHaveAttribute(
    "type",
    "password"
  );
});

test("query recovery guidance works without JavaScript", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    for (const arrival of arrivals.filter((url) => !url.includes("#"))) {
      await page.goto(arrival);
      await expect(
        page.getByRole("heading", {
          name: "استعادة الوصول للحساب",
          exact: true,
        })
      ).toBeVisible();
      await expect(page.locator("form, input")).toHaveCount(0);
    }
    expect(await context.cookies()).toEqual([]);
  } finally {
    await context.close();
  }
});
