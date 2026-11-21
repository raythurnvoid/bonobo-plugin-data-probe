import { bonobo_connect } from "bonobo-plugin-sdk/frontend";
import { job_summary } from "./restore-summary.ts";

const form = document.querySelector<HTMLFormElement>("#probe-form")!;
const select = document.querySelector<HTMLSelectElement>("#probe-case")!;
const runButton = document.querySelector<HTMLButtonElement>("#run-probe")!;
const refreshButton =
	document.querySelector<HTMLButtonElement>("#refresh-probes")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const result = document.querySelector<HTMLPreElement>("#result")!;
const saved = document.querySelector<HTMLUListElement>("#saved-probes")!;
const restoreForm = document.querySelector<HTMLFormElement>("#restore-form")!;
const restoreNodeId =
	document.querySelector<HTMLInputElement>("#restore-node-id")!;
const restoreStamp = document.querySelector<HTMLInputElement>(
	"#restore-archive-operation-id",
)!;
const restorePath = document.querySelector<HTMLInputElement>("#restore-path")!;
const restoreRequestId = document.querySelector<HTMLInputElement>(
	"#restore-request-id",
)!;
const restoreConflict = document.querySelector<HTMLSelectElement>(
	"#restore-on-conflict",
)!;
const restoreDryRun =
	document.querySelector<HTMLInputElement>("#restore-dry-run")!;
const restoreForce =
	document.querySelector<HTMLInputElement>("#restore-force")!;
const restoreWait =
	document.querySelector<HTMLInputElement>("#restore-wait-ms")!;
const restoreButtons =
	restoreForm.querySelectorAll<HTMLButtonElement>("button");
const restoreResult =
	document.querySelector<HTMLPreElement>("#restore-result")!;
const restoreJobs = document.querySelector<HTMLUListElement>("#restore-jobs")!;
const jobForm = document.querySelector<HTMLFormElement>("#job-form")!;
const jobId = document.querySelector<HTMLInputElement>("#job-id")!;
const jobCursor = document.querySelector<HTMLInputElement>("#job-cursor")!;
const jobButtons = jobForm.querySelectorAll<HTMLButtonElement>("button");
const jobResult = document.querySelector<HTMLPreElement>("#job-result")!;
const outboundForm = document.querySelector<HTMLFormElement>("#outbound-form")!;
const outboundUrl = document.querySelector<HTMLInputElement>("#outbound-url")!;
const outboundButton =
	document.querySelector<HTMLButtonElement>("#run-outbound")!;
