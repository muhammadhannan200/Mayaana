import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const snackbar = (page: Page) => page.locator(".handoff-snackbar");
const card = (page: Page) =>
  page.locator(".queue-action-card").filter({ hasText: "سامر خالد الحلبي" });
const trigger = (page: Page) =>
  page.getByRole("button", { name: "إجراءات سامر خالد الحلبي" });
async function pointer(target: Locator, type: string, extra = {}) {
  await target.dispatchEvent(type, {
    pointerType: "touch",
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: 180,
    clientY: 400,
    ...extra,
  });
}
async function hold(page: Page) {
  await pointer(card(page).locator("strong"), "pointerdown");
  await page.waitForTimeout(650);
}
test.beforeEach(async ({ page }) => {
  // Refuse all external requests in the synthetic test app, including Supabase.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname)
      ? route.continue()
      : route.abort();
  });
});

test("confirmed handoff: temporary polite snackbar, unchanged revision/request identity, no Undo", async ({
  page,
}, info) => {
  await page.goto("/secretary?delay=250");
  await expect(trigger(page)).toBeVisible();
  await page.clock.install();
  await card(page).getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(snackbar(page)).toHaveCount(0);
  await expect(page.getByText("جارٍ الحفظ…")).toBeVisible();
  await page.clock.fastForward(300);
  await expect(snackbar(page)).toHaveText("تم إدخال المريض عند الطبيب.");
  await expect(page.locator(".handoff-announcer")).toHaveAttribute(
    "aria-live",
    "polite"
  );
  await expect(
    page.locator(".doctor-card").filter({ hasText: "سامر خالد الحلبي" })
  ).toBeVisible();
  await expect(page.getByText("تم الحفظ في العيادة.")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /تراجع|Undo/ })).toHaveCount(0);
  const request = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("batch-2-synthetic-last-request")!)
  );
  expect(request).toMatchObject({ id: "entry-1", revision: 7 });
  expect(request.requestId).toMatch(/^[a-f0-9-]{36}$/);
  await page.screenshot({
    path: `artifacts/issue-41-batch-2/snackbar-${info.project.name}.png`,
    fullPage: false,
  });
  await page.clock.fastForward(6100);
  await expect(snackbar(page)).toHaveCount(0);
});

for (const result of ["auth", "validation", "network", "conflict", "throw"]) {
  test(`failed ${result} handoff never announces success`, async ({ page }) => {
    await page.goto(`/secretary?result=${result}`);
    await card(page).getByRole("button", { name: "إدخال عند الطبيب" }).click();
    await expect(
      page.locator(".clinical-status").getByRole("alert")
    ).toBeVisible();
    await expect(snackbar(page)).toHaveCount(0);
    await expect(card(page)).toBeVisible();
    await expect(page.locator(".secretary-success")).toHaveCount(0);
  });
}

test("refresh failure does not turn a confirmed operation into an unconfirmed one", async ({
  page,
}) => {
  await page.goto("/secretary?result=refresh-failure");
  await card(page).getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(
    page.locator(".clinical-status").getByRole("alert")
  ).toContainText("تعذّر تحديث");
  await expect(snackbar(page)).toBeVisible();
  await page.reload();
  await expect(snackbar(page)).toHaveCount(0);
});

test("no success replay on reload, navigation/back, polling, or forged sent parameter", async ({
  page,
}) => {
  await page.goto("/secretary?sent=1");
  await expect(trigger(page)).toBeVisible();
  await expect(snackbar(page)).toHaveCount(0);
  await expect(page.getByText("تم إدخال المريض عند الطبيب.")).toHaveCount(0);
  await card(page).getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(snackbar(page)).toBeVisible();
  await page.getByRole("link", { name: "المرضى", exact: true }).click();
  await expect(page).toHaveURL(/\/secretary\/patients$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "دور اليوم" })).toBeVisible();
  await expect(snackbar(page)).toHaveCount(0);
  await page.reload();
  await expect(
    page.locator(".doctor-card").filter({ hasText: "سامر خالد الحلبي" })
  ).toBeVisible();
  await expect(snackbar(page)).toHaveCount(0);
  await page.clock.install();
  await page.clock.fastForward(11000);
  await expect(snackbar(page)).toHaveCount(0);
});

