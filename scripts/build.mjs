import { build } from "esbuild";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const preact = (path) =>
	fileURLToPath(new URL(`../node_modules/preact/${path}`, import.meta.url));
const common = {
	bundle: true,
	format: "esm",
	target: "es2022",
	minify: false,
	legalComments: "inline",
	preserveSymlinks: true,
};

await build({
	...common,
	entryPoints: ["src/backend.ts"],
	outfile: "dist/backend/worker.js",
});
await build({
	...common,
	entryPoints: ["src/frontend.ts"],
	outfile: "dist/frontend/app.js",
	define: { "process.env.NODE_ENV": '"production"' },
	// Match the first-party plugins: readable Preact source keeps the SDK bundle reviewable.
	alias: {
		"react/jsx-runtime": preact("jsx-runtime/src/index.js"),
		react: preact("compat/src/index.js"),
		"preact/compat": preact("compat/src/index.js"),
		"preact/hooks": preact("hooks/src/index.js"),
		preact: preact("src/index.js"),
	},
});
for (const path of ["dist/backend/worker.js", "dist/frontend/app.js"]) {
	const formatted = await format(await readFile(path, "utf8"), {
		parser: "babel",
		useTabs: true,
	});
	// The Convex bundle has blank comment lines that keep spaces after formatting.
	await writeFile(path, formatted.replace(/^[\t ]+$/gm, ""));
}
await copyFile("src/index.html", "dist/frontend/index.html");
await copyFile("src/app.css", "dist/frontend/app.css");
