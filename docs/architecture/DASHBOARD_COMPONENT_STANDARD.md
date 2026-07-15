# Dashboard Component Standard

Status: Phase 3 shared UI standard for customer, internal and future enterprise dashboards.

## Principles

- Prefer shared components over page-specific dashboard cards.
- Use server-side data services for metrics; do not duplicate Supabase queries inside UI components.
- Use accessible labels for every icon-only control.
- Do not rely on colour alone for status.
- Keep touch targets at least 40px where practical.
- Empty states must have one clear primary action.
- Populated summary cards may show an open/details action and a small list of recent rows.

## Components

| Component / pattern | Responsibility | Supported states | Accessibility requirements | Mobile behaviour | Used in | Must not be used for |
| --- | --- | --- | --- | --- | --- | --- |
| `DashboardAssetSummaryCard` | Customer category and asset-class summary card. | loading wrapper, empty, populated, restricted, keyboard focus | card has link semantics; icon actions have labels; empty add action has label | stacks full-width in `.lf-content-grid`; no hover-only actions | customer dashboard, finance/legal/property/business/personal/digital/possessions overviews | internal operational metrics with different privacy rules |
| `.lf-finance-summary-tile` | Wrapper pairing a short helper line with a summary card. | empty/populated tile | helper text must describe the tile below | helper remains close to its card; single column on narrow screens | all customer category dashboards | unrelated forms or record detail pages |
| `AttachmentGallery` | Shared attachment display and lifecycle actions. | empty, previewable, downloadable, printable, removable, replaceable | view/download/print/remove actions labelled; unsupported preview has fallback | cards stack; actions remain reachable | customer records/documents | new page-specific upload gallery |
| `UniversalRecordWorkspace` | Shared record list/create/edit workspace. | list, create, edit, validation, empty, save confirmation | visible labels, required markers, deterministic cancel/save behaviour | form grid collapses; controls remain readable | canonical/section record routes | admin operations or enterprise metrics |
| `SectionWorkspace` | Legacy section record workspace while migration remains incomplete. | list, create, edit, empty | same form/action semantics as canonical workspace | stacks on mobile | retained legacy routes | new persistence paths |
| `IconButton` | Icon-only action control. | default, hover, focus, disabled | always requires plain-English label/title | fixed square touch target | open/edit/delete/view/status actions | text-only command where user needs explanation |
| Status badges | Compact state marker for active/sent/read/accepted/locked/revoked. | neutral, warning, success, danger | status text must be visible beside colour | inline wrap allowed | records, contacts, admin status | sole indicator of state |
| Filter bar | Search/status/sort controls. | empty, filtered, invalid filter | labels or labelled placeholders; invalid filters rejected safely | controls stack | record lists, admin lists | sensitive data exposure without role checks |
| Searchable table | Dense operational or linked-contact data. | empty, sorted, paginated, read-only, action row | headers, row actions labelled, keyboard reachable | horizontal scroll or card fallback | linked contacts, audit/admin lists | mobile-hostile unbounded tables |
| Empty state panel | Explain absence and offer one action. | no records, no permission, hidden by preferences | plain-English explanation; no fake counts | compact | record lists, admin lists | duplicating card-level "No records yet" copy |
| Access-denied state | Safe denial without implementation detail. | unauthenticated, unauthorised, revoked | says what user can do next; no database details | full-width | admin/customer protected routes | granting access client-side |
| Confirmation dialog | Confirm destructive or dirty-form actions. | discard, delete/archive, revoke | focus management and keyboard close | modal content fits viewport | delete/archive/revoke/dirty cancel | routine non-destructive navigation |
| Responsive navigation | Top-level routes and dashboards. | desktop sidebar, mobile drawer | current page state and labels | drawer with touch targets | customer app shell | admin route exposure to unauthorised users |
| Role-aware actions | Show only permitted controls and fail closed server-side. | allowed, denied, hidden, disabled with reason | disabled reason visible where action is discoverable | no hidden hover-only actions | admin and access workflows | replacing server capability enforcement |

## Phase 4A Customer Overview Component

`CanonicalAssetOverviewGrid` is the approved Phase 4A bridge between canonical customer assets and shared dashboard cards. It must:

- use `DashboardAssetSummaryCard` for rendering;
- read through existing auth/viewer/wallet/canonical asset helpers;
- scope rows to the active owner or approved linked owner context;
- show count-only summaries on selected customer overview pages;
- avoid attachment, contact, document-body, audit, admin and enterprise data;
- leave legacy/section routes documented rather than pretending they are canonical.

Selected Phase 4A overview pages: `/property`, `/business`, `/vault/digital`, `/vault/personal`.

## Current Deprecation Candidates

- Page-specific dashboard card variants that duplicate `DashboardAssetSummaryCard`.
- New attachment UI outside `AttachmentGallery`.
- New contact/invitation displays that bypass canonical contacts and invitation status helpers.
- Prototype admin screens that are not gated or visibly labelled non-operational.
