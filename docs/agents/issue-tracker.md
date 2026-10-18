# Issue tracker: GitHub

Issues, specs and implementation tickets for this repository live in [GitHub Issues](https://github.com/muhammadhannan200/Mayaana/issues). Use `gh` to read, comment on and publish issues; do not create local `.scratch/` tickets.

## Conventions

- Read an issue and its discussion with `gh issue view <number> --comments` (paginate through the API when necessary).
- Publish a spec or ticket with `gh issue create`; use a separate issue for each implementation ticket.
- Record triage states with GitHub labels defined in [triage-labels.md](triage-labels.md), not a local `Status:` line.
- Link related issues using GitHub sub-issues and native issue dependencies where available. If those features are unavailable, record `Part of #<number>` or `Blocked by: #<number>` in the issue body.
- Leave pull requests outside the issue-triage queue. PRs target `master` for human review under the repository's [Git workflow](../../AGENTS.md).

## Agent workflows

Project-local skills live in [`.agents/skills/`](../../.agents/skills/). The tracked `plan-issue` and `implement-issue` workflows use GitHub Issues for their approval chain; other issue-oriented skills should use the same tracker. The source inventory for installed skills is [`skills-lock.json`](../../skills-lock.json).
