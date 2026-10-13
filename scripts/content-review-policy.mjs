import { createHash } from "node:crypto";
import { parse } from "acorn";
import { normalizeReviewDraft, reviewDraftIssues } from './content-review-workflow.mjs';

const decoder = new TextDecoder();
const hash = value => createHash("sha256").update(value).digest("hex");

/** Inventory the actual ZIP, retaining exact strings and every source occurrence. */
export function createContentReview(files, { archiveSha256, releasePhase = 'Beta' } = {}) {
  if (!['Alpha', 'Beta'].includes(releasePhase)) throw Error('Unknown release phase.');
  const manifest = JSON.parse(decoder.decode(files["system.json"]));
  const archivePhase = decoder.decode(files['README.md'] ?? new Uint8Array()).match(/\b(Alpha|Beta) listing candidate\b/i)?.[1] ?? null;
  const entries = new Map(), inventory = [];
  const add = (category, text, path, location, reviewRole) => {
    if (typeof text !== "string" || !text.trim()) return;
    const sha256 = hash(text), id = hash(category + "\0" + text);
    if (!entries.has(id)) entries.set(id, {id, sha256, category, text, occurrences:[]});
    entries.get(id).occurrences.push({path, location, ...(reviewRole ? {reviewRole} : {})});
  };
  for (const path of Object.keys(files).sort()) {
    const bytes = files[path], text = decoder.decode(bytes);
    const file = {path, bytes:bytes.length, sha256:hash(bytes), review:"code-maintainability"};
    inventory.push(file);
    if (/\.json$/i.test(path)) {
      const data = JSON.parse(text);
      const walk = (value, pointer = "") => {
        if (typeof value === "string") {
          const category = path.startsWith("lang/") ? "English interface" :
            path === "system.json" && ["/title","/description"].includes(pointer) ? "Listing and manifest" :
            path.startsWith("data/") && /(?:summary|description|guidance|explanation|warning|note|effect|prompt|text)(?:\/|$)/i.test(pointer) ? "Prepared guidance and rules text" :
            path.startsWith("data/") ? "Reference data and source metadata" : "Configuration and schema text";
          add(category, value, path, pointer || "/");
        } else if (Array.isArray(value)) value.forEach((entry,index)=>walk(entry, pointer+"/"+index));
        else if (value && typeof value === "object")
          for (const [key,entry] of Object.entries(value)) walk(entry, pointer+"/"+key.replace(/~/g,"~0").replace(/\//g,"~1"));
      };
      walk(data); file.review="text-inventoried";
    } else if (/\.(?:md|txt|hbs|html)$/i.test(path) || path === "LICENSE") {
      add(path.endsWith(".hbs") ? "Complete interface templates" :
        /LICENSE|NOTICE|OFL|COPYING/i.test(path) ? "Licences and attribution" : "Documentation", text, path, "complete file");
      file.review="text-inventoried";
    } else if (/\.(?:mjs|js)$/i.test(path) && !path.includes("/vendor/")) {
      const source = parse(text, {ecmaVersion:"latest",sourceType:"module",locations:true,allowHashBang:true});
      const addNode = (node,value,parent) => {
        const method = parent?.callee?.property?.name;
        const firstArgument = parent?.type === 'CallExpression' && parent.arguments[0] === node;
        const selectorOrAttribute = firstArgument && ['querySelector','querySelectorAll','closest','matches','getAttribute','setAttribute','removeAttribute','hasAttribute','createElement','addEventListener','removeEventListener'].includes(method);
        const propertyAccess = parent?.type === 'MemberExpression' && parent.property === node;
        const comparedConstant = parent?.type === 'BinaryExpression' && ['==','===','!=','!=='].includes(parent.operator);
        const technicalReference = /^SWFFG\.[\w.]+$/.test(value) || /^#[\da-f]{3,8}$/i.test(value);
        const reviewRole = selectorOrAttribute || propertyAccess || comparedConstant || technicalReference ? 'technical' : 'prepared-candidate';
        add("Inline runtime text and code literals", value, path, `L${node.loc.start.line}:${node.loc.start.column+1}`, reviewRole);
      };
      const visit = (node,parent) => {
        if (!node || typeof node!=="object" || !node.type) return;
        if (node.type==="TemplateLiteral") {
          addNode(node,node.quasis.map((part,index)=>(part.value.cooked??part.value.raw)+(node.expressions[index]?"${"+text.slice(node.expressions[index].start,node.expressions[index].end)+"}":"")).join(""),parent);
          for (const expression of node.expressions) visit(expression,node);
          return;
        }
        if (node.type==="Literal" && typeof node.value==="string") {
          const moduleReference=["ImportDeclaration","ExportNamedDeclaration","ExportAllDeclaration","ImportExpression"].includes(parent?.type)&&parent.source===node;
          if (!moduleReference) addNode(node,node.value,parent);
        }
        for (const [key,value] of Object.entries(node)) {
          if (["loc","start","end"].includes(key)) continue;
          if (Array.isArray(value)) for (const child of value) visit(child,node);
          else visit(value,node);
        }
      };
      visit(source); file.review="text-inventoried-and-code-maintainability";
    } else if (/\.css$/i.test(path)) {
      for (const match of text.matchAll(/\bcontent\s*:\s*(["'])(.*?)\1/g))
        add("CSS interface labels",match[2],path,`L${text.slice(0,match.index).split("\n").length}`);
    } else if (/\.svg$/i.test(path)) {
      for (const match of text.matchAll(/<(?:title|desc|text)\b[^>]*>([\s\S]*?)<\/(?:title|desc|text)>/gi))
        add("SVG accessible text",match[1],path,`L${text.slice(0,match.index).split("\n").length}`);
      file.review="vector-code-and-asset-provenance";
    } else if (!/\.(?:mjs|js)$/i.test(path)) file.review="asset-provenance";
  }
  return {
    schemaVersion:1, archiveSha256, releasePhase, archivePhase, version:manifest.version, systemId:manifest.id,
    advertisedLocales:manifest.languages.map(language=>language.lang),
    files:inventory, entries:[...entries.values()].sort((a,b)=>a.category.localeCompare(b.category)||a.occurrences[0].path.localeCompare(b.occurrences[0].path)||a.occurrences[0].location.localeCompare(b.occurrences[0].location)),
    humanGates:[
      {id:"prepared-authorship",title:"Prepared text has human authorship evidence; AI-origin text is replaced by independently human-authored text"},
      {id:"listing-authorship",title:"The User writes the final Foundry listing description and confirms its "+releasePhase+" limitations"},
      {id:"data-permission",title:"Retain the creator's publication permission and confirm scope for the shipped database and derivatives"},
      {id:"asset-provenance",title:"Confirm human origin and redistribution rights for all raster assets and retained font/symbol licences"},
      {id:"maintainability",title:"The maintainer can understand, explain, modify and maintain all submitted code"},
      {id:"independent-gm",title:"An independent human GM completes onboarding and a short ordinary-play session"},
    ],
  };
}

/** Review evidence is always explicit, archive-bound and never an automatic approval. */
export function reviewDecisions(review, input) {
  const draft = normalizeReviewDraft(review, input), issues = reviewDraftIssues(review, draft);
  if (issues.length) throw Error(issues[0].message);
  return draft;
}
