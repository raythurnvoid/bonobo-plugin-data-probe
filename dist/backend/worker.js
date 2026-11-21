// src/restore-summary.ts
function is_record(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function short_text(value, maxLength) {
	return typeof value === "string" && value.length <= maxLength ? value : null;
}
function refused_rows(value) {
	if (!Array.isArray(value)) return [];
	return value.filter(is_record).map((row) => ({
		path: short_text(row.path, 1024),
		nodeId: short_text(row.nodeId, 128),
		message: short_text(row.message, 300),
	}));
}
function job_fields(value) {
	const progress = is_record(value.progress) ? value.progress : null;
	return {
		kind: short_text(value.kind, 32),
		status: short_text(value.status, 32),
		errorMessage: short_text(value.errorMessage, 300),
		progress:
			progress &&
			Object.fromEntries(
				[
					"discovered",
					"total",
					"completed",
					"skipped",
					"blocked",
					"failed",
					"canceled",
				].map((field) => [
					field,
					typeof progress[field] === "number" ? progress[field] : null,
				]),
			),
		refused: refused_rows(value.refused),
		renamed: Array.isArray(value.renamed)
			? value.renamed.filter(is_record).map((row) => ({
					path: short_text(row.path, 1024),
					newPath: short_text(row.newPath, 1024),
				}))
			: [],
	};
}
function refusal(hostStatus, value) {
	return {
		hostStatus,
		message: is_record(value) ? short_text(value.message, 300) : null,
		errorCode: is_record(value) ? short_text(value.errorCode, 64) : null,
	};
}
function restore_summary(hostStatus, value) {
	if (hostStatus !== 200 || !is_record(value))
		return refusal(hostStatus, value);
	if (value.dryRun === true)
		return {
			hostStatus,
			dryRun: true,
			complete: value.complete === true,
			refused: refused_rows(value.refused),
			jobs: Array.isArray(value.jobs)
				? value.jobs.filter(is_record).map((job) => ({
						...job_fields(job),
						hasMoreItems: job.hasMoreItems === true,
					}))
				: [],
		};
	return {
		hostStatus,
		jobIds: Array.isArray(value.jobIds)
			? value.jobIds.filter((id) => short_text(id, 128) !== null)
			: [],
		isDone: value.isDone === true,
		refused: refused_rows(value.refused),
	};
}
function job_summary(hostStatus, value) {
	if (hostStatus !== 200 || !is_record(value))
		return refusal(hostStatus, value);
	return {
		hostStatus,
		jobId: short_text(value.jobId, 128),
		...job_fields(value),
		refusedCursor: short_text(value.refusedCursor, 4096),
	};
}

// src/backend.ts
var MAX_REPLY_BYTES = 16 * 1024 * 1024;
var MAX_HOST_REPLY_BYTES = 64 * 1024;
var COLLECTION = "response_probes";
var encoder = new TextEncoder();
function is_record2(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function filled_reply(runId, targetBytes, token) {
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
function text_stream(text, chunkBytes) {
	const bytes = encoder.encode(text);
	let offset = 0;
	return new ReadableStream({
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
async function write_probe(env, runId, caseName) {
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
				value: {
					case: caseName,
					runId,
					recordedAt: /* @__PURE__ */ new Date().toISOString(),
				},
			}),
		},
	);
	await response.body?.cancel();
	if (!response.ok)
		throw new Error(
			`Probe document write refused with HTTP ${response.status}`,
		);
}
async function host_post(env, path, body, readBody = false) {
	const response = await fetch(`${env.BONOBO.host.apiOrigin}/api/v1/${path}`, {
		method: "POST",
		redirect: "manual",
		signal: AbortSignal.timeout(5e3),
		headers: {
			Authorization: `Bearer ${env.BONOBO.host.token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(body),
	});
	let value = null;
	if (!readBody || (response.status !== 200 && readBody !== "reply")) {
		await response.body?.cancel();
		return { status: response.status, value };
	}
	if (!response.body) throw new Error("Missing host reply");
	if (readBody === "text" && response.headers.has("X-File-Next-Cursor")) {
		await response.body.cancel();
		throw new Error("Expected a small complete QA file");
	}
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
		text += decoder.decode();
		value = readBody === true ? JSON.parse(text) : text;
	} finally {
		await reader.cancel();
	}
	return { status: response.status, value };
}
function saved_path(value) {
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
function short_id(value) {
	return typeof value === "string" && /^[-_a-zA-Z0-9]{1,128}$/u.test(value);
}
function restore_body(input, extraKeys) {
	const keys = [
		"case",
		"paths",
		"nodes",
		"requestId",
		"onConflict",
		"force",
		"dryRun",
		...extraKeys,
	];
	if (!Object.keys(input).every((key) => keys.includes(key))) return null;
	const { paths, nodes, requestId, onConflict, force, dryRun } = input;
	const items = paths ?? nodes;
	if (
		(paths === void 0) === (nodes === void 0) ||
		!Array.isArray(items) ||
		items.length < 1 ||
		items.length > 100 ||
		(paths !== void 0 && !items.every(saved_path)) ||
		(nodes !== void 0 &&
			!items.every(
				(node) =>
					is_record2(node) &&
					Object.keys(node).length === 2 &&
					short_id(node.nodeId) &&
					short_id(node.archiveOperationId),
			)) ||
		(onConflict !== void 0 &&
			onConflict !== "keep_both" &&
			onConflict !== "skip") ||
		(force !== void 0 && typeof force !== "boolean") ||
		(dryRun !== void 0 && typeof dryRun !== "boolean")
	)
		return null;
	if (
		dryRun === true
			? requestId !== void 0
			: typeof requestId !== "string" ||
				requestId.length < 1 ||
				requestId.length > 64
	)
		return null;
	return { paths, nodes, requestId, onConflict, force, dryRun };
}
async function restore_reply(env, path, body, summary) {
	try {
		const reply = await host_post(env, path, body, "reply");
		let value = null;
		try {
			value = JSON.parse(String(reply.value));
		} catch {}
		return Response.json(summary(reply.status, value));
	} catch {
		return Response.json(
			{
				message:
					"No usable host reply. The host may have started the restore. This case was not retried.",
			},
			{ status: 502 },
		);
	}
}
async function scheduled_probe(env, runId, event) {
	if (
		!is_record2(event.chain) ||
		event.chain.rootRunId !== runId ||
		event.chain.index !== 0 ||
		event.chain.state !== null ||
		!is_record2(event.configuration) ||
		!is_record2(event.configuration.diagnostic) ||
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
			const list = await host_post(
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
				!is_record2(list.value) ||
				list.value.isDone !== true ||
				!Array.isArray(list.value.items) ||
				list.value.items.length > 10 ||
				!list.value.items.every(
					(item) =>
						is_record2(item) &&
						saved_path(item.path) &&
						item.path.startsWith(`${allowedFolder}/`),
				) ||
				!list.value.items.some(
					(item) => is_record2(item) && item.path === allowedFile,
				)
			)
				throw new Error("Allowed list failed");
			const read = await host_post(
				env,
				"files/read",
				{ path: allowedFile },
				"text",
			);
			if (
				read.status !== 200 ||
				typeof read.value !== "string" ||
				encoder.encode(read.value).byteLength > 4096
			)
				throw new Error("Allowed read failed");
			const hash = Array.from(
				new Uint8Array(
					await crypto.subtle.digest("SHA-256", encoder.encode(read.value)),
				),
				(byte) => byte.toString(16).padStart(2, "0"),
			).join("");
			if (hash !== diagnostic.allowedFileSha256)
				throw new Error("Allowed content changed");
			const denied = await host_post(env, "files/read", {
				path: diagnostic.deniedFile,
			});
			if (denied.status !== 403 && denied.status !== 404)
				throw new Error("Hidden read was not refused");
			const hiddenList = await host_post(
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
				hiddenList.status !== 403 &&
				hiddenList.status !== 404 &&
				(hiddenList.status !== 200 ||
					!is_record2(hiddenList.value) ||
					hiddenList.value.isDone !== true ||
					!Array.isArray(hiddenList.value.items) ||
					hiddenList.value.items.length !== 0)
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
			const read = await host_post(env, "plugin-data/read", readBody, true);
			if (
				read.status !== 200 ||
				!is_record2(read.value) ||
				!is_record2(read.value.document) ||
				!is_record2(read.value.document.value) ||
				read.value.document.value.case !== "write-500" ||
				typeof read.value.document.value.runId !== "string" ||
				diagnostic.seedKey !== `qa-${read.value.document.value.runId}`
			)
				throw new Error("Seed read failed");
			const write = await host_post(env, "plugin-data/write", {
				collection: COLLECTION,
				key: `qa-${runId}`,
				value: {
					case:
						caseName === "revoke-hold"
							? "scheduled-waiting"
							: "scheduled-write-denied",
					runId,
					recordedAt: /* @__PURE__ */ new Date().toISOString(),
				},
			});
			if (caseName === "kv-read-only") {
				if (write.status !== 403) throw new Error("KV write was not refused");
				const denied = await host_post(env, "files/read", {
					path: diagnostic.deniedFile,
				});
				if (denied.status !== 403)
					throw new Error("Files scope was not refused");
			} else {
				if (write.status !== 200)
					throw new Error("Waiting marker was not saved");
				await new Promise((resolve) => setTimeout(resolve, 3e4));
				const revoked = await host_post(env, "plugin-data/read", readBody);
				if (revoked.status !== 401)
					throw new Error("Old token read was not refused");
				const followUp = await host_post(env, "plugin-runs/follow-up", {
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
var backend_default = {
	async fetch(request, env) {
		const event = await request.json();
		if (
			!is_record2(event) ||
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
				!is_record2(event.source) ||
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
			!is_record2(event.invoke) ||
			!is_record2(event.invoke.input) ||
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
				const token = caseName === "escaped-unicode" ? '\n\\"\u{1F98A}' : "a";
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
					text_stream(`Tiny chunks: ${'\u{1F98A}\n\\"'.repeat(256)}`, 1),
				);
			case "broken-stream": {
				let sent = false;
				return new Response(
					new ReadableStream({
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
				let timer;
				let finishPull;
				return new Response(
					new ReadableStream({
						start(controller) {
							controller.enqueue(encoder.encode("waiting"));
						},
						pull(controller) {
							return new Promise((resolve) => {
								finishPull = resolve;
								timer = setTimeout(() => {
									controller.close();
									resolve();
								}, 6e4);
							});
						},
						cancel() {
							if (timer !== void 0) clearTimeout(timer);
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
			case "restore":
			case "restore-after-wait": {
				const input = event.invoke.input;
				const waitMs = input.waitMs;
				const body = restore_body(
					input,
					caseName === "restore-after-wait" ? ["waitMs"] : [],
				);
				if (
					body === null ||
					(caseName === "restore-after-wait" &&
						(typeof waitMs !== "number" ||
							!Number.isInteger(waitMs) ||
							waitMs < 0 ||
							waitMs > 2e4))
				)
					return Response.json(
						{ message: "Expected a small restore request" },
						{ status: 400 },
					);
				if (typeof waitMs === "number")
					await new Promise((resolve) => setTimeout(resolve, waitMs));
				return restore_reply(env, "files/restore", body, restore_summary);
			}
			case "restore-status": {
				const { jobId, cursor } = event.invoke.input;
				if (
					!Object.keys(event.invoke.input).every((key) =>
						["case", "jobId", "cursor"].includes(key),
					) ||
					!short_id(jobId) ||
					(cursor !== void 0 &&
						cursor !== null &&
						(typeof cursor !== "string" ||
							cursor.length < 1 ||
							cursor.length > 4096))
				)
					return Response.json(
						{ message: "Expected a job ID and an optional cursor" },
						{ status: 400 },
					);
				return restore_reply(
					env,
					"files/jobs/get",
					{ jobId, cursor },
					job_summary,
				);
			}
			case "outbound-fetch": {
				const { url } = event.invoke.input;
				if (
					!Object.keys(event.invoke.input).every((key) =>
						["case", "url"].includes(key),
					) ||
					typeof url !== "string" ||
					url.length > 2048 ||
					!URL.canParse(url)
				)
					return Response.json(
						{ message: "Expected one URL" },
						{ status: 400 },
					);
				try {
					const response = await fetch(url, {
						redirect: "manual",
						signal: AbortSignal.timeout(5e3),
					});
					await response.body?.cancel();
					return Response.json({ status: response.status });
				} catch (error) {
					return Response.json(
						{
							error:
								error instanceof Error
									? error.message.slice(0, 300)
									: "Outbound fetch failed",
						},
						{ status: 502 },
					);
				}
			}
			default:
				return Response.json(
					{ message: "Unknown probe case" },
					{ status: 400 },
				);
		}
	},
};
export { backend_default as default };
