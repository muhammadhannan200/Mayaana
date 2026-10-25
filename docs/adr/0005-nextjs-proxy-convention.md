# ADR-0005: Use `proxy.ts` instead of recreating `middleware.ts`

Status: Accepted
Date: 2026-10-25

## Context

Mayaana runs Next.js 16, where the `middleware` file convention is deprecated
and renamed to `proxy`. This repository already uses a root `proxy.ts` for
Supabase session cookie refresh and route matching. Because there is no
`middleware.ts`, a contributor or agent might incorrectly conclude that request
interception is missing and add a second file using the old convention.

## Decision

- Mayaana uses the root `proxy.ts` file as its single Next.js proxy boundary.
- Do not create a second `middleware.ts` or duplicate the proxy logic under the
  deprecated convention.
- Changes to this boundary follow the installed Next.js 16 documentation for
  `proxy.ts`, including its export name, matcher and runtime behavior.
- Proxy remains session/request plumbing. It does not replace server-side and
  database authorization, which is covered by ADR-0003.

## Consequences

- There is one file convention and one place for request-level proxy behavior.
- Matcher changes can silently remove coverage; authentication and
  authorization must still be verified inside server actions and RPCs.
- A future framework migration or rename should update this ADR rather than
  silently adding a parallel file.
- The installed Next.js documentation, not older `middleware.ts` examples, is
  authoritative for this boundary.

## References

- `proxy.ts` — root proxy implementation and matcher.
- `package.json` — Next.js 16 dependency.
- Installed Next.js documentation:
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
  and
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/middleware.md`
- [Server-side authorization](0003-server-side-authorization.md)
