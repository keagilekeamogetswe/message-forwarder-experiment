# WebSocket channels

The dispatch table is [services/channel.ts](../services/channel.ts). It maps incoming `{ channel, action, payload }` messages to handlers. Chat sends use `chat`; group lifecycle operations use `group`; sender read receipts use `message_event`.
