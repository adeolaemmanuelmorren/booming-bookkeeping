function getObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

function getString(value: unknown): string | null {
	if (value === null || value === undefined) return null;

	const stringValue = String(value).trim();
	if (!stringValue) return null;

	return stringValue;
}

function firstString(...values: unknown[]): string | null {
	for (const value of values) {
		const stringValue = getString(value);
		if (stringValue) return stringValue;
	}

	return null;
}

export function buildGoogleApiCompliantAttribution(
	attribution: Record<string, unknown>,
	identity: Record<string, unknown>
): Record<string, string | null> {
	const address = getObject(identity.address);
	const gclid = firstString(attribution.gclid);
	const wbraid = gclid ? null : firstString(attribution.wbraid);
	const gbraid = gclid || wbraid ? null : firstString(attribution.gbraid);
	const canIncludeIdentity = Boolean(gclid) || (!wbraid && !gbraid);

	return {
		gclid,
		wbraid,
		gbraid,
		email: canIncludeIdentity ? firstString(identity.email) : null,
		phone: canIncludeIdentity ? firstString(identity.phone, identity.phone_number) : null,
		first_name: canIncludeIdentity
			? firstString(identity.first_name, identity.firstName, address.first_name, address.firstName)
			: null,
		last_name: canIncludeIdentity
			? firstString(identity.last_name, identity.lastName, address.last_name, address.lastName)
			: null,
	};
}

export function addGoogleApiCompliantAttribution(
	attribution: Record<string, unknown>,
	identity: Record<string, unknown>
): Record<string, unknown> {
	return {
		...attribution,
		google_api_compliant: buildGoogleApiCompliantAttribution(attribution, identity),
	};
}
