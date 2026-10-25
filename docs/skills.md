# AI skills

Skills are developer tooling that guide how an agent works. They do **not**
override repository rules, product decisions, security boundaries or explicit
owner approval. When a skill conflicts with
[architecture ownership](architecture/module-ownership.md),
[conventions](conventions.md), [security](security.md) or an explicit
instruction, the repository and the owner win.

Skill availability depends on the local agent environment. The repository
commits its own issue workflows under `.agents/skills/` (`plan-issue` and
`implement-issue`); the broader skills below are installed tooling, not
application code.

## `improve codebase architecture`

Use for:

- Architecture diagnosis
- Responsibility and dependency analysis
- Identifying structural debt and ownership gaps

Useful repository inputs are the
[dependency baseline](architecture/dependency-baseline.md), the ownership and
dependency rules in [module ownership](architecture/module-ownership.md), and
the live inventory (`node scripts/architecture-inventory.mjs`).

Do **not** treat a diagnosis as automatic authorization to rewrite the
application. Findings become tickets first, and architecture work waits for a
fresh review of then-current `master`.

## `to tickets`

Use for:

- Converting architecture findings into small, ordered, reviewable tasks
- Separating foundation work from risky refactors
- Making dependencies between tasks explicit before implementation

Tickets should state scope, verification and what is explicitly out of scope.
The ARCH ticket sequence in
[module ownership](architecture/module-ownership.md) is the current example:
foundation and characterization first, contract extraction and screen
extraction deferred. ARCH-04 and later are not started.

## `code-refactorer`

Use for:

- Existing working code
- Behavior-preserving structural refactoring
- Clear responsibility and dependency improvements

Important limits:

- Not for feature work
- Not for bug fixing
- Not for redesign
- **Behavior is frozen.** Preserve outputs, side effects, errors, ordering,
  timing and existing URLs. If a correctness change is unavoidable, stop and
  make it a separately authorized task.
- Use the narrowest relevant reference files:
  - `frontend` — browser/client UI, components, hooks, presentation adapters
  - `backend` — server processes, persistence, controllers, services
  - `modeling` — DTOs, read models, storage records, behavioral contracts
  - `configuration` — constants, catalogs, feature flags, environment values
- For a full-stack change that crosses the client/server seam, read both the
  frontend and backend references rather than guessing a boundary.
- Validate after structural moves: typecheck first, then the narrow relevant
  test/build, then the broader scope before the PR. Never claim that compilation
  proves runtime behavior.

## Recommended sequence

```text
architecture diagnosis
  → tickets (small, ordered, reviewable)
  → one isolated refactor
  → focused validation
  → broader validation
  → pull request
```

Keep each refactor independently reviewable. Do not combine unrelated cleanup,
a behavior change and a migration in one PR. Validation is scope-aware; see
[commands](commands.md). The PR stays unmerged until owner approval.

## Why this order

Diagnosis without tickets turns into an unplanned rewrite. Tickets without a
frozen behavior contract turn a refactor into a feature change. Broad validation
before focused validation hides which move broke a contract. A PR that mixes
scopes cannot be reviewed or reverted safely.
