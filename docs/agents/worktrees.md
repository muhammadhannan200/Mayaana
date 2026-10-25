# Parallel worktrees

Rules for humans and agents working in parallel on this repository. The goal is
that concurrent tasks never overwrite each other or silently absorb unrelated
work.

## One task per branch and worktree

- Use **one meaningful concurrent task per branch/worktree**. Do not queue
  unrelated fixes on the same branch.
- Use a dedicated branch named `feature/<name>`, `fix/<name>`, `chore/<name>` or
  `docs/<name>`.
- Use a separate worktree for parallel tasks, created from the latest remote
  `master`.

```sh
git fetch origin --prune
git worktree add -b docs/<name> ../mayanaa-<name> origin/master
```

Do not reuse another agent's worktree because it happens to be open.

## Before editing

Always inspect the branch and status first:

```sh
git branch --show-current
git status
```

If the worktree is not on the expected branch, or contains unexpected
uncommitted or untracked work, **stop modifying that worktree and report it**.
Do not "clean it up" to continue.

## Never do this to another worktree

- Do not modify, move or delete another agent's worktree.
- Do not `git stash`, `git reset`, `git clean`, `git checkout --`, or overwrite
  another agent's uncommitted changes.
- Do not commit unrelated work, even if it is convenient.
- Do not force-push or rewrite shared history.

Existing uncommitted work belongs to its owner until that owner says otherwise.

## Committing

- Stage only the files for this task.
- Review `git diff` and `git status` before committing.
- Never commit secrets, `.env.local`, local tooling state or generated
  artifacts.
- Leave pull requests unmerged until the owner approves.

## Issue #41

The Issue #41 worktree (`D:\project\mayanaa-issue-41` on this machine) contains
protected UI/behavior work. Keep it untouched unless the owner explicitly
authorizes access. Do not inspect, stash, move or modify it as part of another
task, and do not copy its changes into an unrelated branch.

## Related

- [Conventions](../conventions.md)
- [Commands](../commands.md)
- [AGENTS.md](../../AGENTS.md)
