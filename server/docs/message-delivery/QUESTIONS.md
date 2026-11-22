# Open questions and proposed next steps

These are discussion points, not approved implementation changes.

## 1. What does “delivered” mean?

The current implementation marks a message delivered after the server's WebSocket write callback succeeds. That confirms the write was accepted by the WebSocket library, but it does not confirm that B's application received, stored, or displayed the message.

**Possible next step:** keep transport-write delivery as the current definition, or add a recipient-to-server acknowledgement message and only mark a message delivered after that acknowledgement arrives. The latter needs a client protocol change and a policy for clients that disconnect before acknowledging.

**Question:** Should `delivered_items` continue to mean “WebSocket write succeeded,” or should it mean “recipient client acknowledged this `client_id`”? 

## 2. Concurrent Mongo initialization (resolved)

`Database.getMongoCollection` now keeps a shared promise for the in-flight Mongo connection. Concurrent callers await the same initialization. WebSocket message handlers also register before pending event/message restoration runs, and restoration failures are caught so they do not terminate the server or block protocol error responses.

**Verification:** the connection and send/reconnect tests pass with simultaneous live clients. The full real integration suite passed: 77 tests across 13 files.

## 3. Reconnect transfer and queue deletion

The pending message is removed after the WebSocket write callback succeeds. A process interruption around the write/removal boundary can cause a duplicate delivery or prevent a retry, depending on which operation completed.

**Possible next step:** first keep the current behavior and document the transport-level guarantee. If stronger delivery guarantees are needed, agree on a recipient acknowledgement protocol and idempotency rules before changing queue deletion.

**Question:** Is the current transport-level guarantee sufficient for now, or should durable recipient acknowledgements be part of a later scope?

## 4. Event partition identifiers

Client-facing event partitions omit Mongo `_id`. The server removes the acknowledged event by matching its event type and message identifiers. This keeps storage IDs private, but those matching fields must identify a single stored event for each acknowledgement.

**Possible next step:** retain this shape while IDs remain unique per event, or agree on a separate opaque acknowledgement token if the client will later need to acknowledge individual events explicitly.

**Question:** Is the current server-side acknowledgement after a successful WebSocket write the intended behavior for sender feedback events?

## Proposed order

1. Confirm the meaning of “delivered.”
2. If approved, make Mongo initialization safe for concurrent callers and rerun the real WebSocket tests.
3. Confirm whether the client `message_event / read_items` payload should include client-generated IDs in addition to server `message_uuid` values.
4. Revisit application-level acknowledgements only if the current transport-level guarantee is insufficient.
