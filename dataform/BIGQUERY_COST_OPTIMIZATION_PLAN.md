# BigQuery Cost Optimization Plan

## Goal

Reduce the cost of normal scheduled Dataform runs without making the pipeline
hard to understand or weakening attribution correctness.

Current full-refresh baseline:

- 19.299 GiB billed
- About $0.1178 per run at public on-demand pricing
- About $2.83 per day if the same work runs hourly
- Five session and touchpoint models create 46.08% of the billed bytes

The first target is a normal incremental run below 3 GiB. Full refreshes will
still rebuild history and should remain manual validation events.

## Principles

1. Optimize the expensive models first.
2. Filter raw source partitions before transforming rows.
3. Reprocess a small overlap window to catch late data.
4. Rebuild affected visitors or business keys, not the whole warehouse.
5. Avoid materializing the same large dataset more than once.
6. Keep identity-resolution models full refresh until incremental correctness
   is proven.
7. Measure two normal runs after every change.

## Priority 1: Fix the Page-View and Session Pipeline

These five models currently cost 8.893 GiB per full run:

- `int_events_sessionized`
- `mart_sessions`
- `mart_touchpoints_all`
- `mart_touchpoints_first`
- `mart_touchpoints_last`

### 1. Materialize `stg_page_views` incrementally

It is currently a view over two growing raw page tables. Every downstream model
therefore reads the raw history again.

Change it to an incremental table:

- Key: `page_view_id`
- Partition: `date(page_view_timestamp)`
- Cluster: `anonymous_id`, `user_id`, `page_view_id`
- Normal-run lookback: 3 hours
- Raw partition safety window: 2 days

Apply physical source filters:

- `boom_domains.pages`: `_partitiontime`
- `jitsu_data.pages`: `timestamp`

Both raw tables are already daily partitioned, so this is a direct,
low-complexity saving.

For late or replayed events, use the latest available ingestion timestamp and
reprocess the overlap window.

### 2. Incrementalize sessionization by changed visitor

For a normal run:

1. Find visitors with page views inside the overlap window.
2. Delete existing sessionized rows for those visitors.
3. Re-sessionize the complete history of only those visitors.
4. Insert the rebuilt rows.

Deleting by visitor is safer than merging only new page views because a late
page view can change session boundaries and later session IDs.

Keep the SQL explicit. Do not add a generalized framework or several macros.

### 3. Incrementalize `mart_sessions` using the same visitors

Delete and rebuild sessions for the changed visitors selected above. This keeps
`int_events_sessionized` and `mart_sessions` aligned and avoids stale session
IDs.

### 4. Stop rebuilding first and last touchpoints separately

`mart_touchpoints_first` and `mart_touchpoints_last` each scan approximately
1.825 GiB.

Make them views over `mart_touchpoints_all` unless a downstream integration
requires physical tables. Creating the views is cheap and moves query work to
the consumers that actually use them.

If they must remain physical, replace both with one profile-level summary table
containing first and last touchpoint fields. Do not maintain two separate full
scans.

### 5. Cluster touchpoints by profile

Add `profile_id` clustering to `mart_touchpoints_all`. The expensive reverse
ETL models join touchpoints by `profile_id` and time, so this matches the real
access path.

Keep `mart_touchpoints_all` as a full table during the first optimization pass
because identity resolution can update old sessions retroactively.

## Priority 2: Reduce Identity-Event Rows

`int_identity_events` costs 0.941 GiB and currently includes every page view.

A page view with only an anonymous ID does not create an identity edge. For the
page-view branch, include only rows that can actually connect identifiers:

```sql
where anonymous_id is not null
  and user_id is not null
  and anonymous_id != user_id
```

Validate resolved-profile counts before and after this change. If they match,
keep the filter.

## Priority 3: Incrementalize Reverse ETL Outputs

The three expensive reverse ETL outputs cost 3.149 GiB per full run:

- `segretl_form_submitted`
- `segretl_first_conversions`
- `segretl_repeatable_conversions`

These already have deterministic `event_id` values.

Change them to incremental tables keyed by `event_id`:

- Reprocess a 7-day conversion window on normal runs.
- Merge or delete/reinsert by `event_id`.
- Keep the existing 90-day business eligibility rule where required.
- Run a manual full refresh after attribution or identity-resolution logic
  changes.

Do not start here. The page-view/session pipeline produces the larger and more
reusable saving.

## Priority 4: Small Improvements Only After the Main Work

After the first three priorities:

- Replace unnecessary `select *` reads in large models with explicit columns.
- Add `requirePartitionFilter` only where all known consumers use date filters.
- Review expensive assertions, but keep correctness assertions unless they
  become a material share of cost.
- Leave small Stripe staging views alone; each is currently only a minimum
  metadata charge during Dataform execution.

## Measurement Sequence

For each priority:

1. Record the current full-refresh baseline.
2. Make one focused change.
3. Run a full refresh and run validation checks.
4. Run Dataform normally twice.
5. Add all three executions to
   `BIGQUERY_COST_OPTIMIZATION_TRACKER.md`.
6. Continue only if row counts, keys, and attribution results are correct.

## Success Checks

The optimization is successful when:

- Normal-run billed bytes are below 3 GiB.
- No duplicate `page_view_id`, `session_id`, or reverse ETL `event_id` values
  are introduced.
- Page-view and session freshness remains within the scheduled interval.
- Resolved-profile counts do not decrease unexpectedly.
- Full-refresh and incremental results match for the recent comparison window.

## Recommended Implementation Order

1. Incremental `stg_page_views` with partition pruning.
2. Changed-visitor incremental `int_events_sessionized`.
3. Changed-visitor incremental `mart_sessions`.
4. Convert first/last touchpoint tables to views.
5. Filter non-linking page views from `int_identity_events`.
6. Incrementalize the three reverse ETL outputs.
