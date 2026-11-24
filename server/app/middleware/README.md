# HTTP middleware

HTTP middleware runs before the WebSocket access-token route. [authentication.ts](authentication.ts) verifies an RS256 bearer token using `JWT_ACCESS_TOKEN_PUBLIC_KEY` and sets `req.user` for downstream routes.

The local test stack enables a separate test-identity override on `/wsaccess`; it is gated by development mode and `WS_TEST_AUTH_ENABLED`.
