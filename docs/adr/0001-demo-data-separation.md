# ADR-0001: Demo data remains browser-local and fictional

Status: Accepted
Date: 2026-10-25

## Context

Mayaana exposes a public demo at `/demo` so the clinic workflow can be reviewed
without real accounts or clinical records. The authenticated Doctor and
Secretary workflows use Supabase as their authoritative store. Keeping demo
behavior close to the real screens is useful, but mixing demo data with
authenticated clinical storage would create safety, privacy and determinism
risks.

Existing architecture documentation records known demo/production source-code
coupling as debt. That debt does not authorize sharing runtime data between the
two contexts.

## Decision

- `/demo` remains a public demo surface with fictional patients, measurements,
  notes, meals and appointments.
- Demo persistence remains browser-local, using the versioned public demo store
  keyed as `mayanaa-demo-v1:public` with a `public` scope. It is not a clinical
  database and not a security boundary.
- Demo records must never be inserted into authenticated clinical storage.
- Authenticated Doctor and Secretary clinical data is stored in and read from
  Supabase, not from the demo store.
- The authenticated application must not seed fictional records or fall back to
  browser-local clinical data.

## Consequences

- Demo state is per browser and can be reset without affecting real data.
- Clearing browser storage can remove demo state, which is acceptable because
  the data is fictional.
- No real patient information may be entered into `/demo`.
- Tests and reviews must keep demo storage and authenticated persistence
  separate.
- The known production-to-demo import debt remains. This ADR preserves the data
  and persistence boundary; it does not claim that source-code decoupling has
  been completed.

## References

- [Module ownership](../architecture/module-ownership.md) — demo/preview
  ownership, dependency rules and recorded demo/production coupling.
- [Dependency baseline](../architecture/dependency-baseline.md) — measured
  production-to-demo imports and the explicit note that they are not evidence
  fictional records reach Supabase.
- [Secretary V1 demo](../secretary-v1-demo.md) — public demo routes, fictional
  fixtures, browser-local state and reset behavior.
- [Clinical persistence](../clinical-persistence.md) — authenticated layouts do
  not mount the demo provider, and no local demo data is imported into clinical
  tables.
- [Production readiness audit](../production-readiness-audit.md) — requirement
  that public demo/preview surfaces remain fictional and clearly separated.
- `app/demo/[[...path]]/page.tsx`, `lib/demo-clinic.tsx`,
  `app/secretary/persisted-flow.tsx`
