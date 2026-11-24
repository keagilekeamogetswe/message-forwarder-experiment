# Message actions

These modules define what persistence, retrieval, and progress mean for each recipient type.

- `primary.action.ts` stores and reads direct messages and removes acknowledged queue items.
- `room.actions.ts` routes room message operations.
- `group.action.ts` checks active membership before persistence, reads per-group cursors and pending invite coverage, and advances coverage after successful socket writes.
- The shared recipient router is in the parent `actions/send.message.ts`.

Group messages do not generate delivered or read receipt events. Internal coverage is used for reconnect and invite catch-up only.
