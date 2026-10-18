import { createHash } from "node:crypto";

export const PLAN_VERSION = 1;

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function issueRevision(issue, comments) {
  return {
    updated_at: issue.updated_at,
    content_sha256: digest({
      title: issue.title,
      body: issue.body,
      comments: comments.map(({ id, body, updated_at }) => ({ id, body, updated_at })),
    }),
  };
}

export function issueNumber(value) {
  const number = Number(value);
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(number)) {
    throw new Error("Select exactly one positive GitHub issue number");
  }
  return number;
}

export function finalizePlan(metadata, proposed) {
  const lists = [
    "scope", "excluded_scope", "affected_areas", "implementation_steps", "risks",
    "validation_steps", "dependencies", "blockers", "open_questions", "sources",
  ];
  if (
    !["ready", "blocked"].includes(proposed.status) ||
    typeof proposed.summary !== "string" ||
    !proposed.summary.trim() ||
    lists.some((key) => !Array.isArray(proposed[key]) || proposed[key].some((item) => typeof item !== "string"))
  ) {
    throw new Error("Planner returned an invalid plan shape");
  }
  if (proposed.status === "ready" && (proposed.blockers.length || proposed.open_questions.length)) {
    throw new Error("A plan with unresolved questions or blockers cannot be ready");
  }
  if (proposed.status === "blocked" && !proposed.blockers.length && !proposed.open_questions.length) {
    throw new Error("A blocked plan must explain why it is blocked");
  }
  const plan = { ...metadata, plan_version: PLAN_VERSION, ...proposed };
  return { ...plan, plan_digest: digest(plan) };
}

export function verifyPlan(plan, repository, number) {
  const { plan_digest, ...unsigned } = plan;
  if (
    plan.repository !== repository || plan.issue_number !== number || plan.plan_version !== PLAN_VERSION ||
    !/^[0-9a-f]{40}$/.test(plan.analyzed_commit_sha) || digest(unsigned) !== plan_digest
  ) {
    throw new Error("Plan identity or digest does not match");
  }
}

export async function github(token, path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${path}: HTTP ${response.status}`);
  return response.json();
}

export async function getIssueSnapshot(token, repository, number) {
  const base = `/repos/${repository}/issues/${number}`;
  const issue = await github(token, base);
  if (issue.state !== "open" || issue.pull_request) {
    throw new Error("Selected number must identify an open issue, not a PR");
  }
  const comments = [];
  for (let page = 1; page <= 4; page++) {
    const batch = await github(token, `${base}/comments?per_page=100&page=${page}`);
    comments.push(...batch);
    if (batch.length < 100) return { issue, comments, revision: issueRevision(issue, comments) };
  }
  throw new Error("Issue has too many comments to plan without truncation");
}

export function renderPlan(plan) {
  const section = (title, items) =>
    `### ${title}\n${items.length ? items.map((item) => `- ${item}`).join("\n") : "- None identified"}`;
  return [
    "<!-- issue-planner:v1 -->",
    `## Implementation plan · ${plan.status}`,
    plan.summary,
    section("Scope", plan.scope),
    section("Out of scope", plan.excluded_scope),
    section("Affected files / areas", plan.affected_areas),
    section("Implementation steps", plan.implementation_steps),
    section("Risks", plan.risks),
    section("Validation", plan.validation_steps),
    section("Dependencies", plan.dependencies),
    section("Blockers", plan.blockers),
    section("Open questions", plan.open_questions),
    section("Sources", plan.sources),
    `Repository: \`${plan.repository}\` · Issue: #${plan.issue_number} · Issue revision: \`${plan.issue_revision.updated_at}\` / \`${plan.issue_revision.content_sha256}\``,
    `Analyzed commit: \`${plan.analyzed_commit_sha}\` · Plan version: ${plan.plan_version} · Plan digest: \`${plan.plan_digest}\``,
    "This plan is a proposal; implementation requires separate maintainer approval.",
  ].join("\n\n") + "\n";
}
