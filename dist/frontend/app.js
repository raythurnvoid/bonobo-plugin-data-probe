/**
 * Data Probe page.
 *
 * Lists the documents the plugin's own backend wrote. The page can only read: the host refuses
 * `/api/v1/plugin-data/write` for a page token, so everything shown here was written by the backend.
 */

import { bonobo_ui_connect } from "./bonobo-sdk.js";

/** Collection the backend writes and the page reads. Both sides must use the same name. */
const COLLECTION = "uploads";

const root = document.getElementById("root");

/** @param {string} message */
function showStatus(message, isError = false) {
	root.replaceChildren();
	const p = document.createElement("p");
	p.className = isError ? "probe-status is-error" : "probe-status";
	p.setAttribute("role", isError ? "alert" : "status");
	p.textContent = message;
	root.append(p);
}

/**
 * @param {{ key: string, value: Record<string, unknown> }[]} documents
 * @param {() => void} onRefresh
 */
function showDocuments(documents, onRefresh) {
	root.replaceChildren();

	const header = document.createElement("div");
	header.className = "probe-header";
	const heading = document.createElement("h1");
	heading.className = "probe-heading";
	heading.textContent = `Recorded uploads (${documents.length})`;
	const refresh = document.createElement("button");
	refresh.type = "button";
	refresh.className = "probe-refresh";
	refresh.textContent = "Refresh";
	refresh.addEventListener("click", onRefresh);
	header.append(heading, refresh);
	root.append(header);

	if (documents.length === 0) {
		const empty = document.createElement("p");
		empty.className = "probe-status";
		empty.textContent = "No documents yet. Upload a file to this workspace, then refresh.";
		root.append(empty);
		return;
	}

	const list = document.createElement("ul");
	list.className = "probe-list";
	for (const document_ of documents) {
		const item = document.createElement("li");
		item.className = "probe-item";

		const name = document.createElement("span");
		name.className = "probe-name";
		name.textContent = String(document_.value.name ?? document_.key);

		const path = document.createElement("span");
		path.className = "probe-path";
		path.textContent = String(document_.value.path ?? "");

		const recordedAt = document.createElement("span");
		recordedAt.className = "probe-recorded";
		recordedAt.textContent = String(document_.value.recordedAt ?? "");

		item.append(name, path, recordedAt);
		list.append(item);
	}
	root.append(list);
}

/** @param {import("bonobo-plugin-sdk/frontend").BonoboUiFrontendClient} client */
async function loadDocuments(client) {
	showStatus("Loading documents…");
	const result = await client.fetchJson("/api/v1/plugin-data/list", {
		method: "POST",
		body: { collection: COLLECTION },
	});
	showDocuments(result.documents ?? [], () => {
		loadDocuments(client).catch((error) => {
			showStatus(error instanceof Error ? error.message : String(error), true);
		});
	});
}

bonobo_ui_connect()
	.then((client) => {
		// The context is a union since SDK 0.6.0; this plugin is only embedded as a page.
		if (client.context.kind === "page") {
			document.title = client.context.pageTitle;
		}
		return loadDocuments(client);
	})
	.catch((error) => {
		showStatus(error instanceof Error ? error.message : String(error), true);
	});
