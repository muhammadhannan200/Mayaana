import { createHash, randomUUID } from "node:crypto";
import { readFile, open } from "node:fs/promises";
import { isAbsolute, relative } from "node:path";

const NAME = "عيادة العرض - بيانات وهمية";
const OWNER = "mayaana-demo-seed-v1";
const CLINIC = "b84945c4-619b-4bfb-b376-bca457922010";
const TABLES = [
  "patients",
  "daily_queue",
  "visits",
  "visit_measurements",
  "visit_private_notes",
  "diet_plans",
  "appointments",
];
const ROLES = ["doctor", "secretary"];
const names = [
  "ليان الخيال",
  "عمر الخيال",
  "نور الخيال",
  "سامي الخيال",
  "ريم الخيال",
  "كريم الخيال",
  "هبة الخيال",
  "مازن الخيال",
];
const targets = [
  "completed",
  "completed",
  "completed",
  "waiting",
  "waiting",
  "ready",
  "ready",
  "with_doctor",
];
const patients = names.map((name, i) => ({
  id: `b84945c4-619b-4bfb-b376-bca45792210${i}`,
  name: `${name} (وهمي)`,
  // NANPA reserves 555-0100 through 555-0199 for fictional use.
  phone: `+1202555010${i}`,
  gender: i % 2 ? "male" : "female",
  height: 162 + i * 2,
  birthYear: 1985 + i * 2,
  goal: "نقص وزن",
  target: targets[i],
}));

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  return value;
}

function hash(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");
}

function day() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function diet(index) {
  return [
    {
      id: `b84945c4-619b-4bfb-b376-bca45792310${index}`,
      meals: [
        {
          id: `b84945c4-619b-4bfb-b376-bca45792410${index}`,
          type: "فطور",
          description: "مثال وهمي: لبن وشوفان وفاكهة. ليس وصفة طبية.",
        },
        {
          id: `b84945c4-619b-4bfb-b376-bca45792510${index}`,
          type: "غداء",
          description: "مثال وهمي: أرز وخضار وعدس. لأغراض العرض فقط.",
        },
        {
          id: `b84945c4-619b-4bfb-b376-bca45792610${index}`,
          type: "عشاء",
          description: "مثال وهمي: سلطة وخبز ولبنة. لأغراض العرض فقط.",
        },
      ],
    },
  ];
}

