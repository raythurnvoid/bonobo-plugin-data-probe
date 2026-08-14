/**
 * Data Probe backend.
 *
 * Runs when an upload finishes and records one plugin-data document about that upload. The plugin's
 * page reads the same collection back, so one round trip through the plugin data store is visible
 * inside the app. The plugin does nothing else on purpose: it exists to prove the store works.
 */

/** Collection the backend writes and the page reads. Both sides must use the same name. */
const COLLECTION = "uploads";

/** @param {unknown} body */
function json(body, status = 200) {
	return Response.json(body, { status });
}

/**
 * POSTs JSON to one of the public Bonobo host APIs and returns the parsed response body.
 *
 * @param {import("bonobo-plugin-sdk").BonoboEnv} env
 * @param {string} path
 * @param {unknown} body
 */
async function hostFetch(env, path, body) {
	const response = await fetch(`${env.BONOBO.host.apiOrigin}${path}`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.BONOBO.host.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	const text = await response.text();
	if (!response.ok) {
		// Keep the host's own message. A refused capability and a bad body both answer with one, and
		// without it the run only says which route failed.
		throw new Error(`Host API ${path} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
	}
	return text ? JSON.parse(text) : null;
}

/** @type {import("bonobo-plugin-sdk").BonoboPluginHandler} */
export default {
	async fetch(request, env) {
		const event = await request.json().catch(() => null);
		const source = event && typeof event === "object" ? event.source : null;
		if (!source || typeof source.fileNodeId !== "string" || typeof source.path !== "string") {
			return json({ error: "Upload source is missing" }, 400);
		}

		// Key by the uploaded file's node id. Re-running on the same file then overwrites that file's
		// own document instead of adding a second one.
		await hostFetch(env, "/api/v1/plugin-data/write", {
			collection: COLLECTION,
			key: source.fileNodeId,
			value: {
				name: typeof source.name === "string" ? source.name : source.path,
				path: source.path,
				contentType: typeof source.contentType === "string" ? source.contentType : null,
				recordedAt: new Date().toISOString(),
			},
		});

		return json({ ok: true, collection: COLLECTION, key: source.fileNodeId });
	},
};
