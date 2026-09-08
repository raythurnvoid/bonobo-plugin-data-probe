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

PNG uploads whose names start with `noop` return 204 without an API call. Other PNG uploads write one test document and return 204 without creating a file. The normal installation folder filter still applies. Editable text uploads do not trigger this stored-blob event.

Only `response_probes` keys `qa-<runId>` are written. The page can refresh up to 100 of those documents. Existing `uploads` documents are not changed or deleted. Repeating a case starts a new host run and creates a new test record for save cases. Do not use uninstall to clean up a preserved installation: uninstall deletes its plugin store.

## Build and review

`src/backend.ts` and `src/frontend.ts` are bundled to the listed `dist/` files. The frontend includes the SDK and readable Preact source, matching the first-party plugins. Generated files are committed for normal GitHub publishing. The manifest script checks file sizes and source-line length and updates hashes.

From this repository:

```powershell
vp env exec pnpm --ignore-workspace install
vp env exec pnpm --ignore-workspace run typecheck
vp env exec pnpm --ignore-workspace run test
vp env exec pnpm --ignore-workspace run build
vp env exec pnpm --ignore-workspace run build
git diff --check
```

The two builds must have identical file hashes. Direct tests verify status, complete envelope size, byte chunks, stream failures, and host writes. They do not prove deployed runner/Convex capacity or browser accessibility.

This release pins SDK 0.20.0 at reviewed mirror commit `5e7cdcb4c0e2420aebcd93720fd313ba9b90df51`. Version 0.2.0 was confirmed unused in the registry. Review and publish the exact commit through the normal plugin flow, update the intended installation with its existing service account, then verify the served version and artifact bytes. No permission, store, or review bypass is part of this fixture.
