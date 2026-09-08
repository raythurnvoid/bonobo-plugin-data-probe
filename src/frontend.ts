import { bonobo_connect } from "bonobo-plugin-sdk/frontend";

const form = document.querySelector<HTMLFormElement>("#probe-form")!;
const select = document.querySelector<HTMLSelectElement>("#probe-case")!;
const runButton = document.querySelector<HTMLButtonElement>("#run-probe")!;
const refreshButton =
	document.querySelector<HTMLButtonElement>("#refresh-probes")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const result = document.querySelector<HTMLPreElement>("#result")!;
const saved = document.querySelector<HTMLUListElement>("#saved-probes")!;
const encoder = new TextEncoder();

function is_record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function small_message(output: string) {
	if (output.length > 4096 || output.length === 0) return null;
	try {
		const parsed: unknown = JSON.parse(output);
		return is_record(parsed) && typeof parsed.message === "string"
			? parsed.message.slice(0, 300)
			: null;
	} catch {
		return null;
	}
}

async function connect() {
	const client = await bonobo_connect();
	runButton.disabled = false;
	refreshButton.disabled = false;
	status.textContent = "Ready.";
	form.addEventListener("submit", async (event) => {
		event.preventDefault();
		if (runButton.disabled) return;
		const caseName = select.value;
		runButton.disabled = true;
		refreshButton.disabled = true;
		form.setAttribute("aria-busy", "true");
		status.textContent = `Running ${caseName}…`;
		try {
			const response = await client.fetchJson("/api/v1/plugin-backend/invoke", {
				endpoint: "probe",
				input: { case: caseName },
			});
			const body: unknown = response.body;
			if (
				response.status === 200 &&
				is_record(body) &&
				typeof body.runId === "string" &&
				typeof body.pluginStatus === "number" &&
				typeof body.output === "string"
			) {
				const bytes = encoder.encode(body.output);
				const digest = await crypto.subtle.digest("SHA-256", bytes);
				const sha256 = Array.from(new Uint8Array(digest), (byte) =>
					byte.toString(16).padStart(2, "0"),
				).join("");
				result.textContent = JSON.stringify(
					{
						case: caseName,
						status: response.status,
						runId: body.runId,
						pluginStatus: body.pluginStatus,
						outputBytes: bytes.byteLength,
						sha256,
						encodedReplyBytes: encoder.encode(JSON.stringify(body)).byteLength,
						message: small_message(body.output),
					},
					null,
					2,
				);
			} else {
				result.textContent = JSON.stringify(
					{
						case: caseName,
						status: response.status,
						runId:
							is_record(body) && typeof body.runId === "string"
								? body.runId
								: null,
						code:
							is_record(body) && typeof body.code === "string"
								? body.code.slice(0, 64)
								: null,
						message:
							is_record(body) && typeof body.message === "string"
								? body.message.slice(0, 300)
								: "Invalid host reply",
					},
					null,
					2,
				);
			}
			status.textContent = "Finished. The summary is below.";
		} catch {
			status.textContent =
				"No host reply arrived. Earlier changes may be saved. This case was not retried.";
			result.textContent = JSON.stringify(
				{ case: caseName, status: "No response" },
				null,
				2,
			);
		} finally {
			runButton.disabled = false;
			refreshButton.disabled = false;
			form.removeAttribute("aria-busy");
		}
	});
	refreshButton.addEventListener("click", async () => {
		if (refreshButton.disabled) return;
		refreshButton.disabled = true;
		runButton.disabled = true;
		status.textContent = "Loading saved test documents…";
		try {
			const response = await client.fetchJson("/api/v1/plugin-data/list", {
				collection: "response_probes",
				keyPrefix: "qa-",
				limit: 100,
			});
			const body: unknown = response.body;
			if (
				response.status !== 200 ||
				!is_record(body) ||
				!Array.isArray(body.documents)
			) {
				status.textContent = `Saved document read refused with HTTP ${response.status}.`;
				return;
			}
			saved.replaceChildren();
			for (const doc of body.documents) {
				if (
					!is_record(doc) ||
					typeof doc.key !== "string" ||
					!is_record(doc.value)
				)
					continue;
				const caseName =
					typeof doc.value.case === "string"
						? doc.value.case.slice(0, 64)
						: "unknown case";
				const item = document.createElement("li");
				item.textContent = `${doc.key.slice(0, 160)} — ${caseName}`;
				saved.append(item);
			}
			status.textContent = `${saved.children.length} test documents shown (up to 100). Existing upload documents stay unchanged.`;
		} catch {
			status.textContent =
				"Saved documents could not be read. Try Refresh again.";
		} finally {
			refreshButton.disabled = false;
			runButton.disabled = false;
		}
	});
}

connect().catch(() => {
	status.textContent =
		"Could not connect to the host. Reload this plugin page.";
});
