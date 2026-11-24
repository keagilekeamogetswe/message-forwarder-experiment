# Repositories

Repositories own database reads and writes. Application actions apply authorization and use-case rules above these low-level operations.

- [mongo/](mongo/README.md) stores messages, group membership, progression, and message events.
- [redis/](redis/README.md) protects WebSocket access cookies from concurrent reuse.
