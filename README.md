# Data Probe

A very small Bonobo plugin that exercises the plugin data store end to end.

- The **backend** runs when an upload finishes and writes one document into the `uploads` collection,
  keyed by the uploaded file's node id.
- The **page** lists that same collection.

The page can only read. The host refuses `/api/v1/plugin-data/write` for a page token, so anything the
page shows was written by the backend.

## Why it exists

It is the smallest plugin that proves two claims about the plugin data store:

1. A plugin backend can write a document, and its own page can read that document back.
2. Uninstalling the plugin deletes every row the installation owned.

Nothing here is meant to be useful on its own.

## Layout

There is no build step. `dist/` is written by hand and committed.

| Path                            | What it is                                                   |
| ------------------------------- | ------------------------------------------------------------ |
| `bonobo.plugin.json`            | Source of truth for the manifest                             |
| `dist/bonobo.plugin.json`       | Byte copy of the above; the only manifest the app fetches    |
| `dist/backend/worker.js`        | Backend entry, runs on `files.upload.completed`              |
| `dist/frontend/index.html`      | Page entry                                                   |
| `dist/frontend/app.js`          | Page code                                                    |
| `dist/frontend/app.css`         | Page styles                                                  |
| `dist/frontend/bonobo-sdk.js`   | Copy of `bonobo-plugin-sdk/frontend.js`, vendored            |

The SDK bridge is vendored instead of installed because the page ships no bundler. The plugin asset
CSP allows same-origin scripts only, so the page imports it as a relative module.

## Releasing

Edit the files, then run:

```
pnpm build:manifest
```

That recomputes every `files[]` hash and size from disk and copies the manifest to
`dist/bonobo.plugin.json`. Commit, push, then publish the repository from the app.
