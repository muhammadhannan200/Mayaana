import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { patientFieldErrors } from "../../lib/patient-validation";
import type { ClinicalSnapshot } from "../../lib/clinical-types";

// Real live UI, isolated from credentials, backend and public /demo. Only the
// server-action and Next navigation boundaries are replaced in this test bundle.
let js: string, css: string, fontClasses: string;
test.beforeAll(async ({ request }) => {
  const result = await build({
    entryPoints: ["tests/fixtures/issue-41-clinic.tsx"],
    bundle: true,
    write: false,
    outdir: "artifacts/issue-41-fixture",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "test-boundaries",
        setup(builder) {
          builder.onResolve(
            {
              filter:
                /^(next\/(link|image|navigation)|@\/app\/(clinical-actions|actions))$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" })
          );
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            loader: "tsx",
            resolveDir: process.cwd(),
            contents:
              args.path === "next/link"
                ? `
          import React from 'react';
          export default function Link({href, children, ...props}) { return <a href={href} {...props}>{children}</a>; }
        `
                : args.path === "next/image"
                  ? `
          import React from 'react';
          export default function Image({unoptimized, ...props}) { return <img {...props}/>; }
        `
                  : args.path === "next/navigation"
                    ? `
          export const useSearchParams = () => new URLSearchParams(location.search);
          export const useRouter = () => ({push: (href) => { window.__destination = href; }});
        `
                    : args.path.endsWith("clinical-actions")
                      ? `
          export const readClinic = async () => ({data: structuredClone(window.__snapshot)});
          export const mutateClinic = async (command) => {
            window.__commands.push(command);
            if (window.__mutationError) return {error: window.__mutationError};
            if (command.type === 'handoff') {
              const entry = window.__snapshot.entries.find(q => q.id === command.entryId);
              entry.status = 'with_doctor'; entry.revision++;
            }
            return {data: command.patient?.id ?? command.entryId ?? 'created-entry'};
          };
        `
                      : `export const signOut = async () => {};`,
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith(".js"))!.text;
  // Use the actual compiled application fonts and tokens in this isolated UI.
  const html = await (await request.get("http://127.0.0.1:3100/")).text();
  fontClasses = html.match(/<html[^>]*class="([^"]+)"/)?.[1] ?? "";
  const sheets = [...html.matchAll(/<link[^>]+>/g)]
    .map(([tag]) =>
      tag.includes('rel="stylesheet"')
        ? tag.match(/href="([^"]+)"/)?.[1]
        : undefined
    )
    .filter((href): href is string => !!href);
  let globals = "";
  for (const href of sheets)
    globals += await (
      await request.get(new URL(href, "http://127.0.0.1:3100").href)
    ).text();
  const urls = [
    ...new Set(
      [...globals.matchAll(/url\(["']?([^)'"\s]+\.woff2)["']?\)/g)].map(
        (match) => match[1]
      )
    ),
  ];
  for (const url of urls) {
    const font = await request.get(new URL(url, "http://127.0.0.1:3100").href);
    globals = globals.replaceAll(
      url,
      `data:font/woff2;base64,${(await font.body()).toString("base64")}`
    );
  }
  css =
    globals + result.outputFiles!.find((f) => f.path.endsWith(".css"))!.text;
});

const patient = {
  id: "synthetic-patient",
  name: "مريض اختباري",
  phone: "0912345678",
  height: "165",
  gender: "female",
  birthYear: "1994",
  goal: "نقص وزن",
};
const ready = {
  id: "ready-entry",
  patientId: patient.id,
  visitId: "synthetic-visit",
  kind: "follow_up" as const,
  status: "ready" as const,
  serviceDate: "2026-10-24",
  revision: 2,
  arrivalTime: "10:00",
  measurements: { weight: "65" },
};

async function mount(
  page: Page,
  route: string,
  snapshot: ClinicalSnapshot = { patients: [patient], entries: [ready] }
) {
  await page.route("https://clinic-ui.test/**", async (request) => {
    const url = new URL(request.request().url());
    if (url.pathname.startsWith("/rashaqa/")) {
      await request.fulfill({
        contentType: "image/svg+xml",
        body: await readFile(path.join("public", url.pathname), "utf8"),
      });
    } else
      await request.fulfill({
        contentType: "text/html",
        body: `<html lang="ar" dir="rtl" class="${fontClasses}"><head><title>Issue 41 synthetic UI fixture</title></head><body><div id="root"></div></body></html>`,
      });
  });
  await page.goto(`https://clinic-ui.test/${route}`);
  await page.evaluate(
    (snapshot) =>
      Object.assign(window, { __snapshot: snapshot, __commands: [] }),
    snapshot
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await expect(page.locator(".persisted-clinic")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test("required patient fields show linked errors and prevent a mutation", async ({
  page,
}) => {
  await mount(page, "secretary/patients/new");
  await page.getByRole("button", { name: "حفظ ومتابعة الإضافة للدور" }).click();
  for (const name of ["name", "phone", "height"]) {
    const input = page.locator(`input[name=${name}]`);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    const description = await input.getAttribute("aria-describedby");
    await expect(page.locator(`#${description}`)).toBeVisible();
  }
  await expect(page.locator("input[name=name]")).toBeFocused();
  expect(await page.evaluate("window.__commands")).toEqual([]);
  await page.getByLabel("الاسم الكامل", { exact: false }).fill("مريض تجريبي");
  await page.locator("input[name=phone]").fill("٠٩١٢٣٤٥٦٧٨");
  await page.locator("input[name=height]").fill("١٦٥٫٥");
  await page.getByRole("button", { name: "حفظ ومتابعة الإضافة للدور" }).click();
  await expect.poll(() => page.evaluate("window.__commands.length")).toBe(1);
  expect(await page.evaluate("window.__commands[0].patient.phone")).toBe(
    "0912345678"
  );
});

test("secretary navigation uses Figma SVGs and one current-page state", async ({
  page,
}) => {
  await mount(page, "secretary/patients");
  const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.locator('[aria-current="page"]')).toHaveText("المرضى");
  await expect(nav.locator("img")).toHaveCount(4);
  await expect(
    nav.locator("img[src$='nav-patients-active.svg']")
  ).toBeVisible();
  await expect(nav.getByRole("link", { name: "البحث" })).toHaveAttribute(
    "href",
    "/secretary/search"
  );
  const first = await nav
    .getByRole("link", { name: "الدور", exact: true })
    .boundingBox();
  const last = await nav
    .getByRole("link", { name: "الحساب", exact: true })
    .boundingBox();
  expect(first!.x).toBeGreaterThan(last!.x);
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= innerWidth)
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("patients.png"),
    fullPage: true,
  });
});

test("patient list opens a file, not the queue confirmation; filters use patient goals", async ({
  page,
}) => {
  await mount(page, "secretary/patients");
  await expect(
    page.getByRole("link", { name: /مريض اختباري/ })
  ).toHaveAttribute("href", `/secretary/patients/${patient.id}`);
  await page.getByRole("button", { name: "زيادة وزن (0)" }).click();
  await expect(page.locator(".patient-result-link")).toHaveCount(0);
  await page.getByRole("button", { name: "الكل (1)" }).click();
  await expect(page.locator(".patient-result-link")).toHaveCount(1);
});

test("visit-type controls expose descriptions and selected styles", async ({
  page,
}) => {
  await mount(page, `secretary/confirm?patient=${patient.id}`, {
    patients: [patient],
    entries: [],
  });
  await expect(page.getByRole("radio", { name: /كشفية/ })).toBeChecked();
  await page.getByRole("radio", { name: /مراجعة/ }).check();
  await expect(page.locator(".visit-options label.selected")).toContainText(
    "وزن فقط"
  );
  await expect(page.locator(".confirm-patient")).toContainText(
    "الهدف: نقص وزن"
  );
  await page.getByRole("button", { name: "إضافة للدور", exact: true }).click();
  expect(await page.evaluate("window.__commands[0].kind")).toBe("follow_up");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("confirm.png"),
    fullPage: true,
  });
});

