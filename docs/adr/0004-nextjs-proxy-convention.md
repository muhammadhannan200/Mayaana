# ADR-0004: Use the Next.js proxy convention

Status: Accepted  
Date: 2026-10-25

## Context

Mayaana uses Next.js 16 and currently has a root `proxy.ts` responsible for the request/session boundary used by protected routes. Coding agents trained on older Next.js conventions may incorrectly assume a missing `middleware.ts` file should be created.

## Decision

- The repository uses root `proxy.ts` as the current request/session proxy convention.
- Do not create a parallel `middleware.ts` merely because older Next.js conventions are expected.
- Changes to this boundary must follow the version-specific Next.js guidance available to the project and preserve current authentication/session behavior.

## Consequences

- The project avoids duplicate request interception layers.
- Agents must verify framework-version conventions instead of relying on stale training assumptions.
- Changes to proxy behavior require Auth/session validation.

## References

- `proxy.ts`
- [Login flow](../login-flow.md)
- [Architecture ownership](../architecture/module-ownership.md)
