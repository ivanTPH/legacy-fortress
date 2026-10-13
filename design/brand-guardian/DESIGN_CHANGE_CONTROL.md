# Design Change Control

Changes to customer-facing presentation must remain traceable to an approved source or an explicit architecture exception.

## Required change record

Every material UI change must identify:

- source file and option/state;
- affected route/component;
- canonical data and handlers preserved;
- desktop and mobile impact;
- security or privacy impact;
- screenshots or exact runtime blocker;
- tests and guardrail results.

## Allowed exceptions

- Canonical data may replace prototype sample values.
- Security, legal and permission rules override visual prototype behaviour.
- Unsupported provider or backend capabilities must be represented honestly, not simulated as completed.
- Enterprise and System Administration retain separate shells and role boundaries.

## Prohibited drift

- page-local replacement of shared tokens;
- a second icon library in governed customer UI;
- duplicate visual primitives for the same object/action;
- prototype counts, names, valuations or dates copied into production;
- hiding a missing backend capability behind decorative UI;
- removing security states to make a screenshot match.

Review `SCREEN_REFERENCE_MAP.md` before adding a new customer-facing route.

