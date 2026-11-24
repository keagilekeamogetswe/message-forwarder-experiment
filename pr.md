# WebSocket bulk messaging and pending-message retrieval

## Summary

- Route messages by recipient prefix: `@` for rooms, `#` for primary recipients, and `$` for groups.
- Add the `chat.bulk_send` action. It creates a unique message UUID per recipient, groups copies under one bulk ID, batches persistence where possible, and reports a result for every recipient through `chat.bulk_sent`.
- Keep a failure for one invalid recipient or group membership from rejecting the other recipients in the request.
- Add optional `reply_to` message UUID metadata.
- Restore pending primary and group messages when a WebSocket connection is established, using message actions.
- Add test server logging to `logs/start.test.server.log` and ignore that generated log.
- Update WebSocket tests for prefixed recipients and bulk results.

## Verification

- `npm run test -- --run` — passed: 14 test files, 82 tests.
- Started the test stack from Git Bash and confirmed the frontend responds on port 3000 and the backend on port 4000.

## Notes

Room messages are persisted. Connection-time room retrieval is not included because the current server does not expose a source for determining a user's room IDs.

Start `start.test.server.sh` from Git Bash. In this Windows environment, the generic `bash` command resolves to the WSL shim; use Git Bash instead.
