/**
 * ActiveCampaign webhook and API contracts used by this Worker.
 */

export interface ActiveCampaignWebhookContact {
	id: string;
	email?: string;
	first_name?: string;
	last_name?: string;
	phone?: string;
	ip?: string;
	tags?: string;
	orgname?: string;
	fields: Record<string, string>;
}

export interface ActiveCampaignContactTagAddedPayload {
	type: "contact_tag_added";
	date_time: string;
	initiated_from: string;
	initiated_by: string;
	list: string;
	tag: string;
	contact: ActiveCampaignWebhookContact;
}

export interface ActiveCampaignApiContact {
	id: string;
	email?: string;
	phone?: string;
	firstName?: string;
	lastName?: string;
	orgid?: string;
	orgname?: string;
	segmentio_id?: string;
	cdate?: string;
	udate?: string;
	adate?: string;
	created_utc_timestamp?: string;
	updated_utc_timestamp?: string;
}
