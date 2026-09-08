import type { BonoboEnv } from "bonobo-plugin-sdk";

const MAX_REPLY_BYTES = 16 * 1024 * 1024;
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
