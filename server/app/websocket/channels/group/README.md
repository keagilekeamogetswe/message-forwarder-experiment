# Group channel

[group.handler.ts](group.handler.ts) implements `group.list`, `group.create`, `group.invite`, `group.accept`, and `group.promote`. It exposes group actions over WebSocket and sends invitation catch-up messages before acceptance.

Acceptance captures a latest-message boundary, sends uncovered group messages through that boundary, advances invite coverage on successful socket writes, then activates the group cursor and removes the invite. A failed write leaves the invite available for retry.
