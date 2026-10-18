import { readFile } from "node:fs/promises";
import { getIssueSnapshot, github, issueNumber, renderPlan, verifyPlan } from "./issue-planner-core.mjs";

const repository = process.env.GITHUB_REPOSITORY;
const number = issueNumber(process.env.ISSUE_NUMBER);
const token = process.env.GITHUB_TOKEN;
if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") || !token) throw new Error("Missing GitHub repository or token");

const plan = JSON.parse(await readFile("planner-output/plan.json", "utf8"));
verifyPlan(plan, repository, number);
const snapshot = await getIssueSnapshot(token, repository, number);
if (JSON.stringify(snapshot.revision) !== JSON.stringify(plan.issue_revision)) {
  throw new Error("Issue changed while planning; rerun the planner before publishing");
}
await github(token, `/repos/${repository}/issues/${number}/comments`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: renderPlan(plan) }),
});
