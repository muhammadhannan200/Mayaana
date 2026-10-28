import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { ClinicalSnapshot } from "../../lib/clinical-types";

// Batch 1 against the actual current controller/view. Only framework navigation
// and explicit server-action boundaries are substituted; no hosted credentials.
// Later-batch checkpoint tests remain at 356d7a6, not silently relaxed here.
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
          // SignOutForm imports its server action relatively, unlike the controller.
          builder.onResolve({ filter: /^\.\/actions$/ }, (args) =>
            args.importer
              .replaceAll("\\", "/")
              .endsWith("/app/sign-out-form.tsx")
              ? { path: "@/app/actions", namespace: "fixture" }
              : undefined
          );
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
            export const getClinicScreen = async (input) => {
              window.__reads.push(input);
              return {ok: true, data: structuredClone(window.__snapshot)};
            };
            const write = async (type, args) => {
              window.__commands.push({type, args});
              if (window.__mutationError) return {ok: false, kind: 'conflict', message: window.__mutationError};
              if (type === 'handoffToDoctor') {
                const entry = window.__snapshot.queue.find(q => q.id === args[0]);
                entry.status = 'with_doctor'; entry.revision++;
              }
              return {ok: true, data: null};
            };
            export const createPatient = (...args) => write('createPatient', args);
            export const enqueuePatient = (...args) => write('enqueuePatient', args);
            export const saveMeasurements = (...args) => write('saveMeasurements', args);
            export const handoffToDoctor = (...args) => write('handoffToDoctor', args);
            export const saveDoctorDraft = (...args) => write('saveDoctorDraft', args);
            export const finishVisit = (...args) => write('finishVisit', args);
          `
                      : `
            export const signOut = async () => {
              window.__logoutCalls = (window.__logoutCalls ?? 0) + 1;
              if (window.__deferLogout) await new Promise(resolve => { window.__resolveLogout = resolve; });
              return {error: 'تعذّر تسجيل الخروج. حاول مجدداً.'};
            };
          `,
          }));
        },
      },
    ],
  });
  js = result.outputFiles!.find((f) => f.path.endsWith(".js"))!.text;
  const html = await (await request.get("http://127.0.0.1:3100/")).text();
  fontClasses = html.match(/<html[^>]*class="([^"]+)"/)?.[1] ?? "";
  let globals = "";
  for (const [tag] of html.matchAll(/<link[^>]+>/g)) {
    if (!tag.includes('rel="stylesheet"')) continue;
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (href) {
      const sheetUrl = new URL(href, "http://127.0.0.1:3100");
      const sheet = await (await request.get(sheetUrl.href)).text();
      // Font URLs are relative to the stylesheet, not the fixture document.
      globals += sheet.replace(
        /url\(["']?([^)'"\s]+\.woff2)["']?\)/g,
        (_, url: string) => `url(${new URL(url, sheetUrl).href})`
      );
    }
  }
  const urls = [
    ...new Set(
      [...globals.matchAll(/url\(["']?([^)'"\s]+\.woff2)["']?\)/g)].map(
        (m) => m[1]
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
  revision: 1,
  visits: [
    {
      id: "past-visit",
      date: "2026-10-01",
      detailDate: "2026-10-01",
      number: 1,
      kind: "full_exam" as const,
      measurements: { weight: "66" },
      notes: "",
      days: [],
    },
  ],
};
const ready = {
  id: "ready-entry",
  patientId: patient.id,
  visitId: "synthetic-visit",
  kind: "follow_up" as const,
  status: "ready" as const,
  revision: 2,
  arrivalTime: "10:00",
  measurements: { weight: "65" },
};
const snapshot: ClinicalSnapshot = {
  clinicId: "synthetic-clinic",
  patients: [patient],
  queue: [ready],
  hasMore: false,
  role: "secretary",
  serviceDate: "2026-10-25",
};
async function mount(page: Page, route: string, data = snapshot) {
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
    (data) =>
      Object.assign(window, { __snapshot: data, __commands: [], __reads: [] }),
    data
  );
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await expect(page.locator(".persisted-clinic")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('16px "Noto Sans Arabic"', "مريض")
    )
  ).toBe(true);
}
async function audit(page: Page, name: string) {
  expect(
    await page
      .locator("body")
      .evaluate((body) => body.scrollWidth <= innerWidth)
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: test.info().outputPath(`${name}.png`),
    fullPage: true,
  });
}

for (const [route, active] of [
  ["secretary", "الدور"],
  ["secretary/patients", "المرضى"],
  ["secretary/search", "البحث"],
  ["secretary/account", "الحساب"],
  ["doctor", "الرئيسية"],
  ["doctor/patients", "المرضى"],
  ["doctor/search", "البحث"],
  // Isolated navigation state only; the existing staff page is unchanged.
  ["doctor/staff", "الحساب"],
]) {
  test(`Figma navigation: ${route}`, async ({ page }) => {
    await mount(page, route, {
      ...snapshot,
      role: route.startsWith("doctor") ? "doctor" : "secretary",
    });
    const nav = page.getByRole("navigation", { name: "التنقل الرئيسي" });
    await expect(nav.getByRole("link")).toHaveCount(4);
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(active);
    await expect(
      nav.getByRole("link", { name: "الحساب", exact: true })
    ).toHaveAttribute(
      "href",
      route.startsWith("doctor") ? "/doctor/staff" : "/secretary/account"
    );
    await expect(nav.locator("img")).toHaveCount(4);
    for (const img of await nav.locator("img").all()) {
      expect(
        await img.evaluate(
          (node: HTMLImageElement) => node.complete && node.naturalWidth > 0
        )
      ).toBe(true);
      await expect(img).toHaveAttribute("width", "54");
      await expect(img).toHaveAttribute("height", "30");
    }
    await expect(nav.locator('[aria-current="page"]')).toHaveCSS(
      "color",
      "rgb(15, 23, 42)"
    );
    await expect(nav.locator("a:not([aria-current])").first()).toHaveCSS(
      "color",
      "rgb(100, 116, 139)"
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveCSS(
      "font-weight",
      "700"
    );
    const first = await nav.getByRole("link").first().boundingBox();
    const last = await nav.getByRole("link").last().boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
    await nav.getByRole("link").first().focus();
    await expect(nav.getByRole("link").first()).toHaveCSS(
      "outline-style",
      "solid"
    );
    await audit(page, route.replaceAll("/", "-"));
  });
}

test("secondary button matches 199:299 and remains keyboard accessible", async ({
  page,
}) => {
  await mount(page, "secretary", {
    ...snapshot,
    queue: [{ ...ready, status: "waiting" }],
  });
  const button = page.getByRole("link", { name: "أخذ القياس" });
  await expect(button).toHaveCSS("padding", "12px 20px");
  await expect(button).toHaveCSS("font-size", "16px");
  await expect(button).toHaveCSS("font-weight", "700");
  await expect(button).toHaveCSS("line-height", "24px");
  await expect(button).toHaveCSS("border-radius", "12px");
  await expect(button).toHaveCSS("border-color", "rgb(226, 232, 240)");
  await expect(button).toHaveCSS("color", "rgb(15, 23, 42)");
  expect((await button.boundingBox())!.height).toBe(50);
  await button.focus();
  await expect(button).toHaveCSS("outline-style", "solid");
  await audit(page, "secondary");
});

test("VisitType badges match both 117:263 variants", async ({ page }) => {
  await mount(page, "secretary", {
    ...snapshot,
    queue: [ready, { ...ready, id: "full-entry", kind: "full_exam" }],
  });
  const badges = page.locator(".visit-badge");
  await expect(badges).toHaveCount(2);
  await expect(badges.first()).toHaveCSS("padding", "4px 12px");
  await expect(badges.first()).toHaveCSS("gap", "4px");
  await expect(badges.first()).toHaveCSS("font-weight", "600");
  await expect(badges.first()).toHaveCSS(
    "background-color",
    "rgb(241, 245, 249)"
  );
  await expect(badges.last()).toHaveCSS(
    "background-color",
    "rgb(240, 249, 255)"
  );
  await expect(badges.last()).toHaveCSS("color", "rgb(3, 105, 161)");
  await expect(badges.first().locator("img")).toHaveAttribute("width", "14");
  await audit(page, "visit-badges");
});

test("visit choices match 118:313/318 without changing enqueue contracts", async ({
  page,
}) => {
  await mount(page, `secretary/confirm?patient=${patient.id}`, {
    ...snapshot,
    queue: [],
  });
  const full = page.getByRole("radio", { name: /كشفية/ });
  const follow = page.getByRole("radio", { name: /مراجعة/ });
  await expect(full).toBeChecked();
  await expect(full).toHaveCSS("width", "22px");
  await expect(page.locator(".visit-options label.selected")).toHaveCSS(
    "border-width",
    "2px"
  );
  await follow.focus();
  await page.keyboard.press("Space");
  await expect(follow).toBeChecked();
  await expect(page.locator(".visit-options label.selected")).toContainText(
    "وزن فقط"
  );
  await expect(page.locator(".visit-options label.selected")).toHaveCSS(
    "background-color",
    "rgb(240, 253, 250)"
  );
  await audit(page, "visit-options");
  await page.getByRole("button", { name: "إضافة للدور", exact: true }).click();
  expect(await page.evaluate("window.__commands[0]")).toEqual({
    type: "enqueuePatient",
    args: [patient.id, "follow_up"],
  });
});

test("first visits still require full examination", async ({ page }) => {
  await mount(page, `secretary/confirm?patient=${patient.id}`, {
    ...snapshot,
    patients: [{ ...patient, visits: [] }],
    queue: [],
  });
  await expect(page.getByRole("radio", { name: /كشفية/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /مراجعة/ })).toBeDisabled();
  await page.getByRole("button", { name: "إضافة للدور", exact: true }).click();
  expect(await page.evaluate("window.__commands[0].args")).toEqual([
    patient.id,
    "full_exam",
  ]);
});

test("master multi-patient queue behavior and handoff revision identity remain intact", async ({
  page,
}) => {
  await mount(page, "secretary", {
    ...snapshot,
    queue: [ready, { ...ready, id: "active-entry", status: "with_doctor" }],
  });
  const handoff = page.getByRole("button", { name: "إدخال عند الطبيب" });
  await expect(handoff).toBeEnabled();
  await handoff.click();
  expect(await page.evaluate("window.__commands[0].args.slice(0, 2)")).toEqual([
    ready.id,
    ready.revision,
  ]);
  expect(await page.evaluate("window.__commands[0].args[2]")).toMatch(
    /^[0-9a-f-]{36}$/
  );
  await expect(
    page.getByRole("heading", { name: "عند الطبيب (2)" })
  ).toBeVisible();
});

test("failed handoff retains queue and conflict recovery instead of success", async ({
  page,
}) => {
  await mount(page, "secretary");
  await page.evaluate(
    "window.__mutationError = 'تغيّرت البيانات؛ أعد المحاولة'"
  );
  await page.getByRole("button", { name: "إدخال عند الطبيب" }).click();
  await expect(page.getByRole("alert")).toContainText("تغيّرت البيانات");
  await expect(
    page.getByRole("button", { name: "تحميل النسخة المحفوظة وإلغاء التعديلات" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "تحديث البيانات / إعادة المحاولة" })
  ).toHaveCSS("padding", "12px 20px");
  expect(await page.evaluate("window.__snapshot.queue[0].status")).toBe(
    "ready"
  );
  expect(await page.evaluate("window.__destination")).toBeUndefined();
});

test("global secondary styling reaches Doctor visits without enabling disabled writes", async ({
  page,
}) => {
  await mount(page, `doctor/visits/${ready.id}`, {
    ...snapshot,
    role: "doctor",
    queue: [{ ...ready, status: "with_doctor" }],
  });
  const save = page.getByRole("button", { name: "حفظ المسودة", exact: true });
  await expect(save).toBeDisabled();
  await expect(save).toHaveCSS("padding", "12px 20px");
  await expect(save).toHaveCSS("font-weight", "700");
  expect(await page.evaluate("window.__commands")).toEqual([]);
});

test("existing Secretary logout retains SignOutForm pending and failure states", async ({
  page,
}) => {
  await mount(page, "secretary/account");
  await page.evaluate("window.__deferLogout = true");
  const logout = page.getByRole("button", { name: "تسجيل الخروج" });
  await logout.click();
  await expect(logout).toBeDisabled();
  await expect(logout).toHaveAttribute("aria-busy", "true");
  await expect(page.getByRole("status")).toHaveText("جارٍ تسجيل الخروج…");
  await page.evaluate("window.__resolveLogout()");
  await expect(page.getByRole("alert")).toContainText("تعذّر تسجيل الخروج");
  await expect(logout).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "حساب العيادة" })
  ).toBeVisible();
  expect(await page.evaluate("window.__commands")).toEqual([]);
});
