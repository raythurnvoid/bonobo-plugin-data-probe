import assert from "node:assert/strict";
import { describe, test, type TestContext } from "node:test";
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

const kvSettings = {
	case: "kv-read-only",
	seedKey: "qa-seed-run",
	deniedFile: "/denied/note.txt",
};
const filesSettings = {
	case: "files-read",
	allowedFolder: "/allowed",
	allowedFile: "/allowed/note.txt",
	allowedFileSha256:
		"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
	deniedFolder: "/denied",
	deniedFile: "/denied/note.txt",
};

function scheduled(
	diagnostic: unknown,
	chain: unknown = { rootRunId: "scheduled_run", index: 0, state: null },
) {
	return backend.fetch(
		new Request("https://plugin.local/__bonobo_senate/run", {
			method: "POST",
			body: JSON.stringify({
				pluginRunId: "scheduled_run",
				event: "schedule.interval.elapsed",
				configuration: { diagnostic },
				chain,
			}),
		}),
		env,
	);
}

function seed_reply() {
	return Response.json({
		document: { value: { case: "write-500", runId: "seed-run" } },
	});
}

function allowed_list() {
	return Response.json({
		items: [{ path: "/allowed/note.txt" }],
		cursor: "",
		isDone: true,
	});
}

function allowed_read() {
	return Response.json({ path: "/allowed/note.txt", content: "hello" });
}

