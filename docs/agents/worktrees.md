# Worktree safety

Detailed operating rules for agents working in parallel. `AGENTS.md` keeps the
short version; this document is the reference.

## Starting work

- Fetch the latest `master` before branching.
- Create a dedicated branch (`feature/<name>`, `fix/<name>`, `chore/<name>`, or
  `docs/<name>`) in its own worktree. Never work directly on `master`.
- Before changing files, inspect `git status` and the current branch in the
  worktree you are about to use.
- Confirm the worktree path is yours. Do not reuse a path another agent is
  working in, even if it looks idle.

## Protecting other agents' work

- Never modify a worktree another agent may be using.
- Never stash, reset, clean, overwrite, or commit another agent's uncommitted
  work.
- Never run repository-wide destructive commands (`git reset --hard`,
  `git clean`, force-push, history rewrites) while other worktrees exist.
- Do not delete or prune worktrees you did not create.
- Preserve unrelated and pre-existing user changes. Leave them unstaged and
  uncommitted.

## Protected worktrees

- Issue #41's uncommitted worktree is protected. Do not inspect, move, stash,
  or modify it without explicit owner approval.
- Treat any worktree with an active branch and uncommitted changes as owned by
  another agent until the owner says otherwise.

## Finishing work

- Validate the affected scope before committing.
- Review `git diff` and confirm only task-related files are included.
- Commit only your changes with a conventional commit message.
- Push your branch and open or update a PR targeting `master`.
- Stop before merge. Do not auto-merge.
