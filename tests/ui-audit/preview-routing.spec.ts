import { expect, test } from "@playwright/test";

for (const mode of ["follow-up", "previous", "full-exam"]) {
  test(`supported preview ${mode} returns HTTP 200`, async ({ page }) => {
    const response = await page.goto(`/measurement-preview/${mode}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      mode === "full-exam" ? "قياس كامل" : "قياس الوزن"
    );
  });
}

for (const mode of ["not-a-screen", "unknown", "FULL-EXAM"]) {
  test(`unsupported preview ${mode} returns HTTP 404 before rendering`, async ({
    page,
    request,
  }) => {
    const path = `/measurement-preview/${mode}`;
    // Check the actual HTTP response, not just the streamed not-found UI.
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    const head = await request.head(path);
    expect(head.status()).toBe(404);

    const navigation = await page.goto(path);
    expect(navigation?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { name: "404", exact: true })
    ).toBeVisible();
    await expect(page.locator(".measure-shell")).toHaveCount(0);
  });
}

test("preview index keeps every supported mode reachable by client navigation", async ({
  page,
}) => {
  const response = await page.goto("/measurement-preview");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("link")).toHaveCount(4);
  for (const mode of ["follow-up", "previous", "full-exam"]) {
    await page
      .getByRole("navigation", { name: "شاشات القياس" })
      .locator(`a[href="/measurement-preview/${mode}"]`)
      .click();
    await expect(page).toHaveURL(new RegExp(`/measurement-preview/${mode}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      mode === "full-exam" ? "قياس كامل" : "قياس الوزن"
    );
    await page.goBack();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "معاينة شاشات القياس"
    );
  }
});
