# Production migrations liên quan hệ thống sáng 10/09/2026

## News / Broker Brief
- 20260910023441 news_intake_v1_finance_first_storage_lifecycle
- 20260910023519 news_intake_v1_security_and_cleanup_schedule
- 20260910024152 news_worker_private_key
- 20260910024300 enable_pg_net_for_news_worker
- 20260910024324 schedule_news_worker_cycle
- 20260910024500 grant_news_worker_service_role
- 20260910024835 refine_finance_relevance_gate_v2
- 20260910025005 link_reviewed_news_signals_for_brief
- 20260910025155 news_batch_ingest_and_brief_candidates
- 20260910025237 schedule_news_worker_collect_only
- 20260910025318 schedule_broker_brief_builder
- 20260910025425 refine_broker_brief_ranking_v2
- 20260910030605 optimize_news_filtering_dedupe_and_brief_scoring
- 20260910030851 harden_news_table_privileges
- 20260910031100 tune_finance_gate_for_market_sensitive_macro

## Hot Stocks
- 20260910052001 add_hot_stocks_snapshot_v1
- 20260910052022 add_hot_stocks_feed_config
- 20260910052242 hot_stocks_public_read_v1
- 20260910052300 hot_stocks_internal_ingest_v1

## Derivatives
- 20260910060042 add_derivatives_trend_snapshot_v1

Lưu ý: các migration trên đã chạy trên production. Danh sách này dùng để đồng bộ Git history và kiểm soát nguồn.
Không chạy lại thủ công chỉ vì file nằm trong repo.
