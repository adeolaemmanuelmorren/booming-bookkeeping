# Stripe to Segment payment webhook plan

## Objective

Add Stripe as a source in the existing Cloudflare Worker at:

`/Users/adeola/cuetime/cloudflare-workers/marketing-webhooks`

The worker must turn every successful Stripe charge into a server-side Segment payment event, enrich it with Stripe catalog and customer data, apply the same product and repeat-payment rules as `mart_payments`, and prevent renewals/installments/balance collections from being treated as new orders.

The validated warehouse model remains the business-rule source of truth:

- `/Users/adeola/Boom Bookkeeping/dataform/definitions/intermediate/stripe/int_stripe_payment_product_resolution.sqlx`
- `/Users/adeola/Boom Bookkeeping/dataform/definitions/intermediate/stripe/int_stripe_payment_occurrence.sqlx`
- `/Users/adeola/Boom Bookkeeping/outputs/STRIPE_PAYMENT_PRODUCT_IDENTIFICATION.md`
- `/Users/adeola/Boom Bookkeeping/dataform/validation/STRIPE_PAYMENT_VALIDATION.md`

## Webhook events

Configure one required Stripe webhook event:

- `charge.succeeded`

Use the endpoint:

- `POST /webhook/stripe`

Do not use `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`, or `invoice.payment_succeeded` as additional conversion triggers. Those events overlap with successful charges and would require deduplication across multiple purchase paths. The validated warehouse grain is one successful `charge.id`, and `charge.succeeded` also covers Checkout, Payment Links, invoices, subscriptions, and direct/legacy Charges API payments.

Refund events are not part of this implementation.

## Segment events

For every `charge.succeeded`, emit:

1. An `identify` call when a normalized customer email is available. Follow the worker's existing convention and use the email as `userId`.
2. A custom `Payment Completed` track event for every successful charge.
3. A standard `Order Completed` track event only when `is_repeat_payment` is `false`.

This separation is intentional:

- `Payment Completed` is the complete Stripe collection ledger, including renewals, installments, and explicit balance payments.
- `Order Completed` represents a new order/conversion and must exclude repeat collections.

Both track events use the Segment Ecommerce V2 `Order Completed` property shape:

- `order_id`: Stripe charge ID
- `checkout_id`: Checkout Session ID when present
- `total`: successful charge amount
- `subtotal`: amount after discounts and before tax/shipping when Stripe exposes the components
- `revenue`: amount excluding tax and shipping
- `shipping`
- `tax`
- `discount`
- `coupon`
- `currency`: uppercase ISO currency
- `products`: all resolved Stripe line items

Each product should include the fields Stripe can support:

- `product_id`: Stripe product ID; for direct ClickFunnels charges without a Stripe product, use the stable `product_rule`
- `sku`: Stripe price or plan ID when present
- `name`
- `variant`
- `price`
- `quantity`

Add only these business-specific payment properties:

- `product_rule`
- `product_classification_method`
- `payment_sequence_number`
- `payment_occurrence_type`
- `is_repeat_payment`

Put Stripe object IDs used for debugging in `context.marketingSource.stripe`, not as more top-level event properties.

Use deterministic Segment `messageId` values derived from `charge.id` and the Segment event name so Stripe retries and queue retries do not create duplicates.

## Stripe API enrichment

Start with the Charge embedded in the verified webhook. Retrieve the canonical Charge when needed, then follow only the branches available on that charge.

### Base objects

- Retrieve Charge: `GET /v1/charges/{charge_id}` with Customer, PaymentIntent, and Invoice expanded where supported.
- Retrieve Customer when the expanded Charge does not contain it: `GET /v1/customers/{customer_id}`.
- Retrieve PaymentIntent when needed: `GET /v1/payment_intents/{payment_intent_id}`.

Use Charge billing details first, then receipt email, Customer, and PaymentIntent receipt email for identity. Normalize email to lowercase.

### Checkout or Payment Link payments

- Find the Checkout Session: `GET /v1/checkout/sessions?payment_intent={payment_intent_id}`.
- If the payment is subscription-based and no session is found by PaymentIntent, use `GET /v1/checkout/sessions?subscription={subscription_id}` and select the session tied to the purchase.
- Retrieve all Checkout line items: `GET /v1/checkout/sessions/{checkout_session_id}/line_items`.
- Use the Session's `payment_link` reference when present.

