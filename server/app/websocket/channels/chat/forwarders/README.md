# Chat forwarders

Forwarders send `sent_items`, `delivered_items`, and `read_items` feedback to a sender. If the sender is offline, delivery/read feedback is persisted for later retrieval. Group handlers intentionally do not use delivered or read forwarders; group cursor coverage is a separate internal progress signal.