test("navigation during a pending handoff cannot deliver stale success", async ({
  page,
}) => {
  await page.goto("/secretary?delay=1000");
  await card(page).getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await page.getByRole("link", { name: "المرضى", exact: true }).click();
  await expect(page).toHaveURL(/\/secretary\/patients$/);
  await page.waitForTimeout(1200);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "دور اليوم" })).toBeVisible();
  await expect(snackbar(page)).toHaveCount(0);
});

test("keyboard sheet: focus trap, RTL, reason selection, safe disabled removal, Escape restore", async ({
  page,
}, info) => {
  await page.goto("/secretary");
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toHaveAttribute("dir", "rtl");
  await expect(sheet).toHaveAccessibleName("سامر خالد الحلبي · دور 2");
  await expect(
    page.getByRole("button", { name: "إغلاق الإجراءات" })
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    sheet.getByRole("radio", { name: "غادر العيادة" })
  ).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(
    sheet.getByRole("radio", { name: "أُضيف بالخطأ" })
  ).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "إغلاق الإجراءات" })
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    sheet.getByRole("radio", { name: "أُضيف بالخطأ" })
  ).toBeFocused();
  await sheet.getByRole("radio", { name: "غادر العيادة" }).check();
  await expect(
    sheet.getByRole("button", { name: "إزالة من الدور", exact: true })
  ).toBeDisabled();
  await expect(sheet).toContainText("معاينة فقط");
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  const violations = (await new AxeBuilder({ page }).analyze()).violations;
  expect(violations).toEqual([]);
  await page.screenshot({
    path: `artifacts/issue-41-batch-2/sheet-${info.project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(card(page)).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("batch-2-synthetic-last-request")
    )
  ).toBeNull();
  await page.keyboard.press("Space");
  await expect(sheet).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(sheet).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
});

test("touch long-press opens preview without click-through and restores to actions", async ({
  page,
}) => {
  await page.goto("/secretary");
  await expect(trigger(page)).toBeVisible();
  await hold(page);
  await expect(page.getByRole("dialog")).toBeVisible();
  await pointer(card(page), "pointerup");
  // A browser may synthesize a click after the hold. It must never reach the
  // underlying handoff control, even when the card is still present.
  await card(page)
    .getByRole("button", { name: "إدخال عند الطبيب" })
    .dispatchEvent("click");
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("batch-2-synthetic-last-request")
    )
  ).toBeNull();
  await page.getByRole("radio", { name: "سبب آخر" }).check();
  await page.getByRole("button", { name: "إغلاق الإجراءات" }).click();
  await expect(trigger(page)).toBeFocused();
  await expect(card(page)).toBeVisible();
});

test("short taps, movement, scrolling, cancellation, multi-touch and nested controls never long-press", async ({
  page,
}) => {
  await page.goto("/secretary");
  await expect(trigger(page)).toBeVisible();
  const target = card(page).locator("strong");
  for (const cancellation of [
    "tap",
    "move",
    "scroll",
    "pointercancel",
    "pointerout",
    "blur",
    "multitouch",
    "Escape",
  ]) {
    await pointer(target, "pointerdown");
    if (cancellation === "tap") await pointer(target, "pointerup");
    else if (cancellation === "move")
      await pointer(target, "pointermove", { clientX: 205 });
    else if (cancellation === "scroll")
      await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    else if (cancellation === "blur")
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    else if (cancellation === "multitouch")
      await pointer(target, "pointerdown", { pointerId: 2, isPrimary: false });
    else if (cancellation === "Escape") await page.keyboard.press("Escape");
    else await pointer(target, cancellation);
    await page.waitForTimeout(600);
    await expect(page.getByRole("dialog"), cancellation).toHaveCount(0);
  }
  await pointer(
    card(page).getByRole("button", { name: "إدخال عند الطبيب" }),
    "pointerdown"
  );
  await page.waitForTimeout(600);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await pointer(target, "pointerdown", { pointerType: "mouse" });
  await page.waitForTimeout(600);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("native touch scrolling remains available and cancels long-press", async ({
  page,
  context,
}) => {
  await page.goto("/secretary");
  await expect(trigger(page)).toBeVisible();
  const box = await card(page).locator("strong").boundingBox();
  const cdp = await context.newCDPSession(page);
  const x = box!.x + box!.width / 2;
  const y = box!.y + 12;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let i = 1; i <= 5; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - 30 * i }],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(650);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await cdp.detach();
});
