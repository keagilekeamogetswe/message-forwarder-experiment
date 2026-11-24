# Application actions

Actions implement application use cases and coordinate repositories. WebSocket handlers and other entry points call these actions instead of choosing persistence collections themselves.

- [send.message.ts](send.message.ts) parses recipient prefixes and routes to destination actions.
- [group.action.ts](group.action.ts) handles group membership, promotion, invites, acceptance, and succession.
- [message/](message/README.md) contains per-destination persistence and retrieval behavior.