const outboundResult =
	document.querySelector<HTMLPreElement>("#outbound-result")!;
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
	for (const button of [...restoreButtons, ...jobButtons, outboundButton])
		button.disabled = false;
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
						errorCode:
							is_record(body) && typeof body.errorCode === "string"
								? body.errorCode.slice(0, 64)
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

	// Run one backend case. Show the backend's own small summary, never the raw host reply.
	async function invoke_backend(input: Record<string, unknown>) {
		const response = await client.fetchJson("/api/v1/plugin-backend/invoke", {
			endpoint: "probe",
			input,
		});
		const body: unknown = response.body;
		if (
			response.status !== 200 ||
			!is_record(body) ||
			typeof body.runId !== "string" ||
			typeof body.pluginStatus !== "number" ||
			typeof body.output !== "string"
		)
			return {
				status: response.status,
				message:
					is_record(body) && typeof body.message === "string"
						? body.message.slice(0, 300)
						: "Invalid host reply",
				output: null,
			};
		let output: unknown = null;
		try {
			output = JSON.parse(body.output);
		} catch {
			// The backend always answers JSON. Show null if it did not.
		}
		return {
			status: response.status,
			runId: body.runId,
			pluginStatus: body.pluginStatus,
			output: is_record(output) ? output : null,
		};
	}

	restoreForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const caseName =
			event.submitter?.id === "run-restore-after-wait"
				? "restore-after-wait"
				: "restore";
		// Send only the filled fields. The backend refuses a bad mix with 400.
		const input: Record<string, unknown> = { case: caseName };
		if (restoreNodeId.value !== "" || restoreStamp.value !== "")
			input.nodes = [
				{
					nodeId: restoreNodeId.value.trim(),
					archiveOperationId: restoreStamp.value.trim(),
				},
			];
		if (restorePath.value !== "") input.paths = [restorePath.value];
		if (restoreRequestId.value !== "") input.requestId = restoreRequestId.value;
		if (restoreConflict.value !== "") input.onConflict = restoreConflict.value;
		if (restoreDryRun.checked) input.dryRun = true;
		if (restoreForce.checked) input.force = true;
		if (caseName === "restore-after-wait")
			input.waitMs = restoreWait.valueAsNumber;
		for (const button of restoreButtons) button.disabled = true;
		restoreForm.setAttribute("aria-busy", "true");
		restoreResult.dataset.state = "running";
		restoreResult.textContent = `Running ${caseName}…`;
		restoreJobs.replaceChildren();
		try {
			const reply = await invoke_backend(input);
			restoreResult.textContent = JSON.stringify(
				{ case: caseName, ...reply },
				null,
				2,
			);
			const jobIds = Array.isArray(reply.output?.jobIds)
				? reply.output.jobIds.filter((id) => typeof id === "string")
				: [];
			for (const id of jobIds) {
				const item = document.createElement("li");
				item.dataset.jobId = id;
				item.textContent = `Job ${id}`;
				restoreJobs.append(item);
			}
			// Put the first job in the status form, so QA can read it next.
			if (jobIds[0]) {
				jobId.value = jobIds[0];
				jobCursor.value = "";
			}
			restoreResult.dataset.state =
				reply.output?.hostStatus === 200 ? "done" : "refused";
		} catch {
			restoreResult.dataset.state = "no-reply";
			restoreResult.textContent = JSON.stringify(
				{
					case: caseName,
					status: "No response",
					message:
						"The host may have started the restore. Send the same request ID again to read the same jobs.",
				},
				null,
				2,
			);
		} finally {
			for (const button of restoreButtons) button.disabled = false;
			restoreForm.removeAttribute("aria-busy");
		}
	});

	jobForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		const reader =
			event.submitter?.id === "read-job-backend" ? "backend run" : "page";
		const request = {
			jobId: jobId.value.trim(),
			cursor: jobCursor.value === "" ? null : jobCursor.value,
		};
		for (const button of jobButtons) button.disabled = true;
		jobForm.setAttribute("aria-busy", "true");
		jobResult.dataset.state = "running";
		jobResult.dataset.jobStatus = "";
		jobResult.textContent = "Reading the job…";
		try {
			let job: Record<string, unknown> | null;
			if (reader === "backend run") {
				const reply = await invoke_backend({
					case: "restore-status",
					...request,
				});
				job = reply.output;
				jobResult.textContent = JSON.stringify({ reader, ...reply }, null, 2);
			} else {
				// The page reads with its own page token, not with a backend run.
				const response = await client.fetchJson(
					"/api/v1/files/jobs/get",
					request,
				);
				job = job_summary(response.status, response.body);
				jobResult.textContent = JSON.stringify({ reader, ...job }, null, 2);
			}
			jobResult.dataset.state = job?.hostStatus === 200 ? "done" : "refused";
			jobResult.dataset.jobStatus =
				typeof job?.status === "string" ? job.status : "";
			// Fill the next page cursor. It is empty after the last page.
			if (job?.hostStatus === 200)
				jobCursor.value =
					typeof job.refusedCursor === "string" ? job.refusedCursor : "";
		} catch {
			jobResult.dataset.state = "no-reply";
			jobResult.textContent = JSON.stringify(
				{ reader, status: "No response" },
				null,
				2,
			);
		} finally {
			for (const button of jobButtons) button.disabled = false;
			jobForm.removeAttribute("aria-busy");
		}
	});

	outboundForm.addEventListener("submit", async (event) => {
		event.preventDefault();
		outboundButton.disabled = true;
		outboundForm.setAttribute("aria-busy", "true");
		outboundResult.dataset.state = "running";
		outboundResult.textContent = "Fetching…";
		try {
			const reply = await invoke_backend({
				case: "outbound-fetch",
				url: outboundUrl.value.trim(),
			});
			outboundResult.textContent = JSON.stringify(
				{ case: "outbound-fetch", ...reply },
				null,
				2,
			);
			// "done" means the runner allowed the origin and the URL answered, with any status.
			outboundResult.dataset.state =
				typeof reply.output?.status === "number" ? "done" : "refused";
		} catch {
			outboundResult.dataset.state = "no-reply";
			outboundResult.textContent = JSON.stringify(
				{ case: "outbound-fetch", status: "No response" },
				null,
				2,
			);
		} finally {
			outboundButton.disabled = false;
			outboundForm.removeAttribute("aria-busy");
		}
	});
}

connect().catch(() => {
	status.textContent =
		"Could not connect to the host. Reload this plugin page.";
});
