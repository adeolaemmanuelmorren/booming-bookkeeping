import { afterEach, describe, expect, it, vi } from "vitest";
import {
	getReadyAnonymousId,
	track,
	waitForAnalytics,
} from "../../../clickfunnels/src/analytics-client.js";
import {
	clearTrackingIdsFromHoneypot,
	purgeClickFunnelsCustomTypeGarlicState,
} from "../../../clickfunnels/src/active-campaign.js";
import { sendTrack } from "../../../clickfunnels/src/analytics-track.js";
import { buildFacebookContext } from "../../../clickfunnels/src/facebook-context.js";
import { loadJitsuAnalytics } from "../../../clickfunnels/src/jitsu-loader.js";
import { listenForKajabiPurchaseDataLayerEvents } from "../../../clickfunnels/src/kajabi-purchase-diagnostic.js";
import {
	bindFormSubmitTracking,
	getPaymentMethodId,
	isOneClickUpsellSubmission,
} from "../../../clickfunnels/src/forms.js";
import {
	createFormSubmissionEventId,
	createPurchaseEventId,
	getPacificEventDate,
	getPacificPurchaseDate,
	sha256Hex,
} from "../../../clickfunnels/src/event-ids.js";
import { decorateCrossDomainLink } from "../../../clickfunnels/src/links.js";
import {
	getActiveCampaignFormId,
	getRegistrationForm,
} from "../../../clickfunnels/src/registration-forms.js";
import { createSubmissionBurstGuard } from "../../../clickfunnels/src/submission-burst.js";
import {
	POLL_AFTER_SUBMIT_ROUTES,
	POLL_ON_LOAD_ROUTES,
	matchesPurchaseRoute,
	pollForConfirmedPurchases,
	registerPurchaseAttempt,
} from "../../../clickfunnels/src/purchase-confirmation.js";

type ScriptStub = {
	async?: boolean;
	src?: string;
	attributes: Record<string, string>;
	setAttribute: (name: string, value: string) => void;
};

