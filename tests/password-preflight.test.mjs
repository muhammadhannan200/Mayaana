import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createContext, compileFunction } from "node:vm";
import ts from "typescript";

// Run the real Server Action, validation and staff authorization. Only external
// Next/Supabase boundaries are replaced. No network, real env or accounts exist
// in this context. Run: node --test tests/password-preflight.test.mjs
const sourceFiles = {
  actions: new URL("../app/actions.ts", import.meta.url),
  auth: new URL("../lib/auth.ts", import.meta.url),
  validation: new URL("../lib/auth-validation.ts", import.meta.url),
};
const sources = Object.fromEntries(
  Object.entries(sourceFiles).map(([name, url]) => [
    name,
    ts.transpileModule(readFileSync(url, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: url.pathname,
    }).outputText,
  ])
);
const serviceError = {
  kind: "service",
  error: "تعذّر الاتصال بالخدمة. حاول مرة أخرى.",
};

class Redirect extends Error {
  constructor(destination) {
    super("Synthetic Next redirect");
    this.destination = destination;
  }
}

function harness() {
  const state = {
    initializationFailure: false,
    user: { id: "synthetic-user", email: "doctor@example.test" },
    staff: {
      clinic_id: "synthetic-clinic",
      role: "doctor",
      login_email: "doctor@example.test",
      active: true,
      must_change_password: false,
    },
    userFailure: null,
    userThrows: false,
    staffFailure: null,
    updates: [],
    activations: [],
    verified: [],
    currentPasswordError: null,
    lookups: 0,
    logs: [],
  };
  const client = {
    auth: {
      getUser: async () => {
        if (state.userThrows) throw new Error("Synthetic private user lookup detail");
        return { data: { user: state.user }, error: state.userFailure };
      },
      updateUser: async (attributes) => {
        state.updates.push(attributes);
        return { error: null };
      },
    },
    from: (table) => {
      assert.equal(table, "clinic_staff");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => {
              state.lookups++;
              return { data: state.staff, error: state.staffFailure };
            },
          }),
        }),
      };
    },
  };
  const boundaries = {
    "server-only": {},
    "next/navigation": {
      redirect: (destination) => { throw new Redirect(destination); },
    },
    "next/cache": { revalidatePath: () => assert.fail("Unexpected revalidation") },
    "@/lib/supabase/server": {
      createClient: async () => {
        if (state.initializationFailure)
          throw new Error("Synthetic private initialization detail");
        return client;
      },
      isSupabaseConfigured: () => true,
      createStatelessClient: () => ({
        auth: {
          signInWithPassword: async ({ password }) => {
            state.verified.push(password);
            return { error: state.currentPasswordError ?? null };
          },
        },
      }),
    },
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from: (table) => {
          assert.equal(table, "clinic_staff");
          return {
            update: (attributes) => {
              state.activations.push(attributes);
              return {
                eq: () => ({ select: () => ({ single: async () => ({ error: null }) }) }),
              };
            },
          };
        },
      }),
    },
  };
  const context = createContext({
    FormData,
    process: { env: { SUPABASE_SECRET_KEY: "synthetic-test-only" } },
    console: Object.fromEntries(["log", "error", "warn"].map((name) => [
      name, (...args) => state.logs.push(args),
    ])),
  });
  const loaded = {};
  function load(name) {
    if (loaded[name]) return loaded[name];
    const loadedModule = { exports: {} };
    compileFunction(sources[name], ["require", "module", "exports"], {
      parsingContext: context,
      filename: sourceFiles[name].pathname,
    })((specifier) => {
      if (specifier === "@/lib/auth") return load("auth");
      if (specifier === "@/lib/auth-validation") return load("validation");
      if (Object.hasOwn(boundaries, specifier)) return boundaries[specifier];
      assert.fail(`Unexpected external dependency: ${specifier}`);
    }, loadedModule, loadedModule.exports);
    loaded[name] = loadedModule.exports;
    return loadedModule.exports;
  }
  return { state, changePassword: load("actions").changePassword };
}

function form() {
  const data = new FormData();
  data.set("password", "Synthetic-new-password!");
  data.set("confirmation", "Synthetic-new-password!");
  data.set("currentPassword", "Synthetic-current-password!");
  return data;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("initialization failure returns a private, retryable result without mutation", async () => {
  const { state, changePassword } = harness();
  state.initializationFailure = true;
  const data = form();
  assert.deepEqual(plain(await changePassword(null, data)), serviceError);
  assert.equal(state.lookups, 0);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.activations, []);
  assert.deepEqual(state.logs, []);
  assert.equal(data.get("currentPassword"), "Synthetic-current-password!");
  assert.equal(data.get("password"), "Synthetic-new-password!");
  state.initializationFailure = false;
  await assert.rejects(changePassword(serviceError, data), (error) =>
    error instanceof Redirect && error.destination === "/doctor"
  );
  assert.equal(state.updates.length, 1);
  assert.deepEqual(state.activations, []);
});

for (const mode of ["throws", "returns-service-error"]) {
  test(`user lookup ${mode}: safe failure and successful explicit retry`, async () => {
    const { state, changePassword } = harness();
    state.userThrows = mode === "throws";
    state.userFailure = mode === "returns-service-error"
      ? { name: "AuthApiError", status: 503, message: "Synthetic private Auth detail" }
      : null;
    const data = form();
    const result = await changePassword(null, data);
    assert.deepEqual(plain(result), serviceError);
    assert.equal(state.lookups, 0);
    assert.deepEqual(state.updates, []);
    assert.deepEqual(state.activations, []);
    assert.deepEqual(state.logs, []);
    state.userThrows = false;
    state.userFailure = null;
    await assert.rejects(changePassword(result, data), (error) =>
      error instanceof Redirect && error.destination === "/doctor"
    );
    assert.deepEqual(plain(state.updates), [{
      password: "Synthetic-new-password!",
      current_password: "Synthetic-current-password!",
    }]);
    assert.deepEqual(state.activations, []);
  });
}

