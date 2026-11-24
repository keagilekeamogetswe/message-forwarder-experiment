# MongoDB repositories

MongoDB repositories persist message data and related state. [message.ts](message.ts) handles primary, room, and group message collections; [message.items.event.ts](message.items.event.ts) stores sender event feedback. Group-specific repositories are under [groups/](groups/README.md).

Collections are obtained through the shared connection in `server/app/db.ts`.
