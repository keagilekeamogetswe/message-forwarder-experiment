# Redis repositories

[access.token.ts](access.token.ts) stores the `locked cookies:<user_id>:<jti>` lease used during WebSocket sessions. Redis `NX` prevents a cookie from opening concurrent connections; a short TTL is renewed while connected and the lease is released on close.

Redis is connected at server startup through `server/app/redis.ts`.
