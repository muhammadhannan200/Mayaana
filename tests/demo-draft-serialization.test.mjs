import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { handoffQueue } from "../lib/queue-handoff.ts";

const source = ts.createSourceFile("lib/demo-clinic.tsx", readFileSync("lib/demo-clinic.tsx", "utf8"), ts.ScriptTarget.Latest, true);
const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "createStore");
assert.ok(declaration);
const compiled = ts.transpileModule(declaration.getText(source), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const key = "mayanaa-demo-v1:public";
const draftKey = "mayanaa-demo-visit-v1:public:entry";
const seed = {
  notes: "Seed notes",
  days: [{ id: "day", meals: [{ id: "meal", type: "فطور", description: "Seed meal" }] }],
  appointment: "2099-11-15",
};
const changed = (label) => ({
  notes: `${label} notes`,
  days: [{ id: "day", meals: [{ id: "meal", type: "فطور", description: `${label} meal` }] }],
  appointment: label === "First" ? "2099-11-16" : "2099-11-17",
});

function harness() {
  const initial = {
    patients: [{ id: "patient", name: "Synthetic", visits: [] }],
    queue: [{ id: "entry", patientId: "patient", kind: "follow_up", status: "with_doctor", measurements: { weight: "80" }, visit: structuredClone(seed) }],
  };
  const values = new Map([[key, JSON.stringify(initial)]]);
  const pending = [], writes = [];
  let held = false, beforeWrite;
  const locks = {
    request(name, callback) {
      assert.equal(name, key);
      return new Promise((resolve, reject) => pending.push({ callback, resolve, reject }));
    },
    async releaseNext() {
      assert.equal(held, false);
      const request = pending.shift();
      assert.ok(request);
      held = true;
      try { request.resolve(await request.callback()); }
      catch (error) { request.reject(error); }
      finally { held = false; }
    },
  };
  function tab() {
    const faults = { write: false };
    const listeners = new Set();
    const createStore = new Function("initial", "handoffQueue", "navigator", "localStorage", "window", `${compiled}\nreturn createStore;`)(
      structuredClone(initial), handoffQueue, { locks },
      {
        getItem: (name) => values.get(name) ?? null,
        setItem(name, value) {
          if (faults.write) throw new Error("Synthetic shared-storage failure");
          const hook = beforeWrite;
          beforeWrite = undefined;
          if (hook) hook(name, value);
          writes.push({ name, held });
          values.set(name, value);
        },
        removeItem: (name) => values.delete(name),
        [draftKey]: "",
      },
      { addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn) }
    );
    const store = createStore("public");
    store.read();
    store.subscribe(() => {});
    return { store, faults, sync: () => listeners.forEach((fn) => fn({ key: draftKey })) };
  }
  return {
    tab, values, pending, writes, locks,
    hook: (fn) => { beforeWrite = fn; },
    drain: async () => { while (pending.length) await locks.releaseNext(); },
    persisted: () => JSON.parse(values.get(key)),
  };
}
const save = (tab, visit, expected = seed) => Promise.resolve(tab.store.saveVisit("entry", () => visit, expected));
const complete = (tab, expected = seed) => tab.store.completeVisit("entry", expected, expected.appointment);

test("a late autosave cannot publish inside the completion write boundary", async () => {
  const h = harness(), completing = h.tab(), editing = h.tab();
  const late = changed("Late");
  let autosave;
  h.hook((name) => {
    assert.equal(name, key);
    autosave = save(editing, late);
  });
  const completion = complete(completing);
  await h.drain();
  assert.equal(await completion, "completed");
  assert.equal(await autosave, "unavailable", "A write arriving during completion must wait and then reject");
  assert.equal(h.values.has(draftKey), false, "No late draft key may be published");
  assert.deepEqual(editing.store.localDraft("entry"), late, "Retain every rejected field for recovery");
  assert.equal(h.persisted().queue[0].visit.notes, seed.notes);
  assert.equal(h.persisted().patients[0].visits.length, 1);
});

test("overlapping same-visit autosaves serialize; the losing edit is recoverable, not last-writer-wins", async () => {
  const h = harness(), first = h.tab(), second = h.tab();
  let loser;
  h.hook((name) => {
    assert.equal(name, draftKey);
    loser = save(second, changed("Second"));
  });
  const winner = save(first, changed("First"));
  await h.drain();
  assert.equal(await winner, "saved");
  assert.equal(await loser, "conflict");
  assert.deepEqual(JSON.parse(h.values.get(draftKey)), changed("First"));
  assert.deepEqual(second.store.localDraft("entry"), changed("Second"));
  assert.ok(h.writes.every((write) => write.held), "All shared writes must own the same lock");
});

test("autosave winning the lock makes an older completion fail without changing history", async () => {
  const h = harness(), editing = h.tab(), completing = h.tab();
  const autosave = save(editing, changed("First"));
  const completion = complete(completing);
  await h.drain();
  assert.equal(await autosave, "saved");
  assert.equal(await completion, "conflict");
  assert.equal(h.persisted().queue[0].status, "with_doctor");
  assert.equal(h.persisted().patients[0].visits.length, 0);
  assert.deepEqual(JSON.parse(h.values.get(draftKey)), changed("First"));
  assert.ok(h.writes.every((write) => write.held));
});