for (const error of [
  { name: "AuthRetryableFetchError", status: 0 },
  { name: "AuthApiError", status: 429 },
  { name: "AuthApiError", status: 504 },
  { name: "AuthApiError", code: "request_timeout" },
  { name: "AuthApiError", code: "unexpected_failure" },
]) {
  test(`user lookup service classification: ${error.code ?? error.status}`, async () => {
    const { state, changePassword } = harness();
    state.user = null;
    state.userFailure = { ...error, message: "Synthetic private service detail" };
    assert.deepEqual(plain(await changePassword(null, form())), serviceError);
    assert.equal(state.lookups, 0);
    assert.deepEqual(state.updates, []);
    assert.deepEqual(state.activations, []);
  });
}

for (const reason of ["no-session", "expired-session", "missing-staff", "inactive", "email-mismatch", "invalid-role", "normal-secretary"]) {
  test(`${reason}: authorization redirect remains intact without mutation`, async () => {
    const { state, changePassword } = harness();
    if (reason === "no-session") state.user = null;
    if (reason === "expired-session") {
      state.userFailure = { name: "AuthApiError", status: 401, code: "session_not_found" };
    }
    if (reason === "missing-staff") state.staff = null;
    if (reason === "inactive") state.staff.active = false;
    if (reason === "email-mismatch") state.staff.login_email = "other@example.test";
    if (reason === "invalid-role") state.staff.role = "patient";
    if (reason === "normal-secretary") state.staff.role = "secretary";
    const destination = reason === "normal-secretary" ? "/secretary" : "/";
    await assert.rejects(changePassword(null, form()), (error) =>
      error instanceof Redirect && error.destination === destination
    );
    assert.deepEqual(state.updates, []);
    assert.deepEqual(state.activations, []);
    assert.deepEqual(state.logs, []);
  });
}

test("retry after staff outage rechecks a subsequently disabled account", async () => {
  const { state, changePassword } = harness();
  state.staffFailure = { message: "Synthetic temporary failure" };
  const result = await changePassword(null, form());
  assert.deepEqual(plain(result), serviceError);
  state.staffFailure = null;
  state.staff.active = false;
  await assert.rejects(changePassword(result, form()), (error) =>
    error instanceof Redirect && error.destination === "/"
  );
  assert.equal(state.lookups, 2);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.activations, []);
});

test("optional doctor cannot omit current password to bypass server validation", async () => {
  const { state, changePassword } = harness();
  const data = form();
  data.delete("currentPassword");
  assert.deepEqual(plain(await changePassword(null, data)), {
    kind: "validation",
    error: "أدخل كلمة المرور الحالية.",
    fieldErrors: { currentPassword: "أدخل كلمة المرور الحالية." },
  });
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.activations, []);
});

test("wrong current password is rejected before any update", async () => {
  const { state, changePassword } = harness();
  const data = form();
  state.staff.must_change_password = false;
  state.currentPasswordError = { status: 400, code: "invalid_credentials" };
  const result = await changePassword(null, data);
  assert.equal(result.kind, "service");
  assert.match(result.error, /تعذّر تغيير كلمة المرور/);
  assert.deepEqual(state.verified, ["Synthetic-current-password!"]);
  assert.deepEqual(state.updates, []);
});

test("field validation still precedes preflight and does not echo input", async () => {
  const { state, changePassword } = harness();
  state.initializationFailure = true;
  const data = form();
  data.set("password", "short");
  const result = await changePassword(null, data);
  assert.equal(result.kind, "validation");
  assert.equal(result.fieldErrors.password, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.");
  assert.equal(JSON.stringify(result).includes("short"), false);
  assert.equal(state.lookups, 0);
  assert.deepEqual(state.updates, []);
  assert.deepEqual(state.activations, []);
});

for (const mode of ["optional-doctor", "mandatory-doctor", "mandatory-secretary"]) {
  test(`${mode}: staff-directory outage cannot mutate; retry rechecks authorization`, async () => {
    const { state, changePassword } = harness();
    state.staff.must_change_password = mode !== "optional-doctor";
    state.staff.role = mode === "mandatory-secretary" ? "secretary" : "doctor";
    state.staffFailure = { message: "Synthetic private staff detail", code: "08006" };
    const data = form();
    if (state.staff.must_change_password) data.delete("currentPassword");
    const result = await changePassword(null, data);
    assert.deepEqual(plain(result), serviceError);
    assert.equal(state.lookups, 1);
    assert.deepEqual(state.updates, []);
    assert.deepEqual(state.activations, []);
    assert.deepEqual(state.logs, []);
    state.staffFailure = null;
    await assert.rejects(changePassword(result, data), (error) =>
      error instanceof Redirect && error.destination === `/${state.staff.role}`
    );
    assert.equal(state.lookups, 2);
    assert.deepEqual(plain(state.updates), [state.staff.must_change_password
      ? { password: "Synthetic-new-password!" }
      : { password: "Synthetic-new-password!", current_password: "Synthetic-current-password!" }
    ]);
    assert.deepEqual(plain(state.activations), state.staff.must_change_password
      ? [{ must_change_password: false }]
      : []
    );
  });
}
