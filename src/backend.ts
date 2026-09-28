import type { BonoboEnv } from "bonobo-plugin-sdk";

const MAX_REPLY_BYTES = 16 * 1024 * 1024;
const MAX_HOST_REPLY_BYTES = 64 * 1024;
const COLLECTION = "response_probes";
const encoder = new TextEncoder();

function is_record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function filled_reply(runId: string, targetBytes: number, token: string) {
	const envelopeBytes = encoder.encode(
		JSON.stringify({ runId, pluginStatus: 200, output: "" }),
	).byteLength;
	const available = targetBytes - envelopeBytes;
	const tokenBytes = encoder.encode(
		JSON.stringify(token).slice(1, -1),
	).byteLength;
	return (
		token.repeat(Math.floor(available / tokenBytes)) +
		"a".repeat(available % tokenBytes)
	);
}

function text_stream(text: string, chunkBytes: number) {
	const bytes = encoder.encode(text);
	let offset = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (offset === bytes.byteLength) {
				controller.close();
				return;
			}
			const end = Math.min(offset + chunkBytes, bytes.byteLength);
			controller.enqueue(bytes.subarray(offset, end));
			offset = end;
		},
	});
}

async function write_probe(env: BonoboEnv, runId: string, caseName: string) {
	const response = await fetch(
		`${env.BONOBO.host.apiOrigin}/api/v1/plugin-data/write`,
		{
			method: "POST",
			// Keep the host token off redirect destinations.
			redirect: "manual",
			headers: {
				Authorization: `Bearer ${env.BONOBO.host.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				collection: COLLECTION,
				key: `qa-${runId}`,
				value: { case: caseName, runId, recordedAt: new Date().toISOString() },
			}),
		},
	);
	await response.body?.cancel();
	if (!response.ok)
		throw new Error(
			`Probe document write refused with HTTP ${response.status}`,
		);
}

async function scheduled_post(
	env: BonoboEnv,
	path: string,
	body: Record<string, unknown>,
	readJson = false,
) {
	const response = await fetch(`${env.BONOBO.host.apiOrigin}/api/v1/${path}`, {
		method: "POST",
		redirect: "manual",
		signal: AbortSignal.timeout(5_000),
		headers: {
			Authorization: `Bearer ${env.BONOBO.host.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	let value: unknown = null;
	if (response.status !== 200 || !readJson) {
		await response.body?.cancel();
		return { status: response.status, value };
	}
	if (!response.body) throw new Error("Missing host reply");
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = "";
	try {
		for (;;) {
			const next = await reader.read();
			if (next.done) break;
			bytes += next.value.byteLength;
			if (bytes > MAX_HOST_REPLY_BYTES) throw new Error("Host reply too large");
			text += decoder.decode(next.value, { stream: true });
		}
		value = JSON.parse(text + decoder.decode());
	} finally {
		await reader.cancel();
	}
	return { status: response.status, value };
}

function saved_path(value: unknown): value is string {
	return (
		typeof value === "string" &&
		value.startsWith("/") &&
		value.length <= 1024 &&
		!/[\\\u0000-\u001f]/u.test(value) &&
		value !== "/.mounts" &&
		!value.startsWith("/.mounts/") &&
		value
			.slice(1)
			.split("/")
			.every((part) => part !== "" && part !== "." && part !== "..")
	);
}

async function scheduled_probe(
	env: BonoboEnv,
	runId: string,
	event: Record<string, unknown>,
) {
	if (
		!is_record(event.chain) ||
		event.chain.rootRunId !== runId ||
		event.chain.index !== 0 ||
		event.chain.state !== null ||
		!is_record(event.configuration) ||
		!is_record(event.configuration.diagnostic) ||
		!/^[-_a-zA-Z0-9]{1,128}$/u.test(runId)
	) {
		return Response.json(
			{ message: "Expected root diagnostic settings" },
			{ status: 400 },
		);
	}
	const diagnostic = event.configuration.diagnostic;
	const caseName = diagnostic.case;
	if (caseName === "idle") return new Response(null, { status: 204 });
	if (
		caseName !== "kv-read-only" &&
		caseName !== "revoke-hold" &&
		caseName !== "files-read"
	) {
		return Response.json(
			{ message: "Unknown scheduled probe case" },
			{ status: 400 },
		);
	}
	try {
		if (caseName === "files-read") {
			if (
				!saved_path(diagnostic.allowedFolder) ||
				!saved_path(diagnostic.allowedFile) ||
				!diagnostic.allowedFile.startsWith(`${diagnostic.allowedFolder}/`) ||
				!saved_path(diagnostic.deniedFolder) ||
				!saved_path(diagnostic.deniedFile) ||
				!diagnostic.deniedFile.startsWith(`${diagnostic.deniedFolder}/`) ||
				diagnostic.deniedFolder === diagnostic.allowedFolder ||
				diagnostic.deniedFolder.startsWith(`${diagnostic.allowedFolder}/`) ||
				diagnostic.allowedFolder.startsWith(`${diagnostic.deniedFolder}/`) ||
				typeof diagnostic.allowedFileSha256 !== "string" ||
				!/^[a-f0-9]{64}$/u.test(diagnostic.allowedFileSha256)
			) {
				return Response.json(
					{ message: "Expected small saved QA fixtures" },
					{ status: 400 },
				);
			}
			const allowedFolder = diagnostic.allowedFolder;
			const allowedFile = diagnostic.allowedFile;
			const list = await scheduled_post(
				env,
				"files/list",
				{
					path: allowedFolder,
					limit: 10,
					scanLimit: 30,
					recursive: true,
				},
				true,
			);
			if (
				list.status !== 200 ||
				!is_record(list.value) ||
				list.value.isDone !== true ||
				!Array.isArray(list.value.items) ||
				list.value.items.length > 10 ||
				!list.value.items.every(
					(item: unknown) =>
						is_record(item) &&
						saved_path(item.path) &&
						item.path.startsWith(`${allowedFolder}/`),
				) ||
				!list.value.items.some(
					(item: unknown) => is_record(item) && item.path === allowedFile,
				)
			)
				throw new Error("Allowed list failed");
			const read = await scheduled_post(
				env,
				"files/read",
				{ path: allowedFile, maxBytes: 4096 },
				true,
			);
			if (
				read.status !== 200 ||
				!is_record(read.value) ||
				read.value.path !== allowedFile ||
				typeof read.value.content !== "string" ||
				encoder.encode(read.value.content).byteLength > 4096
			)
				throw new Error("Allowed read failed");
			const hash = Array.from(
				new Uint8Array(
					await crypto.subtle.digest(
						"SHA-256",
						encoder.encode(read.value.content),
					),
				),
				(byte) => byte.toString(16).padStart(2, "0"),
			).join("");
			if (hash !== diagnostic.allowedFileSha256)
				throw new Error("Allowed content changed");
			const denied = await scheduled_post(env, "files/read", {
				path: diagnostic.deniedFile,
				maxBytes: 4096,
			});
			if (denied.status !== 404) throw new Error("Hidden read was not refused");
			const hiddenList = await scheduled_post(
				env,
				"files/list",
				{
					path: diagnostic.deniedFolder,
					limit: 10,
					scanLimit: 30,
					recursive: true,
				},
				true,
			);
			if (
				hiddenList.status !== 200 ||
				!is_record(hiddenList.value) ||
				hiddenList.value.isDone !== true ||
				!Array.isArray(hiddenList.value.items) ||
				hiddenList.value.items.length !== 0
			)
				throw new Error("Hidden list was not empty");
		} else {
			if (
				typeof diagnostic.seedKey !== "string" ||
				!/^qa-[-_a-zA-Z0-9]{1,128}$/u.test(diagnostic.seedKey) ||
				diagnostic.seedKey === `qa-${runId}` ||
				(caseName === "kv-read-only" && !saved_path(diagnostic.deniedFile))
			) {
				return Response.json(
					{ message: "Expected small saved QA fixtures" },
					{ status: 400 },
				);
			}
			const readBody = { collection: COLLECTION, key: diagnostic.seedKey };
			const read = await scheduled_post(
				env,
				"plugin-data/read",
				readBody,
				true,
			);
			if (
				read.status !== 200 ||
				!is_record(read.value) ||
				!is_record(read.value.document) ||
				!is_record(read.value.document.value) ||
				read.value.document.value.case !== "write-500" ||
				typeof read.value.document.value.runId !== "string" ||
				diagnostic.seedKey !== `qa-${read.value.document.value.runId}`
			)
				throw new Error("Seed read failed");
			const write = await scheduled_post(env, "plugin-data/write", {
				collection: COLLECTION,
				key: `qa-${runId}`,
				value: {
					case:
						caseName === "revoke-hold"
							? "scheduled-waiting"
							: "scheduled-write-denied",
					runId,
					recordedAt: new Date().toISOString(),
				},
			});
			if (caseName === "kv-read-only") {
				if (write.status !== 403) throw new Error("KV write was not refused");
				const denied = await scheduled_post(env, "files/read", {
					path: diagnostic.deniedFile,
					maxBytes: 4096,
				});
				if (denied.status !== 403)
					throw new Error("Files scope was not refused");
			} else {
				if (write.status !== 200)
					throw new Error("Waiting marker was not saved");
				// Keep this run alive while the selected user revokes their own consent.
				await new Promise<void>((resolve) => setTimeout(resolve, 30_000));
				const revoked = await scheduled_post(env, "plugin-data/read", readBody);
				// Stop before follow-up if the old token still works.
				if (revoked.status !== 401)
					throw new Error("Old token read was not refused");
				const followUp = await scheduled_post(env, "plugin-runs/follow-up", {
					state: '{"phase":"done"}',
				});
				if (followUp.status !== 401)
					throw new Error("Old token follow-up was not refused");
				return new Response(null, { status: 204 });
			}
		}
		return Response.json({ message: "Scheduled probe passed" });
	} catch {
		return Response.json(
			{ message: "Scheduled probe did not pass" },
			{ status: 409 },
		);
	}
}

export default {
	async fetch(request: Request, env: BonoboEnv): Promise<Response> {
		const event: unknown = await request.json();
		if (
			!is_record(event) ||
			typeof event.pluginRunId !== "string" ||
			event.pluginRunId.length === 0
		) {
			return Response.json({ message: "Missing host run ID" }, { status: 400 });
		}
		const runId = event.pluginRunId;
		const path = new URL(request.url).pathname;
		if (path === "/__bonobo_senate/run") {
			if (event.event === "schedule.interval.elapsed")
				return scheduled_probe(env, runId, event);
			if (
				event.event !== "files.upload.completed" ||
				!is_record(event.source) ||
				event.source.contentType !== "image/png" ||
				typeof event.source.name !== "string"
			) {
				return Response.json(
					{ message: "Expected a PNG upload" },
					{ status: 400 },
				);
			}
			if (!event.source.name.startsWith("noop"))
				await write_probe(env, runId, "upload-write");
			return new Response(null, { status: 204 });
		}
		if (
			path !== "/probe" ||
			event.event !== "ui.invoke.requested" ||
			!is_record(event.invoke) ||
			!is_record(event.invoke.input) ||
			typeof event.invoke.input.case !== "string"
		) {
			return Response.json(
				{ message: "Expected a probe case" },
				{ status: 400 },
			);
		}
		const caseName = event.invoke.input.case;
		switch (caseName) {
			case "json-200":
			case "json-400":
			case "json-409":
			case "json-500": {
				const status = Number(caseName.slice(5));
				return Response.json(
					{ message: `Probe answered HTTP ${status}` },
					{ status },
				);
			}
			case "empty-204":
				return new Response(null, { status: 204 });
			case "exact-cap":
			case "one-byte-over":
			case "escaped-unicode": {
				const targetBytes =
					MAX_REPLY_BYTES + (caseName === "one-byte-over" ? 1 : 0);
				const token = caseName === "escaped-unicode" ? '\n\\"🦊' : "a";
				return new Response(
					text_stream(filled_reply(runId, targetBytes, token), 64 * 1024),
				);
			}
			case "raw-over":
				return new Response(
					text_stream("a".repeat(MAX_REPLY_BYTES + 1), 64 * 1024),
				);
			case "tiny-chunks":
				return new Response(
					text_stream(`Tiny chunks: ${'🦊\n\\"'.repeat(256)}`, 1),
				);
			case "broken-stream": {
				let sent = false;
				return new Response(
					new ReadableStream<Uint8Array>({
						pull(controller) {
							if (sent) controller.error(new Error("Probe stream failed"));
							else {
								sent = true;
								controller.enqueue(encoder.encode("incomplete"));
							}
						},
					}),
				);
			}
			case "stalled-stream": {
				let timer: ReturnType<typeof setTimeout> | undefined;
				let finishPull: (() => void) | undefined;
				return new Response(
					new ReadableStream<Uint8Array>({
						start(controller) {
							controller.enqueue(encoder.encode("waiting"));
						},
						pull(controller) {
							// A real timer keeps Workers from treating this as a hung promise.
							return new Promise<void>((resolve) => {
								finishPull = resolve;
								timer = setTimeout(() => {
									controller.close();
									resolve();
								}, 60_000);
							});
						},
						cancel() {
							if (timer !== undefined) clearTimeout(timer);
							finishPull?.();
						},
					}),
				);
			}
			case "write-500":
			case "write-throw":
				await write_probe(env, runId, caseName);
				if (caseName === "write-throw")
					throw new Error("Probe threw after saving its document");
				return Response.json(
					{ message: "Probe saved its document, then answered HTTP 500" },
					{ status: 500 },
				);
			default:
				return Response.json(
					{ message: "Unknown probe case" },
					{ status: 400 },
				);
		}
	},
};
