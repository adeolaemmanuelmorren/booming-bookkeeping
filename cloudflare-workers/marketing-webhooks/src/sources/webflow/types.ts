/**
 * Webflow webhook payload types.
 */

export interface WebflowFormSubmissionPayload {
	triggerType: "form_submission";
	payload: {
		name: string;
		siteId: string;
		data: Record<string, unknown>;
		submittedAt: string;
		id: string;
		formId?: string;
		formElementId?: string;
		pageId?: string;
		publishedPath?: string;
		pageUrl?: string;
		schema?: unknown[];
	};
}
