# Data Probe

This normal plugin checks backend responses and the plugin document store. It uses the current frontend SDK. It needs `plugin.backend.invoke`, `plugin.data.read`, and `plugin.data.write`. It has no secrets and no outside network origins.

The page runs one selected case through endpoint `probe` (`/probe`). It displays only a small summary: outer status, run ID, plugin status, output byte count, SHA-256, complete encoded reply byte count, and a short parsed message. It does not print a large response or token and does not retry a case.

| Case                     | Expected result                                                  |
| ------------------------ | ---------------------------------------------------------------- |
| JSON 200/400/409/500     | Outer 200, original plugin status, complete small JSON message.  |
| Empty 204                | Outer 200, plugin 204, zero output bytes.                        |
| Exact cap                | Outer 200, complete encoded reply exactly 16,777,216 bytes.      |
| One byte over            | Host size error; no truncated success.                           |
| Raw over                 | Host size error after reading more than 16,777,216 raw bytes.    |
| Escaped text and Unicode | Exact encoded cap with quotes, backslashes, newlines, and emoji. |
| Tiny chunks              | A small complete response delivered in one-byte chunks.          |
| Broken stream            | Host execution failure.                                          |
| Stalled stream           | Host timeout after about 35 seconds.                             |
| Save then 500            | One saved document, outer 200, plugin 500 with its message.      |
| Save then throw          | One saved document, host execution failure.                      |

Large replies are generated at runtime. The exact-size cases include the host-provided `event.pluginRunId`, status, field names, JSON punctuation, and escaping. They do not trust an input run ID. The backend uses the current `env.BONOBO.host.apiOrigin` and `token` binding for host API calls.

Host writes use `redirect: "manual"` and refuse every non-2xx response, including redirects. This keeps the token off redirect destinations and avoids the runner's rejection of `redirect: "error"` seen during 0.2.0 checks. The stalled stream uses a real 60-second timer to keep the read alive past the 35-second invoke deadline. Cancellation clears the timer. An unresolved promise with no future event can fail immediately in Workers, so that 0.2.0 case was not a timeout proof.

PNG uploads whose names start with `noop` return 204 without an API call. Other PNG uploads write one test document and return 204 without creating a file. The normal installation folder filter still applies. Editable text uploads do not trigger this stored-blob event.

Only `response_probes` keys `qa-<runId>` are written. The page can refresh up to 100 of those documents. Existing `uploads` documents are not changed or deleted. Repeating a case starts a new host run and creates a new test record for save cases. Do not use uninstall to clean up a preserved installation: uninstall deletes its plugin store.

## Chat agent fixture

Since 0.3.0 the plugin is also the Press QA fixture for MCP servers and plugin skills. It needs `agent.mcp.connect` and `agent.skills.contribute`.

- MCP server `fixture` points at the public `modern-basic` test server (`packages/mcp-fixture-worker` in the Press repository). It has the tools `echo` and `picture`, no sign-in, and no secrets.
- Skill `mcp-echo` (`dist/skills/mcp-echo/SKILL.md`) tells the agent to call `echo` and reply with the echoed text.

The MCP fixture does not change the page or upload cases. Install this plugin only in a QA workspace: every chat there gets the fixture tools.

## Scheduled permission checks

Since 0.4.0, the plugin declares `plugin.schedule.run` and `workspace.files.read`. It uses only current public host APIs. The default schedule runs `idle` once a week, with no API calls. YAML never chooses an actor, consent grant, or token. Select the user's own grant through the normal host controls. These checks accept only a root run with null chain state.

Keep the existing upload settings. Set `schedule.everyMinutes` to a whole number from 15 to 10080. Use one of these diagnostic settings:

```yaml
diagnostic:
  case: kv-read-only
  seedKey: qa-<saved-invoke-run-id>
  deniedFile: /denied/note.txt
```

