// Small summaries of the host's Restore and job replies. The backend and the page both use them.
// They copy only known fields. So a token or any other unknown field in a reply never reaches
// the page.

function is_record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Return the string when it is short enough, or null. Never cut a string: a cut cursor or path
 * would look valid but be wrong.
 */
function short_text(value: unknown, maxLength: number) {
	return typeof value === "string" && value.length <= maxLength ? value : null;
}

function refused_rows(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.filter(is_record).map((row) => ({
		path: short_text(row.path, 1024),
		nodeId: short_text(row.nodeId, 128),
		message: short_text(row.message, 300),
	}));
}

function job_fields(value: Record<string, unknown>) {
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

function refusal(hostStatus: number, value: unknown) {
	return {
		hostStatus,
		message: is_record(value) ? short_text(value.message, 300) : null,
		errorCode: is_record(value) ? short_text(value.errorCode, 64) : null,
	};
}

/**
 * Summarize a `files/restore` reply: job ids, or the dry-run jobs, or the host refusal.
 */
export function restore_summary(hostStatus: number, value: unknown) {
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

/**
 * Summarize a `files/jobs/get` reply: one page of job outcomes and the next cursor, or the host
 * refusal.
 */
export function job_summary(hostStatus: number, value: unknown) {
	if (hostStatus !== 200 || !is_record(value))
		return refusal(hostStatus, value);
	return {
		hostStatus,
		jobId: short_text(value.jobId, 128),
		...job_fields(value),
		refusedCursor: short_text(value.refusedCursor, 4096),
	};
}
