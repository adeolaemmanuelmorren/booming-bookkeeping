const activeCampaignRegistrationForms = [
  {
    registrationType: "krc",
    contentName: "Keyboard Rich Challenge Registration",
    activeCampaignFormIds: ["20"],
    primaryTagPrefixes: [
      "[KRC] Registered for Challenge -",
      "[KRC] Registered -",
    ],
    primaryExactTags: [],
    fallbackExactTag: "[KRC] Registered for Challenge",
  },
  {
    registrationType: "webinar",
    contentName: "Booming Bookkeeping Webinar Registration",
    activeCampaignFormIds: ["15"],
    primaryTagPrefixes: [],
    primaryExactTags: [
      "[CW] Registered for Webinar",
    ],
    fallbackExactTag: null,
  },
];

module.exports = {
  activeCampaignRegistrationForms,
};
