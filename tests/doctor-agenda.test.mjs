import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as agenda from "../shared/doctor-agenda.ts";

const { classifyAgenda, damascusDate, readDoctorAgenda, AgendaBoundError } =
  agenda;
const today = "2026-11-04";
const now = new Date("2026-11-04T09:00:00Z");
const doctor = {
  role: "doctor",
  clinicId: "clinic-a",
  mustChangePassword: false,
};
const patients = [
  "today",
  "overdue",
  "arrived",
  "completed",
  "future",
  "rescheduled",
  "same-day",
].map((id) => ({ id, name: `خيالي ${id}` }));
const appointments = patients.map((p) => ({
  patientId: p.id,
  date: p.id === "today" ? today : "2026-11-01",
}));
appointments.push(
  { patientId: "future", date: "2026-11-05" },
  { patientId: "rescheduled", date: "2026-11-20" }
);

test("today, overdue, arrived (any queue status), completed-later, same-day completion, future and later appointment", () => {
  const result = classifyAgenda(
    today,
    patients,
    appointments,
    ["arrived"],
    [
      { patientId: "completed", date: "2026-11-02" },
      { patientId: "same-day", date: "2026-11-01" },
      { patientId: "overdue", date: "2026-10-30" },
    ]
  );
  assert.deepEqual(
    result.today.map((row) => row.patientId),
    ["today"]
  );
  assert.deepEqual(
    result.overdue.map((row) => row.patientId),
    ["overdue"]
  );
  assert.equal(result.today[0].date, today);
  assert.equal(result.today[0].name, "خيالي today");
});

test("latest appointment appears once, including later-today replacing overdue", () => {
  const result = classifyAgenda(
    today,
    [patients[0]],
    [
      { patientId: "today", date: "2026-10-01" },
      { patientId: "today", date: today },
      { patientId: "today", date: today },
    ],
    [],
    []
  );
  assert.equal(result.today.length, 1);
  assert.deepEqual(result.overdue, []);
});

test("Damascus midnight switches the calendar date, not UTC or host date", () => {
  assert.equal(
    damascusDate(new Date("2026-11-03T20:59:59.999Z")),
    "2026-11-03"
  );
  assert.equal(damascusDate(new Date("2026-11-03T21:00:00.000Z")), today);
  const row = [{ patientId: "today", date: "2026-11-03" }];
  assert.equal(
    classifyAgenda("2026-11-03", [patients[0]], row, [], []).today.length,
    1
  );
  assert.equal(
    classifyAgenda(today, [patients[0]], row, [], []).overdue.length,
    1
  );
});

// A small query double executes the actual reader's filters and projections.
// Every query must have an explicit clinic and limit; forbidden reads fail.
function clientFor(tables) {
  const queries = [];
  return {
    queries,
    from(table) {
      assert.ok(
        ["patients", "appointments", "daily_queue", "visits"].includes(table)
      );
      const query = { table, filters: [], max: undefined, columns: undefined };
      queries.push(query);
      const chain = {
        select(columns) {
          query.columns = columns;
          assert.doesNotMatch(columns, /\*|notes|days|measurements/);
          return chain;
        },
        eq(key, value) {
          query.filters.push((row) => row[key] === value);
          if (key === "clinic_id") query.clinic = value;
          return chain;
        },
        lte(key, value) {
          query.filters.push((row) => row[key] <= value);
          return chain;
        },
        in(key, values) {
          query.filters.push((row) => values.includes(row[key]));
          return chain;
        },
        not(key, operator, value) {
          assert.equal(operator, "is");
          assert.equal(value, null);
          query.filters.push((row) => row[key] != null);
          return chain;
        },
        order() {
          return chain;
        },
        limit(max) {
          query.max = max;
          return chain;
        },
        then(resolve) {
          assert.ok(query.clinic, "clinic filter required");
          assert.ok(query.max <= 501, "bounded query required");
          const rows = (tables[table] ?? [])
            .filter((row) => query.filters.every((filter) => filter(row)))
            .slice(0, query.max);
          return Promise.resolve({
            data: rows.map((row) =>
              Object.fromEntries(
                query.columns.split(",").map((key) => [key, row[key]])
              )
            ),
            error: null,
          }).then(resolve);
        },
      };
      return chain;
    },
  };
}

test("reader scopes every read by clinic, uses Damascus completion dates, ignores incomplete visits", async () => {
  const client = clientFor({
    patients: [
      { clinic_id: "clinic-a", id: "a", full_name: "ألف" },
      { clinic_id: "clinic-a", id: "b", full_name: "باء" },
      { clinic_id: "clinic-b", id: "other", full_name: "آخر" },
    ],
    appointments: [
      { clinic_id: "clinic-a", patient_id: "a", appointment_date: today },
      { clinic_id: "clinic-a", patient_id: "b", appointment_date: today },
      { clinic_id: "clinic-b", patient_id: "other", appointment_date: today },
      // A foreign clinic's later appointment/arrival/visit cannot hide a patient.
      {
        clinic_id: "clinic-b",
        patient_id: "b",
        appointment_date: "2026-12-01",
      },
    ],
    daily_queue: [
      { clinic_id: "clinic-b", patient_id: "b", queue_date: today },
    ],
    visits: [
      {
        clinic_id: "clinic-a",
        patient_id: "a",
        completed_at: "2026-11-03T21:00:00Z",
      },
      { clinic_id: "clinic-a", patient_id: "b", completed_at: null },
      {
        clinic_id: "clinic-b",
        patient_id: "b",
        completed_at: "2026-11-04T08:00:00Z",
      },
    ],
  });
  const result = await readDoctorAgenda(client, doctor, now);
  assert.deepEqual(result.today, [
    { patientId: "b", name: "باء", date: today },
  ]);
  assert.deepEqual(result.overdue, []);
  assert.ok(client.queries.every((query) => query.clinic === "clinic-a"));
});

