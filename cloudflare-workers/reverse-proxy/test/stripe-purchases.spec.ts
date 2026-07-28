import { afterEach, describe, expect, it, vi } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import type { PurchaseState } from "../src/stripe/purchase-state";
import { findConfirmedPurchases } from "../src/stripe/confirmed-purchases";
import type { ConfirmedPurchase, PurchaseAttemptInput } from "../src/stripe/types";

const STRIPE_ENV = {
	STRIPE_SECRET_KEY: "sk_test_main",
	STRIPE_KAJABI_SECRET_KEY: "sk_test_kajabi",
};

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function jsonResponse(body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
}

function createAttempt(overrides: Partial<PurchaseAttemptInput> = {}): PurchaseAttemptInput {
	return {
		email: "person@example.com",
		paymentMethodId: "pm_shared",
		stripeAccount: "main",
		submittedAt: 1_000_000,
		...overrides,
	};
}

describe("Stripe charge confirmation", () => {
	it("returns multiple distinct purchases made with the same payment method", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
			data: [
				{
					id: "ch_book",
					amount: 795,
					billing_details: { email: "person@example.com" },
					calculated_statement_descriptor: "KEYBOARD RICH BOOK",
					currency: "usd",
					created: 1010,
					description: "Products: Keyboard Rich Book, Domestic Shipping",
					metadata: {},
					paid: true,
					payment_method: "pm_shared",
					status: "succeeded",
				},
				{
					id: "ch_oto",
					amount: 4700,
					billing_details: { email: "person@example.com" },
					currency: "usd",
					created: 1020,
					description: "Top Tax Loopholes",
					metadata: { products: "Top Tax Loopholes for Bookkeeping Business Owners" },
					paid: true,
					payment_method: "pm_shared",
					status: "succeeded",
				},
			],
			has_more: false,
		})));

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases).toEqual([
			expect.objectContaining({
				chargeId: "ch_book",
				contentIds: ["keyboard rich book", "domestic shipping"],
				productName: "Keyboard Rich Book, Domestic Shipping",
				value: 7.95,
			}),
			expect.objectContaining({
				chargeId: "ch_oto",
				contentIds: ["top tax loopholes for bookkeeping business owners"],
				productName: "Top Tax Loopholes for Bookkeeping Business Owners",
				value: 47,
			}),
		]);
	});

	it("keeps price commas inside one content ID and removes duplicate products", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
			data: [{
				id: "ch_payment_plan",
				amount: 199700,
				billing_details: { email: "person@example.com" },
				currency: "usd",
				created: 1010,
				metadata: {
					products: [
						"Booming Bookkeeping Mentorship Program (3 payments of $1,997)",
						"Booming Bookkeeping Mentorship Program (3 payments of $1,997)",
					].join(", "),
				},
				paid: true,
				payment_method: "pm_shared",
				status: "succeeded",
			}],
			has_more: false,
		})));

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases[0]).toEqual(expect.objectContaining({
			contentIds: ["booming bookkeeping mentorship program (3 payments of $1,997)"],
			productName: "Booming Bookkeeping Mentorship Program (3 payments of $1,997)",
		}));
	});

	it("extracts the mentorship product from its ClickFunnels invoice description", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
			const url = new URL(String(input));

			if (url.pathname === "/v1/charges") {
				return jsonResponse({
					data: [{
						id: "ch_mentorship_invoice",
						amount: 199700,
						billing_details: { email: "person@example.com" },
						currency: "usd",
						created: 1010,
						invoice: "in_mentorship",
						paid: true,
						payment_method: "pm_shared",
						status: "succeeded",
					}],
					has_more: false,
				});
			}

			return jsonResponse({
				billing_reason: "manual",
				id: "in_mentorship",
				lines: {
					data: [{
						amount: 199700,
						description: "Booming Bookkeeping Bu | person@example.com | " +
							"Product: Booming Bookkeeping Mentorship Program " +
							"(Payment Plan - 3 x $1,997 for a total of $5,991)",
					}],
				},
			});
		}));

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases[0]).toEqual(expect.objectContaining({
			contentIds: [
				"booming bookkeeping mentorship program " +
				"(payment plan - 3 x $1,997 for a total of $5,991)",
			],
		}));
	});

	it("does not extract an unrelated future product from an invoice description", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
			const url = new URL(String(input));

			if (url.pathname === "/v1/charges") {
				return jsonResponse({
					data: [{
						id: "ch_future_invoice",
						amount: 1000,
						billing_details: { email: "person@example.com" },
						currency: "usd",
						created: 1010,
						invoice: "in_future",
						paid: true,
						payment_method: "pm_shared",
						status: "succeeded",
					}],
					has_more: false,
				});
			}

			return jsonResponse({
				billing_reason: "manual",
				id: "in_future",
				lines: {
					data: [{
						amount: 1000,
						description: "Invoice 123 | Product: Future Product",
					}],
				},
			});
		}));

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases[0]).toEqual(expect.objectContaining({
			contentIds: ["invoice 123 | product: future product"],
		}));
	});

	it("rejects a later subscription installment", async () => {
		const fetchStub = vi.fn(async (input: URL | RequestInfo) => {
			const url = new URL(String(input));

			if (url.pathname === "/v1/charges") {
				return jsonResponse({
					data: [{
						id: "ch_installment",
						amount: 199700,
						billing_details: { email: "person@example.com" },
						currency: "usd",
						created: 1010,
						invoice: "in_repeat",
						paid: true,
						payment_method: "pm_shared",
						status: "succeeded",
					}],
					has_more: false,
				});
			}

			return jsonResponse({
				billing_reason: "subscription_cycle",
				id: "in_repeat",
				lines: {
					data: [{
						description: "Booming Bookkeeping Mentorship Program",
						plan: { id: "BBB3X1997" },
						price: {
							id: "BBB3X1997",
							product: {
								id: "prod_PtzEmmHhC1K9Xi",
								name: "Booming Bookkeeping Mentorship Program",
							},
						},
					}],
				},
				subscription: "sub_123",
			});
		});
		vi.stubGlobal("fetch", fetchStub);

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases).toEqual([]);
		expect(fetchStub).toHaveBeenCalledTimes(2);
	});

	it("rejects the explicit mentorship balance product", async () => {
		const fetchStub = vi.fn(async (input: URL | RequestInfo) => {
			const url = new URL(String(input));

			if (url.pathname === "/v1/charges") {
				return jsonResponse({
					data: [{
						id: "ch_balance",
						amount: 300300,
						billing_details: { email: "person@example.com" },
						currency: "usd",
						created: 1010,
						invoice: "in_balance",
						paid: true,
						payment_method: "pm_shared",
						status: "succeeded",
					}],
					has_more: false,
				});
			}

			return jsonResponse({
				billing_reason: "manual",
				id: "in_balance",
				lines: {
					data: [{
						amount: 300300,
						description: "Booming Bookkeeping Balance payment",
						price: {
							id: "price_1QzjKMBf6i84vTZE2WPd5Rh7",
							product: {
								id: "prod_RtWNqT9xux5CI7",
								name: "Booming Bookkeeping Balance payment",
							},
						},
					}],
				},
			});
		});
		vi.stubGlobal("fetch", fetchStub);

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
		);

		expect(purchases).toEqual([]);
	});

	it("accepts the initial Kajabi subscription charge", async () => {
		vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
			const url = new URL(String(input));

			if (url.pathname === "/v1/charges") {
				return jsonResponse({
					data: [{
						id: "ch_kajabi",
						amount: 19900,
						billing_details: { email: "person@example.com", name: "Person Example" },
						currency: "usd",
						created: 1010,
						invoice: "in_initial",
						paid: true,
						payment_method: "pm_shared",
						status: "succeeded",
					}],
					has_more: false,
				});
			}

			return jsonResponse({
				billing_reason: "subscription_create",
				id: "in_initial",
				lines: {
					data: [{
						description: "Booming Bookkeeping Mentorship Program",
						plan: { id: "subscription_plan_2149288216" },
					}],
				},
				subscription: "sub_kajabi",
			});
		}));

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"kajabi",
			[createAttempt({ stripeAccount: "kajabi" })],
			1_100_000,
		);

		expect(purchases).toEqual([
			expect.objectContaining({
				chargeId: "ch_kajabi",
				contentIds: ["booming bookkeeping mentorship program"],
				productId: "booming bookkeeping mentorship program",
				productName: "Booming Bookkeeping Mentorship Program",
				products: [
					expect.objectContaining({
						contentId: "booming bookkeeping mentorship program",
						stripePlanId: "subscription_plan_2149288216",
					}),
				],
				value: 199,
			}),
		]);
	});

	it("does not enrich a charge that the Durable Object already delivered", async () => {
		const fetchStub = vi.fn(async () => jsonResponse({
			data: [{
				id: "ch_already_delivered",
				amount: 4700,
				billing_details: { email: "person@example.com" },
				currency: "usd",
				created: 1010,
				invoice: "in_should_not_be_loaded",
				paid: true,
				payment_method: "pm_shared",
				status: "succeeded",
			}],
			has_more: false,
		}));
		vi.stubGlobal("fetch", fetchStub);

		const purchases = await findConfirmedPurchases(
			STRIPE_ENV,
			"main",
			[createAttempt()],
			1_100_000,
			new Set(["ch_already_delivered"]),
		);

		expect(purchases).toEqual([]);
		expect(fetchStub).toHaveBeenCalledTimes(1);
	});
});