async function main() {
  const args = process.argv.slice(2);
  check(
    args.every((arg) => ["--write", "--dry-run"].includes(arg)),
    "Only --write and --dry-run are supported; there is no cleanup mode."
  );
  check(
    new Set(args).size === args.length && args.length <= 1,
    "Choose one mode only."
  );
  console.log("SEEDER REPORT");
  console.log(
    JSON.stringify(
      {
        mode: args.includes("--write") ? "write" : "dry-run",
        clinic: NAME,
        accounts: ROLES.map((role) => `${role}@mayaana-demo.example.com`),
        patients: 8,
        queue: { waiting: 2, ready: 2, with_doctor: 1, completed: 3 },
        completedHistory: 3,
        doctorDrafts: 1,
        dietPlans: 4,
        futureAppointments: 4,
        policy:
          "Fictional only. No cleanup. Existing seed day is reused; owner resets database separately.",
      },
      null,
      2
    )
  );
  // Deliberately before imports, environment validation, file access or clients.
  if (!args.includes("--write")) return;

  const required = (name) => {
    check(Boolean(process.env[name]), `Missing ${name}.`);
    return process.env[name];
  };
  const url = new URL(required("NEXT_PUBLIC_SUPABASE_URL"));
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  check(
    local &&
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash,
    "Writes are restricted to a loopback disposable Supabase URL. Hosted projects are refused."
  );
  check(
    required("SEED_CONFIRM_PROJECT_REF") === url.hostname,
    "SEED_CONFIRM_PROJECT_REF must exactly match the local URL hostname."
  );
  const passwords = Object.fromEntries(
    ROLES.map((role) => [role, required(`SEED_${role.toUpperCase()}_PASSWORD`)])
  );
  check(
    ROLES.every((role) => passwords[role].length >= 12) &&
      passwords.doctor !== passwords.secretary,
    "Use distinct passwords of at least 12 characters."
  );
  const ledgerPath = required("SEED_LEDGER_PATH");
  check(
    isAbsolute(ledgerPath) &&
      relative(process.cwd(), ledgerPath).startsWith(".."),
    "SEED_LEDGER_PATH must be absolute and outside the repository."
  );
  const publicKey = required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const secret = required("SUPABASE_SECRET_KEY");
  // No .env loading. No secrets, sessions or raw API errors are logged/stored.
  const { createClient } = await import("@supabase/supabase-js");
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) => {
        const destination = new URL(
          input instanceof URL
            ? input.href
            : typeof input === "string"
              ? input
              : input.url
        );
        check(
          destination.origin === url.origin,
          "Cross-origin request refused."
        );
        return fetch(input, {
          ...init,
          redirect: "error",
          signal: AbortSignal.timeout(15000),
        });
      },
    },
  };
  const admin = createClient(url.origin, secret, options);
  const clients = Object.fromEntries(
    ROLES.map((role) => [role, createClient(url.origin, publicKey, options)])
  );
  const result = async (operation) => {
    const { data, error } = await operation;
    check(
      !error,
      "Database/Auth operation failed. Details suppressed; do not retry an uncertain write."
    );
    return data;
  };
  let ledger;
  let loadedHash = null;
  try {
    ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
    loadedHash = hash(ledger);
  } catch (error) {
    if (error.code !== "ENOENT")
      throw new Error("Ownership ledger is unreadable; refusing to proceed.");
    ledger = {
      owner: OWNER,
      clinic: CLINIC,
      name: NAME,
      origin: url.origin,
      token: randomUUID(),
      date: day(),
      users: {},
      directory: {},
      snapshot: {},
      steps: [],
    };
  }
  check(
    ledger.owner === OWNER &&
      ledger.clinic === CLINIC &&
      ledger.name === NAME &&
      ledger.origin === url.origin &&
      ledger.token,
    "Ownership ledger does not match this script and database."
  );
  check(
    !ledger.pending,
    "An uncertain/interrupted operation exists. Refusing adoption or retry; owner review/reset is required."
  );
  // Exclusive ledger lock survives crashes: never clear a stale lock automatically.
  const lock = await open(`${ledgerPath}.lock`, "wx", 0o600);
  const save = async () => {
    const file = await open(ledgerPath, "w", 0o600);
    try {
      await file.writeFile(JSON.stringify(ledger, null, 2));
      await file.sync();
    } finally {
      await file.close();
    }
  };
  const rows = async (client, table, column, value) => {
    const { data, error, count } = await client
      .from(table)
      .select("*", { count: "exact" })
      .eq(column, value)
      .range(0, 999);
    check(
      !error && count !== null && count === data?.length,
      "Unable to inspect every clinic record; refusing partial visibility."
    );
    return data.sort((a, b) =>
      String(a.id ?? a.visit_id ?? a.user_id).localeCompare(
        String(b.id ?? b.visit_id ?? b.user_id)
      )
    );
  };
  const directory = async () => {
    const clinics = await rows(admin, "clinics", "id", CLINIC);
    const named = await rows(admin, "clinics", "name", NAME);
    check(
      named.every((row) => row.id === CLINIC),
      "Another clinic uses the fictional clinic name; refusing to proceed."
    );
    const staff = await rows(admin, "clinic_staff", "clinic_id", CLINIC);
    check(
      clinics.length <= 1 &&
        clinics.every(
          (row) =>
            row.name === NAME && row.doctor_user_id === ledger.users.doctor
        ),
      "Clinic identity/name mismatch."
    );
    check(
      hash({ clinics, staff }) === hash(ledger.directory),
      "Unknown or changed clinic/staff record. Refusing privileged writes."
    );
    for (const role of ROLES) {
      if (!ledger.users[role]) continue;
      const { user } = await result(
        admin.auth.admin.getUserById(ledger.users[role])
      );
      check(
        user.id === ledger.users[role] &&
          user.email === `${role}@mayaana-demo.example.com` &&
          user.app_metadata?.seed_owner === OWNER &&
          user.app_metadata?.seed_token === ledger.token &&
          user.app_metadata?.seed_clinic === CLINIC,
        "Auth ownership mismatch."
      );
    }
  };
  const snapshot = async () =>
    Object.fromEntries(
      await Promise.all(
        TABLES.map(async (table) => [
          table,
          await rows(clients.doctor, table, "clinic_id", CLINIC),
        ])
      )
    );
  const verify = async () => {
    await directory();
    const current = await snapshot();
    check(
      hash(current) === hash(ledger.snapshot),
      "Unknown, changed or missing clinical record; refusing to modify the clinic."
    );
    check(
      current.daily_queue.filter((q) => q.status === "with_doctor").length <= 1,
      "Multiple active patients; refusing to proceed."
    );
    return current;
  };
  const captureDirectory = async () => {
    ledger.directory = {
      clinics: await rows(admin, "clinics", "id", CLINIC),
      staff: await rows(admin, "clinic_staff", "clinic_id", CLINIC),
    };
  };
  try {
    // The ledger was read before taking the lock; reject a concurrent change.
    let lockedHash = null;
    try {
      lockedHash = hash(JSON.parse(await readFile(ledgerPath, "utf8")));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    check(
      lockedHash === loadedHash,
      "Ownership ledger changed while acquiring the lock; rerun safely."
    );
    if (!ledger.provisioned) {
      check(
        ledger.steps.length === 0 && Object.keys(ledger.users).length === 0,
        "Partial provisioning requires owner review/reset."
      );
      ledger.directory = { clinics: [], staff: [] };
      await directory();
      await save();
      for (const role of ROLES) {
        await directory(); // Also validates the exact intended clinic name before it exists.
        ledger.pending = `create-${role}`;
        await save();
        const { user } = await result(
          admin.auth.admin.createUser({
            email: `${role}@mayaana-demo.example.com`,
            password: passwords[role],
            email_confirm: true,
            app_metadata: {
              seed_owner: OWNER,
              seed_token: ledger.token,
              seed_clinic: CLINIC,
            },
          })
        );
        ledger.users[role] = user.id;
        ledger.pending = null;
        await save();
      }
      await directory();
      ledger.pending = "create-clinic";
      await save();
      await result(
        admin.from("clinics").insert({
          id: CLINIC,
          name: NAME,
          doctor_user_id: ledger.users.doctor,
        })
      );
      await captureDirectory();
      ledger.pending = null;
      await save();
      await directory();
      ledger.pending = "create-staff";
      await save();
      await result(
        admin.from("clinic_staff").insert(
          ROLES.map((role) => ({
            user_id: ledger.users[role],
            clinic_id: CLINIC,
            role,
            login_email: `${role}@mayaana-demo.example.com`,
            display_name:
              role === "doctor" ? "طبيب العرض الوهمي" : "سكرتير العرض الوهمي",
            active: true,
            must_change_password: false,
          }))
        )
      );
      await captureDirectory();
      ledger.provisioned = true;
      ledger.snapshot = Object.fromEntries(TABLES.map((table) => [table, []]));
      ledger.pending = null;
      await save();
    }
    for (const role of ROLES) {
      const data = await result(
        clients[role].auth.signInWithPassword({
          email: `${role}@mayaana-demo.example.com`,
          password: passwords[role],
        })
      );
      check(
        data.user.id === ledger.users[role],
        "Signed-in identity mismatch."
      );
    }
    await verify();
    if (ledger.complete) {
      console.log(
        "Existing seed verified. No seed records written; original service day retained."
      );
      return;
    }
    check(
      ledger.date === day(),
      "Incomplete seed belongs to a different service day; owner reset required."
    );

    const mutate = async (step, role, rpc, payload, allowed) => {
      if (ledger.steps.includes(step)) return;
      check(
        ledger.date === day(),
        "Service day changed; owner review required."
      );
      const before = await verify();
      ledger.pending = step;
      await save();
      await result(clients[role].rpc(rpc, payload));
      const after = await snapshot();
      // Never adopt unrelated rows when capturing an RPC's generated IDs.
      for (const table of TABLES) {
        const key = (row) => row.id ?? row.visit_id;
        const old = new Map(before[table].map((row) => [key(row), row]));
        for (const row of after[table]) {
          const previous = old.get(key(row));
          old.delete(key(row));
          if (hash(previous ?? null) !== hash(row)) {
            check(
              allowed[table]?.(row),
              "Unexpected record appeared during seed; ownership cannot be established."
            );
            const actor = row.updated_by ?? row.recorded_by ?? row.created_by;
            check(actor === ledger.users[role], "Unexpected clinical writer.");
          }
        }
        check(old.size === 0, "Unexpected record disappearance.");
      }
      check(
        after.daily_queue.filter((q) => q.status === "with_doctor").length <= 1,
        "Multiple active patients detected."
      );
      ledger.snapshot = after;
      ledger.steps.push(step);
      ledger.pending = null;
      await save();
    };

    // Complete three patients sequentially BEFORE handing off the final active one.
    for (const [i, patient] of patients.entries()) {
      await mutate(
        `patient-${i}`,
        "secretary",
        "clinical_create_patient",
        {
          p_id: patient.id,
          p_clinic: CLINIC,
          p_name: patient.name,
          p_phone: patient.phone,
          p_height: patient.height,
          p_gender: patient.gender,
          p_birth_year: patient.birthYear,
          p_goal: patient.goal,
        },
        { patients: (row) => row.id === patient.id }
      );
      await mutate(
        `enqueue-${i}`,
        "secretary",
        "clinical_enqueue",
        { p_clinic: CLINIC, p_patient: patient.id, p_kind: "full_exam" },
        {
          daily_queue: (row) =>
            row.patient_id === patient.id && row.queue_date === ledger.date,
          visits: (row) => row.patient_id === patient.id,
        }
      );
      if (patient.target === "waiting") continue;
      let q = ledger.snapshot.daily_queue.find(
        (row) => row.patient_id === patient.id
      );
      const visit = ledger.snapshot.visits.find((row) => row.queue_id === q.id);
      const allowed = {
        daily_queue: (row) => row.id === q.id,
        visits: (row) => row.id === visit.id,
        visit_measurements: (row) => row.visit_id === visit.id,
      };
      await mutate(
        `measure-${i}`,
        "secretary",
        "clinical_save_measurements",
        {
          p_queue: q.id,
          p_revision: q.revision,
          p_values: {
            weight: 72 + i * 3,
            fat: 26 + i,
            muscle: 29 + i,
            visceral: 8,
            bmr: 1550 + i * 40,
            waist: 83 + i,
            arm: 29,
            thigh: 53,
            hip: 98 + i,
          },
        },
        allowed
      );
      if (patient.target === "ready") continue;
      q = ledger.snapshot.daily_queue.find((row) => row.id === q.id);
      await mutate(
        `handoff-${i}`,
        "secretary",
        "clinical_handoff",
        {
          p_queue: q.id,
          p_revision: q.revision,
          p_request: `b84945c4-619b-4bfb-b376-bca45792710${i}`,
        },
        allowed
      );
      q = ledger.snapshot.daily_queue.find((row) => row.id === q.id);
      const appointment = new Date(`${ledger.date}T12:00:00Z`);
      appointment.setUTCDate(appointment.getUTCDate() + 14 + i);
      const payload = {
        p_queue: q.id,
        p_revision: q.revision,
        p_notes:
          "سجل عرض وهمي: مراجعة نمط الوجبات والنشاط. لا يمثل مريضاً أو توصية طبية.",
        p_days: diet(i),
        p_appointment: appointment.toISOString().slice(0, 10),
      };
      const doctorAllowed = {
        daily_queue: allowed.daily_queue,
        visits: allowed.visits,
        visit_private_notes: (row) => row.visit_id === visit.id,
        diet_plans: (row) => row.visit_id === visit.id,
        appointments: (row) => row.originating_visit_id === visit.id,
      };
      if (patient.target === "completed") {
        await mutate(
          `finish-${i}`,
          "doctor",
          "clinical_finish",
          { ...payload, p_request: `b84945c4-619b-4bfb-b376-bca45792810${i}` },
          doctorAllowed
        );
      } else {
        await mutate(
          `draft-${i}`,
          "doctor",
          "clinical_save_doctor_draft",
          payload,
          doctorAllowed
        );
      }
    }
    const final = await verify();
    check(
      final.patients.length === 8 &&
        final.daily_queue.length === 8 &&
        final.visits.length === 8 &&
        final.visit_measurements.length === 6 &&
        final.diet_plans.length === 4 &&
        final.visit_private_notes.length === 4 &&
        final.appointments.length === 4 &&
        patients.every(
          (patient) =>
            final.daily_queue.find((q) => q.patient_id === patient.id)
              ?.status === patient.target
        ),
      "Final fixture verification failed."
    );
    ledger.complete = true;
    await save();
    console.log(
      "Fictional seed completed and verified. Keep the ownership ledger; no cleanup is provided."
    );
  } finally {
    await lock.close();
    // Remove only our exclusive local lock, never any database record.
    const { unlink } = await import("node:fs/promises");
    await unlink(`${ledgerPath}.lock`);
  }
}

main().catch(() => {
  // Errors may contain request URLs, credentials, or clinical fields. Never echo them.
  console.error(
    "SEEDER: refused or failed. No raw error details logged. Check configuration and ownership ledger pending state; uncertain writes require owner review/reset."
  );
  process.exitCode = 1;
});
