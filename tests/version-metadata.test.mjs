import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateVersionMetadata } from "../scripts/version-metadata.mjs";

const url = "https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system";
function fixture() {
  return {
    pkg: { name: "star-wars-ffg-system", version: "0.3.0", scripts: { test: "node --test" } },
    lock: { version: "0.3.0", packages: { "": { version: "0.3.0" }, "node_modules/example": { version: "9.1.0" } } },
    manifest: { version: "0.3.0", url, download: `${url}/releases/download/v0.3.0/star-wars-ffg.zip` },
    changelog: "# Changelog\n\n## 0.3.0 — Unreleased\n\n- New work.\n\n## 0.2.1 — 2026-09-24\n\n- Prior release.\n",
  };
}

test("version validation rejects drift in every published identity field", () => {
  assert.doesNotThrow(() => validateVersionMetadata(fixture()));
  for (const corrupt of [
    data => data.manifest.version = "0.2.1",
    data => data.lock.version = "0.2.1",
    data => data.lock.packages[""].version = "0.2.1",
    data => data.manifest.download = `${url}/releases/download/v0.2.1/star-wars-ffg.zip`,
    data => data.changelog = data.changelog.replace("0.3.0", "0.2.1"),
    data => data.changelog = data.changelog.replace("0.3.0 — Unreleased", "Unreleased"),
  ]) {
    const data = fixture(); corrupt(data);
    assert.throws(() => validateVersionMetadata(data), /version|download|changelog/i);
  }
});

async function inFixture(run, changes = {}) {
  const root = await mkdtemp(join(tmpdir(), "sw-ffg-version-"));
  const data = { ...fixture(), ...changes };
  const names = { pkg: "package.json", lock: "package-lock.json", manifest: "system.json", changelog: "CHANGELOG.md" };
  try {
    for (const [key, name] of Object.entries(names))
      await writeFile(join(root, name), key === "changelog" ? data[key] : JSON.stringify(data[key], null, 2) + "\n");
    const invoke = version => spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/set-version.mjs", import.meta.url)), version], { cwd: root, encoding: "utf8" });
    const read = async () => Object.fromEntries(await Promise.all(Object.entries(names).map(async ([key, name]) => [key, await readFile(join(root, name), "utf8")])));
    await run({ invoke, read });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("version command synchronizes metadata without changing dependencies or release history", async () => {
  await inFixture(async ({ invoke, read }) => {
    const result = invoke("0.4.0");
    assert.equal(result.status, 0, result.stderr);
    const resultFiles = await read();
    const data = { pkg: JSON.parse(resultFiles.pkg), lock: JSON.parse(resultFiles.lock), manifest: JSON.parse(resultFiles.manifest), changelog: resultFiles.changelog };
    validateVersionMetadata(data);
    assert.equal(data.pkg.version, "0.4.0");
    assert.deepEqual(data.pkg.scripts, fixture().pkg.scripts);
    assert.equal(data.lock.packages["node_modules/example"].version, "9.1.0");
    assert.match(data.changelog, /## 0\.4\.0 — Unreleased\n\n- New work\./);
    assert.ok(data.changelog.endsWith("## 0.2.1 — 2026-09-24\n\n- Prior release.\n"));
    const before = await read();
    assert.equal(invoke("0.4.0").status, 0);
    assert.deepEqual(await read(), before);
  });
});

test("version command starts a new candidate after a dated release and accepts legacy Unreleased notes", async () => {
  for (const changelog of [fixture().changelog.replace(" — Unreleased", " — 2026-09-26"), fixture().changelog.replace("0.3.0 — Unreleased", "Unreleased")]) {
    await inFixture(async ({ invoke, read }) => {
      const result = invoke("0.4.0");
      assert.equal(result.status, 0, result.stderr);
      const updated = (await read()).changelog;
      assert.match(updated, /## 0\.4\.0 — Unreleased/);
      assert.ok(updated.includes("- New work."));
      if (changelog.includes("2026-09-26")) assert.ok(updated.endsWith(changelog.slice(changelog.indexOf("## 0.3.0"))));
    }, { changelog });
  }
});

test("invalid, unsupported prerelease and backwards versions fail without changing any files", async () => {
  await inFixture(async ({ invoke, read }) => {
    const before = await read();
    for (const version of ["0.2.9", "0.4", "v0.4.0", "0.4.0-dev.1", "0.4.0+build.1", "01.4.0", "9007199254740992.0.0"]) {
      const result = invoke(version);
      assert.notEqual(result.status, 0, version);
      assert.match(result.stderr, /version/i);
      assert.deepEqual(await read(), before, version);
    }
  });
});
