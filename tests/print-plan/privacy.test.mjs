import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const nativeRequire = createRequire(import.meta.url);
const entryId = "11111111-1111-4111-8111-111111111111";
const secret = "PRIVATE-NOTE-NEVER-PRINT-7b193";
const days = [
  {
    id: "day",
    notes: secret,
    meals: [
      { id: "meal", type: "فطور", description: "وجبة خيالية", notes: secret },
    ],
  },
];

// Execute the real server read and document using the same in-memory TypeScript
// approach as demo-hydration tests. Only the Supabase transport is replaced.
function fixture({
  role = "doctor",
  active = true,
  mustChange = false,
  user = true,
  ownClinic = true,
  ownVisit = true,
  completed = true,
  failTable,
} = {}) {
  const calls = [];
  const rows = {
    clinic_staff: {
      clinic_id: "clinic-a",
      role,
      active,
      must_change_password: mustChange,
      login_email: "doctor@example.test",
    },
    clinics: { name: "عيادة خيالية" },
    visits: {
      id: "visit-a",
      patient_id: "patient-a",
      completed_at: completed ? "2026-11-04T09:00:00Z" : null,
    },
    patients: { full_name: "مريض خيالي" },
    diet_plans: { days },
    appointments: { appointment_date: "2026-11-18" },
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: {
          user: user ? { id: "doctor-a", email: "doctor@example.test" } : null,
        },
        error: null,
      }),
    },
    from(table) {
      assert.ok(table in rows, `Unexpected table: ${table}`);
      const call = { table, columns: "", filters: [] };
      calls.push(call);
      return {
        select(columns) {
          call.columns = columns;
          return this;
        },
        eq(column, value) {
          call.filters.push([column, value]);
          return this;
        },
        async maybeSingle() {
          if (table === failTable)
            return { data: null, error: new Error(secret) };
          if (
            (table === "clinics" && !ownClinic) ||
            (table === "visits" && !ownVisit)
          )
            return { data: null, error: null };
          // Emulate projection, rejecting any added wildcard/private column.
          const row = rows[table];
          const data = Object.fromEntries(
            call.columns.split(",").map((column) => {
              const key = column.trim();
              assert.ok(
                key in row,
                `Unexpected selected field ${table}.${key}`
              );
              return [key, row[key]];
            })
          );
          return { data, error: null };
        },
      };
    },
  };
  const cache = new Map();
  function load(file) {
    if (!path.extname(file))
      file += fs.existsSync(`${file}.ts`) ? ".ts" : ".tsx";
    if (cache.has(file)) return cache.get(file).exports;
    const loaded = { exports: {} };
    cache.set(file, loaded);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    const require = (id) => {
      if (id === "server-only") return {};
      if (id === "./supabase/server" || id === "@/backend/supabase/server")
        return { createClient: async () => client };
      if (id.startsWith(".")) return load(path.resolve(path.dirname(file), id));
      if (id.startsWith("@/")) return load(path.resolve(id.slice(2)));
      return nativeRequire(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, {
      filename: file,
    })(require, loaded, loaded.exports);
    return loaded.exports;
  }
  return {
    calls,
    read: load(path.resolve("backend/print-plan-server.ts")).getPrintPlan,
    document: load(path.resolve("frontend/doctor/print-plan/document.tsx"))
      .PrintDocument,
  };
}

test("print data and rendered HTML omit private text and nested extra fields", async () => {
  const { read, calls, document } = fixture();
  const result = await read(entryId);
  assert.equal(result.kind, "ready");
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.deepEqual(Object.keys(result.plan), [
    "clinicName",
    "patientName",
    "visitDate",
    "days",
    "appointment",
  ]);
  assert.deepEqual(result.plan.days, [
    { meals: [{ type: "فطور", description: "وجبة خيالية" }] },
  ]);
  const html = renderToStaticMarkup(
    createElement(document, { plan: result.plan })
  );
  assert.ok(html.includes("مريض خيالي"));
  assert.ok(html.includes("وجبة خيالية"));
  assert.ok(html.includes("موعد المراجعة القادمة"));
  assert.equal(html.includes(secret), false);
  assert.equal(html.includes("notes"), false);
  assert.deepEqual(
    calls.map((call) => [call.table, call.columns]),
    [
      [
        "clinic_staff",
        "clinic_id, role, login_email, must_change_password, active",
      ],
      ["clinics", "name"],
      ["visits", "id,patient_id,completed_at"],
      ["patients", "full_name"],
      ["diet_plans", "days"],
      ["appointments", "appointment_date"],
    ]
  );
  for (const call of calls.filter(
    (call) => !["clinic_staff", "clinics"].includes(call.table)
  ))
    assert.ok(
      call.filters.some(
        ([key, value]) => key === "clinic_id" && value === "clinic-a"
      )
    );
  assert.ok(
    calls
      .find((call) => call.table === "clinics")
      .filters.some(
        ([key, value]) => key === "doctor_user_id" && value === "doctor-a"
      )
  );
});

for (const options of [
  { role: "secretary" },
  { role: "admin" },
  { active: false },
  { mustChange: true },
  { user: false },
]) {
  test(`unauthorized account receives no patient or diet data: ${JSON.stringify(options)}`, async () => {
    const { read, calls } = fixture(options);
    assert.deepEqual(await read(entryId), { kind: "denied" });
    assert.ok(calls.every((call) => call.table === "clinic_staff"));
  });
}

for (const [options, kind] of [
  [{ ownClinic: false }, "denied"],
  [{ ownVisit: false }, "unavailable"],
  [{ completed: false }, "incomplete"],
]) {
  test(`ownership/completion boundary: ${JSON.stringify(options)}`, async () => {
    const { read, calls } = fixture(options);
    assert.deepEqual(await read(entryId), { kind });
    assert.ok(
      calls.every((call) =>
        ["clinic_staff", "clinics", "visits"].includes(call.table)
      )
    );
  });
}

test("query failures return neither partial plan nor backend diagnostics", async () => {
  for (const failTable of [
    "clinic_staff",
    "clinics",
    "visits",
    "patients",
    "diet_plans",
    "appointments",
  ]) {
    assert.deepEqual(await fixture({ failTable }).read(entryId), {
      kind: "error",
    });
  }
});

test("invalid route ID cannot query clinical records", async () => {
  const { read, calls } = fixture();
  assert.deepEqual(await read("not-a-uuid"), { kind: "unavailable" });
  assert.deepEqual(
    calls.map((call) => call.table),
    ["clinic_staff"]
  );
});
