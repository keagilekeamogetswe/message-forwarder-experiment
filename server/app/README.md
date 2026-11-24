# Server application

The Node.js application entry point and runtime code live here. [index.ts](index.ts) configures Express, authentication, the WebSocket server, Redis startup, and connection lifecycle.

- `actions/` coordinates message and group use cases.
- `middleware/` authenticates HTTP requests.
- `model/` defines message contracts and action interfaces.
- `repository/` contains MongoDB and Redis access.
- `websocket/` handles upgrades, connections, and protocol channels.
- `config/` holds local TLS development assets.

The repository root README describes the end-to-end flow.
