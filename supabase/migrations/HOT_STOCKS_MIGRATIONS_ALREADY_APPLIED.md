# Hot Stocks production mirror

Production already contains the Hot Stocks schema/RPC migrations with versions:
- 20260910052001 add_hot_stocks_snapshot_v1
- 20260910052022 add_hot_stocks_feed_config
- 20260910052242 hot_stocks_public_read_v1
- 20260910052300 hot_stocks_internal_ingest_v1

This package intentionally does not invent/re-run those SQL files without the original repository copy.
The Edge Function source and the Windows bridge are included here for Git source synchronization.
