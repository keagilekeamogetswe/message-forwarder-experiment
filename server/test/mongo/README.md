# MongoDB repository tests

Repository integration tests create and remove records in the configured test database. They cover messages, event partitions, group registry and participants, and user progression. Keep test collection setup isolated and use the `user_progression` collection for current group progress behavior.
