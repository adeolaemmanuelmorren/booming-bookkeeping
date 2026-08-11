export type StripeAccount = 'main' | 'kajabi';

export type PurchaseAttemptInput = {
	email: string;
	paymentMethodId: string;
	stripeAccount: StripeAccount;
	submittedAt: number;
};

export type ConfirmedProduct = {
	contentId: string;
	name: string;
	price?: number;
	quantity: number;
	stripePlanId?: string;
	stripePriceId?: string;
	stripeProductId?: string;
};

export type ConfirmedAddress = {
	city: string;
	country: string;
	postalCode: string;
	region: string;
	street: string;
};

export type ConfirmedPurchase = {
	address: ConfirmedAddress;
	chargeId: string;
	contentIds: string[];
	currency: string;
	email: string;
	name: string;
	phone: string;
	productId: string;
	productName: string;
	products: ConfirmedProduct[];
	stripeAccount: StripeAccount;
	value: number;
};

export type PurchasePollResult = {
	charges: ConfirmedPurchase[];
	hasPendingAttempts: boolean;
	retryAfterMs: number;
};

export interface PurchaseEnv {
	STRIPE_SECRET_KEY: string;
	STRIPE_KAJABI_SECRET_KEY: string;
}
