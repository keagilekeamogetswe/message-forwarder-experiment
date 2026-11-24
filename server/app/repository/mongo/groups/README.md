# Group repositories

Group persistence is split by responsibility:

- `group.registry.ts` stores group records.
- `group.participants.ts` stores active members and archives departures.
- `user.progress.ts` stores each user’s active group cursors and pending group invites in `user_progression`.
- [models/](models/README.md) defines the stored record shapes.

Use `GroupActions` for lifecycle changes so participant records, group counts, and progression stay coordinated.
