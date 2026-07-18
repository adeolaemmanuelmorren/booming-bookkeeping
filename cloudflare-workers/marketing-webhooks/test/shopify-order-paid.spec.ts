import { describe, it, expect } from "vitest";
import { orderPaidHandler } from "../src/sources/shopify/handlers/order-paid";

describe("Shopify orders/paid handler", () => {
	it("sets Order Completed event_id from order_id", () => {
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
			processed_at: "2026-02-01T00:05:00Z",
			phone: "+15551234567",
			billing_address: {
				first_name: "Adeola",
				last_name: "Morren",
			},
			note_attributes: [
				{ name: "gclid", value: "gclid-test" },
				{ name: "wbraid", value: "wbraid-test" },
			],
			line_items: [
				{
					id: 1,
					product_id: 111,
					variant_id: 222,
					title: "Test Product",
					quantity: 1,
					price: "19.99",
				},
			],
		};

		const validation = orderPaidHandler.validate(payload);
		expect(validation.valid).toBe(true);

		const events = orderPaidHandler.transform(payload as any);
		const track = events.find((event) => event.type === "track") as any;

		expect(track.event).toBe("Order Completed");
		expect(track.properties.order_id).toBe("1001");
		expect(track.properties.event_id).toBe("ajs_ordercompleted_1001");
		expect(track.context.attribution.google_api_compliant).toEqual({
			gclid: "gclid-test",
			wbraid: null,
			gbraid: null,
			email: "test@example.com",
			phone: "+15551234567",
			first_name: "Adeola",
			last_name: "Morren",
		});
	});
});
