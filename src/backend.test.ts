import assert from "node:assert/strict";
import { describe, test } from "node:test";
import backend from "./backend.ts";

const LIMIT = 16 * 1024 * 1024;
const env = {
	BONOBO: {
		host: { apiOrigin: "https://host.example", token: "test-run-token" },
		secrets: { get: async () => null },
	},
};
const encoder = new TextEncoder();

function invoke(caseName: string, runId = "run_123") {
	return backend.fetch(
		new Request("https://plugin.local/probe", {
			method: "POST",
			body: JSON.stringify({
				pluginRunId: runId,
				event: "ui.invoke.requested",
				invoke: { input: { case: caseName } },
			}),
		}),
		env,
	);
}

function upload(name: string, contentType = "image/png") {
	return backend.fetch(
		new Request("https://plugin.local/__bonobo_senate/run", {
			method: "POST",
			body: JSON.stringify({
				pluginRunId: "upload_run",
				event: "files.upload.completed",
				source: { name, contentType },
			}),
		}),
		env,
	);
}

describe("probe replies", () => {
	for (const status of [200, 400, 409, 500]) {
		test(`keeps JSON HTTP ${status}`, async () => {
			const response = await invoke(`json-${status}`);
			assert.equal(response.status, status);
			assert.deepEqual(await response.json(), {
				message: `Probe answered HTTP ${status}`,
			});
		});
	}
	test("returns a truly empty 204", async () => {
		const response = await invoke("empty-204");
		assert.equal(response.status, 204);
		assert.equal(response.body, null);
	});
	for (const runId of ["run_123", `run-\"\\${"x".repeat(115)}`]) {
		for (const caseName of ["exact-cap", "one-byte-over", "escaped-unicode"]) {
			test(`${caseName} includes a ${runId.length}-character run ID and all JSON escaping`, async () => {
				const response = await invoke(caseName, runId);
				const output = await response.text();
				assert.ok(encoder.encode(output).byteLength < LIMIT);
				const bytes = encoder.encode(
					JSON.stringify({ runId, pluginStatus: response.status, output }),
				).byteLength;
				assert.equal(bytes, LIMIT + (caseName === "one-byte-over" ? 1 : 0));
				if (caseName === "escaped-unicode")
					assert.ok(output.startsWith('\n\\"🦊'));
			});
		}
	}
	test("generates one byte over the raw cap", async () => {
		assert.equal(
			(await (await invoke("raw-over")).arrayBuffer()).byteLength,
			LIMIT + 1,
		);
	});
	test("delivers one-byte chunks without changing Unicode", async () => {
		const response = await invoke("tiny-chunks");
		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		let text = "";
		let chunks = 0;
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			assert.equal(next.value.byteLength, 1);
			text += decoder.decode(next.value, { stream: true });
			chunks++;
		}
		text += decoder.decode();
		assert.equal(text, `Tiny chunks: ${'🦊\n\\"'.repeat(256)}`);
		assert.equal(chunks, encoder.encode(text).byteLength);
	});
	test("fails a response stream after a prefix", async () => {
		await assert.rejects(
			(await invoke("broken-stream")).text(),
			/Probe stream failed/,
		);
	});
	test("keeps a stalled read pending past the invoke deadline and cancels its timer", async (context) => {
		context.mock.timers.enable({ apis: ["setTimeout"] });
		const timeout = context.mock.method(globalThis, "setTimeout");
		const clear = context.mock.method(globalThis, "clearTimeout");
		const reader = (await invoke("stalled-stream")).body!.getReader();
		assert.equal(
			new TextDecoder().decode((await reader.read()).value),
			"waiting",
		);
		let settled = false;
		const pending = reader.read().then((value) => {
			settled = true;
			return value;
		});
		assert.equal(timeout.mock.callCount(), 1);
		assert.equal(timeout.mock.calls[0]!.arguments[1], 60_000);
		context.mock.timers.tick(35_001);
		await Promise.resolve();
		assert.equal(settled, false);
		await reader.cancel();
		assert.equal((await pending).done, true);
		assert.equal(clear.mock.callCount(), 1);
		assert.equal(
			clear.mock.calls[0]!.arguments[0],
			timeout.mock.calls[0]!.result,
		);
	});
	test("finishes the stalled response when its real delay expires", async (context) => {
		context.mock.timers.enable({ apis: ["setTimeout"] });
		const timeout = context.mock.method(globalThis, "setTimeout");
		const reader = (await invoke("stalled-stream")).body!.getReader();
		await reader.read();
		assert.equal(timeout.mock.callCount(), 1);
		const pending = reader.read();
		context.mock.timers.tick(60_000);
		assert.equal((await pending).done, true);
	});
	test("refuses unknown cases", async () => {
		assert.equal((await invoke("not-a-case")).status, 400);
	});
});

describe("saved probe documents", () => {
	for (const caseName of [
		"write-500",
		"write-throw",
		"upload-write",
		"upload-noop",
		"wrong-content-type",
	]) {
		test(caseName, async (context) => {
			const writes: {
				url: string;
				body: unknown;
				authorization: string | null;
				redirect?: RequestRedirect;
			}[] = [];
			context.mock.method(
				globalThis,
				"fetch",
				async (url: string | URL | Request, init?: RequestInit) => {
					writes.push({
						url: String(url),
						body: JSON.parse(String(init?.body)),
						authorization: new Headers(init?.headers).get("Authorization"),
						redirect: init?.redirect,
					});
					return Response.json({ revision: 1, byteSize: 100 });
				},
			);
			if (caseName === "write-throw")
				await assert.rejects(invoke(caseName), /threw after saving/);
			else if (caseName === "write-500")
				assert.equal((await invoke(caseName)).status, 500);
			else if (caseName === "wrong-content-type")
				assert.equal((await upload("test.jpg", "image/jpeg")).status, 400);
			else
				assert.equal(
					(
						await upload(
							caseName === "upload-noop" ? "noop-test.png" : "probe-test.png",
						)
					).status,
					204,
				);
			if (caseName === "upload-noop" || caseName === "wrong-content-type")
				assert.deepEqual(writes, []);
			else {
				assert.equal(writes.length, 1);
				const write = writes[0]!;
				assert.equal(
					write.url,
					"https://host.example/api/v1/plugin-data/write",
				);
				assert.equal(write.authorization, "Bearer test-run-token");
				assert.equal(write.redirect, "manual");
				const runId = caseName === "upload-write" ? "upload_run" : "run_123";
				assert.deepEqual(write.body, {
					collection: "response_probes",
					key: `qa-${runId}`,
					value: {
						case: caseName,
						runId,
						recordedAt: (write.body as { value: { recordedAt: string } }).value
							.recordedAt,
					},
				});
			}
		});
	}
	for (const status of [301, 302, 303, 307, 308]) {
		test(`refuses HTTP ${status} without following its location`, async (context) => {
			const response = new Response("Moved", {
				status,
				headers: { Location: "https://outside.example/blocked" },
			});
			const fetch = context.mock.method(
				globalThis,
				"fetch",
				async (url: string | URL | Request, init?: RequestInit) => {
					const request = new Request(url, init);
					assert.equal(
						request.url,
						"https://host.example/api/v1/plugin-data/write",
					);
					assert.equal(request.redirect, "manual");
					return response;
				},
			);
			await assert.rejects(invoke("write-500"), {
				message: `Probe document write refused with HTTP ${status}`,
			});
			assert.equal(fetch.mock.callCount(), 1);
			assert.equal(response.bodyUsed, true);
		});
	}
});