test("handoff success is temporary and a second handoff is disabled", async ({
  page,
}) => {
  await mount(page, "secretary");
  await page.clock.install();
  await page.getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(page.getByRole("status")).toContainText("دخل عند الطبيب");
  await page.clock.fastForward(60_001);
  await expect(page.locator(".recent-handoff")).toHaveCount(0);
  expect(await page.evaluate("window.__commands.length")).toBe(1);
});

test("an active patient blocks another UI handoff without hiding active records", async ({
  page,
}) => {
  await mount(page, "secretary", {
    patients: [patient],
    entries: [ready, { ...ready, id: "active-entry", status: "with_doctor" }],
  });
  await expect(
    page.getByRole("button", { name: "إدخال عند الطبيب" })
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "إدخال عند الطبيب" })
  ).toHaveAttribute("title", "يوجد مريض عند الطبيب بالفعل");
  expect(await page.evaluate("window.__commands")).toEqual([]);
});

test("failed handoff is not shown as success", async ({ page }) => {
  await mount(page, "secretary");
  await page.evaluate("window.__mutationError = 'تعذّر الحفظ'");
  await page.getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(page.getByRole("alert")).toContainText("تعذّر الحفظ");
  await expect(page.locator(".recent-handoff")).toHaveCount(0);
});

