import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const lockName = "mayanaa-demo-v1:public";
const draftKey = "mayanaa-demo-visit-v1:public:demo-featured";
const committedNotes = "Synthetic confirmed notes before lock contention";
const pendingNotes = "Synthetic pending notes that are not yet committed";
type LockWindow = Window & { releaseDraftLock?: () => void };

async function pendingAutosave(page: Page, context: BrowserContext) {
  await page.goto("/demo/doctor/visits/demo-featured");
  const notes = page.getByLabel("ملاحظاتي", { exact: true });
  const saving = page.getByRole("status").filter({ hasText: "جارٍ حفظ المسودة" });
  await notes.fill(committedNotes);
  await expect.poll(() => page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).notes : null;
  }, draftKey)).toBe(committedNotes);
  await expect(saving).toHaveCount(0);

  const locker = await context.newPage();
  await locker.goto("/demo/doctor");
  // This second document owns the actual browser Web Lock until explicitly
  // released. Neither sleeps nor a mocked store determine when saving may run.
  await locker.evaluate((name) => {
    void navigator.locks.request(name, () => new Promise<void>((resolve) => {
      (window as LockWindow).releaseDraftLock = resolve;
    }));
  }, lockName);
  await expect.poll(() => locker.evaluate(() =>
    typeof (window as LockWindow).releaseDraftLock
  )).toBe("function");

  await notes.fill(pendingNotes);
  await expect(notes).toHaveValue(pendingNotes);
  await expect(saving).toBeVisible();
  await expect.poll(() => locker.evaluate(async (name) =>
    (await navigator.locks.query()).pending?.filter((lock) => lock.name === name).length ?? 0,
  lockName)).toBe(1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).notes, draftKey)).toBe(committedNotes);
  return { locker, notes, saving };
}

async function release(locker: Page) {
  await locker.evaluate(() => (window as LockWindow).releaseDraftLock?.());
}

test("pending locked autosave warns on navigation; accepting reload discards only the uncommitted edit", async ({ page, context }) => {
  const { locker, notes, saving } = await pendingAutosave(page, context);
  try {
    const confirmation = page.waitForEvent("dialog");
    const leaving = page.getByRole("link", { name: "العودة لملف المريض", exact: true }).click();
    const dialog = await confirmation;
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("تعديلات غير محفوظة");
    await dialog.dismiss();
    await leaving;
    await expect(page).toHaveURL("/demo/doctor/visits/demo-featured");
    await expect(notes).toHaveValue(pendingNotes);
    await expect(saving).toBeVisible();

    const warning = page.waitForEvent("dialog");
    const reloading = page.reload();
    const unload = await warning;
    expect(unload.type()).toBe("beforeunload");
    await unload.accept();
    await reloading;
    await expect(notes).toHaveValue(committedNotes);
    await expect(saving).toHaveCount(0);
    // Destroying the editing document cancels its queued request. Releasing the
    // lock later must not resurrect or publish that discarded pending overlay.
    await expect.poll(() => locker.evaluate(async (name) =>
      (await navigator.locks.query()).pending?.filter((lock) => lock.name === name).length ?? 0,
    lockName)).toBe(0);
    await release(locker);
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).notes, draftKey)).toBe(committedNotes);
    const fresh = await context.newPage();
    await fresh.goto("/demo/doctor/visits/demo-featured");
    await expect(fresh.getByLabel("ملاحظاتي", { exact: true })).toHaveValue(committedNotes);
  } finally {
    await release(locker);
  }
});

test("pending autosave becomes reloadable only after the held Web Lock is released and saving confirms", async ({ page, context }) => {
  const { locker, notes, saving } = await pendingAutosave(page, context);
  try {
    await release(locker);
    await expect.poll(() => page.evaluate((key) =>
      JSON.parse(localStorage.getItem(key)!).notes,
    draftKey)).toBe(pendingNotes);
    await expect(saving).toHaveCount(0);
    await page.reload();
    await expect(notes).toHaveValue(pendingNotes);
  } finally {
    await release(locker);
  }
});
