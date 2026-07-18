import { describe, it, expect } from "vitest";
import { formSubmissionHandler } from "../src/sources/webflow/handlers";
import { webflowSource } from "../src/sources/webflow";

const samplePayload = {
	triggerType: "form_submission",
	payload: {
		name: "Email Form Footer",
		siteId: "69dbe58bb250e502897dee77",
		data: {
			Email: "adeolamorren@gmail.com",
			Phone: "+15551234567",
			"First Name": "Adeola",
			"Last Name": "Morren",
			Company: "CueTime",
			utm_source: "adeola",
			utm_medium: "",
			utm_campaign: "",
			utm_term: "",
			utm_content: "",
			utm_id: "",
			gclid: "",
			fbclid: "adeola",
			gbraid: "",
			wbraid: "",
			twclid: "",
			ttclid: "",
			rdt_cid: "",
			li_fat_id: "",
			msclkid: "",
			_fbc: "fb.2.1778292941489.adeola.AQYCAQMA",
			_fbp: "fb.2.1778012454098.648590367374456416.AQYCAQMA",
			_uetvid: "",
			_uetsid: "",
			_ttp: "01KQWWSZE979VWAV3AHSPPE2F4_.tt.2",
			_ttclid: "",
			_rdt_uuid: "",
			ajs_anonymous_id: "fbaf8348-f6d9-43f4-8188-d41d296d35c4",
			ct_form_submission_id: "ct-form-submit-123",
		},
		submittedAt: "2026-05-09T02:15:47.854Z",
		id: "69fe98d31e6b0587db80b811",
		formId: "69f1baf2695b74f8fa62b6be",
		formElementId: "4b7ff0ff-e040-5746-0c1c-f03be4ee996a",
		pageId: "69dbe58eb250e502897deee4",
		publishedPath: "/",
		pageUrl: "https://cuetime.webflow.io/?utm_source=adeola&fbclid=adeola",
		schema: [],
	},
};

describe("Webflow form_submission handler", () => {
	it("extracts the topic from triggerType", () => {
		const topic = webflowSource.extractTopic?.({}, samplePayload);

		expect(topic).toBe("form_submission");
	});

	it("transforms a form submission to identify and track events", () => {
		const validation = formSubmissionHandler.validate(samplePayload);
		expect(validation.valid).toBe(true);

		const events = formSubmissionHandler.transform(samplePayload as any);
		expect(events.length).toBe(2);

		const identify = events.find((event) => event.type === "identify") as any;
		expect(identify.userId).toBe("adeolamorren@gmail.com");
		expect(identify.anonymousId).toBe("fbaf8348-f6d9-43f4-8188-d41d296d35c4");
		expect(identify.traits.email).toBe("adeolamorren@gmail.com");
		expect(identify.traits.first_name).toBe("Adeola");
		expect(identify.traits.last_name).toBe("Morren");
		expect(identify.context.attribution.utm_source).toBe("adeola");
		expect(identify.context.attribution.fbc).toBe("fb.2.1778292941489.adeola.AQYCAQMA");
		expect(identify.context.attribution.google_api_compliant).toEqual({
			gclid: null,
			wbraid: null,
			gbraid: null,
			email: "adeolamorren@gmail.com",
			phone: "+15551234567",
			first_name: "Adeola",
			last_name: "Morren",
		});

		const track = events.find((event) => event.type === "track") as any;
		expect(track.event).toBe("Form Submitted");
		expect(track.userId).toBe("adeolamorren@gmail.com");
		expect(track.properties.form_name).toBe("Email Form Footer");
		expect(track.properties.email).toBe("adeolamorren@gmail.com");
		expect(track.properties.phone).toBe("+15551234567");
		expect(track.properties.first_name).toBe("Adeola");
		expect(track.properties.last_name).toBe("Morren");
		expect(track.properties.event_id).toBe("ajs_formsubmitted_ctformsubmit123");
		expect(track.properties.extra_submitted_fields.company).toBe("CueTime");
		expect(track.properties.extra_submitted_fields.Email).toBeUndefined();
		expect(track.properties.extra_submitted_fields.ct_form_submission_id).toBeUndefined();
		expect(track.properties.submitted_fields).toBeUndefined();
		expect(track.context.page.path).toBe("/");
		expect(track.context.traits).toEqual({
			email: "adeolamorren@gmail.com",
			phone: "+15551234567",
			first_name: "Adeola",
			last_name: "Morren",
		});
	});
});
