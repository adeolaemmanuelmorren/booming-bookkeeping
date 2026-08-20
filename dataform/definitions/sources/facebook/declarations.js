const source = {
  database: dataform.projectConfig.vars.facebook_ads_database || "able-folio-499722",
  schema: dataform.projectConfig.vars.facebook_ads_schema || "facebook_ads",
};

[
  "ad_history",
  "ad_set_history",
  "basic_ad",
  "basic_ad_action_values",
  "basic_ad_actions",
  "basic_ad_hourly",
  "basic_ad_set",
  "basic_campaign",
  "campaign_history",
  "creative_history",
].forEach((name) => {
  declare({
    database: source.database,
    schema: source.schema,
    name,
  });
});