### Invoice or subscription payments

- Retrieve Invoice: `GET /v1/invoices/{invoice_id}`.
- Retrieve all Invoice line items: `GET /v1/invoices/{invoice_id}/lines`.
- If line items do not expose enough catalog detail, retrieve Price and Product by ID.
- For repeat sequencing, list paid invoices for the subscription: `GET /v1/invoices?subscription={subscription_id}&status=paid`, paginate all results, retain only invoices backed by successful Stripe charges, and order those charges by `created` then `charge.id`. The current charge's one-based position is `payment_sequence_number`.

### Catalog fallback

- Retrieve Price when required: `GET /v1/prices/{price_id}`.
- Retrieve Product when required: `GET /v1/products/{product_id}`.

Do not make every API call for every payment. Branch from the IDs present on the charge and stop once all needed objects and line items are resolved.

## Product classification

Port the warehouse rule priority exactly, in readable named functions/constants:

1. Keyboard Rich book from the charge statement descriptors, with the six description-derived variants.
2. Structured Basic VIP from product, price, or Payment Link.
3. Structured Keyboard Rich Challenge from product or price.
4. $47 VIP from amount plus the required KRC/VIP text signals.
5. Mentorship deposit from the exact description plus $997/$497 amount.
6. Structured $4,997 full payment from the exact product or price only; amount alone must not classify it.
7. 3 x $1,997 plan from the exact product, plan, or price.
8. Structured $3,003 balance from the exact product or price.
9. Other known Stripe catalog products keep their Stripe product name.
10. Otherwise `unclassified`.

Do not classify `199IP` as Kajabi. That account is not represented in this Stripe dataset.

## Repeat-payment logic

Match `mart_payments`:

- Explicit structured $3,003 balance: `payment_occurrence_type = "balance"`, `is_repeat_payment = true`.
- No subscription: `payment_sequence_number = null`, `payment_occurrence_type = "one_time"`, `is_repeat_payment = false`.
- Subscription sequence 1: `payment_occurrence_type = "initial"`, `is_repeat_payment = false`.
- Later 3 x $1,997 payments: `payment_occurrence_type = "installment"`, `is_repeat_payment = true`.
- Other later subscription payments: `payment_occurrence_type = "renewal"`, `is_repeat_payment = true`.

## Worker integration

Keep the existing source-plugin structure:

- Add `src/sources/stripe/` with types, validation, enrichment, extractors/classification, handler, and source registration.
- Add a Stripe API client under the Stripe source or `src/clients` according to whether the code is reusable.
- Add Stripe to the source registry and source-platform context.
- Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Worker secrets.
- Use Stripe's official Node library for signature verification and API access unless Cloudflare compatibility makes a small, tested manual HTTP client necessary.

Stripe signature verification must happen at HTTP ingestion against the unmodified raw request body and the `Stripe-Signature` header before JSON parsing/queueing. Extend the source contract minimally so source-specific ingress verification is possible. Invalid signatures return `400` and are never queued.

Stripe enrichment is required for correct classification. Retry transient Stripe API failures through the existing queue; do not silently emit a partially classified conversion after a network or Stripe 5xx failure. Treat a genuine missing optional object/404 as absent data and continue with the documented fallback rules.

## Tests and definition of done

Add focused tests for:

- valid and invalid Stripe signatures;
- direct Keyboard Rich book classification and variant;
- direct $47 VIP classification;
- structured Basic VIP/KRC/full-payment/3 x $1,997/balance rules;
- exact $4,997 amount without the structured product remaining unclassified;
- `199IP` not becoming Kajabi;
- first subscription payment producing both `Payment Completed` and `Order Completed`;
- later installment/renewal and balance payments producing `Payment Completed` but no `Order Completed`;
- complete Segment ecommerce fields and deterministic message IDs;
- retry behavior for transient enrichment failures;
- unchanged Shopify and Webflow behavior.

Run:

- `npm test`
- TypeScript no-emit validation

Update the worker README with the Stripe endpoint, supported event, required secrets, event behavior, and exact Stripe Dashboard setup instructions.

## Explicitly out of scope

- Refund/cancellation Segment events
- Checkout Started events
- Historical Stripe-to-Segment backfill
- New databases, KV namespaces, Durable Objects, or cron jobs
- Changes to the validated Dataform payment models
- Live deployment or Stripe Dashboard changes without a separate explicit production step

