<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow

For every meaningful feature, bug fix, chore, or documentation task:

1. Work on a dedicated branch named `feature/<name>`, `fix/<name>`, `chore/<name>`, or `docs/<name>`. Never work directly on `master`.
2. Before changing files, verify the current branch and inspect `git status`.
3. When the task is complete, run relevant validation checks and review `git diff`.
4. Commit only the intended changes with a clear conventional commit message; exclude secrets and local environment files.
5. Push the branch to GitHub and open a Pull Request targeting `master`. Leave the PR unmerged for the user's final approval.

Never force-push or rewrite Git history unless the user explicitly requests it.
