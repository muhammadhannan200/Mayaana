import assert from "node:assert/strict";
import test from "node:test";
import { digest, finalizePlan, issueNumber, issueRevision, renderPlan, verifyPlan } from "./issue-planner-core.mjs";

const proposed = {
  status: "ready",
  summary: "Plan one issue",
  scope: ["Implement sign-in"],
  excluded_scope: [],
  affected_areas: ["app/page.tsx"],
  implementation_steps: ["Read the docs"],
  risks: ["Session handling"],
  validation_steps: ["npm run typecheck"],
  dependencies: [],
  blockers: [],
  open_questions: [],
  sources: ["docs/login-flow.md"],
};
const metadata = {
  repository: "owner/repo",
  issue_number: 3,
  issue_revision: { updated_at: "2026-10-18T00:00:00Z", content_sha256: digest("issue") },
  analyzed_commit_sha: "a".repeat(40),
};

test("accepts only one positive issue number", () => {
  assert.equal(issueNumber("42"), 42);
  for (const value of ["0", "3,4", "3.1", "", "-1", "9007199254740993"]) {
    assert.throws(() => issueNumber(value));
  }
});

test("issue revision changes when a comment changes", () => {
  const issue = { title: "A", body: "B", updated_at: "now" };
  const first = issueRevision(issue, [{ id: 1, body: "one", updated_at: "now" }]);
  const second = issueRevision(issue, [{ id: 1, body: "two", updated_at: "now" }]);
  assert.notEqual(first.content_sha256, second.content_sha256);
});

test("artifact verifies identity and digest, and blocked plans require a reason", () => {
  const plan = finalizePlan(metadata, proposed);
  verifyPlan(plan, "owner/repo", 3);
  assert.match(renderPlan(plan), /Plan digest:/);
  assert.throws(() => verifyPlan({ ...plan, scope: ["changed"] }, "owner/repo", 3));
  assert.throws(() => verifyPlan(plan, "other/repo", 3));
  assert.throws(() => finalizePlan(metadata, { ...proposed, blockers: ["Need decision"] }));
  assert.throws(() => finalizePlan(metadata, { ...proposed, status: "blocked" }));
  assert.equal(finalizePlan(metadata, { ...proposed, status: "blocked", open_questions: ["Which role?"] }).status, "blocked");
});