type BrowserStub = {
	window: Record<string, any>;
	document: Record<string, any>;
	getCurrentUrl: () => URL;
	getInsertedScript: () => ScriptStub | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

function createBrowserStub(initialUrl: string, cookie = ""): BrowserStub {
	let currentUrl = new URL(initialUrl);
	let insertedScript: ScriptStub | null = null;

	const location = {
		get href() {
			return currentUrl.toString();
		},
		get hostname() {
			return currentUrl.hostname;
		},
		get protocol() {
			return currentUrl.protocol;
		},
		get pathname() {
			return currentUrl.pathname;
		},
		get search() {
			return currentUrl.search;
		},
	};

	const firstScript = {
		parentNode: {
			insertBefore(script: ScriptStub) {
				insertedScript = script;
			},
		},
	};

	const documentStub = {
		cookie,
		head: {
			appendChild(script: ScriptStub) {
				insertedScript = script;
			},
		},
		querySelector() {
			return null;
		},
		createElement() {
			const script: ScriptStub = {
				attributes: {},
				setAttribute(name: string, value: string) {
					this.attributes[name] = value;
				},
			};
			return script;
		},
		getElementsByTagName() {
			return [firstScript];
		},
	};

	const windowStub = {
		location,
		console: { warn: vi.fn() },
		history: {
			state: null,
			replaceState(_state: unknown, _title: string, nextUrl: string) {
				currentUrl = new URL(nextUrl);
			},
		},
		fetch: vi.fn(async () => new Response("{}")),
		setInterval,
		clearInterval,
	};

	vi.stubGlobal("window", windowStub);
	vi.stubGlobal("document", documentStub);

	return {
		window: windowStub,
		document: documentStub,
		getCurrentUrl: () => currentUrl,
		getInsertedScript: () => insertedScript,
	};
}

describe("ClickFunnels Jitsu bootstrap", () => {
	it("copies a valid handoff to both the page and p.js request", () => {
		const browser = createBrowserStub(
			"https://keyboardrichchallenge.com/offer?ajs_aid=shared-identity",
		);

		loadJitsuAnalytics();

		const pageUrl = browser.getCurrentUrl();
		const script = browser.getInsertedScript();
		const scriptUrl = new URL(script?.src ?? "");

		expect(pageUrl.searchParams.get("ajs_aid")).toBe("shared-identity");
		expect(pageUrl.searchParams.get("an_aid")).toBe("shared-identity");
		expect(scriptUrl.origin).toBe("https://sg.keyboardrichchallenge.com");
		expect(scriptUrl.pathname).toBe("/p.js");
		expect(scriptUrl.searchParams.get("ajs_aid")).toBe("shared-identity");
		expect(scriptUrl.searchParams.get("an_aid")).toBe("shared-identity");
		expect(script?.attributes["data-init-only"]).toBe("true");
		expect(script?.attributes["data-cookie-domain"]).toBe("keyboardrichchallenge.com");
	});

	it("neutralizes conflicting handoffs before Jitsu initializes", () => {
		const browser = createBrowserStub(
			"https://keyboardrich.com/offer?ajs_aid=first-identity&an_aid=second-identity",
		);

		loadJitsuAnalytics();

		const pageUrl = browser.getCurrentUrl();
		const scriptUrl = new URL(browser.getInsertedScript()?.src ?? "");

		expect(pageUrl.searchParams.has("ajs_aid")).toBe(false);
		expect(pageUrl.searchParams.has("an_aid")).toBe(false);
		expect(scriptUrl.searchParams.has("ajs_aid")).toBe(false);
		expect(scriptUrl.searchParams.has("an_aid")).toBe(false);
		expect(browser.window.console.warn).toHaveBeenCalledWith("anonymous_id_handoff_conflict");
	});

	it("configures Jitsu event fetches to include Worker cookies", async () => {
		const browser = createBrowserStub("https://thebookkeepingchallenge.com/offer");
		browser.window.jitsuConfig = { debug: true };

		loadJitsuAnalytics();
		await browser.window.jitsuConfig.fetch("https://sg.thebookkeepingchallenge.com/api/s/track", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
		});

		expect(browser.window.jitsuConfig.debug).toBe(true);
		expect(browser.window.fetch).toHaveBeenCalledWith(
			"https://sg.thebookkeepingchallenge.com/api/s/track",
			 expect.objectContaining({
				method: "POST",
				credentials: "include",
				keepalive: true,
				headers: { "Content-Type": "application/json" },
			}),
		);
	});

	it("queues analytics calls until Jitsu is ready", () => {
		const browser = createBrowserStub("https://thebookkeepingchallenge.com/offer");
		const readyCallbacks: Array<() => void> = [];
		let initialized = false;
		const jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized } })),
			on: vi.fn((eventName: string, callback: () => void) => {
				if (eventName === "ready") {
					readyCallbacks.push(callback);
				}
			}),
		};

		track("Form Submitted", { form_id: "lead" }, { context: {} });
		expect(jitsu.track).not.toHaveBeenCalled();

		browser.window.jitsuQ.forEach((callback: (client: unknown) => void) => callback(jitsu));
		expect(jitsu.on).toHaveBeenCalledWith("ready", expect.any(Function));
		expect(jitsu.track).not.toHaveBeenCalled();

		initialized = true;
		readyCallbacks.forEach((callback) => {
			callback();
			callback();
		});
		expect(jitsu.track).toHaveBeenCalledWith(
			"Form Submitted",
			{ form_id: "lead" },
			{ context: {} },
		);
		expect(jitsu.track).toHaveBeenCalledTimes(1);
	});

	it("runs analytics calls immediately when Jitsu is already initialized", () => {
		const browser = createBrowserStub("https://thebookkeepingchallenge.com/offer");
		const jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		browser.window.jitsu = jitsu;
		track("Form Submitted", { form_id: "lead" }, { context: {} });

		expect(jitsu.on).not.toHaveBeenCalled();
		expect(jitsu.track).toHaveBeenCalledWith(
			"Form Submitted",
			{ form_id: "lead" },
			{ context: {} },
		);
	});

	it("does not expose the browser identity to form hydration before Jitsu is initialized", () => {
		const browser = createBrowserStub(
			"https://thebookkeepingchallenge.com/offer",
			"__eventn_id=identity-before-jitsu-ready",
		);
		let initialized = false;

		browser.window.jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized } })),
		};

		expect(getReadyAnonymousId()).toBe("");

		initialized = true;

		expect(getReadyAnonymousId()).toBe("identity-before-jitsu-ready");
	});

	it("does not treat a readiness timeout as successful initialization", () => {
		vi.useFakeTimers();
		const browser = createBrowserStub("https://thebookkeepingchallenge.com/offer");
		const callback = vi.fn();

		waitForAnalytics(callback);
		vi.advanceTimersByTime(10_100);

		expect(callback).not.toHaveBeenCalled();
		expect(browser.window.console.warn).toHaveBeenCalledWith("jitsu_ready_timeout");
	});
});

