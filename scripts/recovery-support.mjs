import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {validateReleasePath} from './release-policy.mjs';

export function ownedPath(root,...parts) {
  const path=resolve(root,...parts),rel=relative(resolve(root),path);
  if(!rel || rel==='..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel))
    throw Error('Recovery output must remain inside its owned directory.');
  return path;
}
export function inspectRecoveryArchive(bytes) {
  if(bytes.byteLength>128*1024*1024)throw Error('Archive exceeds the bounded acceptance limit.');
  let expandedBytes=0,count=0;const seen=new Set();
  const files=unzipSync(bytes,{filter:file=>{
    validateReleasePath(file.name);
    expandedBytes+=file.originalSize;
    if(++count>10_000 || expandedBytes>256*1024*1024)throw Error('Archive exceeds the bounded acceptance limit.');
    if(seen.has(file.name))throw Error('Duplicate recovery archive entry.');
    seen.add(file.name);return true;
  }}),names=Object.keys(files);
  if(!names.length || names.length>10_000 || Object.values(files).reduce((n,b)=>n+b.byteLength,0)>256*1024*1024)
    throw Error('Archive exceeds the bounded acceptance limit.');
  for(const name of names)validateReleasePath(name);
  const manifest=JSON.parse(new TextDecoder().decode(files['system.json']));
  if(manifest.id!=='star-wars-ffg' || !/^\d+\.\d+\.\d+$/.test(manifest.version))throw Error('Unexpected package identity.');
  for(const path of [...manifest.esmodules??[],...manifest.styles??[]])if(!files[path]?.length)throw Error('Missing package entrypoint.');
  return {files,manifest,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export function coreVersionFromPackage(pkg) {
  const {generation,build}=pkg?.release??{};
  if(!Number.isInteger(generation)||!Number.isInteger(build))throw Error('Foundry package.json has no release core version.');
  return `${generation}.${build}`;
}
/** The core build beside a licensed main.js, e.g. "14.369". */
export async function installedCoreVersion(app) {
  return coreVersionFromPackage(JSON.parse(await readFile(resolve(dirname(resolve(app)),'package.json'),'utf8')));
}
/** Parses a core logCompatibilityWarning console message; null for any other text. */
export function classifyCompatibilityWarning(text) {
  const since=/Deprecated since Version (\S+)/.exec(text)?.[1],until=/removed in Version (\S+)/.exec(text)?.[1];
  if(!since&&!until)return null;
  const lines=String(text).split('\n');
  return {message:lines[0],since:since??null,until:until??null,fromSystem:lines.some(line=>/^\s*at .*\/systems\/star-wars-ffg\//.test(line))};
}
/** The join screen offers either a user select (Foundry 14.369) or a typed name field. */
export async function chooseJoinUser(field,name) {
  if(await field.evaluate(el=>el.tagName==='SELECT'))await field.selectOption({label:name});else await field.fill(name);
}
/** Foundry 14.369 sends invitation links in world data; a load before its post-listen address lookup ends fails this way. */
export function isCoreAddressRace(message) {
  return /^\[ReleaseData\] validation errors/.test(String(message));
}
/** Loads the game as the named user, retrying only that core startup race. Returns the retries used. */
export async function joinGame(page,url,name,errors,{attempts=3,delay=2000,poll=250}={}) {
  for(let attempt=1;;attempt++) {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60_000});
    if(page.url().includes('/join')){await chooseJoinUser(page.locator('#join-username'),name);await page.getByRole('button',{name:'Join Game Session'}).click();}
    // A slow healthy load keeps the full timeout; only the recognized race ends a wait early.
    const ready=page.waitForFunction(()=>globalThis.game?.ready,null,{timeout:60_000}).then(()=>'ready');
    let timer;
    const raced=new Promise(done=>{timer=setInterval(()=>{if(errors.some(isCoreAddressRace))done('race');},poll);});
    try {if(await Promise.race([ready,raced])==='ready')return attempt-1;}
    finally {clearInterval(timer);}
    ready.catch(()=>{});
    if(attempt>=attempts)throw Error('Foundry core startup race persisted after every join attempt.');
    errors.splice(0,errors.length,...errors.filter(e=>!isCoreAddressRace(e)));
    await new Promise(done=>setTimeout(done,delay));
  }
}
export async function installRecoveryArchive(archive,destination) {
  const result=inspectRecoveryArchive(await readFile(archive));
  // A harness never overwrites an existing installed package.
  await mkdir(destination);
  for(const [name,bytes]of Object.entries(result.files)) {
    const target=ownedPath(destination,name);await mkdir(dirname(target),{recursive:true});
    await writeFile(target,bytes,{flag:'wx'});
  }
  return {version:result.manifest.version,sha256:result.sha256};
}
