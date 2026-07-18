# TODO

## Cross-Domain Segment Rollout

### 1. Deploy Worker First

- [ ] Replace `REPLACE_WITH_NEW_CLOUDFLARE_ACCOUNT_ID` in `cloudflare-workers/reverse-proxy/wrangler.jsonc`.
- [ ] Deploy the Worker to the dedicated tracking subdomains:

```text
sg.thebookkeepingchallenge.com
sg.keyboardrichchallenge.com
sg.keyboardrich.com
sg.boomingbookkeeping.com
```

- [ ] Confirm the Worker routes respond before changing ClickFunnels or ActiveCampaign behavior.

### 2. Install ClickFunnels Helper and Manually Test `ajs_aid`

- [ ] Publish the ClickFunnels helper bundle after the Segment loader is included inside it.
- [ ] Install/load only the ClickFunnels helper on the relevant pages through the matching first-party asset host.
- [ ] Do not paste a separate Segment Analytics.js snippet on the same page.
- [ ] Confirm the helper loads Segment through the matching `sg.*` proxy host for the current root domain.
- [ ] Keep the current ActiveCampaign and ClickFunnels redirect behavior unchanged during this test.
- [ ] Manually open the destination with a test anonymous ID:

```text
https://keyboardrichchallenge.com/vipfc-1?ajs_aid=manual-test-anonymous-id
```

- [ ] Confirm the destination page initializes Segment with that exact anonymous ID:

```js
analytics.user().anonymousId()
```

Expected:

```text
manual-test-anonymous-id
```

### 3. Update ActiveCampaign Form

- [ ] In the ActiveCampaign form builder, add the hidden custom field for the Segment anonymous ID.
- [ ] Save/publish the ActiveCampaign form.
- [ ] Copy the updated ActiveCampaign form HTML into ClickFunnels if ClickFunnels is using pasted HTML.
- [ ] Confirm the generated ActiveCampaign hidden field input name, likely:

```text
field[39]
```

- [ ] Update the ClickFunnels helper mapping so the ActiveCampaign hidden field receives:

```js
analytics.user().anonymousId()
```

- [ ] Set the ActiveCampaign redirect to append the field value as:

```text
ajs_aid=<segment-anonymous-id>
```

### 4. Remove Native ClickFunnels Redirect Last

- [ ] Only after the ActiveCampaign native redirect is verified, remove or disable the native ClickFunnels redirect.
- [ ] Confirm final submit flow:

```text
ClickFunnels form
  -> ActiveCampaign native form submit
  -> ActiveCampaign native redirect
  -> keyboardrichchallenge.com/vipfc-1?ajs_aid=<segment-anonymous-id>
```

### 5. Append Segment Querystring API Params to ActiveCampaign Email Links

- [ ] Update every ActiveCampaign email link that sends traffic to the website.
- [ ] Append Segment's querystring API user ID parameter using the ActiveCampaign email personalization value.
- [ ] Use the contact's email address as the Segment `userId`.
- [ ] Example target pattern:

```text
https://example.com/path?ajs_uid=%EMAIL%
```

- [ ] Preserve existing URL parameters by using `&ajs_uid=%EMAIL%` when the link already has a query string.
- [ ] Confirm Segment initializes or identifies the visitor with the expected email-based `userId` after clicking from an ActiveCampaign email.

### 6. Optional DocuSign Tightening After Core Tracking Is Stable

- [ ] Only propose this to the owner after the core Segment, ActiveCampaign, ClickFunnels, and coverage measurement setup is working.
- [ ] Current customer-facing flow after the user makes the `$997` deposit on:

```text
https://keyboardrich.com/yes
```

- [ ] Proposed stricter flow:

```text
ClickFunnels/payment success redirects to your Worker/server
Worker creates DocuSign envelope for the buyer email
Worker gets embedded signing URL
Worker redirects browser to that signing URL
```

- [ ] Keep the user experience effectively the same:

```text
Pay deposit
  -> land on DocuSign contract
  -> sign in browser
  -> return to boomingbookkeeping.com/go
  -> pay balance
```

- [ ] Before proposing the stricter DocuSign API path, measure whether there is a real leakage/problem worth solving.
- [ ] Test what percentage of users submitted a DocuSign signer email where no matching payment exists.
- [ ] Compare DocuSign signer emails against payment records by email and timestamp window.
- [ ] Treat the stricter Worker-created embedded signing flow as optional hardening, not part of the initial tracking rollout.

## Browser Segment Track API Events

### 7. Send Browser Form and Payment Events Directly to Segment

- [ ] Send `Form Submitted` directly from the browser to Segment using the Segment Track API.
- [ ] Send payment events directly from the browser to Segment using the Segment Track API.
- [ ] Include stable IDs on browser events so they can be compared against server-side sources.
- [ ] Include `anonymousId`, page URL, funnel step, form/payment identifiers, and submission/payment timestamps where available.

## Coverage Measurement

### 8. Compare Browser Capture vs Server/Webhook Sources

- [ ] Build a coverage report for forms:

```text
browser Form Submitted events / server or webhook form submissions
```

- [ ] Build a coverage report for payments:

```text
browser payment events / server or webhook payment events
```

- [ ] Report both raw counts and coverage percentage.
- [ ] Break coverage down by domain, funnel step, and event date if the data supports it.

### 9. Compare ActiveCampaign Hidden Field Coverage vs Browser Form Capture

- [ ] For ActiveCampaign form submissions, measure how often the hidden Segment anonymous ID field is present and non-empty.
- [ ] In the warehouse, measure the percentage of users redirected from:

```text
https://thebookkeepingchallenge.com/live-1
```

to:

```text
https://keyboardrichchallenge.com/vipfc-2
```

where the destination URL includes a non-empty `ajs_aid` parameter.
- [ ] Break the `live-1` -> `vipfc-2` redirect check into:
  - total redirects
  - redirects with `ajs_aid`
  - redirects with missing or blank `ajs_aid`
  - coverage percentage
- [ ] Treat missing or blank `ajs_aid` on this path as a suspected browser-side hydration race unless the ActiveCampaign submission payload proves the hidden field was filled.
- [ ] Compare that against browser `Form Submitted` captures.
- [ ] Report:

```text
ActiveCampaign submissions with anonymous ID / browser Form Submitted events
```

- [ ] Flag cases where the browser captured a form submission but ActiveCampaign did not receive the anonymous ID.
- [ ] Flag cases where ActiveCampaign received a submission but no matching browser `Form Submitted` event exists.
