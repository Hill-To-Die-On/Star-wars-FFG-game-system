import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
test("wiki navigation resolves to committed pages and distinguishes the candidate", async()=>{
  const files=await readdir(new URL("../docs/wiki/",import.meta.url));
  assert.equal(files.filter(name=>!name.startsWith("_")&&name.endsWith(".md")).length,10);
  let links=0;
  for(const file of files) {
    const text=await readFile(new URL(`../docs/wiki/${file}`,import.meta.url),"utf8");
    for(const [,target] of text.matchAll(/\]\(([^)]+)\)/g)) {
      if(/^https:\/\//.test(target))continue;
      assert.ok(files.includes(`${target}.md`),`${file} links to missing ${target}`);links++;
    }
  }
  assert.ok(links>=15,"Navigation coverage must not be empty");
  const home=await readFile(new URL("../docs/wiki/Home.md",import.meta.url),"utf8");
  const {version}=JSON.parse(await readFile(new URL('../system.json',import.meta.url),'utf8'));
  assert.match(home,/stable release is \*\*0\.3\.0/);
  const changelog=await readFile(new URL("../CHANGELOG.md",import.meta.url),"utf8");
  const versions=Array.from(changelog.matchAll(/^## ([\d.]+) — (Unreleased|\d{4}-\d{2}-\d{2})$/gm));
  const manifestEntry=versions.find(([,number])=>number===version);
  assert.ok(manifestEntry,"The manifest version has a changelog entry");
  const published=versions.find(([, , date])=>date!=="Unreleased");
  assert.ok(published && home.includes(`**${published[1]} Beta release**`));
  if (manifestEntry[2]==="Unreleased") {
    assert.ok(home.includes(`**${version} local candidate**`));
    assert.ok(!home.includes(`**${version} Beta release**`));
  }
  assert.match(home,/English only/);
});
