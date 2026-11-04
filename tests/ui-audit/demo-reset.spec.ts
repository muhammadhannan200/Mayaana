import { expect, test } from "@playwright/test";

for (const failure of ["enumerate", "remove", "write"] as const) {
  test(`Demo reset ${failure} failure stays local and cannot reuse a surviving draft on reset seed data`, async ({ page, context }) => {
    await page.goto("/demo/secretary/account");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "إعادة ضبط العرض التجريبي", exact: true }).click();
    await expect(page).toHaveURL("/demo/secretary");
    const before = await page.evaluate(() => {
      const key = "mayanaa-demo-v1:public";
      const state = JSON.parse(localStorage.getItem(key)!);
      const active = state.queue.find((entry: { id: string }) => entry.id === "demo-featured");
      state.patients.find((patient: { id: string }) => patient.id === active.patientId).name = "Synthetic pre-reset patient";
      localStorage.setItem(key, JSON.stringify(state));
      localStorage.setItem("mayanaa-demo-visit-v1:public:older-entry", JSON.stringify(active.visit));
      localStorage.setItem("mayanaa-demo-visit-v1:public:demo-featured", JSON.stringify({ ...active.visit, notes: "Synthetic surviving reset draft" }));
      localStorage.setItem("unrelated-reset-test", "keep");
      localStorage.setItem("mayanaa-demo-visit-v1:other:entry", "keep other scope");
      return { main: localStorage.getItem(key), notes: active.visit.notes as string };
    });
    await page.goto("/demo/secretary/account");
    await page.evaluate((failure) => {
      const storage = window.localStorage;
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: new Proxy(storage, {
          ownKeys(target) {
            if (failure === "enumerate") throw new DOMException("Synthetic enumeration failure", "SecurityError");
            return Reflect.ownKeys(target);
          },
          get(target, property) {
            if (property === "removeItem") return (key: string) => {
              if (failure === "remove" && key.endsWith(":demo-featured")) throw new DOMException("Synthetic deletion failure", "SecurityError");
              storage.removeItem(key);
            };
            if (property === "setItem") return (key: string, value: string) => {
              if (failure === "write" && key === "mayanaa-demo-v1:public") throw new DOMException("Synthetic write failure", "QuotaExceededError");
              storage.setItem(key, value);
            };
            const value = Reflect.get(target, property, target);
            return typeof value === "function" ? value.bind(target) : value;
          },
        }),
      });
    }, failure);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "إعادة ضبط العرض التجريبي", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "لم تكتمل إعادة الضبط" })).toBeVisible();
    await expect(page).toHaveURL("/demo/secretary/account");
    expect(await page.evaluate(() => localStorage.getItem("mayanaa-demo-v1:public"))).toBe(before.main);
    // Reload drops this tab's isolated fallback; another tab initializes from
    // the original shared dataset, never a new seed overlaid with an old draft.
    await page.reload();
    const other = await context.newPage();
    for (const tab of [page, other]) {
      await tab.goto("/demo/doctor");
      await expect(tab.locator(".doctor-current")).toContainText("Synthetic pre-reset patient");
      await tab.goto("/demo/doctor/visits/demo-featured");
      await expect(tab.getByLabel("ملاحظاتي", { exact: true })).toHaveValue(
        failure === "write" ? before.notes : "Synthetic surviving reset draft"
      );
      expect(await tab.evaluate(() => localStorage.getItem("unrelated-reset-test"))).toBe("keep");
      expect(await tab.evaluate(() => localStorage.getItem("mayanaa-demo-visit-v1:other:entry"))).toBe("keep other scope");
    }
  });
}

test("successful Demo reset clears scoped drafts and synchronizes another open tab", async ({ page, context }) => {
  await page.goto("/demo/doctor/visits/demo-featured");
  const notes = page.getByLabel("ملاحظاتي", { exact: true });
  await notes.fill("Synthetic draft before successful reset");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("mayanaa-demo-visit-v1:public:demo-featured")!).notes)).toBe("Synthetic draft before successful reset");
  await page.evaluate(() => {
    localStorage.setItem("unrelated-reset-test", "keep");
    localStorage.setItem("mayanaa-demo-visit-v1:other:entry", "keep other scope");
  });
  const account = await context.newPage();
  await account.goto("/demo/secretary/account");
  account.once("dialog", (dialog) => dialog.accept());
  await account.getByRole("button", { name: "إعادة ضبط العرض التجريبي", exact: true }).click();
  await expect(account).toHaveURL("/demo/secretary");
  await expect(notes).not.toHaveValue("Synthetic draft before successful reset");
  expect(await account.evaluate(() => localStorage.getItem("mayanaa-demo-visit-v1:public:demo-featured"))).toBeNull();
  expect(await account.evaluate(() => localStorage.getItem("unrelated-reset-test"))).toBe("keep");
  expect(await account.evaluate(() => localStorage.getItem("mayanaa-demo-visit-v1:other:entry"))).toBe("keep other scope");
  await account.goto("/demo/doctor/visits/demo-featured");
  await expect(account.getByLabel("ملاحظاتي", { exact: true })).toHaveValue(await notes.inputValue());
});
