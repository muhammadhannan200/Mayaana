import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
});

test("public login has no detectable accessibility violations", async ({
  page,
}) => {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2)
  ).toEqual([]);
});

test("critical controls have labels and an explicit unavailable state", async ({
  page,
}) => {
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(".brand-mark")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".brand-mark")
        .evaluate((image: HTMLImageElement) => image.naturalWidth)
    )
    .toBeGreaterThan(0);
  await expect(page.getByLabel("البريد الإلكتروني")).toHaveAttribute(
    "type",
    "email"
  );
  await expect(page.getByLabel("كلمة المرور")).toHaveAttribute(
    "type",
    "password"
  );
  await expect(page.getByRole("button", { name: "دخول" })).toBeDisabled();
  await expect(page.locator("main [role='alert']")).toBeVisible();
});

test("public login fits within the viewport without horizontal overflow", async ({
  page,
}) => {
  const geometry = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const criticalElements = [
      document.querySelector(".auth-panel"),
      ...document.querySelectorAll("input, button"),
    ];

    return {
      viewport,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      controlsOutsideViewport: criticalElements.flatMap((element) => {
        if (!element) return ["missing critical element"];
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > viewport + 1
          ? [
              `${element.tagName.toLowerCase()} at ${bounds.left}..${bounds.right}`,
            ]
          : [];
      }),
    };
  });

  expect(geometry.documentWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(
    geometry.viewport + 1
  );
  expect(geometry.bodyWidth, JSON.stringify(geometry)).toBeLessThanOrEqual(
    geometry.viewport + 1
  );
  expect(geometry.controlsOutsideViewport).toEqual([]);
});