test("rapid same-tab edits remain visible while queued and commit in order before completion", async () => {
  const h = harness(), tab = h.tab();
  const first = save(tab, changed("First"));
  const second = save(tab, changed("Second"), changed("First"));
  assert.deepEqual(tab.store.read().queue[0].visit, changed("Second"));
  assert.equal(tab.store.isSavingVisit("entry"), true);
  const snapshot = tab.store.read();
  assert.equal(tab.store.read(), snapshot, "Pending snapshots must be cached for React");
  const completion = complete(tab, changed("Second"));
  await h.drain();
  assert.deepEqual(await Promise.all([first, second]), ["saved", "saved"]);
  assert.equal(await completion, "completed");
  assert.equal(tab.store.localDraft("entry"), undefined);
  assert.equal(tab.store.isSavingVisit("entry"), false);
  const { completedAt, ...savedVisit } = h.persisted().queue[0].visit;
  assert.ok(completedAt);
  assert.deepEqual(savedVisit, changed("Second"));
  assert.deepEqual(Object.keys(h.persisted()), ["patients", "queue"]);
});

test("a losing tab cannot flush its conflict through stale retries or storage events", async () => {
  const h = harness(), first = h.tab(), second = h.tab();
  const winner = save(first, changed("First")), loser = save(second, changed("Second"));
  await h.drain();
  assert.equal(await winner, "saved");
  assert.equal(await loser, "conflict");
  const authoritative = h.values.get(draftKey), writes = h.writes.length;
  second.sync();
  const retry = save(second, changed("Retry"), changed("Second"));
  await h.drain();
  assert.equal(await retry, "local_only");
  assert.equal(h.values.get(draftKey), authoritative);
  assert.equal(h.writes.length, writes);
  assert.deepEqual(second.store.localDraft("entry"), changed("Retry"));
});

test("failed shared autosave stays local and cannot be flushed or completed after storage recovery", async () => {
  const h = harness(), failing = h.tab(), other = h.tab();
  failing.faults.write = true;
  const failed = save(failing, changed("Failed"));
  await h.drain();
  assert.equal(await failed, "local_only");
  assert.equal(h.values.has(draftKey), false);
  failing.faults.write = false;
  const saved = save(other, changed("First"));
  await h.drain();
  assert.equal(await saved, "saved");
  const authoritative = [...h.values];
  const retry = save(failing, changed("Retry"), changed("Failed"));
  const completion = complete(failing, changed("Retry"));
  await h.drain();
  assert.equal(await retry, "local_only");
  assert.equal(await completion, "storage_unavailable");
  assert.deepEqual([...h.values], authoritative);
  assert.deepEqual(failing.store.localDraft("entry"), changed("Retry"));
});

test("storage synchronization cannot replace a pending losing edit", async () => {
  const h = harness(), first = h.tab(), second = h.tab();
  const winner = save(first, changed("First")), loser = save(second, changed("Second"));
  await h.locks.releaseNext();
  assert.equal(await winner, "saved");
  second.sync();
  assert.deepEqual(second.store.read().queue[0].visit, changed("Second"));
  assert.equal(second.store.isSavingVisit("entry"), true);
  await h.locks.releaseNext();
  assert.equal(await loser, "conflict");
  assert.deepEqual(JSON.parse(h.values.get(draftKey)), changed("First"));
  assert.deepEqual(second.store.localDraft("entry"), changed("Second"));
});

test("unrelated queue writes cannot flush an optimistic draft into the main document", async () => {
  const h = harness(), tab = h.tab();
  const queueWrite = tab.store.update((state) => ({ ...state }));
  const autosave = save(tab, changed("First"));
  await h.locks.releaseNext();
  await queueWrite;
  assert.deepEqual(h.persisted().queue[0].visit, seed);
  await h.locks.releaseNext();
  assert.equal(await autosave, "saved");
  assert.deepEqual(JSON.parse(h.values.get(draftKey)), changed("First"));
});

test("confirmed reset clears both shared drafts and pending local metadata", async () => {
  const h = harness(), tab = h.tab();
  const autosave = save(tab, changed("First"));
  const reset = tab.store.reset();
  await h.drain();
  assert.equal(await autosave, "saved");
  await reset;
  assert.equal(h.values.has(draftKey), false);
  assert.deepEqual(h.persisted().queue[0].visit, seed);
  assert.equal(tab.store.localDraft("entry"), undefined);
  assert.equal(tab.store.isSavingVisit("entry"), false);
});

test("the actual Demo editor warns before unloading pending or recovered edits", () => {
  const editor = ts.createSourceFile("app/doctor/visit-screen.tsx", readFileSync("app/doctor/visit-screen.tsx", "utf8"), ts.ScriptTarget.Latest, true);
  function find(node) {
    if (ts.isCallExpression(node) && node.expression.getText(editor) === "useEffect" &&
      node.arguments[0]?.getText(editor).includes('window.addEventListener("beforeunload"')) return node.arguments[0];
    return ts.forEachChild(node, find);
  }
  const callback = find(editor);
  assert.ok(callback);
  const effectCode = ts.transpileModule(`const effect = ${callback.getText(editor)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  for (const [hasLocalDraft, failedCompletionDraft] of [[true, null], [false, seed], [false, null]]) {
    const listeners = new Map();
    const effect = new Function("demo", "hasLocalDraft", "failedCompletionDraft", "draft", "editing", "description", "window", "document", `${effectCode}\nreturn effect;`)(
      true, hasLocalDraft, failedCompletionDraft, null, null, "",
      { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name) => listeners.delete(name) },
      { addEventListener: () => {}, removeEventListener: () => {} }
    );
    const cleanup = effect();
    if (hasLocalDraft || failedCompletionDraft) {
      let prevented = false;
      listeners.get("beforeunload")({ preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      cleanup();
      assert.equal(listeners.size, 0);
    } else assert.equal(listeners.has("beforeunload"), false);
  }
});