test("patient validation accepts normalized decimals, rejects malformed values and retains optional fields", () => {
  const form = new FormData();
  expect(Object.keys(patientFieldErrors(form))).toEqual([
    "name",
    "phone",
    "height",
  ]);
  form.set("name", "  مريض تجريبي  ");
  form.set("phone", "٠٩١٢٣٤٥٦٧٨");
  form.set("height", "١٦٥٫٥");
  expect(patientFieldErrors(form)).toEqual({});
  for (const value of ["", "0xA5", "1e2", "165.123", "251", "49"]) {
    form.set("height", value);
    expect(patientFieldErrors(form)).toHaveProperty("height");
  }
  form.set("height", "165");
  form.set("birthYear", "2027");
  expect(patientFieldErrors(form, 2026)).toHaveProperty("birthYear");
});

test("secretary account preserves email identity and doctor-assisted recovery", async ({
  page,
}) => {
  await mount(page, "secretary/account");
  await expect(
    page.getByRole("heading", { name: "اسم اختباري" })
  ).toBeVisible();
  await expect(page.locator(".account-details")).toContainText(
    "synthetic@example.invalid"
  );
  await expect(page.locator(".account-recovery")).toContainText("مسؤول النظام");
  await expect(
    page.getByRole("button", { name: "تسجيل الخروج" })
  ).toBeVisible();
  await expect(page.locator("nav [aria-current=page]")).toHaveText("الحساب");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= innerWidth)
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("account.png"),
    fullPage: true,
  });
});

test("doctor current card links to the real read-only visit without invented history", async ({
  page,
}) => {
  await mount(page, "doctor", {
    patients: [patient],
    entries: [{ ...ready, status: "with_doctor" }],
  });
  await expect(page.locator(".doctor-current")).toContainText("مريض اختباري");
  await expect(page.locator(".doctor-current")).toContainText("65 كغ");
  await expect(page.locator(".doctor-stat")).toContainText("إجمالي المرضى");
  await expect(page.locator(".doctor-stat strong")).toHaveText("1");
  await expect(page.getByRole("link", { name: "فتح الزيارة" })).toHaveAttribute(
    "href",
    "/doctor/visits/synthetic-visit"
  );
  await expect(page.locator(".queue-card")).toHaveCount(0);
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= innerWidth)
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("doctor-current.png"),
    fullPage: true,
  });
});

test("doctor account and search navigation preserve the existing security/product boundaries", async ({
  page,
}) => {
  await mount(page, "doctor/account");
  await expect(
    page.getByRole("link", { name: "تغيير كلمة المرور" })
  ).toHaveAttribute("href", "/change-password");
  await expect(
    page.getByRole("link", { name: "حساب السكرتيرة" })
  ).toHaveAttribute("href", "/doctor/staff");
  await expect(page.locator(".account-recovery")).toContainText("مسؤول النظام");
  await expect(page.locator("nav [aria-current=page]")).toHaveText("الحساب");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "البحث" })
  ).toHaveAttribute("href", "/doctor/search");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath("doctor-account.png"),
    fullPage: true,
  });
});

test("patient details show all available demographics and queue navigation", async ({
  page,
}) => {
  await mount(page, `secretary/patients/${patient.id}`);
  await expect(page.locator(".demo-patient-info")).toContainText("أنثى");
  await expect(page.locator(".demo-patient-info")).toContainText("1994");
  await expect(page.locator(".demo-patient-info")).toContainText("نقص وزن");
  await expect(page.getByRole("link", { name: "إضافة للدور" })).toHaveAttribute(
    "href",
    `/secretary/confirm?patient=${patient.id}`
  );
});