describe("Kajabi purchase data-layer diagnostic", () => {
	it("captures complete existing and future purchase payloads without changing the layer", () => {
		const browser = createBrowserStub(
			"https://learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout",
		);
		const existingPurchase = {
			event: "purchase",
			ecommerce: {
				transaction_id: "kajabi_purchase_1",
				value: 199,
				currency: "USD",
				items: [{ item_id: "v3WtGzPH", item_name: "Mentorship" }],
			},
		};
		const futurePurchase = {
			event: "purchase",
			ecommerce: {
				transaction_id: "kajabi_purchase_2",
				value: 199,
				currency: "USD",
				items: [{ item_id: "v3WtGzPH", item_name: "Mentorship" }],
			},
		};
		const track = vi.fn();

		browser.window.kajabiDataLayer = [existingPurchase];
		browser.window.jitsu = {
			track,
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		expect(listenForKajabiPurchaseDataLayerEvents()).toBe(true);
		expect(browser.window.kajabiDataLayer.push(futurePurchase)).toBe(2);
		expect(browser.window.kajabiDataLayer).toHaveLength(2);
		expect(browser.window.kajabiDataLayer[0]).toBe(existingPurchase);
		expect(browser.window.kajabiDataLayer[1]).toBe(futurePurchase);
		expect(track).toHaveBeenNthCalledWith(
			1,
			"Kajabi Data Layer Purchase",
			expect.objectContaining({
				data_layer_name: "kajabiDataLayer",
				capture_phase: "existing",
				payload: existingPurchase,
				payload_json: JSON.stringify(existingPurchase),
			}),
			{},
		);
		expect(track).toHaveBeenNthCalledWith(
			2,
			"Kajabi Data Layer Purchase",
			expect.objectContaining({
				data_layer_name: "kajabiDataLayer",
				capture_phase: "push",
				payload: futurePurchase,
				payload_json: JSON.stringify(futurePurchase),
			}),
			{},
		);
	});

	it("captures the gtag arguments shape and ignores non-purchase pushes", () => {
		const browser = createBrowserStub(
			"https://learn.boomingbookkeeping.com/offers/v3WtGzPH/checkout",
		);
		const track = vi.fn();
		const purchasePayload = [
			"event",
			"purchase",
			{
				transaction_id: "kajabi_purchase_3",
				value: 199,
				currency: "USD",
			},
		];

		browser.window.jitsu = {
			track,
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		listenForKajabiPurchaseDataLayerEvents();
		browser.window.kajabiDataLayer.push(["config", "G-123"]);
		browser.window.kajabiDataLayer.push(purchasePayload);

		expect(track).toHaveBeenCalledTimes(1);
		expect(track).toHaveBeenCalledWith(
			"Kajabi Data Layer Purchase",
			expect.objectContaining({
				payload: purchasePayload,
				payload_json: JSON.stringify(purchasePayload),
			}),
			{},
		);
	});

	it("does nothing outside the Kajabi host", () => {
		const browser = createBrowserStub("https://keyboardrich.com/yes-1");

		expect(listenForKajabiPurchaseDataLayerEvents()).toBe(false);
		expect(browser.window.kajabiDataLayer).toBeUndefined();
	});
});

describe("cross-root link decoration", () => {
	it("writes matching ajs_aid and an_aid values", () => {
		createBrowserStub(
			"https://thebookkeepingchallenge.com/offer",
			"__eventn_id=shared-identity",
		);
		const link = {
			href: "",
			getAttribute(name: string) {
				return name === "href" ? "https://keyboardrich.com/next" : "";
			},
		};

		expect(decorateCrossDomainLink(link)).toBe(true);

		const decoratedUrl = new URL(link.href);
		expect(decoratedUrl.searchParams.get("ajs_aid")).toBe("shared-identity");
		expect(decoratedUrl.searchParams.get("an_aid")).toBe("shared-identity");
	});
});

describe("ClickFunnels submission burst guard", () => {
	it("suppresses an identical formdata burst from the same form", () => {
		const shouldProcess = createSubmissionBurstGuard(1000);
		const form = {};
		const properties = {
			form_id: "_form_20_",
			page_path: "/live-1",
			email: "person@example.com",
			phone: "+1 202-555-0198",
		};

		expect(shouldProcess(form, "Form Submitted", properties, 10_000)).toBe(true);
		expect(shouldProcess(form, "Form Submitted", properties, 10_007)).toBe(false);
	});

	it("allows the same submission after the burst window", () => {
		const shouldProcess = createSubmissionBurstGuard(1000);
		const form = {};
		const properties = { form_id: "lead", email: "person@example.com" };

		expect(shouldProcess(form, "Form Submitted", properties, 10_000)).toBe(true);
		expect(shouldProcess(form, "Form Submitted", properties, 11_001)).toBe(true);
	});

	it("allows a changed payload or a different form during the window", () => {
		const shouldProcess = createSubmissionBurstGuard(1000);
		const firstForm = {};
		const secondForm = {};

		expect(shouldProcess(firstForm, "Form Submitted", { email: "first@example.com" }, 10_000)).toBe(true);
		expect(shouldProcess(firstForm, "Form Submitted", { email: "second@example.com" }, 10_007)).toBe(true);
		expect(shouldProcess(secondForm, "Form Submitted", { email: "first@example.com" }, 10_007)).toBe(true);
	});
});

describe("purchase event IDs", () => {
	it("reads the PaymentMethod ID from the ClickFunnels Stripe customer token field", () => {
		const formData = new FormData();
		formData.set("purchase[stripe_customer_token]", "pm_clickfunnels123");

		expect(getPaymentMethodId(formData)).toBe("pm_clickfunnels123");
	});

	it("reads the PaymentMethod ID from the Kajabi checkout field", () => {
		const formData = new FormData();
		formData.set("checkout_offer[payment_method_id]", "pm_kajabi123");

		expect(getPaymentMethodId(formData)).toBe("pm_kajabi123");
	});

	it("recognizes an unmapped one-click upsell without a product map", () => {
		const formData = new FormData();
		formData.set("upsell", "1");
		formData.set("purchase[product_id]", "future-product-id");

		expect(isOneClickUpsellSubmission(formData)).toBe(true);
	});

	it("uses a synchronous, standards-compatible SHA-256 hash", () => {
		expect(sha256Hex("abc")).toBe(
			"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
		);
	});

	it("normalizes browser and Stripe product-name representations to the same ID", () => {
		const browserEventId = createPurchaseEventId({
			email: " Person@Example.com ",
			productName: "VIP Basic Package (View Q&amp;A Only)",
			paymentMethodId: "pm_shared123",
			purchaseDate: "2026-07-22",
		});
		const stripeEventId = createPurchaseEventId({
			email: "person@example.com",
			productName: "vip  basic package (view q&a only)",
			paymentMethodId: "pm_shared123",
			purchaseDate: "2026-07-22",
		});

		expect(browserEventId).toBe(stripeEventId);
		expect(browserEventId).toMatch(/^purchase_[a-f0-9]{64}$/);
	});

	it("uses the Pacific date at the UTC date boundary", () => {
		expect(getPacificPurchaseDate("2026-07-22T06:59:59Z")).toBe("2026-07-21");
		expect(getPacificPurchaseDate("2026-07-22T07:00:00Z")).toBe("2026-07-22");
	});

	it("does not create a composite ID when a shared field is missing", () => {
		expect(createPurchaseEventId({
			email: "person@example.com",
			productName: "VIP Basic Package",
			paymentMethodId: "",
			purchaseDate: "2026-07-22",
		})).toBe("");
	});
});

describe("confirmed browser purchases", () => {
	it("matches exact confirmation routes and the Kajabi checkout pattern", () => {
		expect(matchesPurchaseRoute(POLL_ON_LOAD_ROUTES, {
			hostname: "keyboardrich.com",
			pathname: "/oto-2-page-1",
		})).toBe(true);
		expect(matchesPurchaseRoute(POLL_AFTER_SUBMIT_ROUTES, {
			hostname: "learn.boomingbookkeeping.com",
			pathname: "/offers/v3WtGzPH/checkout",
		})).toBe(true);
		expect(matchesPurchaseRoute(POLL_ON_LOAD_ROUTES, {
			hostname: "keyboardrich.com",
			pathname: "/unrelated-page",
		})).toBe(false);
	});

	it("registers only the small pending-attempt payload", async () => {
		const browser = createBrowserStub(
			"https://keyboardrich.com/free-1",
			"__eventn_id=anonymous-123",
		);
		browser.window.fetch = vi.fn(async () => jsonResponse({ ok: true }, 202));

		const registered = await registerPurchaseAttempt({
			anonymous_id: "ignored-copy",
			email: " Person@Example.com ",
			name: "Person Example",
			payment_method_id: "pm_checkout123",
			product_name: "Browser Product Name",
			submitted_at: "2026-07-25T12:34:56Z",
			value: 47,
		});
		const request = browser.window.fetch.mock.calls[0][1];
		const body = JSON.parse(request.body);

		expect(registered).toBe(true);
		expect(body).toEqual({
			anonymous_id: "anonymous-123",
			attempt: {
				email: "person@example.com",
				payment_method_id: "pm_checkout123",
				submitted_at: "2026-07-25T12:34:56Z",
			},
		});
	});

	it("fires Order Completed with the Stripe Charge ID in all ID fields", async () => {
		const browser = createBrowserStub(
			"https://keyboardrich.com/receipt-1",
			"__eventn_id=anonymous-123",
		);
		const jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		browser.window.jitsu = jitsu;
		browser.window.fetch = vi.fn(async () => jsonResponse({
			charges: [{
				charge_id: "ch_confirmed123",
				content_ids: [
					"keyboard rich book",
					"domestic shipping",
				],
				currency: "USD",
				email: "person@example.com",
				name: "Person Example",
				phone: "+15555550123",
				product_id: "keyboard rich book",
				product_name: "Keyboard Rich Book, Domestic Shipping",
				products: [
					{
						product_id: "keyboard rich book",
						product_name: "Keyboard Rich Book",
						quantity: 1,
					},
					{
						product_id: "domestic shipping",
						product_name: "Domestic Shipping",
						quantity: 1,
					},
				],
				value: 47,
			}],
			has_pending_attempts: true,
			retry_after_ms: 2500,
		}));

		expect(await pollForConfirmedPurchases()).toBe(true);
		expect(jitsu.track).toHaveBeenCalledWith(
			"Order Completed",
			expect.objectContaining({
				event_id: "purchase_ch_confirmed123",
				order_id: "ch_confirmed123",
				charge_id: "ch_confirmed123",
				is_payment_confirmed: true,
				payment_status: "succeeded",
				completion_basis: "stripe_charge_confirmed",
				content_ids: [
					"keyboard rich book",
					"domestic shipping",
				],
				fb_content_ids: [
					"keyboard rich book",
					"domestic shipping",
				],
				fb_contents: [
					{
						id: "keyboard rich book",
						quantity: 1,
						item_price: 23.5,
					},
					{
						id: "domestic shipping",
						quantity: 1,
						item_price: 23.5,
					},
				],
				product_name: "Keyboard Rich Book, Domestic Shipping",
				products: [
					expect.objectContaining({
						product_id: "keyboard rich book",
						product_name: "Keyboard Rich Book",
					}),
					expect.objectContaining({
						product_id: "domestic shipping",
						product_name: "Domestic Shipping",
					}),
				],
				value: 47,
				total: 47,
			}),
			expect.any(Object),
		);

		const dataLayerEvent = browser.window.dataLayer.find(
			(event: { event?: string }) => event.event === "Order Completed",
		);

		expect(dataLayerEvent.properties.fb_content_ids).toEqual([
			"keyboard rich book",
			"domestic shipping",
		]);
		expect(dataLayerEvent.properties.fb_contents).toEqual([
			{
				id: "keyboard rich book",
				quantity: 1,
				item_price: 23.5,
			},
			{
				id: "domestic shipping",
				quantity: 1,
				item_price: 23.5,
			},
		]);
		expect(dataLayerEvent.context.fb.contents).toEqual(
			dataLayerEvent.properties.fb_contents,
		);
	});
});

describe("Facebook conversion context", () => {
	it("uses normalized product names as automatic content IDs", () => {
		const context = buildFacebookContext("Order Completed", {
			product_name: "Keyboard Rich Book, Domestic Shipping",
			products: [
				{ product_name: " Keyboard Rich Book " },
				{ product_name: "VIP Basic Package (View Q&amp;A Only)" },
				{ product_name: "keyboard rich book" },
			],
			value: 54.95,
			currency: "USD",
		});

		expect(context).toEqual({
			content_ids: [
				"keyboard rich book",
				"vip basic package (view q&a only)",
			],
			content_name: "Keyboard Rich Book, Domestic Shipping",
			content_type: "product",
			value: 54.95,
			currency: "USD",
		});
	});

	it("uses confirmed Stripe content IDs without rebuilding them from product names", () => {
		const context = buildFacebookContext("Order Completed", {
			content_ids: [
				"booming bookkeeping mentorship program (3 payments of $1,997)",
			],
			product_name: "A different display name",
			products: [{ product_name: "A different display name" }],
			value: 1997,
			currency: "USD",
		});

		expect(context.content_ids).toEqual([
			"booming bookkeeping mentorship program (3 payments of $1,997)",
		]);
	});

	it("places the same fb context inside Jitsu and dataLayer events", () => {
		const browser = createBrowserStub("https://keyboardrich.com/free-1");
		const jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		browser.window.jitsu = jitsu;
		sendTrack("Order Completed", {
			event_id: "purchase_shared",
			product_name: "Keyboard Rich Book",
			products: [{ product_name: "Keyboard Rich Book" }],
			value: 7.95,
			currency: "USD",
		});

		const dataLayerEvent = browser.window.dataLayer[0];
		const jitsuOptions = jitsu.track.mock.calls[0][2];

		expect(dataLayerEvent.context.fb).toEqual({
			content_ids: ["keyboard rich book"],
			content_name: "Keyboard Rich Book",
			content_type: "product",
			value: 7.95,
			currency: "USD",
		});
		expect(jitsuOptions.context.fb).toEqual(dataLayerEvent.context.fb);
	});

	it("adds a content name to form submissions", () => {
		expect(buildFacebookContext("Form Submitted", {
			page_title: "Keyboard Rich Challenge Registration",
			form_name: "Registration",
		})).toEqual({
			content_name: "Keyboard Rich Challenge Registration",
		});
	});
});

describe("GA4 ecommerce dataLayer events", () => {
	it("adds purchase ecommerce fields to the existing Order Completed push", () => {
		const browser = createBrowserStub("https://keyboardrich.com/receipt-1");
		browser.window.jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		sendTrack("Order Completed", {
			event_id: "purchase_ch_ga4test",
			order_id: "ch_ga4test",
			charge_id: "ch_ga4test",
			value: 47,
			currency: "usd",
			products: [{
				product_id: "challenge-vip",
				product_name: "Challenge VIP",
				price: 47,
				quantity: 1,
			}],
		});

		expect(browser.window.dataLayer).toHaveLength(1);
		expect(browser.window.dataLayer[0]).toMatchObject({
			event: "Order Completed",
			event_id: "purchase_ch_ga4test",
			ga4_event: "purchase",
			ga4_event_type: "ecommerce",
			ecommerce: {
				transaction_id: "ch_ga4test",
				value: 47,
				currency: "USD",
				items: [{
					item_id: "challenge-vip",
					item_name: "Challenge VIP",
					price: 47,
					quantity: 1,
				}],
			},
		});
	});

	it("adds lead_source to the existing Form Submitted push", () => {
		const browser = createBrowserStub("https://keyboardrichchallenge.com/krc-1");
		browser.window.jitsu = {
			track: vi.fn(),
			getState: vi.fn(() => ({ context: { initialized: true } })),
			on: vi.fn(),
		};

		sendTrack("Form Submitted", {
			event_id: "form_submission_ga4test",
			form_id: "_form_20_",
			lead_source: "krc",
			registration_type: "krc",
		});

		expect(browser.window.dataLayer).toHaveLength(1);
		expect(browser.window.dataLayer[0]).toMatchObject({
			event: "Form Submitted",
			event_id: "form_submission_ga4test",
			ga4_event: "generate_lead",
			ga4_event_type: "standard_event",
			ga4_properties: {
				lead_source: "krc",
			},
		});
		expect(browser.window.dataLayer[0].ecommerce).toBeUndefined();
		expect(browser.window.dataLayer[0].standard_event).toBeUndefined();
	});
});

describe("form submission event IDs", () => {
	it("normalizes email before creating the ID", () => {
		const browserEventId = createFormSubmissionEventId({
			email: " Person@Example.com ",
			registrationType: "KRC",
			submissionDate: "2026-07-22",
		});
		const serverEventId = createFormSubmissionEventId({
			email: "person@example.com",
			registrationType: "krc",
			submissionDate: "2026-07-22",
		});

		expect(browserEventId).toBe(serverEventId);
		expect(browserEventId).toMatch(/^form_submission_[a-f0-9]{64}$/);
	});

	it("separates different registration types on the same day", () => {
		const challengeEventId = createFormSubmissionEventId({
			email: "person@example.com",
			registrationType: "krc",
			submissionDate: "2026-07-22",
		});
		const webinarEventId = createFormSubmissionEventId({
			email: "person@example.com",
			registrationType: "webinar",
			submissionDate: "2026-07-22",
		});

		expect(challengeEventId).not.toBe(webinarEventId);
	});

	it("uses the Pacific registration date", () => {
		expect(getPacificEventDate("2026-07-22T06:59:59Z")).toBe("2026-07-21");
		expect(getPacificEventDate("2026-07-22T07:00:00Z")).toBe("2026-07-22");
	});

	it("does not create an ID without an email", () => {
		expect(createFormSubmissionEventId({
			email: "",
			registrationType: "krc",
			submissionDate: "2026-07-22",
		})).toBe("");
	});

	it("does not create an ID without a registration type", () => {
		expect(createFormSubmissionEventId({
			email: "person@example.com",
			submissionDate: "2026-07-22",
		})).toBe("");
	});
});

describe("ActiveCampaign registration form mapping", () => {
	function createForm(activeCampaignFormId: string) {
		return {
			getAttribute(name: string) {
				if (name === "id") return `_form_${activeCampaignFormId}_`;
				return "";
			},
			querySelector(selector: string) {
				if (selector === 'input[name="f"]') {
					return { value: activeCampaignFormId };
				}
				return null;
			},
		};
	}

	it("maps ActiveCampaign form 20 to KRC", () => {
		const form = createForm("20");

		expect(getActiveCampaignFormId(form)).toBe("20");
		expect(getRegistrationForm(form)?.registrationType).toBe("krc");
	});

	it("maps ActiveCampaign form 15 to webinar", () => {
		const form = createForm("15");

		expect(getActiveCampaignFormId(form)).toBe("15");
		expect(getRegistrationForm(form)?.registrationType).toBe("webinar");
	});

});

describe("ActiveCampaign honeypot protection", () => {
	function createField(value: string) {
		return {
			value,
			setAttribute: vi.fn(),
			dispatchEvent: vi.fn(),
		};
	}

	it("clears tracking identities without firing persistence events", () => {
		const currentId = "19b2c927-d8ef-4b14-9e6a-b01c043a2b1c";
		const legacyId = "e3a5de96-fc72-4e52-9162-5a7d5bd45138";
		const segmentField = createField(currentId);
		const activeCampaignIdentityField = createField(currentId);
		const honeypotField = createField(legacyId);
		const activeCampaignHoneypotField = createField(legacyId);

		vi.stubGlobal("window", {});
		vi.stubGlobal("document", {
			cookie: `ajs_anonymous_id=%22${legacyId}%22`,
			querySelectorAll(selector: string) {
				if (selector.includes('data-custom-type="segment_anonymous_id"')) {
					return [segmentField];
				}
				if (selector.includes('data-custom-type="hpcheck"')) {
					return [honeypotField];
				}
				if (selector.includes("field[39]")) {
					return [activeCampaignIdentityField];
				}
				if (selector.includes("field[31]")) {
					return [activeCampaignHoneypotField];
				}
				return [];
			},
		});

		expect(clearTrackingIdsFromHoneypot(currentId)).toBe(true);
		expect(honeypotField.value).toBe("");
		expect(activeCampaignHoneypotField.value).toBe("");
		expect(honeypotField.dispatchEvent).not.toHaveBeenCalled();
		expect(activeCampaignHoneypotField.dispatchEvent).not.toHaveBeenCalled();
		expect(segmentField.value).toBe(currentId);
		expect(activeCampaignIdentityField.value).toBe(currentId);
	});

	it("does not clear an unrelated honeypot value", () => {
		const currentId = "19b2c927-d8ef-4b14-9e6a-b01c043a2b1c";
		const honeypotField = createField("bot-filled-this-field");

		vi.stubGlobal("window", {});
		vi.stubGlobal("document", {
			cookie: "",
			querySelectorAll(selector: string) {
				if (selector.includes('data-custom-type="hpcheck"')) {
					return [honeypotField];
				}
				return [];
			},
		});

		expect(clearTrackingIdsFromHoneypot(currentId)).toBe(false);
		expect(honeypotField.value).toBe("bot-filled-this-field");
	});

	it("removes only the shared ClickFunnels custom-type Garlic key", () => {
		const values = new Map([
			["garlic:thebookkeepingchallenge.com*>input.custom_type", "anonymous-id"],
			["garlic:thebookkeepingchallenge.com*>input.email", "lead@example.com"],
			["unrelated", "keep-me"],
		]);
		const localStorage = {
			get length() {
				return values.size;
			},
			key(index: number) {
				return [...values.keys()][index] ?? null;
			},
			removeItem(key: string) {
				values.delete(key);
			},
		};

		vi.stubGlobal("window", { localStorage });

		purgeClickFunnelsCustomTypeGarlicState();

		expect(values.has("garlic:thebookkeepingchallenge.com*>input.custom_type")).toBe(false);
		expect(values.get("garlic:thebookkeepingchallenge.com*>input.email")).toBe("lead@example.com");
		expect(values.get("unrelated")).toBe("keep-me");
	});
});

describe("Kajabi checkout capture", () => {
	it("binds the finalized formdata event instead of the premature submit event", () => {
		const formAttributes: Record<string, string> = {};
		const form = {
			id: "new_checkout_offer",
			nodeType: 1,
			tagName: "FORM",
			classList: { contains: () => false },
			addEventListener: vi.fn(),
			getAttribute(name: string) {
				return formAttributes[name] ?? "";
			},
			setAttribute(name: string, value: string) {
				formAttributes[name] = value;
			},
			querySelector: vi.fn(() => null),
		};
		const documentStub = {
			body: {},
			addEventListener: vi.fn(),
			querySelectorAll: vi.fn(() => [form]),
		};
		const observe = vi.fn();

		vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
		vi.stubGlobal("document", documentStub);
		vi.stubGlobal("MutationObserver", vi.fn(() => ({ observe })));

		bindFormSubmitTracking();

		expect(form.addEventListener).toHaveBeenCalledWith("formdata", expect.any(Function));
		expect(documentStub.addEventListener).not.toHaveBeenCalledWith(
			"submit",
			expect.any(Function),
			true,
		);
		expect(observe).toHaveBeenCalledWith(documentStub.body, { childList: true, subtree: true });
	});
});
