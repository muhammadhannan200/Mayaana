import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

// Exercise the public screen read with a synthetic, read-only Supabase adapter.
// No database, credentials, network, or mutation methods are available here.
async function historyAt(completedAt) {
  const patient = "11111111-1111-4111-8111-111111111111";
  const queue = "22222222-2222-4222-8222-222222222222";
  const visit = "33333333-3333-4333-8333-333333333333";
  const rows = {
    patients: [{ id: patient, full_name: "Fictional patient", revision: 0 }],
    daily_queue: [
      {
        id: queue,
        patient_id: patient,
        visit_type: "follow_up",
        status: "completed",
        revision: 3,
        arrived_at: "2026-10-10T20:00:00Z",
      },
    ],
    visits: [
      {
        id: visit,
        patient_id: patient,
        queue_entry_id: queue,
        completed_at: completedAt,
      },
    ],
    visit_measurements: [{ visit_id: visit, measurements: { weight: 65 } }],
  };
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: "fictional-user" } } }),
    },
    from(table) {
      assert.ok(table in rows, `Unexpected read: ${table}`);
      const query = {
        then(resolve) {
          return Promise.resolve({ data: rows[table], error: null }).then(
            resolve
          );
        },
      };
      for (const method of [
        "select",
        "eq",
        "order",
        "range",
        "in",
        "not",
        "limit",
        "or",
      ])
        query[method] = () => query;
      return query;
    },
  };
  const source = readFileSync(
    new URL("../../lib/clinical.ts", import.meta.url),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(
    compiled,
    {
      exports,
      require(name) {
        if (name === "server-only") return {};
        if (name === "./supabase/server")
          return { createClient: async () => client };
        if (name === "./queue-handoff")
          return {
            cancelUnavailableMessage: "",
            doctorOccupiedMessage: "",
          };
        if (name === "./auth")
          return {
            accountForUser: async () => ({
              clinicId: "fictional-clinic",
              role: "secretary",
              mustChangePassword: false,
            }),
          };
        throw new Error(`Unexpected runtime dependency: ${name}`);
      },
      Intl,
      Date,
    },
    { filename: "lib/clinical.ts" }
  );
  const result = await exports.getClinicScreen({ term: "", page: 0, patient });
  assert.equal(result.ok, true);
  // Read-only adapters must preserve the actual stored timestamp.
  assert.equal(rows.visits[0].completed_at, completedAt);
  return result.data.patients[0].visits[0];
}

for (const [timestamp, date, detailDate] of [
  ["2026-10-10T20:59:00Z", "2026-10-10", "2026-10-10 · 23:59"],
  ["2026-10-10T21:00:00Z", "2026-10-11", "2026-10-11 · 00:00"],
  ["2026-10-10T21:01:00Z", "2026-10-11", "2026-10-11 · 00:01"],
  ["2026-12-31T21:01:00Z", "2027-01-01", "2027-01-01 · 00:01"],
  ["2026-10-11T00:01:00+03:00", "2026-10-11", "2026-10-11 · 00:01"],
  ["2024-02-28T21:00:00Z", "2024-02-29", "2024-02-29 · 00:00"],
  ["2020-12-31T21:59:59Z", "2020-12-31", "2020-12-31 · 23:59"],
  ["2020-12-31T22:00:00Z", "2021-01-01", "2021-01-01 · 00:00"],
]) {
  test(`history uses the Damascus date and minute: ${timestamp}`, async () => {
    const history = await historyAt(timestamp);
    assert.equal(history.date, date);
    assert.equal(history.detailDate, detailDate);
  });
}
