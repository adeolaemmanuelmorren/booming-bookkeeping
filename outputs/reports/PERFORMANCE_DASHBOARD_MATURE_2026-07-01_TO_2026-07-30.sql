-- Performance dashboard: fully matured 30-day paid-click cohort.
-- Click dates: July 1-30, 2026. Outcomes observed through the run date.
-- BBB attribution is direct: prior ad touchpoint -> first qualifying BBB order.
-- A KRC registration is not required for BBB attribution.

declare report_start_date date default date '2026-07-01';
declare report_end_date date default date '2026-07-30';

with dashboard_rows as (
  select
    'first' as attribution,
    date,
    source,
    campaign_id,
    adset_id,
    ad_id,
    campaign_name,
    adset_name,
    ad_name,
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
    campaign_id,
    adset_id,
    ad_id,
    campaign_name,
    adset_name,
    ad_name,
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
    campaign_id,
    adset_id,
    ad_id,
    campaign_name,
    adset_name,
    ad_name,
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

ad_totals as (
  select
    attribution,
    source,
    campaign_id,
    adset_id,
    ad_id,
    any_value(campaign_name) as campaign_name,
    any_value(adset_name) as adset_name,
    any_value(ad_name) as ad_name,
    any_value(medium) as medium,
    sum(impressions) as impressions,
    sum(clicks) as clicks,
    round(sum(spend), 2) as spend,
    sum(platform_conversions) as platform_conversions,
    round(sum(registrations), 2) as registrations,
    round(sum(bbb_buyers), 2) as bbb_buyers,
    round(sum(bbb_revenue), 2) as bbb_revenue,
    round(sum(revenue), 2) as revenue,
    round(sum(vip_revenue), 2) as vip_revenue,
    round(sum(book_revenue), 2) as book_revenue,
    round(sum(mentorship_revenue), 2) as mentorship_revenue,
    round(sum(kajabi_revenue), 2) as kajabi_revenue,
    round(sum(catalog_revenue), 2) as catalog_revenue,
    round(sum(unknown_revenue), 2) as unknown_revenue
  from dashboard_rows
  group by attribution, source, campaign_id, adset_id, ad_id
)

select
  *,
  round(safe_divide(spend, nullif(platform_conversions, 0)), 2) as platform_cpl,
  round(safe_divide(spend, nullif(registrations, 0)), 2) as cost_per_registration,
  round(safe_divide(revenue, nullif(spend, 0)), 3) as roas
from ad_totals
qualify row_number() over (
  partition by attribution
  order by revenue desc, spend desc
) <= 20
order by attribution, revenue desc;
