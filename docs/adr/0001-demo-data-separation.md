# ADR-0001: Keep demo data separate from authenticated clinical data

Status: Accepted  
Date: 2026-10-25

## Context

Mayaana provides public demo and preview experiences alongside authenticated Doctor and Secretary workflows. Demo content is fictional and browser-local, while authenticated clinical workflows use Supabase-backed data.

The current codebase still has documented source-level coupling between some production contracts and demo/fixture modules. That coupling is architecture debt; it is not permission for demo records to enter authenticated storage.

## Decision

- Public demo state remains fictional and browser-local.
- Authenticated clinical state remains Supabase-backed.
- Demo records must never be inserted into authenticated clinical tables.
- Refactors may reduce source-level demo/production coupling, but must preserve this runtime separation.

## Consequences

- Demo flows can remain deterministic and safe without production data.
- Clinical privacy and persistence boundaries stay explicit.
- Architecture work must distinguish source-code coupling from runtime data separation.

## References

- [Architecture ownership](../architecture/module-ownership.md)
- [Dependency baseline](../architecture/dependency-baseline.md)
- [Product overview](../product-overview.md)
