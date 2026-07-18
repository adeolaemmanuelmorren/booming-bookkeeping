# Cloudflare Funnel Proxy Proposal

## What the Proxy Does

We would create a dedicated public subdomain, such as:

```text
go.thebookkeepingchallenge.com
```

A Cloudflare Worker would run on this subdomain. When someone requests a page, the Worker would:

1. Read the requested path, such as `/vip`.
2. Look up the matching ClickFunnels page.
3. Fetch that page privately from its current domain.
4. Serve the page through `go.thebookkeepingchallenge.com`.

For example:

```text
go.thebookkeepingchallenge.com/register
  fetches the page from
thebookkeepingchallenge.com/live-1

go.thebookkeepingchallenge.com/vip
  fetches the page from
keyboardrichchallenge.com/vipfc
```

This is not a normal redirect. The visitor stays on the public subdomain while the Worker retrieves the page in the background.

ClickFunnels would continue hosting the pages. Changes made in ClickFunnels would continue to appear without copying or rebuilding the pages.

The Worker would also keep supported links, forms, and ClickFunnels redirects on the public subdomain when the visitor moves to the next mapped page.

## Why Use a Dedicated Subdomain

The dedicated subdomain lets Cloudflare run the Worker without changing the existing ClickFunnels domain setup.

- `go.thebookkeepingchallenge.com` would be proxied through Cloudflare.
- The existing ClickFunnels domains would remain connected directly to ClickFunnels.
- The existing URLs would remain available as fallbacks.

Ideally, registration, VIP, challenge, and offer links would all use the public subdomain. This keeps the visitor on one hostname throughout the journey.

The same Termly configuration must be used throughout the proxied journey so the visitor's consent preference is recognized on every mapped page.

## How the Page Mappings Would Be Managed

Bill would manage the mappings through an Airtable interface. He would not need to edit Worker code.

Each mapping would contain:

| Page name | Public path | Current ClickFunnels URL | Page type | Status |
| --- | --- | --- | --- | --- |
| Registration | `/register` | `https://thebookkeepingchallenge.com/live-1` | Form | Published |
| VIP upgrade | `/vip` | `https://keyboardrichchallenge.com/vipfc` | Checkout | Published |
| Challenge access | `/challenge` | `https://keyboardrichchallenge.com/krc-1` | Content | Published |

Bill's process would be:

1. Add or update a mapping in Airtable.
2. Open the preview link and confirm the page works.
3. Click **Publish**.
4. The approved mappings are copied into Cloudflare.

The Worker would read the published Cloudflare copy instead of contacting Airtable for every visitor. This avoids adding Airtable latency or making the funnel dependent on Airtable being available.

## Controls to Prevent Breakage

Before publishing, the system would check that:

- The public path is valid and is not already in use.
- The ClickFunnels URL uses an approved domain.
- The source page is available.
- Important ClickFunnels redirects lead to another mapped page.
- Checkout pages have been tested before being published.

If validation fails, the existing live mappings would remain unchanged.

The system would keep the previous published version so Bill could restore it from Airtable. Individual mappings could also be disabled without affecting the rest of the funnel.

We would first test the complete journey on a staging subdomain. Production mappings would then be released in sections: registration, VIP, challenge pages, and finally offers and checkout pages.
