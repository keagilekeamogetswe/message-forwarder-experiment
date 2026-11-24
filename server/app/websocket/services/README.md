# WebSocket services

Shared transport helpers live here. `client.registry.ts` maps connected user IDs to sockets. `message.forwarder.ts` writes a JSON message to a connected socket and runs success/failure callbacks. `channel.ts` is the protocol dispatch table.
