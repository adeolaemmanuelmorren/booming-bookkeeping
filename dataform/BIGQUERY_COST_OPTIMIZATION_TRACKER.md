# BigQuery Cost Optimization Tracker

This document tracks controlled Dataform cost tests for the
`able-folio-499722` project.

The main comparison is:

- One full-refresh baseline before a change.
- One full refresh after a change to confirm correctness and full-build cost.
- Two normal incremental runs after a change to measure steady-state cost.

## Cost Assumptions

BigQuery job metadata provides billed bytes, not the final invoice amount.

Estimated cost in this tracker uses the public on-demand analysis rate:

```text
estimated USD = billed bytes / 1 TiB * $6.25
```

Actual charges can be lower because of the monthly free tier, reservations,
credits, or negotiated pricing. Current public pricing:
https://cloud.google.com/bigquery/pricing

Only root Dataform action jobs are counted. Child jobs created by Dataform
scripts are excluded so their bytes are not counted twice.

## Run History

| Test | Run time | Run type | Execution ID | Duration | Actions | Failed | Processed | Billed | Estimated cost | If run hourly | If run daily |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Baseline 1 | 2026-07-25 22:00 HST | Full refresh | `1785052802-1ad49558-db70-45a3-865c-c0c1a19559a4` | 6m 6s | 91 | 0 | 19.060 GiB | 19.299 GiB | $0.1178/run | $2.83/day; $84.81/30d | $3.53/30d |

## Cost by Action Type

| Action type | Actions | Billed GiB | Share | Estimated USD |
|---|---:|---:|---:|---:|
| Tables | 43 | 18.618 | 96.47% | $0.1136 |
| Assertions | 15 | 0.358 | 1.86% | $0.0022 |
| Views | 32 | 0.313 | 1.62% | $0.0019 |
| Operations | 1 | 0.010 | 0.05% | $0.0001 |
| **Total** | **91** | **19.299** | **100%** | **$0.1178** |

## Highest-Cost Models

These models are the first optimization targets. Projections assume the same
full cost on every run.

| Model | Billed GiB | Estimated USD/run | USD/day if hourly | USD/30d if daily |
|---|---:|---:|---:|---:|
| `mart_touchpoints_all` | 1.872 | $0.01143 | $0.2742 | $0.3428 |
| `int_events_sessionized` | 1.836 | $0.01121 | $0.2689 | $0.3362 |
| `mart_touchpoints_first` | 1.825 | $0.01114 | $0.2674 | $0.3342 |
| `mart_touchpoints_last` | 1.825 | $0.01114 | $0.2674 | $0.3342 |
| `mart_sessions` | 1.535 | $0.00937 | $0.2249 | $0.2811 |
| `segretl_form_submitted` | 1.156 | $0.00706 | $0.1694 | $0.2117 |
| `segretl_first_conversions` | 1.047 | $0.00639 | $0.1534 | $0.1917 |
| `segretl_repeatable_conversions` | 0.946 | $0.00578 | $0.1386 | $0.1733 |
| `int_identity_events` | 0.941 | $0.00575 | $0.1379 | $0.1724 |
| `mart_checkout_started_client_side` | 0.632 | $0.00386 | $0.0926 | $0.1157 |

The top five models account for 46.08% of the run. The top ten account for
70.55%.

## Longitudinal Table Cost

Add one USD column for each future controlled test. Keep rows ordered by the
latest test's cost.

