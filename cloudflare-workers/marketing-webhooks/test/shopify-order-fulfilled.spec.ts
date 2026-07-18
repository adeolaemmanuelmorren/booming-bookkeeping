import { describe, it, expect } from "vitest";
import { orderFulfilledHandler } from "../src/sources/shopify/handlers/order-fulfilled";

describe("Shopify orders/fulfilled handler", () => {
	it("transforms a valid order payload to Order Fulfilled events", () => {
		const payload = {
			id: 123,
			order_number: 1001,
			name: "#1001",
			email: "test@example.com",
			currency: "USD",
			total_price: "19.99",
			subtotal_price: "19.99",
			total_tax: "0.00",
			total_discounts: "0.00",
			created_at: "2026-02-01T00:00:00Z",
			updated_at: "2026-02-01T01:00:00Z",
			note_attributes: [
				{ name: "_fbc", value: "fb.1.test" },
				{ name: "utm_source", value: "newsletter" },
			],
			line_items: [
				{
					id: 1,
					product_id: 111,
					variant_id: 222,
					title: "Test Product",
					quantity: 1,
					price: "19.99",
					sku: "SKU-1",
					variant_title: "Default",
					vendor: "TestBrand",
					properties: [
						{ name: "ajs_anonymous_id", value: "anon-123" },
						{ name: "_fbp", value: "fbp.1.test" },
						{ name: "ttclid", value: "ttclid-test" },
					],
				},
			],
			discount_codes: [{ code: "TEST", amount: "0.00", type: "percentage" }],
		};

		const validation = orderFulfilledHandler.validate(payload);
		expect(validation.valid).toBe(true);
		expect(validation.data).toBeTruthy();

		const events = orderFulfilledHandler.transform(payload as any);
		expect(events.length).toBe(2);

		const track = events.find((e) => e.type === "track") as any;
		expect(track).toBeTruthy();
		expect(track.event).toBe("Order Fulfilled");
		expect(track.anonymousId).toBe("anon-123");
		expect(track.properties.order_id).toBe("1001");
		expect(track.properties.products[0].product_id).toBe("111");
		expect(track.properties.products[0].name).toBe("Test Product");
		expect(track.context.attribution).toMatchObject({
			fbc: "fb.1.test",
			utm_source: "newsletter",
			fbp: "fbp.1.test",
			ttclid: "ttclid-test",
		});
		expect(track.context.attribution.google_api_compliant.email).toBe("test@example.com");
		expect(track.context.traits.email).toBe("test@example.com");
	});
});
