import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		deps: {
			optimizer: {
				ssr: {
					enabled: true,
					include: ["@segment/edge-sdk", "uuid"],
				},
			},
		},
		poolOptions: {
			workers: {
				wrangler: { configPath: "./wrangler.jsonc" },
			},
		},
	},
});