function host_replies(context: TestContext, replies: Response[]) {
	const calls: { path: string; body: unknown }[] = [];
	context.mock.method(
		globalThis,
		"fetch",
		async (url: string | URL | Request, init?: RequestInit) => {
			const request = new Request(url, init);
			assert.equal(new URL(request.url).origin, "https://host.example");
			assert.equal(request.method, "POST");
			assert.equal(request.redirect, "manual");
			assert.equal(
				request.headers.get("Authorization"),
				"Bearer test-run-token",
			);
			assert.equal(request.headers.get("Content-Type"), "application/json");
			assert.ok(init?.signal instanceof AbortSignal);
			const response = replies[calls.length];
			assert.ok(response, "No extra host request");
			calls.push({
				path: new URL(request.url).pathname,
				body: await request.json(),
			});
			return response;
		},
	);
	return calls;
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

describe("scheduled_probe", () => {
	test("keeps idle free of host calls", async (context) => {
		const calls = host_replies(context, []);
		const response = await scheduled({ case: "idle" });
		assert.equal(response.status, 204);
		assert.equal(response.body, null);
		assert.deepEqual(calls, []);
	});
	for (const settings of [
		null,
		{},
		{ case: "unknown" },
		{ case: "kv-read-only" },
		{ ...kvSettings, seedKey: "qa-scheduled_run" },
		{ ...kvSettings, seedKey: "other" },
		{ ...kvSettings, deniedFile: "/.mounts/github/note.txt" },
		{ ...filesSettings, allowedFile: "/outside/note.txt" },
		{ ...filesSettings, allowedFolder: "/allowed/" },
		{ ...filesSettings, allowedFolder: "/allowed/../denied" },
		{
			...filesSettings,
			deniedFolder: "/allowed/denied",
			deniedFile: "/allowed/denied/note.txt",
		},
		{ ...filesSettings, allowedFileSha256: "wrong" },
	]) {
		test(`refuses invalid settings ${JSON.stringify(settings)}`, async (context) => {
			const calls = host_replies(context, []);
			assert.equal((await scheduled(settings)).status, 400);
			assert.deepEqual(calls, []);
		});
	}
	for (const chain of [
		null,
		{ rootRunId: "other", index: 0, state: null },
		{ rootRunId: "scheduled_run", index: 1, state: null },
		{ rootRunId: "scheduled_run", index: 0, state: { phase: "done" } },
	]) {
		test(`refuses a non-root chain ${JSON.stringify(chain)}`, async (context) => {
			const calls = host_replies(context, []);
			assert.equal((await scheduled({ case: "idle" }, chain)).status, 400);
			assert.deepEqual(calls, []);
		});
	}
	test("passes only after KV read and both missing scopes refuse", async (context) => {
		const refused = [
			new Response("hidden error", { status: 403 }),
			new Response("hidden error", { status: 403 }),
		];
		const calls = host_replies(context, [seed_reply(), ...refused]);
		const response = await scheduled(kvSettings);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			message: "Scheduled probe passed",
		});
		assert.equal(calls.length, 3);
		assert.deepEqual(calls[0], {
			path: "/api/v1/plugin-data/read",
			body: { collection: "response_probes", key: "qa-seed-run" },
		});
		assert.equal(calls[1]!.path, "/api/v1/plugin-data/write");
		assert.match(JSON.stringify(calls[1]!.body), /"key":"qa-scheduled_run"/u);
		assert.match(
			JSON.stringify(calls[1]!.body),
			/"case":"scheduled-write-denied"/u,
		);
		assert.deepEqual(calls[2], {
			path: "/api/v1/files/read",
			body: { path: "/denied/note.txt", maxBytes: 4096 },
		});
		assert.ok(refused.every((reply) => reply.bodyUsed));
	});
	test("refuses a KV write that succeeds without write consent", async (context) => {
		const calls = host_replies(context, [
			seed_reply(),
			Response.json({ revision: 1 }),
			new Response(null, { status: 403 }),
		]);
		assert.equal((await scheduled(kvSettings)).status, 409);
		assert.equal(calls.length, 2);
	});
	test("refuses a Files read that succeeds without Files consent", async (context) => {
		host_replies(context, [
			seed_reply(),
			new Response(null, { status: 403 }),
			allowed_read(),
		]);
		assert.equal((await scheduled(kvSettings)).status, 409);
	});
	for (const value of [
		null,
		{ document: null },
		{ document: { value: { case: "upload-write", runId: "seed-run" } } },
		{ document: { value: { case: "write-500", runId: "other" } } },
		{ document: { value: { case: "write-500", runId: 123 } } },
	]) {
		test(`refuses an invalid seed ${JSON.stringify(value)}`, async (context) => {
			const calls = host_replies(context, [Response.json(value)]);
			assert.equal((await scheduled(kvSettings)).status, 409);
			assert.equal(calls.length, 1);
		});
	}
	for (const status of [401, 403, 404, 429, 500, 302]) {
		test(`refuses seed HTTP ${status} without retry or write`, async (context) => {
			const calls = host_replies(context, [
				new Response("private detail", { status }),
			]);
			const response = await scheduled(kvSettings);
			assert.equal(response.status, 409);
			assert.deepEqual(await response.json(), {
				message: "Scheduled probe did not pass",
			});
			assert.equal(calls.length, 1);
		});
	}
	for (const reply of [
		new Response("not JSON"),
		new Response("x".repeat(64 * 1024 + 1)),
	]) {
		test(`refuses malformed or large host JSON (${reply.headers.get("Content-Type")})`, async (context) => {
			host_replies(context, [reply]);
			assert.equal((await scheduled(kvSettings)).status, 409);
			assert.equal(reply.bodyUsed, true);
		});
	}
	test("hides transport errors and tokens", async (context) => {
		context.mock.method(globalThis, "fetch", async () => {
			throw new Error("test-run-token private host detail");
		});
		const response = await scheduled(kvSettings);
		assert.equal(response.status, 409);
		assert.deepEqual(await response.json(), {
			message: "Scheduled probe did not pass",
		});
	});
	test("passes an allowed file and both hidden targets without writes", async (context) => {
		const calls = host_replies(context, [
			allowed_list(),
			allowed_read(),
			new Response(null, { status: 404 }),
			Response.json({ items: [], cursor: "", isDone: true }),
		]);
		const response = await scheduled(filesSettings);
		assert.equal(response.status, 200);
		assert.deepEqual(await response.json(), {
			message: "Scheduled probe passed",
		});
		assert.deepEqual(calls, [
			{
				path: "/api/v1/files/list",
				body: { path: "/allowed", limit: 10, scanLimit: 30, recursive: true },
			},
			{
				path: "/api/v1/files/read",
				body: { path: "/allowed/note.txt", maxBytes: 4096 },
			},
			{
				path: "/api/v1/files/read",
				body: { path: "/denied/note.txt", maxBytes: 4096 },
			},
			{
				path: "/api/v1/files/list",
				body: { path: "/denied", limit: 10, scanLimit: 30, recursive: true },
			},
		]);
	});
	for (const list of [
		{ items: [], isDone: true },
		{ items: [{ path: "/allowed/note.txt" }], isDone: false },
		{ items: [{ path: 3 }], isDone: true },
		{
			items: [
				{ path: "/allowed/note.txt" },
				{ path: "/allowed-other/note.txt" },
			],
			isDone: true,
		},
		{
			items: [
				{ path: "/allowed/note.txt" },
				{ path: "/allowed/../denied/note.txt" },
			],
			isDone: true,
		},
	]) {
		test(`refuses invalid allowed list ${JSON.stringify(list)}`, async (context) => {
			const calls = host_replies(context, [Response.json(list)]);
			assert.equal((await scheduled(filesSettings)).status, 409);
			assert.equal(calls.length, 1);
		});
	}
	for (const read of [
		{ path: "/outside/note.txt", content: "hello" },
		{ path: "/allowed/note.txt", content: 3 },
		{ path: "/allowed/note.txt", content: "changed" },
		{ path: "/allowed/note.txt", content: "x".repeat(4097) },
	]) {
		test(`refuses changed or malformed allowed file (${typeof read.content})`, async (context) => {
			const calls = host_replies(context, [
				allowed_list(),
				Response.json(read),
			]);
			assert.equal((await scheduled(filesSettings)).status, 409);
			assert.equal(calls.length, 2);
		});
	}
	test("refuses a hidden file read that succeeds", async (context) => {
		const calls = host_replies(context, [
			allowed_list(),
			allowed_read(),
			allowed_read(),
			Response.json({ items: [], isDone: true }),
		]);
		assert.equal((await scheduled(filesSettings)).status, 409);
		assert.equal(calls.length, 3);
	});
	test("refuses a hidden folder list with visible entries", async (context) => {
		host_replies(context, [
			allowed_list(),
			allowed_read(),
			new Response(null, { status: 404 }),
			Response.json({ items: [{ path: "/denied/note.txt" }], isDone: true }),
		]);
		assert.equal((await scheduled(filesSettings)).status, 409);
	});
	test("refuses an unfinished hidden folder page", async (context) => {
		host_replies(context, [
			allowed_list(),
			allowed_read(),
			new Response(null, { status: 404 }),
			Response.json({ items: [], isDone: false }),
		]);
		assert.equal((await scheduled(filesSettings)).status, 409);
	});
	for (const result of [
		"revoked",
		"read-still-valid",
		"follow-up-still-valid",
	]) {
		test(
			result === "revoked"
				? "requires both old-token refusals after the real hold"
				: result === "read-still-valid"
					? "refuses a still-valid old token before follow-up"
					: "refuses a still-valid follow-up after token read refusal",
			async (context) => {
				context.mock.timers.enable({ apis: ["setTimeout"] });
				const timeout = context.mock.method(globalThis, "setTimeout");
				const calls = host_replies(context, [
					seed_reply(),
					Response.json({ revision: 1 }),
					new Response(null, {
						status: result === "read-still-valid" ? 200 : 401,
					}),
					new Response(null, {
						status: result === "follow-up-still-valid" ? 200 : 401,
					}),
				]);
				const pending = scheduled({
					case: "revoke-hold",
					seedKey: "qa-seed-run",
				});
				await new Promise<void>((resolve) => setImmediate(resolve));
				assert.equal(calls.length, 2);
				assert.match(
					JSON.stringify(calls[1]!.body),
					/"case":"scheduled-waiting"/u,
				);
				assert.equal(timeout.mock.callCount(), 1);
				assert.equal(timeout.mock.calls[0]!.arguments[1], 30_000);
				context.mock.timers.tick(29_999);
				await Promise.resolve();
				assert.equal(calls.length, 2);
				context.mock.timers.tick(1);
				const response = await pending;
				assert.equal(response.status, result === "revoked" ? 204 : 409);
				if (result === "revoked") assert.equal(response.body, null);
				assert.equal(calls.length, result === "read-still-valid" ? 3 : 4);
				assert.deepEqual(calls[2], calls[0]);
				if (calls.length === 4)
					assert.deepEqual(calls[3], {
						path: "/api/v1/plugin-runs/follow-up",
						body: { state: '{"phase":"done"}' },
					});
			},
		);
	}
	test("does not hold if the waiting marker write is refused", async (context) => {
		const calls = host_replies(context, [
			seed_reply(),
			new Response(null, { status: 403 }),
		]);
		assert.equal(
			(await scheduled({ case: "revoke-hold", seedKey: "qa-seed-run" })).status,
			409,
		);
		assert.equal(calls.length, 2);
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
