# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Clinic doctors and secretaries use a mobile-width, Arabic RTL interface during patient intake and visits. Patient access is a separate later release.

## Product Purpose

Rashaqa helps a clinic maintain patient files and a daily queue, record visits, and hand patients from reception to the doctor.

## Operating Context

The secretary searches for an existing patient before creating a new file, adds the patient to today's queue and can send them to the doctor without first recording measurements. The doctor can perform essential secretary work from their own account.

## Capabilities and Constraints

Clinic staff sign in with separate email/password accounts. Account role and clinic membership come from the protected Supabase staff directory, not editable user metadata. The first secretary delivery covers queue home and patient search/create/add; measurements, patient account access, and V2 appointments follow later. Patient data must be separated by clinic.

## Brand Commitments

The existing Rashaqa Figma mobile web canvas is the visual reference, particularly secretary home frame `142:607`. Preserve Arabic copy and RTL layout.

## Evidence on Hand

See `docs/product-overview.md`, `docs/figma-structure.md`, `docs/design-system.md`, `docs/login-flow.md`, and `docs/database.md`. No real patient content is provided; sample names in Figma are not production records.

## Product Principles

- Find before creating to limit duplicate patient files.
- Make queue status and next action clear at a glance.
- Enforce clinic isolation in the database as well as on protected pages.