describe("Durable Object replay prevention", () => {
	it("appends attempts and records a charge only once", async () => {
		const state = env.PURCHASE_STATE.getByName(`purchase-test-${crypto.randomUUID()}`);
		const now = Date.now();
		const charge: ConfirmedPurchase = {
			chargeId: "ch_once",
			contentIds: ["test product"],
			currency: "USD",
			email: "person@example.com",
			name: "Person Example",
			phone: "",
			productId: "test product",
			productName: "Test Product",
			products: [{
				contentId: "test product",
				name: "Test Product",
				price: 47,
				quantity: 1,
			}],
			stripeAccount: "main",
			value: 47,
		};

		await state.registerAttempt(createAttempt({ submittedAt: now }));
		await state.registerAttempt(createAttempt({
			paymentMethodId: "pm_second",
			submittedAt: now + 1,
		}));

		const result = await runInDurableObject(
			state as DurableObjectStub<PurchaseState>,
			(instance, durableState) => {
				const first = (instance as any).recordNewCharges([charge], now);
				const second = (instance as any).recordNewCharges([charge], now + 1);
				const attempts = [...durableState.storage.sql.exec(
					"SELECT attempt_id FROM pending_attempts",
				)];
				const firstLease = (instance as any).reserveStripeCheck("main", now);
				const overlappingRetry = (instance as any).reserveStripeCheck("main", now + 3000);

				return { attempts, first, second, firstLease, overlappingRetry };
			},
		);

		expect(result.attempts).toHaveLength(2);
		expect(result.first).toEqual([charge]);
		expect(result.second).toEqual([]);
		expect(result.firstLease).toBe(0);
		expect(result.overlappingRetry).toBe(12_000);
	});
});
