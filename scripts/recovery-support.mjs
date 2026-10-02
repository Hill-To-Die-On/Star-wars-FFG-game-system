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
