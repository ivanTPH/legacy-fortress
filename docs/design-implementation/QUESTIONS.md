# V4 design questions requiring product or service decisions

1. **Multiple roles per person:** the existing canonical contact and invitation model exposes one primary role. Should V4 show additional linked relationships as read-only labels, or is a separately approved data-model change planned?
2. **Revoke Undo:** V4 shows a Toast Undo after immediate revocation. A safe, audited inverse grant operation is not established. Confirm whether to omit Undo until a dedicated service exists.
3. **Request-specific record selection:** current verification requests identify a requester, type and notes, but do not reliably carry canonical requested record IDs. Confirm how “Approve and choose records” should preselect records. Approval itself will continue to leave sharing unchanged.
4. **Form required fields:** V4 suggests type-specific required fields. Existing field dictionaries and backend validation remain authoritative until the owner approves individual changes to required status.
5. **Audit history:** V4 asks for the latest three access events and a full-history link. Confirm an authorised, contact-scoped audit API before surfacing events or a link.
