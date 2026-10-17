# V4 design questions requiring product or service decisions

1. **Multiple roles per person:** the existing canonical contact and invitation model exposes one primary role. Should V4 show additional linked relationships as read-only labels, or is a separately approved data-model change planned?
2. **Revoke Undo:** V4 shows a Toast Undo after immediate revocation. A safe, audited inverse grant operation is not established. Confirm whether to omit Undo until a dedicated service exists.
3. **Request-specific record selection:** current verification requests identify a requester, type and notes, but do not reliably carry canonical requested record IDs. Confirm how “Approve and choose records” should preselect records. Approval itself will continue to leave sharing unchanged.
4. **Form required fields:** V4 suggests type-specific required fields. Existing field dictionaries and backend validation remain authoritative until the owner approves individual changes to required status.
5. **Audit history:** V4 asks for the latest three access events and a full-history link. Confirm an authorised, contact-scoped audit API before surfacing events or a link.

## V5 decisions and implementation gates

**Approved for planning:** Use V5 as the current visual reference, retain V4 history, and deliver in owner-reviewed stages: Personal Vault mobile; People & Access/mobile forms; Platform Admin mobile; Partner Portal mobile; then desktop consistency. Keep current authentication, roles, routes, grants, RLS and deployment controls. None of the questions below is permission to add backend capability.

6. **Staff workspace conflict:** `MOBILE_V4.1.md` includes a role-filtered “Legacy Fortress staff” entry in the customer workspace sheet, while `ADMIN_PARTNER.md` says Platform Admin has separate sign-in and never appears in the customer switcher. Which navigation model is approved? Until decided, retain the current authorised choices and security-domain boundaries.
7. **Three-interface consolidation:** Should existing Enterprise Operations and Platform Probate Review routes remain as compatible entry points if their navigation is later grouped under Platform Admin? Specify role mapping, redirects and migration acceptance before any change.
8. **Admin sign-in/two-step:** Is the proposed separate Platform Admin login and mandatory two-step verification an authorised future security project? It requires provider, recovery and session decisions and is outside visual stages.
9. **Partner Portal:** Confirm the approved public route/label and which V5 Team, Registration links, Reports and Activity views can map to existing `/enterprise/*` services. Unbacked prototype actions must not appear functional.
10. **Workspace labels and roles:** Confirm the display labels “Personal,” “Linked to you,” “Work” and “Legacy Fortress staff” for each existing authorised context; labels must not imply broader grants.
11. **Mobile form presentation:** V5 specifies full-screen Add/Edit modals without the customer tab bar. Confirm whether existing deep links and back behavior should stay on their current URLs while adopting that presentation.
12. **Admin action reasons:** Identify any V5 risky actions whose current canonical service does not store an audited reason. Do not add an unaudited field or claim an action is reversible.
