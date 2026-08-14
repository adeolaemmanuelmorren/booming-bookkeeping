-- Dashboard summary, source/medium, and five-day trend data.
-- Click dates: July 1-30, 2026. Outcomes observed through the run date.

declare report_start_date date default date '2026-07-01';
declare report_end_date date default date '2026-07-30';

with dashboard_rows as (
  select
    'first' as attribution,
    date,
    source,
    medium,
    impressions,
    clicks,
    spend,
    platform_conversions,
    krc_registrations_server_side_ft as registrations,
    bbb_buyers_server_side_ft as bbb_buyers,
    bbb_revenue_server_side_ft as bbb_revenue,
    revenue_server_side_ft as revenue,
    revenue_vip_server_side_ft as vip_revenue,
    revenue_book_server_side_ft as book_revenue,
    revenue_mentorship_server_side_ft as mentorship_revenue,
    revenue_kajabi_server_side_ft as kajabi_revenue,
    revenue_catalog_server_side_ft as catalog_revenue,
    revenue_unknown_server_side_ft as unknown_revenue
  from `able-folio-499722.booming_data_analytics.mart_conversions_ad_performance`
  where date between report_start_date and report_end_date

  union all

  select
    'last',
    date,
    source,
    medium,
    impressions,
    clicks,
    spend,
    platform_conversions,
    krc_registrations_server_side_lt,
    bbb_buyers_server_side_lt,
    bbb_revenue_server_side_lt,
    revenue_server_side_lt,
    revenue_vip_server_side_lt,
    revenue_book_server_side_lt,
    revenue_mentorship_server_side_lt,
    revenue_kajabi_server_side_lt,
    revenue_catalog_server_side_lt,
    revenue_unknown_server_side_lt
  from `able-folio-499722.booming_data_analytics.mart_conversions_ad_performance`
  where date between report_start_date and report_end_date

  union all

  select
    'multi',
    date,
    source,
    medium,
    impressions,
    clicks,
    spend,
    platform_conversions,
    krc_registrations_server_side_mt,
    bbb_buyers_server_side_mt,
    bbb_revenue_server_side_mt,
    revenue_server_side_mt,
    revenue_vip_server_side_mt,
    revenue_book_server_side_mt,
    revenue_mentorship_server_side_mt,
    revenue_kajabi_server_side_mt,
    revenue_catalog_server_side_mt,
    revenue_unknown_server_side_mt
  from `able-folio-499722.booming_data_analytics.mart_conversions_ad_performance`
  where date between report_start_date and report_end_date
),

summary_rows as (
  select
    'summary' as report_level,
    attribution,
    'All paid media' as label,
    cast(null as date) as period_start,
    sum(impressions) as impressions,
    sum(clicks) as clicks,
    sum(spend) as spend,
    sum(platform_conversions) as platform_conversions,
    sum(registrations) as registrations,
    sum(bbb_buyers) as bbb_buyers,
    sum(bbb_revenue) as bbb_revenue,
    sum(revenue) as revenue,
    sum(vip_revenue) as vip_revenue,
    sum(book_revenue) as book_revenue,
    sum(mentorship_revenue) as mentorship_revenue,
    sum(kajabi_revenue) as kajabi_revenue,
    sum(catalog_revenue) as catalog_revenue,
    sum(unknown_revenue) as unknown_revenue
  from dashboard_rows
  group by attribution
),

source_rows as (
  select
    'source_medium' as report_level,
    attribution,
    concat(initcap(source), ' / ', coalesce(medium, 'unknown')) as label,
    cast(null as date) as period_start,
    sum(impressions) as impressions,
    sum(clicks) as clicks,
    sum(spend) as spend,
    sum(platform_conversions) as platform_conversions,
    sum(registrations) as registrations,
    sum(bbb_buyers) as bbb_buyers,
    sum(bbb_revenue) as bbb_revenue,
    sum(revenue) as revenue,
    sum(vip_revenue) as vip_revenue,
    sum(book_revenue) as book_revenue,
    sum(mentorship_revenue) as mentorship_revenue,
    sum(kajabi_revenue) as kajabi_revenue,
    sum(catalog_revenue) as catalog_revenue,
    sum(unknown_revenue) as unknown_revenue
  from dashboard_rows
  group by attribution, source, medium
),

trend_rows as (
  select
    'five_day_trend' as report_level,
    attribution,
    format_date('%b %e', period_start) as label,
    period_start,
    sum(impressions) as impressions,
    sum(clicks) as clicks,
    sum(spend) as spend,
    sum(platform_conversions) as platform_conversions,
    sum(registrations) as registrations,
    sum(bbb_buyers) as bbb_buyers,
    sum(bbb_revenue) as bbb_revenue,
    sum(revenue) as revenue,
    sum(vip_revenue) as vip_revenue,
    sum(book_revenue) as book_revenue,
    sum(mentorship_revenue) as mentorship_revenue,
    sum(kajabi_revenue) as kajabi_revenue,
    sum(catalog_revenue) as catalog_revenue,
    sum(unknown_revenue) as unknown_revenue
  from (
    select
      *,
      date_add(
        report_start_date,
        interval div(date_diff(date, report_start_date, day), 5) * 5 day
      ) as period_start
    from dashboard_rows
  )
  group by attribution, period_start
)

select
  report_level,
  attribution,
  label,
  period_start,
  impressions,
  clicks,
  round(spend, 2) as spend,
  round(platform_conversions, 2) as platform_conversions,
  round(registrations, 2) as registrations,
  round(bbb_buyers, 2) as bbb_buyers,
  round(bbb_revenue, 2) as bbb_revenue,
  round(revenue, 2) as revenue,
  round(vip_revenue, 2) as vip_revenue,
  round(book_revenue, 2) as book_revenue,
  round(mentorship_revenue, 2) as mentorship_revenue,
  round(kajabi_revenue, 2) as kajabi_revenue,
  round(catalog_revenue, 2) as catalog_revenue,
  round(unknown_revenue, 2) as unknown_revenue
from summary_rows

union all

select
  report_level,
  attribution,
  label,
  period_start,
  impressions,
  clicks,
  round(spend, 2),
  round(platform_conversions, 2),
  round(registrations, 2),
  round(bbb_buyers, 2),
  round(bbb_revenue, 2),
  round(revenue, 2),
  round(vip_revenue, 2),
  round(book_revenue, 2),
  round(mentorship_revenue, 2),
  round(kajabi_revenue, 2),
  round(catalog_revenue, 2),
  round(unknown_revenue, 2)
from source_rows

union all

select
  report_level,
  attribution,
  label,
  period_start,
  impressions,
  clicks,
  round(spend, 2),
  round(platform_conversions, 2),
  round(registrations, 2),
  round(bbb_buyers, 2),
  round(bbb_revenue, 2),
  round(revenue, 2),
  round(vip_revenue, 2),
  round(book_revenue, 2),
  round(mentorship_revenue, 2),
  round(kajabi_revenue, 2),
  round(catalog_revenue, 2),
  round(unknown_revenue, 2)
from trend_rows
order by report_level, attribution, period_start, label;
