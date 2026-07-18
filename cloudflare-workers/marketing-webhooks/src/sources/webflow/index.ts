/**
 * Webflow marketing source.
 */

import type { MarketingSource, TopicHandler } from "../base";
import { formSubmissionHandler } from "./handlers";

export * from "./types";
export * from "./extractors";

const handlers = new Map<string, TopicHandler<unknown>>([
	["form_submission", formSubmissionHandler],
]);

export const webflowSource: MarketingSource = {
	name: "webflow",

	handlers,

	extractTopic(_headers: Record<string, string>, payload?: unknown): string | null {
		if (!payload || typeof payload !== "object") return null;

		const triggerType = (payload as Record<string, unknown>).triggerType;
		if (typeof triggerType !== "string" || triggerType.length === 0) {
			return null;
		}

		return triggerType;
	},
};
