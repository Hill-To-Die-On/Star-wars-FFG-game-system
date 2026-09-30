import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { auditReleaseFiles } from "./release-policy.mjs";

const archive = await readFile("dist/star-wars-ffg.zip");
const manifestBytes = await readFile("dist/system.json");
const inventory = JSON.parse(await readFile("dist/contents.json", "utf8"));
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const result = auditReleaseFiles(unzipSync(archive), { version, inventory, manifestBytes });
result.archiveSha256 = createHash("sha256").update(archive).digest("hex");
await writeFile("dist/release-audit.json", JSON.stringify(result, null, 2) + "\n");
console.log("Release audit passed: " + result.fileCount + " files, matching manifest/inventory, public paths, content signatures and SHA-256 evidence.");