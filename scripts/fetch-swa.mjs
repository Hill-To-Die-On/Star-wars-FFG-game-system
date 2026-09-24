import { mkdir, writeFile } from "node:fs/promises";
const origin = "https://swa.stoogoff.com";
async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok)
    throw new Error(`Source download failed: ${response.status} ${url}`);
  const text = await response.text();
  if (text.length > 10 * 1024 * 1024)
    throw new Error("Source file exceeds 10 MB.");
  return text;
}
const home = await fetchText(`${origin}/`);
const version = /["'](\d+\.\d+\.\d+)\/media\//.exec(home)?.[1];
if (!version)
  throw new Error(
    "The site's data layout changed; inspect its published source before updating this connector.",
  );
const collections = Object.fromEntries(
  await Promise.all(
    [
      "adversaries",
      "weapons",
      "talents",
      "qualities",
      "skills",
      "vehicles",
    ].map(async (key) => {
      const data = JSON.parse(
        await fetchText(`${origin}/${version}/media/data/${key}.json`),
      );
      if (!Array.isArray(data)) throw new Error(`Unexpected ${key} format.`);
      return [key, data];
    }),
  ),
);
await mkdir(".local", { recursive: true });
await writeFile(
  ".local/swa-source.json",
  JSON.stringify({
    format: "swa-source",
    version: 1,
    siteVersion: version,
    origin,
    collections,
  }),
);
console.log(
  JSON.stringify({
    output: ".local/swa-source.json",
    version,
    counts: Object.fromEntries(
      Object.entries(collections).map(([key, rows]) => [key, rows.length]),
    ),
  }),
);
