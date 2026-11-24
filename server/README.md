# Server

The server is an Express HTTP service and a `ws` WebSocket service in one Node.js process. It issues short-lived WebSocket cookies, validates upgrades, routes protocol actions, persists messages and progress, and restores pending items when users reconnect.

## Runtime flow

1. [app/index.ts](app/index.ts) configures Express and the WebSocket server, connects Redis, then listens on `HTTP_PORT` (4000 in the local test stack).
2. [app/middleware/authentication.ts](app/middleware/authentication.ts) validates the bearer token for `/wsaccess`. [app/ws.access.token.route.ts](app/ws.access.token.route.ts) issues the short-lived `ws_access` cookie.
3. [app/websocket/upgrade.ts](app/websocket/upgrade.ts) verifies the cookie and uses [app/repository/redis/access.token.ts](app/repository/redis/access.token.ts) to prevent concurrent reuse of its `jti`.
4. [app/websocket/connection.ts](app/websocket/connection.ts) registers the authenticated connection and restores persisted event and message items.
5. [app/websocket/services/channel.ts](app/websocket/services/channel.ts) dispatches chat, message-event, and group operations to their handlers.
6. Handlers call [app/actions/](app/actions/README.md); actions apply the use-case rules and call [app/repository/](app/repository/README.md) for MongoDB or Redis operations.

## Message and group behavior

The shared send action routes `#user` to direct messages, `@room` to rooms, and `$groupId` to groups. Direct messages can be sent live or queued in MongoDB for connection-time restoration. Rooms and groups are persisted. Group delivery progress is stored per group; pending invitations use an `offset` and a `coverage` cursor in `user_progression` and expire after 64 days.

Group catch-up advances invite coverage only when a WebSocket write succeeds. That cursor is internal progress and does not create a group delivered event. Group messages use sent status feedback; read and delivered group events are suppressed.

## Tests and design notes

- [Test overview](test/README.md)
- [Message delivery behavior](docs/message-delivery/README.md)
- [Open protocol questions](docs/message-delivery/QUESTIONS.md)

Integration tests use the root `.test.env` and require the configured MongoDB and Redis services. Run them from the repository root with `npm test`.
