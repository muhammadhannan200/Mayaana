# Security Policy

## Supported Versions

Mayaana is currently under active development. Security fixes are applied to the latest version of the `master` branch.

| Version | Supported |
| --- | --- |
| Latest `master` | ✅ |
| Older commits / abandoned branches | ❌ |

## Reporting a Vulnerability

Please **do not open a public GitHub issue** for security vulnerabilities.

If GitHub provides a **Report a vulnerability** option for this repository, use it to submit the report privately through GitHub Security Advisories.

Include as much of the following information as possible:

- A clear description of the vulnerability.
- The affected page, route, API, or component.
- Steps to reproduce the issue.
- The expected and actual behavior.
- The potential security impact.
- Screenshots, logs, or proof-of-concept details when relevant.
- Any suggested mitigation, if known.

Please avoid including real patient, clinic, authentication, or other sensitive data in a report.

## What to Report

Examples of security issues that should be reported privately include:

- Authentication or session bypasses.
- Unauthorized access to doctor, secretary, clinic, or account data.
- Role or permission escalation.
- Supabase RLS bypasses.
- Exposure of secrets, service-role keys, tokens, or credentials.
- Cross-site scripting (XSS).
- SQL injection or unsafe database access.
- Sensitive information disclosure.
- Vulnerabilities that could allow modification or deletion of data without authorization.
- Dependency vulnerabilities that are exploitable in Mayaana.

## Out of Scope

The following generally do not require a private security report unless they create a real security impact:

- UI/UX issues without a security consequence.
- Missing features.
- General code-quality suggestions.
- Automated scanner reports without a reproducible security impact.
- Vulnerabilities affecting unsupported or abandoned branches only.

## Disclosure

Please allow reasonable time for investigation and remediation before publicly disclosing a vulnerability.

We will aim to:

1. Review valid reports promptly.
2. Reproduce and assess the impact.
3. Develop and validate a fix.
4. Release the fix through the normal pull-request and review process.
5. Coordinate disclosure when appropriate.

## Security Practices

The project uses automated security and quality checks, including:

- Dependency vulnerability scanning.
- Secret scanning.
- GitHub CodeQL analysis.
- Pull-request quality checks.
- Human review before production merges.

Security controls in the application, including authentication, authorization, Supabase Row Level Security (RLS), and server-only secrets, must not be weakened to simplify development or testing.
