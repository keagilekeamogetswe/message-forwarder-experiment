# WebSocket Playground and Bulk Messaging

## Summary

- Route messages by recipient prefix: `@` for rooms, `#` for primary recipients, and `$` for groups.
- Add the `chat.bulk_send` action. It creates a unique message UUID per recipient, groups copies under one bulk ID, batches persistence where possible, and reports a result for every recipient through `chat.bulk_sent`.
- Keep a failure for one invalid recipient or group membership from rejecting the other recipients in the request.
- Add optional `reply_to` message UUID metadata.
- Restore pending primary and group messages when a WebSocket connection is established, using message actions.
- Add a frontend channel/action registry that dispatches incoming WebSocket messages to component subscriptions. Raw message structs are normalized to `chat.message`, and server error objects to `system.error`.
- Keep the message-event retrieval handshake in the WebSocket daemon while routing incoming frames through the registry.
- Add a browser chat playground with a user ID connect form, prefixed recipient field, message/reply/client ID inputs, and a fixed URL list field for media uploads.
- Keep per-user conversations and per-message send/delivery/read state in `MessageDirectoryService`, keyed for direct message and reply lookups. Message bubbles subscribe to their own state and stop listening once read.
- Enable distinct browser test identities through a guarded test-stack-only cookie endpoint option; the test private key stays on the server.
- Add test server logging to `logs/start.test.server.log` and ignore that generated log.
- Update WebSocket tests for prefixed recipients and bulk results.

## Verification

- `npm run test -- --run` — passed: 14 test files, 83 tests.
- Frontend TypeScript check — passed.
- Started the test stack from Git Bash and confirmed the frontend responds on port 3000 and the backend on port 4000.

## Notes

Room messages are persisted. Connection-time room retrieval is not included because the current server does not expose a source for determining a user's room IDs.

Start `start.test.server.sh` from Git Bash after freeing ports 3000 and 4000. In this Windows environment, the generic `bash` command resolves to the WSL shim; use Git Bash instead.
