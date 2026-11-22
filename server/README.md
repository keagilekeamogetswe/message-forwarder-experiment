# Server

The server authenticates WebSocket connections, routes chat messages, and stores messages and delivery events in MongoDB.

## Message delivery notes

- [Current send and delivery behavior](docs/message-delivery/README.md)
- [Open questions and proposed next steps](docs/message-delivery/QUESTIONS.md)

The delivery notes describe the current implementation and the scope discussed so far. They do not define read receipts; that behavior is intentionally left for later direction.
