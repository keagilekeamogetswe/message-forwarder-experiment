# Pull request: group invitations and playground controls

## Summary

- Add group lifecycle actions for creating groups, inviting members, promoting participants, accepting invitations, and succession when an owner or final admin leaves.
- Add WebSocket group actions and playground controls to create groups, invite users, and accept pending invitations.
- Store per-user active group cursors and pending invite `{ offset, coverage }` in `user_progression`; copy legacy `user_group_progress` data forward without dropping the old collection.
- On invite acceptance, deliver uncovered group messages through a captured latest-message boundary before promoting coverage to the active group cursor and deleting the invite. A failed socket write leaves the invite pending for retry.
- Keep group message feedback limited to `sending` and `sent`. Successful socket writes still advance internal coverage but do not emit delivered or read events; stale group receipt events are filtered and removed.
- Keep the local test bootstrap token valid for 24 hours rather than one hour.
- Update existing repository/action test expectations for the progression collection and group member counts.

## Message routing

The shared routing action interprets `#user` as a direct recipient, `@room` as a room, and `$groupId` as a group. Bulk group persistence validates each recipient independently so an invalid group recipient does not fail the other entries in the request.

## Verification

- Frontend TypeScript check passed.
- Targeted server TypeScript check passed for the changed action, repository, and WebSocket files.
- Tests were not run.

## Suggested title

`feat: add group invitation flow to playground`
