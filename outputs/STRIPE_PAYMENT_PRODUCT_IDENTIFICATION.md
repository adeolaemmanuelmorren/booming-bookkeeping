# Stripe Payment and Product Identification

The **source of truth for a completed payment** is:

```text
able-folio-499722.stripe.charge
```

Count a payment when:

```sql
charge.paid = TRUE
AND charge.status = 'succeeded'
```

Use `charge.id` as the unique payment. Do not separately count its Payment Intent, invoice, or Checkout Session as additional purchases.

## How We Identify the Product

Product classification does **not** need to rely on the amount or catalog price.

Use this priority:

1. `product.id` and `product.name`
2. Checkout Session line-item product/price references and description
3. Invoice line-item product, `price_id`, `plan_id`, and description
4. Subscription-item `price_id` or `plan_id`
5. Payment Link and its associated line items
6. For ClickFunnels charges without structured Stripe products, use `charge.description` and statement descriptors
7. Use `charge.amount` only as a supporting validation signal, not the primary product identifier

## Payments, Discounts, and Refunds

| Question | Source |
|---|---|
| Was payment completed? | Successful `charge` |
| What product was purchased? | Product ID/name, line item, plan, Payment Link, or description |
| What was the catalog price? | `price.unit_amount` |
| What did the customer actually pay after a coupon? | `charge.amount` |
| Why was the amount discounted? | Checkout/invoice discount, coupon, or promotion-code records |
| How much was later refunded? | `charge.amount_refunded` |
| What remains after refunds? | `charge.amount - charge.amount_refunded` |

A coupon reduces the amount before the charge is created. It **does not** appear as a refund.

## Current Product Detection Rules

These are the concrete rules supported by the current Stripe data. Every rule still requires a successful charge before it counts as collected money.

| Purchase | Exact identification rule | Limitation |
|---|---|---|
| Keyboard Rich book | Require `REGEXP_CONTAINS(LOWER(CONCAT(COALESCE(charge.calculated_statement_descriptor, ''), ' ', COALESCE(charge.statement_descriptor, ''))), r'keyboard rich book')`. Extract the purchased options from `charge.description` with `REGEXP_EXTRACT(description, r'(?i)products?:[[:space:]]*(.*)')`. | These ClickFunnels charges have no Stripe product or price ID. The descriptor identifies the book family; the extracted `Products:` text identifies the variant. |
| Book shipping/audio variant | Search the extracted book `product_text` for `domestic shipping`, `international shipping`, and `audiobook`. Their combinations produce the six audited variants. | Amount is supporting validation only: observed variants include $7.95, $19.95, $30.00, $36.95, and $48.95, plus a small $1 legacy group. |
| $47 Keyboard Rich Challenge VIP | Require a successful charge with `charge.amount = 4700`. Build a lowercase signal from extracted `Products:` text, both charge statement descriptors, and Checkout line-item descriptions. Require that signal to match `(keyboard rich|keyboardrich|krc)` together with `(vip|backstage|basic package|platinum)`. | This identifies the VIP family, not the originating ClickFunnels route. Most direct ClickFunnels charges have no reusable Stripe product/price relationship. |
| Structured $47 Basic VIP | Product `prod_RtWRamfeN5cGXG`, price `price_1QzjOMBf6i84vTZEJziq3pN7`, or Payment Link `plink_1QzjOqBf6i84vTZEkOOwnbNJ`, connected through Checkout Session line items. | This structured path covers only a minority of the historical $47 VIP charges. |
| Structured $47 Keyboard Rich Challenge | Product `prod_RL2UJfDpmvCvRx` and price `price_1QSMPLBf6i84vTZEbLsCt1b7`. | The audit found no paid Payment Link sessions for this object, so it cannot replace the charge-text rule. |
| $997 mentorship deposit | Require `REGEXP_CONTAINS(LOWER(COALESCE(charge.description, '')), r'mentorship program \(deposit\)')`. Use `charge.amount = 99700` to select the current $997 deposit; `49700` identifies the historical $497 deposit version. | These direct ClickFunnels deposit charges have no Checkout Session or price ID. A charge proves a payment, not necessarily a complete enrollment. |
| Structured $4,997 full-payment offer | Product `prod_RlhQH6wdxzjZeZ` and price `price_1QsA1wBf6i84vTZEca307VRJ`, resolved through a Checkout or invoice line and then linked to its successful charge. | As of July 15, 2026, this exact price has zero Checkout line items and one invoice line. That invoice is open and unpaid, and its associated $4,997 charge failed. Therefore, zero successful charges are tied to this exact product/price pair. Separately, 372 program-related successful charges have an exact $4,997 amount, mostly through custom Payment Links, but Stripe cannot prove those charges represent this exact structured offer or a completed enrollment. |
| 3 x $1,997 plan | Find `subscription_item.plan_id = 'BBB3X1997'` or `invoice_line_item.plan_id = 'BBB3X1997'` / `invoice_line_item.price_id = 'BBB3X1997'`. Join `invoice_line_item.invoice_id` to `invoice.id`, then `invoice.charge_id` to the successful `charge.id`. Product reference: `prod_PtzEmmHhC1K9Xi`. | Each successful $1,997 charge is one collected installment, not a new mentorship enrollment. |
| Structured $3,003 balance | Product `prod_RtWNqT9xux5CI7` and price `price_1QzjKMBf6i84vTZE2WPd5Rh7`, resolved through its Checkout line/Payment Link and successful charge. | This rule identifies the explicit balance offer. It does not classify arbitrary custom-amount charges as balances. |
| Kajabi $199/month | No rule is available in `able-folio-499722.stripe`. | The separate Stripe account used by Kajabi is not connected to this dataset. The unrelated historical `199IP` plan must not be classified as Kajabi. |

### Keyboard Rich Book Variant Logic

After a charge passes the `Keyboard Rich Book` descriptor rule, classify its extracted `product_text` as follows:

| Text found in `product_text` | Classification |
|---|---|
| `international shipping` and `audiobook` | Book + international shipping + audiobook |
| `domestic shipping` and `audiobook` | Book + domestic shipping + audiobook |
| `international shipping` only | Book + international shipping |
| `domestic shipping` only | Book + domestic shipping |
| `audiobook` without a shipping label | Book + audiobook/no shipping label |
| None of those option labels | Book/no shipping label |

The core model is:

```text
Product identity = product, line item, plan, Payment Link, or description
Payment completion and actual amount collected = successful charge
Discount explanation = invoice/Checkout discount records
Refund = charge.amount_refunded
```
