# Chat channel

Chat handlers validate and route individual and bulk message sends. They call the application send action, persist to the destination repository, and send client feedback.

Direct messages can be forwarded live and produce sent/delivered/read feedback. Group messages are persisted and restored on connection; their status is limited to sending/sent. Group socket writes update internal invite coverage without a delivered event.

See [forwarders/](forwarders/README.md) for message-event feedback helpers.