First use the page's existing **Save then 500** case. Refresh to confirm its `write-500` document and use that key as the seed. Select a real user who granted only `plugin_data:read`. The scheduled check requires that seed read to succeed, then requires 403 for a KV write and a Files read. It returns 200 only when all three checks pass. The write uses a new `qa-<scheduled-run-id>` key and never overwrites the seed. If the grant wrongly allows write, it may save that one small diagnostic document before returning 409.

```yaml
diagnostic:
  case: files-read
  allowedFolder: /allowed
  allowedFile: /allowed/note.txt
  allowedFileSha256: <64-lowercase-hex-digits>
  deniedFolder: /denied
  deniedFile: /denied/note.txt
```

Use two small saved QA folders and text files, outside `/.mounts`. Grant the installation account read on both restricted folder roots. Grant the selected user access to only the allowed folder, then let that user grant `files:list` and `files:read` with that folder as proof. The proof adds no Files access. The check requires a final list page containing the allowed file, a matching SHA-256 for its text, 404 for the existing unrelated file, and an empty final page for the denied folder. It returns 200 only after those four calls. It makes no writes. Each list uses `limit:10`, `scanLimit:30` and `recursive:true`; a larger or unfinished fixture fails. Each read uses `maxBytes:4096`.

Run an owner control with the same files first. The unrelated file read must succeed and this diagnostic must return 409. Then the folder-only user's unchanged check must return 200. This proves the user limit rather than an account that cannot read either target. Save and restore the real roles and sharing grants. Do not fake consent or insert fixture documents directly.

```yaml
diagnostic:
  case: revoke-hold
  seedKey: qa-<saved-invoke-run-id>
```

Select a real user with their own KV read/write grant. The check reads the seed, then saves a `scheduled-waiting` marker at its new run key. Refresh the page and confirm running host history. The selected user must revoke their own grant during the real 30-second wait. The plugin then uses the same old token for a seed read and a follow-up request. Both must return 401 before it returns empty 204. If the old token still reads, the check returns 409 before requesting follow-up. No successful child run is requested by this check.

Canceled host history and the waiting marker do not prove the later 401s. The host ignores late completion after cancellation. Pair them with the existing runner's completed status 204 log for that exact run and the reviewed source pin. If the Worker stops early or that log is absent, leave the old-token assertion unverified. Old actor/grant and chain history must remain after reassignment or rejoin.

Scheduled requests have a five-second timeout, manual redirects, no retries, and a 64 KiB JSON reply cap. Malformed settings return 400. Any failed check or host error returns generic 409, without content, tokens, or raw error text. These modes write no mounted files and need no mounted-file billing. Worker and database use still apply. Use real fixture accounts and invites. Do not change credits or customer IDs.

## Build and review

`src/backend.ts` and `src/frontend.ts` are bundled to the listed `dist/` files. The frontend includes the SDK and readable Preact source, matching the first-party plugins. Generated files are committed for normal GitHub publishing. The manifest script checks file sizes and source-line length and updates hashes.

From this repository:

```powershell
vp env exec pnpm --ignore-workspace install --frozen-lockfile
vp env exec pnpm --ignore-workspace run typecheck
vp env exec pnpm --ignore-workspace run test
vp env exec pnpm --ignore-workspace run build
vp env exec pnpm --ignore-workspace run build
git diff --check
```

The two builds must have identical file hashes. Direct tests verify status, complete envelope size, byte chunks, stream failures, host writes, scheduled permission checks, and held revocation. They do not prove live consent, deployed runner/Convex behavior, or browser accessibility. Break each permission check on purpose, observe its named test fail, restore exact source bytes, and pass again before review.

This release pins SDK 0.20.0 at reviewed mirror commit `5e7cdcb4c0e2420aebcd93720fd313ba9b90df51`. Version 0.2.1 was confirmed unused in the registry. Review and publish the exact commit through the normal plugin flow, update the intended installation with its existing service account, then verify the served version and artifact bytes. No permission, store, or review bypass is part of this fixture.
