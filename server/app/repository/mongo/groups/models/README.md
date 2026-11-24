# Group persistence models

TypeScript interfaces for MongoDB group records, active and archived participants, and per-user progression live here. Group invitations store `{ offset, coverage }` per group: `offset` marks the invite time, and `coverage` advances as pending messages are sent successfully.
