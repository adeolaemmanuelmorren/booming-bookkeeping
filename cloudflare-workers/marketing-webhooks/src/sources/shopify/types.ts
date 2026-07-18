/**
 * Shopify webhook payload types
 */

/**
 * Shopify money amount
 */
export interface ShopifyMoney {
	amount: string;
	currency_code: string;
}

/**
 * Shopify address
 */
export interface ShopifyAddress {
	first_name?: string;
	last_name?: string;
	address1?: string;
	address2?: string;
	city?: string;
	province?: string;
	province_code?: string;
	country?: string;
	country_code?: string;
	zip?: string;
	phone?: string;
	company?: string;
}

/**
 * Shopify customer
 */
export interface ShopifyCustomer {
	id: number;
	email?: string;
	first_name?: string;
	last_name?: string;
	phone?: string;
	orders_count?: number;
	total_spent?: string;
	created_at?: string;
	updated_at?: string;
	default_address?: ShopifyAddress;
	accepts_marketing?: boolean;
	marketing_opt_in_level?: string;
}

/**
 * Shopify line item (product in cart/order)
 */
export interface ShopifyLineItem {
	id: number;
	product_id: number;
	variant_id: number;
	title: string;
	variant_title?: string;
	sku?: string;
	quantity: number;
	price: string;
	total_discount?: string;
	fulfillment_status?: string;
	vendor?: string;
	properties?: Array<{ name: string; value: string }>;
}

/**
 * Shopify discount application
 */
export interface ShopifyDiscountApplication {
	type: string;
	title?: string;
	description?: string;
	value: string;
	value_type: "fixed_amount" | "percentage";
	allocation_method?: string;
	target_selection?: string;
	target_type?: string;
	code?: string;
}

/**
 * Shopify discount code
 */
export interface ShopifyDiscountCode {
	code: string;
	amount: string;
	type: string;
}

/**
 * Base checkout payload (checkouts/create, checkouts/update)
 */
export interface ShopifyCheckoutPayload {
	id: number;
	token: string;
	cart_token?: string;
	email?: string;
	phone?: string;
	customer?: ShopifyCustomer;
	line_items: ShopifyLineItem[];
	billing_address?: ShopifyAddress;
	shipping_address?: ShopifyAddress;
	subtotal_price: string;
	total_price: string;
	total_tax?: string;
	total_discounts?: string;
	total_line_items_price?: string;
	currency: string;
	presentment_currency?: string;
	discount_codes?: ShopifyDiscountCode[];
	discount_applications?: ShopifyDiscountApplication[];
	created_at: string;
	updated_at: string;
	completed_at?: string;
	abandoned_checkout_url?: string;
	landing_site?: string;
	referring_site?: string;
	source_name?: string;
	note?: string;
	note_attributes?: Array<{ name: string; value: string }>;
}

/**
 * Shopify transaction
 */
export interface ShopifyTransaction {
	id: number;
	kind: string;
	gateway: string;
	status: string;
	amount: string;
	currency: string;
	payment_details?: {
		credit_card_bin?: string;
		credit_card_company?: string;
		credit_card_number?: string;
	};
}

/**
 * Shopify shipping line
 */
export interface ShopifyShippingLine {
	id: number;
	title: string;
	price: string;
	code?: string;
	source?: string;
}

/**
 * Order payload (orders/create, orders/paid, orders/fulfilled)
 */
export interface ShopifyOrderPayload {
	id: number;
	order_number: number;
	name: string;
	email?: string;
	phone?: string;
	customer?: ShopifyCustomer;
	line_items: ShopifyLineItem[];
	billing_address?: ShopifyAddress;
	shipping_address?: ShopifyAddress;
	subtotal_price: string;
	total_price: string;
	total_tax?: string;
	total_discounts?: string;
	total_shipping_price_set?: {
		shop_money: ShopifyMoney;
		presentment_money: ShopifyMoney;
	};
	currency: string;
	presentment_currency?: string;
	financial_status?: string;
	fulfillment_status?: string | null;
	discount_codes?: ShopifyDiscountCode[];
	discount_applications?: ShopifyDiscountApplication[];
	transactions?: ShopifyTransaction[];
	shipping_lines?: ShopifyShippingLine[];
	created_at: string;
	updated_at: string;
	processed_at?: string;
	cancelled_at?: string | null;
	closed_at?: string | null;
	landing_site?: string;
	referring_site?: string;
	source_name?: string;
	note?: string;
	note_attributes?: Array<{ name: string; value: string }>;
	tags?: string;
	checkout_token?: string;
	cart_token?: string;
}

/**
 * Customer payload (customers/create, customers/update)
 */
export interface ShopifyCustomerPayload extends ShopifyCustomer {
	addresses?: ShopifyAddress[];
	tags?: string;
	note?: string;
	verified_email?: boolean;
	tax_exempt?: boolean;
}

/**
 * Shopify Admin API product response
 */
export interface ShopifyAdminProduct {
	id: number;
	title: string;
	handle: string;
	image?: {
		id: number;
		src: string;
		alt?: string;
	};
	images?: Array<{
		id: number;
		src: string;
		alt?: string;
		variant_ids?: number[];
	}>;
}

/**
 * Shopify Admin API customer response (for order count)
 */
export interface ShopifyAdminCustomer {
	id: number;
	email?: string;
	orders_count: number;
	total_spent: string;
}

/**
 * Union type for all supported Shopify payloads
 */
export type ShopifyPayload =
	| ShopifyCheckoutPayload
	| ShopifyOrderPayload
	| ShopifyCustomerPayload;
