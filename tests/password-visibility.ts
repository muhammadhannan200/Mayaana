import { expect, type Page } from "@playwright/test";

// Use only synthetic values; prevent submission before any server action runs.
export async function exercisePasswordVisibility(page: Page, labels: string[]) {
  const form = page.locator("form.auth-form");
  await form.evaluate((element) => {
    element.setAttribute("data-test-submits", "0");
    element.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();
        element.setAttribute(
          "data-test-submits",
          String(Number(element.getAttribute("data-test-submits")) + 1)
        );
      },
      { capture: true }
    );
  });

  for (const label of labels) {
    await expect(page.getByLabel(label, { exact: true })).toHaveAttribute(
      "type",
      "password"
    );
    await page
      .getByLabel(label, { exact: true })
      .fill("Synthetic-visibility-50!");
  }

  for (const [index, label] of labels.entries()) {
    const input = page.getByLabel(label, { exact: true });
    const autocomplete = await input.getAttribute("autocomplete");
    const name = await input.getAttribute("name");
    const toggle = page.getByRole("button", {
      name: `إظهار ${label}`,
      exact: true,
    });
    await expect(toggle).toHaveAttribute("type", "button");
    await expect(toggle).toHaveAttribute(
      "aria-controls",
      (await input.getAttribute("id")) as string
    );
    await input.focus();
    await input.evaluate((element: HTMLInputElement) =>
      element.setSelectionRange(2, 8, "backward")
    );
    await toggle.click();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Synthetic-visibility-50!");
    await expect(input).toHaveAttribute("autocomplete", autocomplete as string);
    await expect(input).toHaveAttribute("name", name as string);
    expect(
      await input.evaluate((element: HTMLInputElement) => [
        element.selectionStart,
        element.selectionEnd,
        element.selectionDirection,
      ])
    ).toEqual([2, 8, "backward"]);
    await expect(
      page.getByRole("button", { name: `إخفاء ${label}`, exact: true })
    ).toBeVisible();
    for (const [otherIndex, otherLabel] of labels.entries()) {
      await expect(
        page.getByLabel(otherLabel, { exact: true })
      ).toHaveAttribute("type", otherIndex <= index ? "text" : "password");
    }
  }

  for (const label of labels) {
    const input = page.getByLabel(label, { exact: true });
    await input.focus();
    await input.evaluate((element: HTMLInputElement) =>
      element.setSelectionRange(1, 6, "backward")
    );
    await input.press("Tab");
    const toggle = input.locator("..").getByRole("button");
    await expect(toggle).toBeFocused();
    expect(
      await toggle.evaluate((element) => getComputedStyle(element).outlineStyle)
    ).not.toBe("none");
    await toggle.press("Enter");
    await expect(input).toHaveAttribute("type", "password");
    await expect(toggle).toBeFocused();
    await toggle.press("Space");
    await expect(input).toHaveAttribute("type", "text");
    await expect(toggle).toBeFocused();
    await expect(input).toHaveValue("Synthetic-visibility-50!");
    expect(
      await input.evaluate((element: HTMLInputElement) => [
        element.selectionStart,
        element.selectionEnd,
        element.selectionDirection,
      ])
    ).toEqual([1, 6, "backward"]);
    await toggle.press("Shift+Tab");
    await expect(input).toBeFocused();
  }
  await expect(form).toHaveAttribute("data-test-submits", "0");

  // No toggle contributes form data, irrespective of the visibility state.
  expect(
    await form.evaluate((element: HTMLFormElement) =>
      Array.from(new FormData(element).keys()).filter(
        (key) => !key.startsWith("$ACTION_")
      )
    )
  ).toEqual(
    await form
      .locator("input[name]")
      .evaluateAll((inputs) =>
        inputs
          .map((input) => input.getAttribute("name"))
          .filter((name) => !name?.startsWith("$ACTION_"))
      )
  );
}

export async function expectPasswordToggleLayout(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const toggle of await page
    .locator(".password-visibility-toggle")
    .all()) {
    const bounds = await toggle.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    const input = toggle.locator("..").locator("input");
    const inputBounds = await input.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(inputBounds!.x);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      inputBounds!.x + inputBounds!.width
    );
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(
      inputBounds!.y + inputBounds!.height
    );
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth)
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
}
