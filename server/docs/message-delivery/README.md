# Message sending and delivery

## Scope

This note covers the current direct-message send path, feedback to the sender, and delivery of queued messages when a recipient reconnects. The client's `client_id` is the UUID generated on the client for that message. The server's `message_uuid` is a separate identifier.

The client can explicitly report that messages were read. This note covers the `read_items` client event and its sender feedback. It does not define read behavior beyond that notification.

## Current flow

```text
A sends to B
     |
     +-- B is connected --> forward message to B
     |                       then send delivered_items feedback to A
     |
     +-- B is offline ----> store message for B
                             then send sent_items feedback to A
                                  |
                                  +-- B reconnects
                                      forward queued message to B
                                      on successful WebSocket write:
                                      remove queued message and send
                                      delivered_items feedback to A
```

### Recipient is connected

`ChatSendEventHandler` creates a server `message_uuid` and forwards the message to the recipient through `CreateMessageForwarder`. On successful forwarding, `DeliveredItemForwarder` sends `chat / delivered_items` to the sender. The feedback contains the client `client_id`, server `message_uuid`, recipient, sender, and delivery timestamp.

### Recipient is offline

The send handler stores the message in `primary_messages` before reporting `chat / sent_items` to the sender. That feedback includes the client's `client_id` and server `message_uuid`. It means the server accepted and queued the message; it does not mean the recipient received it.

### Recipient reconnects

`WSConnectionEvent` retrieves pending messages for the recipient and sends each through `CreateMessageForwarder`. After the forwarder's WebSocket write callback succeeds, the server removes the queued message and dispatches delivered feedback to the original sender. If the sender is offline, the delivered event is persisted for retrieval on that sender's next connection.

Pending message-event partitions are sent through the message forwarder. The public partition objects omit Mongo `_id` values. The repository acknowledges the matching stored event after the WebSocket write succeeds.

### Recipient reads messages

The recipient sends `message_event / read_items` with `sender_id` and a `message_ids` array. The server uses the authenticated recipient ID, then forwards `chat / read_items` feedback to the original sender. If the sender is offline, the read event is persisted for retrieval on the sender's next connection.

## Delivery meaning and reliability

Today, “delivered” means the WebSocket library reported a successful write to the recipient's connection. There is no application-level acknowledgement from the recipient client in this flow. The queue record is removed after that write callback, so the server is not currently confirming that the recipient application processed or persisted the message.

If the process stops after the write succeeds but before the queue record is removed, the recipient may receive the message again on reconnect. If the server removes it after the write callback but the client never processes it, the message may not be retried. These are the current boundaries of the transport-level delivery signal.

## Main code locations

- `app/websocket/channels/chat/send.handler.ts` — accepts a message, forwards to an online recipient, or persists for an offline recipient.
- `app/websocket/channels/chat/forwarders/sentItems.ts` — sends or persists sent feedback.
- `app/websocket/channels/chat/forwarders/deliveredItems.ts` — sends or persists delivered feedback.
- `app/websocket/connection.ts` — retrieves event feedback and queued messages on connection.
- `app/websocket/services/message.forwarder.ts` — looks up a connected client and runs success/failure callbacks around the WebSocket write.
- `app/repository/mongo/message.ts` — stores and retrieves primary messages.
- `app/repository/mongo/message.items.event.ts` — stores sender feedback events and returns client-facing event partitions.
- `test/ws.chat.send.test.ts` — live WebSocket coverage for online send, offline queueing, and reconnect delivery.
- `test/ws.message.events.test.ts` — live WebSocket coverage for retrieving and acknowledging event partitions.

## Verification status

The full test suite passed after the connection and Mongo initialization fixes: 77 tests across 13 files. The tests use live WebSocket connections and the configured MongoDB service.
