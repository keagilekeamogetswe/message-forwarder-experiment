# WebSocket server

This folder owns WebSocket authentication, connection setup, heartbeat handling, protocol dispatch, and channel implementations.

- [upgrade.ts](upgrade.ts) verifies the `ws_access` cookie and acquires its Redis `jti` lock.
- [connection.ts](connection.ts) registers the client and restores pending events and messages.
- [channels/](channels/README.md) maps protocol channels and actions to handlers.
- [services/](services/README.md) provides client lookup and message forwarding.
- [types/](types/README.md) defines connection and message contracts.
