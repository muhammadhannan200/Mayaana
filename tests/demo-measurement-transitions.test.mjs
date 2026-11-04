import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { handoffQueue } from "../lib/queue-handoff.ts";

const source = (path) =>
  ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
const flow = source("app/secretary/clinic-flow.tsx");
const storeSource = source("lib/demo-clinic.tsx");

function find(root, predicate) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, (node) => find(node, predicate));
}

function compile(text, bindings, result) {
  const { outputText } = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  return new Function(...Object.keys(bindings), `${outputText}\nreturn ${result};`)(
    ...Object.values(bindings)
  );
}

// Execute the actual JSX callbacks, not a duplicated policy or a text assertion.
// Only their lexical dependencies are supplied; production exports stay private.
function measurementCallback(name, store, entry, measurements) {
  const attribute = find(flow, (node) =>
    ts.isJsxAttribute(node) && node.name.getText(flow) === name
  );
  assert.ok(attribute && ts.isJsxExpression(attribute.initializer));
  const expression = attribute.initializer.expression;
  const callback = ts.isConditionalExpression(expression)
    ? expression.whenFalse
    : expression;
  assert.ok(ts.isArrowFunction(callback));
  return compile(`const callback = ${callback.getText(flow)};`, {
    update: store.update,
    entry,
    operations: undefined,
    go: () => {},
  }, "callback")(measurements);
}

function harness(status = "ready") {
  const initial = {
    patients: [{ id: "fictional-patient", name: "Synthetic", visits: [] }],
    queue: [{
      id: "fictional-entry", patientId: "fictional-patient", kind: "follow_up",
      status, measurements: { weight: "80" },
      visit: { notes: "Keep this draft", days: [], appointment: "" },
    }],
  };
  const key = "mayanaa-demo-v1:public";
  const values = new Map([[key, JSON.stringify(initial)]]);
  const pending = [];
  // Deterministic FIFO Web Lock substitute: callbacks cannot run until released.
  const locks = {
    request(name, callback) {
      assert.equal(name, key);
      return new Promise((resolve, reject) => pending.push({ callback, resolve, reject }));
    },
    async releaseNext() {
      const request = pending.shift();
      assert.ok(request, "Expected a queued locked mutation");
      try { request.resolve(await request.callback()); }
      catch (error) { request.reject(error); }
    },
  };
  const declaration = find(storeSource, (node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === "createStore"
  );
  assert.ok(declaration);
  const createStore = compile(declaration.getText(storeSource), {
    initial, handoffQueue, navigator: { locks }, window: {},
    localStorage: {
      getItem: (name) => values.get(name) ?? null,
      setItem: (name, value) => values.set(name, value),
    },
  }, "createStore");
  return {
    secretary: createStore("public"), doctor: createStore("public"), locks, pending,
    persisted: () => JSON.parse(values.get(key)),
  };
}

for (const callback of ["onDraftChange", "onComplete"]) {
  for (const transition of ["handoff", "completion"]) {
    test(`${callback}: stale save queued behind ${transition} preserves the confirmed entry`, async () => {
      const h = harness();
      const staleEntry = structuredClone(h.secretary.read().queue[0]);
      if (transition === "completion") {
        const sent = h.doctor.handoff(staleEntry.id);
        await h.locks.releaseNext();
        assert.equal(await sent, "sent");
        assert.equal(h.secretary.read().queue[0].status, "ready", "Secretary snapshot is stale");
      }
      const confirmed = transition === "handoff"
        ? h.doctor.handoff(staleEntry.id)
        : h.doctor.update((state) => ({
            ...state,
            queue: state.queue.map((entry) => ({
              ...entry, status: "completed",
              visit: { ...entry.visit, completedAt: "2026-10-27T10:00:00Z" },
            })),
          }));
      const staleSave = measurementCallback(callback, h.secretary, staleEntry, { weight: "99" });
      assert.equal(h.pending.length, 2, "Transition precedes stale save in the lock queue");
      await h.locks.releaseNext();
      const outcome = await confirmed;
      if (transition === "handoff") assert.equal(outcome, "sent");
      const before = h.persisted();
      assert.equal(before.queue[0].status, transition === "handoff" ? "with_doctor" : "completed");
      await h.locks.releaseNext();
      await staleSave;
      assert.deepEqual(h.persisted(), before, "Stale callback must not change status, measurements or visit data");
      assert.deepEqual(h.secretary.read(), before);
    });
  }
  for (const status of ["waiting", "ready"]) {
    test(`${callback}: eligible ${status} entry still saves measurements`, async () => {
      const h = harness(status);
      const before = h.persisted();
      const saved = measurementCallback(callback, h.secretary, before.queue[0], { weight: "81" });
      await h.locks.releaseNext();
      await saved;
      const after = h.persisted();
      assert.deepEqual(after.queue[0].measurements, { weight: "81" });
      assert.equal(after.queue[0].status, callback === "onComplete" ? "ready" : "waiting");
      assert.deepEqual(after.queue[0].visit, before.queue[0].visit);
      assert.deepEqual(after.patients, before.patients);
    });
  }
}
