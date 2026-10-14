/** Static reading aids. Template expressions are labels, never evaluated. */
export function readingPreviewModel(entry,localizations={}) {
 const source=entry.text;
 const markdown=entry.occurrences.some(({path})=>/\.(?:md|txt)$/i.test(path)||/LICENSE|NOTICE|OFL|COPYING/i.test(path));
 const markup=entry.occurrences.some(({path})=>/\.(?:hbs|html)$/i.test(path))||/<\/?(?:p|h[1-6]|div|section|span|button|form|input|label|ul|li|table|details|a|br|strong|em|fieldset|article)\b/i.test(source);
 const format=markdown?'markdown':markup?'html':'text';
 const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
 const literal=value=>format==='html'?escape(value):value;
 const hasPlaceholders=/\{\{|\$\{/.test(source)&&format==='html';
 const text=hasPlaceholders?source
  .replace(/\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}/g,'')
  .replace(/\{\{\s*localize\s+(["'])(.*?)\1\s*\}\}/g,(_,quote,key)=>literal(localizations[key]??key))
  .replace(/\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/g,(_,raw,normal)=>literal('['+(raw??normal).trim()+']'))
  .replace(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g,(_,expression)=>literal('['+expression.trim()+']')):source;
 return {format,text,hasPlaceholders};
}

/** Clone only reading elements. No source attributes can load resources or run actions. */
export function appendReadingPreview(container,entry,localizations={}) {
 const document=container.ownerDocument,model=readingPreviewModel(entry,localizations);
 const element=(tag,text,parent)=>{const result=document.createElement(tag);if(text!==undefined)result.textContent=text;if(parent)parent.append(result);return result;};
 const allowed=new Set('p div section article header footer main aside span h1 h2 h3 h4 h5 h6 strong b em i u s small sub sup code pre blockquote ul ol li dl dt dd table thead tbody tfoot tr th td caption fieldset legend label button input textarea select option optgroup details summary br hr a'.split(' '));
 const blocked=new Set('script style iframe frame frameset object embed svg math canvas audio video source track link meta base template noscript'.split(' '));
 function markup(target,source) {
  const inert=document.createElement('template');inert.innerHTML=source;
  const clone=node=>{
   const fragment=document.createDocumentFragment();
   if(node.nodeType===3){
    if(!model.hasPlaceholders)return document.createTextNode(node.textContent);
    let end=0;for(const match of node.textContent.matchAll(/\[(?:#[A-Za-z][^\]]*|else(?:\s[^\]]*)?|\/[A-Za-z][^\]]*)\]/g)){
     fragment.append(document.createTextNode(node.textContent.slice(end,match.index)));
     const marker=element('small',match[0]);marker.className='reading-condition';fragment.append(marker);end=match.index+match[0].length;
    }
    fragment.append(document.createTextNode(node.textContent.slice(end)));return fragment;
   }
   if(node.nodeType!==1)return fragment;
   const tag=node.localName.toLowerCase();
   if(blocked.has(tag))return fragment;
   if(tag==='img')return element('span','[Image'+(node.getAttribute('alt')?': '+node.getAttribute('alt'):'')+']');
   if(!allowed.has(tag)&&tag!=='form'){for(const child of node.childNodes)fragment.append(clone(child));return fragment;}
   const copy=element(tag==='form'?'div':tag);
   for(const attribute of ['title','aria-label','placeholder'])if(node.hasAttribute(attribute))copy.setAttribute(attribute,node.getAttribute(attribute));
   if(tag==='button'){copy.type='button';copy.disabled=true;}
   if(tag==='input'){
    copy.type=['checkbox','radio','number','text'].includes(node.getAttribute('type'))?node.getAttribute('type'):'text';
    copy.value=node.getAttribute('value')??'';copy.disabled=true;copy.checked=node.hasAttribute('checked');
   }
   if(tag==='textarea'||tag==='select')copy.disabled=true;
   if(tag==='option')copy.selected=node.hasAttribute('selected');
   if(tag==='details')copy.open=true;
   for(const child of node.childNodes)copy.append(clone(child));
   return copy;
  };
  for(const child of inert.content.childNodes)target.append(clone(child));
 }
 function inline(target,text) {
  const tokens=/`(?<code>[^`]+)`|\*\*(?<bold>[^*]+)\*\*|__(?<strong>[^_]+)__|\*(?<italic>[^*]+)\*|!\[(?<image>[^\]]*)\]\([^)]*\)|\[(?<link>[^\]]+)\]\([^)]*\)/g;
  let end=0;
  for(const match of text.matchAll(tokens)){
   target.append(document.createTextNode(text.slice(end,match.index)));
   const group=match.groups;
   if(group.code!==undefined)element('code',group.code,target);
   else if(group.bold!==undefined||group.strong!==undefined)inline(element('strong',undefined,target),group.bold??group.strong);
   else if(group.italic!==undefined)inline(element('em',undefined,target),group.italic);
   else if(group.image!==undefined)element('span','[Image: '+group.image+']',target);
   else inline(element('a',undefined,target),group.link);
   end=match.index+match[0].length;
  }
  target.append(document.createTextNode(text.slice(end)));
 }
 function markdown(target,text) {
  const lines=text.replace(/\r\n?/g,'\n').split('\n');let list;
  const fence=line=>line.match(/^\s*(`{3,}|~{3,})(\S*)\s*$/);
  const isList=line=>/^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
  const cells=line=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
  for(let index=0;index<lines.length;index++){
   const line=lines[index];
   if(!line.trim()){list=null;continue;}
   const opening=fence(line);
   if(opening){
    list=null;const code=[];while(++index<lines.length&&!lines[index].trim().startsWith(opening[1]))code.push(lines[index]);
    element('code',code.join('\n'),element('pre',undefined,target));
    if(/^(?:html|hbs|handlebars)$/.test(opening[2])){
     const example=element('div',undefined,target);example.className='reading-example';element('small','Rendered example',example);
     markup(example,readingPreviewModel({text:code.join('\n'),occurrences:[{path:'example.hbs'}]},localizations).text);
    }
    continue;
   }
   const heading=line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
   if(heading){list=null;inline(element('h'+heading[1].length,undefined,target),heading[2].replace(/\s+#+\s*$/,''));continue;}
   if(/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)){list=null;element('hr',undefined,target);continue;}
   if(line.includes('|')&&/^\s*\|?\s*:?-{3,}/.test(lines[index+1]??'')){
    list=null;const table=element('table',undefined,target),head=element('tr',undefined,element('thead',undefined,table));
    for(const value of cells(line))inline(element('th',undefined,head),value);
    index++;const body=element('tbody',undefined,table);
    while(index+1<lines.length&&lines[index+1].includes('|')){const row=element('tr',undefined,body);for(const value of cells(lines[++index]))inline(element('td',undefined,row),value);}
    continue;
   }
   if(isList(line)){
    const ordered=/^\s*\d/.test(line),tag=ordered?'ol':'ul';if(!list||list.localName!==tag)list=element(tag,undefined,target);
    inline(element('li',undefined,list),line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/,''));continue;
   }
   list=null;
   if(/^\s*>/.test(line)){inline(element('blockquote',undefined,target),line.replace(/^\s*>\s?/,''));continue;}
   if(/^\s*</.test(line)){const block=[line];while(index+1<lines.length&&lines[index+1].trim())block.push(lines[++index]);markup(target,block.join('\n'));continue;}
   const paragraph=[line];
   while(index+1<lines.length&&lines[index+1].trim()&&!/^(?:\s*#|\s*>|\s*<)/.test(lines[index+1])&&!fence(lines[index+1])&&!isList(lines[index+1])&&!lines[index+1].includes('|'))paragraph.push(lines[++index]);
   inline(element('p',undefined,target),paragraph.join(' '));
  }
 }
 container.dataset.previewFormat=model.format;
 if(model.format==='html')markup(container,model.text);
 else if(model.format==='markdown')markdown(container,model.text);
 else {container.classList.add('reading-plain');container.textContent=model.text;}
 if(model.hasPlaceholders)container.dataset.placeholders='true';
}
