import { expect, test, type Page } from "@playwright/test";

function browserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

// Deliberately differ from the server/build calendar without changing timers.
// A same-day rerun masked the original intermittent hydration failure.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2031-01-02T12:00:00Z"));
});

test("Demo patient list hydrates across a server/browser date boundary", async ({ page }) => {
  const errors = browserErrors(page);
  await page.goto("/demo/doctor/patients");
  await page.getByLabel("اسم المريض أو رقم هاتفه").fill("مريم");
  const patient = page.getByRole("link", { name: /مريم العلي/ });
  await expect(patient).toContainText("2031-01-02");
  await expect(page.locator(".patient-result-link")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("Demo date-boundary navigation and reload preserve a confirmed visit draft", async ({ page }) => {
  const errors = browserErrors(page);
  const notes = "Synthetic confirmed draft across date-boundary navigation";
  await page.goto("/demo/doctor/visits/demo-featured");
  await page.getByLabel("ملاحظاتي", { exact: true }).fill(notes);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("mayanaa-demo-visit-v1:public:demo-featured");
    return raw ? JSON.parse(raw).notes : null;
  })).toBe(notes);
  await page.goto("/demo/doctor/patients");
  await page.getByLabel("اسم المريض أو رقم هاتفه").fill("مريم");
  await expect(page.getByRole("link", { name: /مريم العلي/ })).toContainText("2031-01-02");
  await page.reload();
  await expect(page.locator(".patient-result-link")).toHaveCount(6);
  await page.goto("/demo/doctor/visits/demo-featured");
  await expect(page.getByLabel("ملاحظاتي", { exact: true })).toHaveValue(notes);
  expect(errors).toEqual([]);
});