test("reader excludes today's queue, but not an earlier queue or uncompleted visit", async () => {
  const client = clientFor({
    patients: ["a", "b"].map((id) => ({
      clinic_id: "clinic-a",
      id,
      full_name: id,
    })),
    appointments: ["a", "b"].map((patient_id) => ({
      clinic_id: "clinic-a",
      patient_id,
      appointment_date: "2026-11-01",
    })),
    daily_queue: [
      { clinic_id: "clinic-a", patient_id: "a", queue_date: today },
      { clinic_id: "clinic-a", patient_id: "b", queue_date: "2026-11-02" },
    ],
  });
  assert.deepEqual(
    (await readDoctorAgenda(client, doctor, now)).overdue.map(
      (row) => row.patientId
    ),
    ["b"]
  );
});

test("doctor access is enforced before reading clinical tables", async () => {
  for (const account of [
    null,
    { ...doctor, role: "secretary" },
    { ...doctor, mustChangePassword: true },
  ]) {
    const client = clientFor({});
    await assert.rejects(
      readDoctorAgenda(client, account, now),
      /Doctor access required/
    );
    assert.equal(client.queries.length, 0);
  }
});

test("candidate and history bounds fail closed rather than reporting partial overdue data", async () => {
  const row = {
    clinic_id: "clinic-a",
    patient_id: "a",
    appointment_date: today,
  };
  await assert.rejects(
    readDoctorAgenda(
      clientFor({ appointments: Array(201).fill(row) }),
      doctor,
      now
    ),
    AgendaBoundError
  );
  await assert.rejects(
    readDoctorAgenda(
      clientFor({
        patients: [{ clinic_id: "clinic-a", id: "a", full_name: "ألف" }],
        appointments: [
          row,
          ...Array(500).fill({ ...row, appointment_date: "2026-12-01" }),
        ],
      }),
      doctor,
      now
    ),
    AgendaBoundError
  );
  await assert.rejects(
    readDoctorAgenda(
      clientFor({
        patients: [{ clinic_id: "clinic-a", id: "a", full_name: "ألف" }],
        appointments: [row],
        visits: Array(501).fill({
          clinic_id: "clinic-a",
          patient_id: "a",
          completed_at: "2026-10-01T09:00:00Z",
        }),
      }),
      doctor,
      now
    ),
    AgendaBoundError
  );
});

function compile(file, imports) {
  const loaded = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }
  ).outputText;
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`)(
    (name) => {
      assert.ok(name in imports, `Unexpected runtime import: ${name}`);
      return imports[name];
    },
    loaded,
    loaded.exports
  );
  return loaded.exports;
}

test("server action reauthenticates and rejects anonymous, inactive, first-use and secretary callers", async () => {
  for (const account of [
    null,
    { ...doctor, role: "secretary" },
    { ...doctor, mustChangePassword: true },
    doctor,
  ]) {
    let read = false;
    let authentications = 0;
    const action = compile("../backend/actions/agenda-actions.ts", {
      "@/backend/auth": { accountForUser: async () => account },
      "@/backend/supabase/server": {
        createClient: async () => ({
          auth: {
            getUser: async () => {
              authentications++;
              return { data: { user: { id: "u" } }, error: null };
            },
          },
        }),
      },
      "@/shared/doctor-agenda": {
        AgendaBoundError,
        readDoctorAgenda: async () => {
          read = true;
          return { today: [], overdue: [] };
        },
      },
    });
    assert.equal((await action.getDoctorAgenda()).ok, account === doctor);
    assert.equal(read, account === doctor);
    assert.equal(authentications, 1);
  }
  const action = compile("../backend/actions/agenda-actions.ts", {
    "@/backend/auth": {
      accountForUser: () => assert.fail("No account lookup for anonymous"),
    },
    "@/backend/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      }),
    },
    "@/shared/doctor-agenda": agenda,
  });
  assert.equal((await action.getDoctorAgenda()).ok, false);
});

test("demo reads fictional local appointment metadata without reading private fields", () => {
  const { demoAgenda } = compile("../frontend/demo/demo-agenda.ts", {
    "../../shared/doctor-agenda": agenda,
  });
  const privateValue = {
    get() {
      assert.fail("Private data must not be read");
    },
  };
  const visit = { appointment: today };
  Object.defineProperties(visit, { notes: privateValue, days: privateValue });
  const result = demoAgenda(
    {
      patients: [
        {
          id: "local-today",
          name: "تجريبي اليوم",
          visits: [{ date: "2026-10-01", appointment: today }],
        },
        {
          id: "local-overdue",
          name: "تجريبي متأخر",
          visits: [{ date: "2026-10-01", appointment: "2026-11-01" }],
        },
        {
          id: "local-completed",
          name: "تجريبي مكتمل",
          visits: [
            {
              date: "١/١١/٢٠٢٦",
              serviceDate: "2026-11-02",
              appointment: "2026-11-01",
            },
          ],
        },
        { id: "arrived", name: "حضر", visits: [] },
      ],
      queue: [{ patientId: "arrived", visit }],
    },
    today
  );
  assert.deepEqual(
    result.today.map((row) => row.patientId),
    ["local-today"]
  );
  assert.deepEqual(
    result.overdue.map((row) => row.patientId),
    ["local-overdue"]
  );
});
