# AI development skills

Project skills guide how agents reason about and execute work. They do not override repository rules, security boundaries, product decisions, or explicit owner approval.

## Architecture analysis

### `improve codebase architecture`

Use for:

- architecture diagnosis
- responsibility and dependency analysis
- identifying structural debt
- proposing safer target boundaries

Do not treat architecture findings as automatic authorization to rewrite the application.

### `to tickets`

Use after architecture analysis to:

- split large findings into small reviewable tasks
- order dependencies
- separate foundation work from risky refactors
- distinguish behavior-preserving work from product changes

## Behavior-preserving refactoring

### `code-refactorer`

Use only for code that already works when the goal is structural improvement without changing observable behavior.

Appropriate uses include:

- separating mixed responsibilities
- correcting dependency direction
- reducing god components/modules
- removing duplicated structural ownership
- moving configuration/model contracts to the correct owner

Do not use it for:

- feature work
- bug fixing
- product redesign
- behavior changes
- broad rewrites

Behavior is frozen during a refactor. Preserve outputs, side effects, errors, ordering, timing, authorization, persistence semantics, and existing user-visible behavior unless a separate ticket explicitly authorizes a change.

Load only the references relevant to the scope:

- frontend
- backend
- modeling
- configuration

## Recommended sequence

1. Architecture diagnosis.
2. Convert findings into small tickets.
3. Choose one isolated refactor.
4. State the behavior being preserved and how it will be verified.
5. Perform the smallest safe structural move.
6. Run focused validation.
7. Expand validation before PR completion.
8. Review the diff and open/update the PR.
9. Stop before merge for owner approval.

Current architecture ownership and deferred work are documented in [architecture/module-ownership.md](architecture/module-ownership.md).
