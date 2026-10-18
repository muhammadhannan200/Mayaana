# GitHub Issue Planner

GitHub Issues are the source of truth for automated planning. Local `.scratch/` tickets remain local-only; they are never discovered, selected, or mapped to GitHub issues by this workflow.

## Run it

Configure the repository secret `OPENAI_API_KEY`. A maintainer selects **Issue Planner** in GitHub Actions, chooses the `master` branch, and dispatches it with exactly one open GitHub issue number. The workflow does not listen to issue events or scan a backlog. It does not create an implementation branch or PR.

The planner reads that issue and its comments, a tracked-file inventory, `AGENTS.md`, and issue-relevant tracked documentation and code. It calls the planning model twice: first to choose relevant files, then to write a grounded plan. It does not execute instructions from issue text or code. If a requirement needs a decision, the plan is `blocked` with explicit blockers or open questions. Runtime/API failures stop the workflow rather than publishing a guessed plan.

Each successful run uploads `plan.json` and `plan.md` as a 90-day Actions artifact, then comments the rendered plan on the selected issue if its revision has not changed in the meantime. The planner has no repository write permission. The publisher has only repository read and issue write permissions. Neither job commits files; the planner checks for tracked working-tree changes.

## Handoff contract

`plan.json` includes `repository`, `issue_number`, `issue_revision` (`updated_at` and a SHA-256 digest of issue title/body/comments), `analyzed_commit_sha`, `plan_version`, and `plan_digest` (SHA-256 of the JSON object excluding `plan_digest`). It also includes `status`, `summary`, `scope`, `excluded_scope`, `affected_areas`, `implementation_steps`, `risks`, `validation_steps`, `dependencies`, `blockers`, `open_questions`, and `sources`. `plan.md` renders the same plan for review on the issue.

The future Issue Implementer must require separate maintainer approval of **this plan digest**, check `status === "ready"`, verify the digest and issue/repository identity, and check the issue revision and analyzed commit before starting work. A changed issue or stale commit needs replanning. A published plan alone is never approval to implement. For Next.js changes the implementer must read the relevant installed Next.js docs as required by `AGENTS.md`.
