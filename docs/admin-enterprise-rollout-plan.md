# Legacy Fortress Admin and Enterprise Rollout Plan

This plan covers future rollout work for the admin, probate, enterprise, and licensing surfaces. Current prototype routes remain static/mock-only until backend permissions, audit, and data access boundaries are designed and approved.

## Current Prototype Separation

- Probate operations: case management, verification review, access control, and audit review.
- Enterprise and licensing: organisation management, licence health, client portfolio reporting, and safe banded insight signals.
- Consumer vault: remains separate from internal admin and enterprise prototype routes.

No enterprise or probate prototype route should be linked from consumer navigation.

## Beta Test Access and Role Preview

Future implementation target: `/internal/test-login` or `/test-login` for staging/development only.

The beta test access route should allow reviewers to preview the application as different mock personas without weakening production authentication.

Required label:

> Beta test access - mock role preview

### Required Beta Personas

- Free consumer subscriber
- Paid consumer subscriber
- Executor
- Adviser
- Partner organisation user
- Commercial admin
- Probate admin
- Super admin

### Rules

- Test/dev/staging only.
- Do not expose on production public routes.
- Do not weaken real authentication.
- Do not store real passwords in code.
- Do not create real users unless explicitly required in a later implementation phase.
- Use mock persona switching only where safe.
- Restricted areas must show safe access-denied states.
- Consumer, probate admin, and enterprise admin views must remain clearly separated.

### Expected Preview Behaviour

- Free consumer subscriber: consumer vault navigation, starter-plan limits, billing prompts, no admin routes.
- Paid consumer subscriber: consumer vault navigation with paid-plan capacity, no admin routes.
- Executor: permitted linked-access navigation only, with sensitive areas masked or restricted according to existing access rules.
- Adviser: adviser-permitted client context only, no probate operations, no commercial admin controls unless explicitly granted.
- Partner organisation user: organisation-scoped enterprise preview only, with banded client insight data and no vault details.
- Commercial admin: enterprise/licensing prototype areas only, no probate case operations unless separately granted.
- Probate admin: probate operations only, no enterprise reporting or licensing data.
- Super admin: both probate and enterprise prototype areas, clearly separated by context labels.

### Implementation Guardrails

- Gate route visibility by environment, for example development/staging flags.
- Keep mock persona selection separate from production auth sessions.
- Do not persist persona choices to real user accounts.
- Avoid real Supabase user creation unless a later beta plan explicitly requires seeded test accounts.
- Show access-denied states for restricted routes instead of redirecting into unrelated app areas.
- Log or label the preview state in the UI so reviewers never confuse mock access with live permissions.

## Recommended Sequence

1. Finalise prototype review with solicitors, IFAs, accountants, and enterprise partners.
2. Define permission matrix for consumer, executor, adviser, probate, commercial, licensing, and super-admin roles.
3. Define audit event model for role switching, admin viewing, case decisions, licence changes, and reporting access.
4. Design beta test access route for staging/dev only.
5. Implement mock persona preview without production auth changes.
6. Add tests proving production builds do not expose the beta route unless explicitly enabled.
7. Run controlled internal pilot using mock data first.
8. Only then design backend/API integration for real role-based access.

## Open Risks Before Implementation

- Ensuring the beta route cannot appear on public production domains.
- Preventing mock persona state from being mistaken for live permissions.
- Keeping executor/adviser preview aligned with existing linked-access rules.
- Avoiding leakage between probate operations and enterprise/licensing reporting.
- Defining the audit expectations before any real admin or enterprise access is enabled.
