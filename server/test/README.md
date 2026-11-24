# Server tests

Vitest coverage for server actions, MongoDB repositories, HTTP access-token issuance, and live WebSocket behavior is organized by concern.

- [actions/](actions/README.md) exercises message action rules.
- [mongo/](mongo/README.md) covers collection operations.
- Root-level `ws.*.test.ts` files cover access, connection restoration, chat sends, event partitions, and heartbeat behavior.

The root Vitest configuration loads `.test.env`, generates a temporary RSA key pair, and serializes files to avoid competing against shared integration services.