| Model | 2026-07-25 full refresh USD |
|---|---:|
| `mart_touchpoints_all` | $0.011426 |
| `int_events_sessionized` | $0.011206 |
| `mart_touchpoints_first` | $0.011140 |
| `mart_touchpoints_last` | $0.011140 |
| `mart_sessions` | $0.009370 |
| `segretl_form_submitted` | $0.007057 |
| `segretl_first_conversions` | $0.006390 |
| `segretl_repeatable_conversions` | $0.005776 |
| `int_identity_events` | $0.005746 |
| `mart_checkout_started_client_side` | $0.003856 |
| `int_attribution_traits` | $0.002736 |
| `mart_payments` | $0.002122 |
| `mart_form_submissions_server_side` | $0.002110 |
| `mart_conversions_with_touchpoints` | $0.001919 |
| `int_resolved_identifiers` | $0.001723 |
| `mart_manual_attribution_profile_search_candidates` | $0.001675 |
| `int_stripe_payment_occurrence` | $0.001633 |
| `mart_customers` | $0.001627 |
| `int_activecampaign_form_submissions` | $0.001526 |
| `int_all_stripe_payments` | $0.001520 |
| `int_stripe_payment_product_resolution` | $0.001472 |
| `mart_contact_first_conversions` | $0.001442 |
| `int_stripe_payment_enrichment` | $0.001359 |
| `mart_conversions_multi_touch` | $0.001192 |
| `mart_form_submissions_client_side` | $0.000834 |
| `mart_payments_client_side` | $0.000691 |
| `int_stripe_line_item_candidates` | $0.000656 |
| `mart_manual_attribution_payment_status` | $0.000584 |
| `int_stripe_kajabi_payment_enrichment` | $0.000477 |
| `mart_conversions_organic_performance` | $0.000435 |
| `int_stripe_payment_discounts` | $0.000417 |
| `mart_landing_page_performance_daily` | $0.000411 |
| `int_stripe_kajabi_payment_occurrence` | $0.000399 |
| `mart_product_sales` | $0.000364 |
| `mart_ad_cost_by_landing_page_daily` | $0.000179 |
| `mart_ad_performance` | $0.000179 |
| `mart_conversions_ad_performance` | $0.000179 |
| `segretl_order_completed` | $0.000131 |
| `mart_payment_info_submitted_client_side` | $0.000119 |
| `mart_unattributed_payments` | $0.000119 |
| `stg_facebook_ads` | $0.000119 |
| `stg_google_ads` | $0.000119 |
| `int_manual_payment_profile_links_latest` | $0.000060 |

Views are excluded from the model matrix because creating a view does not scan
its underlying data. Their 10 MiB minimum metadata jobs are included in the
run total. Assertions and operations are also included in the run total.

## Query for the Next Test

Change the execution ID or replace it with the latest execution ID from the
first query.

### Find recent Dataform executions

```sql
select
  (select value from unnest(labels)
   where key = 'dataform_workflow_execution_id') as execution_id,
  min(creation_time) as started_at_utc,
  max(end_time) as ended_at_utc,
  countif(parent_job_id is null) as actions,
  countif(parent_job_id is null and error_result is not null) as failed_actions,
  round(
    sum(if(parent_job_id is null, coalesce(total_bytes_billed, 0), 0))
      / pow(1024, 3),
    3
  ) as billed_gib
from `able-folio-499722.region-us`.information_schema.jobs_by_project
where creation_time >= timestamp_sub(current_timestamp(), interval 7 day)
  and job_type = 'QUERY'
  and exists (
    select 1
    from unnest(labels)
    where key = 'dataform_repository_id'
      and value = 'dataform'
  )
group by execution_id
having execution_id is not null
order by started_at_utc desc;
```

### Cost by model for one execution

```sql
declare execution_id string default
  '1785052802-1ad49558-db70-45a3-865c-c0c1a19559a4';
declare usd_per_tib float64 default 6.25;

select
  (select value from unnest(labels)
   where key = 'dataform_workflow_execution_action_id_name') as model,
  (select value from unnest(labels)
   where key = 'dataform-action-type') as action_type,
  round(sum(coalesce(total_bytes_billed, 0)) / pow(1024, 3), 6)
    as billed_gib,
  round(
    sum(coalesce(total_bytes_billed, 0)) / pow(1024, 4) * usd_per_tib,
    6
  ) as estimated_usd,
  round(
    sum(coalesce(total_bytes_billed, 0)) / pow(1024, 4)
      * usd_per_tib * 24,
    4
  ) as daily_usd_if_hourly
from `able-folio-499722.region-us`.information_schema.jobs_by_project
where job_type = 'QUERY'
  and parent_job_id is null
  and (
    select value
    from unnest(labels)
    where key = 'dataform_workflow_execution_id'
  ) = execution_id
group by model, action_type
order by sum(coalesce(total_bytes_billed, 0)) desc;
```

## Test Notes

For each future test, record:

1. The commit or exact model change.
2. Whether the run was full refresh or normal incremental.
3. The Dataform execution ID.
4. Total and per-model billed GiB.
5. Row-count and uniqueness checks.
6. Two steady-state incremental runs after any incremental-model change.

