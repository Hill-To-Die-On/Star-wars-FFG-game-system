/** Foundry-shaped browser fixture for UI journeys; this is not live Foundry acceptance. */
const listeners=new Map();
globalThis.Hooks={on(name,fn){const rows=listeners.get(name)??[];rows.push(fn);listeners.set(name,rows);return fn;},off(name,fn){listeners.set(name,(listeners.get(name)??[]).filter(row=>row!==fn));},once(name,fn){this.on(name,fn);},callAll(name,...args){for(const fn of listeners.get(name)??[])fn(...args);}};
const collection=rows=>Object.assign(rows,{get(id){return this.find(r=>r.id===id);}});
const write=(doc,path,value)=>{const keys=path.split('.');let target=doc;for(const k of keys.slice(0,-1))target=target[k]??={};target[keys.at(-1)]=structuredClone(value);};
function expandData(value) {
 if(Array.isArray(value))return value.map(expandData);
 if(!value||typeof value!=='object')return value;
 const result={};for(const [path,entry]of Object.entries(value))write(result,path,expandData(entry));return result;
}
const documents=new Map();
const documentOf=data=>{const doc={...data,async update(changes){for(const [path,value]of Object.entries(changes))write(this,path,value);Hooks.callAll(this.uuid.startsWith('ChatMessage')?'updateChatMessage':'updateActor',this);return this;}};documents.set(doc.uuid,doc);return doc;};
const gm={id:'gm',name:'GM',isGM:true,active:true},player={id:'player',name:'Player',isGM:false,active:true};
const settings=new Map([['campaign',{lines:['edge','age','force'],bookMode:'all',obligation:true,duty:true,morality:true}],['turnTrackerControl','gm']]);
const notices=[];
globalThis.game={socket:{on(){},off(){},emit(){}},user:gm,users:collection([gm,player]),actors:collection([]),messages:collection([]),combats:[],settings:{get(_id,key){return settings.get(key);},set(_id,key,value){settings.set(key,value);return Promise.resolve(value);},register(_id,key,config){if(!settings.has(key))settings.set(key,config.default);}},system:{api:{range:{}}}};
globalThis.ui={notifications:{info(text){notices.push(text);},warn(text){notices.push(text);},error(text){notices.push(text);}},combat:{render(){}}};
globalThis.canvas={tokens:{placeables:[]}};
globalThis.fromUuid=async id=>documents.get(id);
let nextId=0;
globalThis.ChatMessage={async create(data){const id=`m${++nextId}`;const doc=documentOf({id,uuid:`ChatMessage.${id}`,author:game.user,isContentVisible:true,rolls:[],...expandData(data)});game.messages.push(doc);Hooks.callAll('createChatMessage',doc,{},doc.author.id);return doc;}};
function showDialog(config,type) {
 return new Promise(resolve=>{
  const host=document.createElement('section');host.className='application sf-tabletop-dialog';host.innerHTML=`<header class="window-header"><h2>${config.window?.title??''}</h2></header><div class="window-content"><form><div class="dialog-content">${config.content}</div><footer></footer></form></div>`;document.body.append(host);
  const app={element:host,close(){host.remove();this.element=null;resolve(null);}};
  const buttons=type==='prompt'?[{action:'ok',label:config.ok?.label??'OK',callback:config.ok?.callback}]:type==='confirm'?[{action:'yes',label:config.yes?.label??'Yes',callback:()=>true},{action:'no',label:config.no?.label??'No',callback:()=>false}]:config.buttons;
  for(const button of buttons){const el=document.createElement('button');el.type='button';el.dataset.action=button.action;el.textContent=button.label;el.addEventListener('click',async()=>{if(type==='prompt'&&!host.querySelector('form').reportValidity())return;const result=await button.callback?.(null,{form:host.querySelector('form')});host.remove();app.element=null;resolve(result);});host.querySelector('footer').append(el);}
  config.render?.(null,app);
 });
}
globalThis.foundry={utils:{randomID(){return `op${++nextId}`;}},applications:{api:{DialogV2:{prompt:config=>showDialog(config,'prompt'),confirm:config=>showDialog(config,'confirm'),wait:config=>showDialog(config,'wait')}}}};
const actor=(id,name,extra={})=>documentOf({id,uuid:`Actor.${id}`,name,type:'character',hasPlayerOwner:true,isOwner:true,items:collection([]),flags:{},system:{characteristics:{agility:3},skills:{},wounds:{value:2,max:12},strain:{value:3,max:10},soak:2,xp:{available:5,total:20},credits:50,criticals:[],obligation:{value:10},duty:{value:0},morality:{value:50,conflict:0}},testUserPermission:u=>u.id==='player',skillRank:()=>2,sheet:{render(){},activeTab:'overview'},...extra});
const hero=actor('hero','Mira Test'),second=actor('second','Vek Test');
const ship=actor('ship','Test Freighter',{type:'vehicle',hasPlayerOwner:false,system:{hullTrauma:{value:1,max:20},systemStrain:{value:2,max:15},speed:{value:1,max:4},shields:{fore:1,aft:1,port:0,starboard:0},armor:2,silhouette:4,handling:-1,crew:'2',passengers:'4'},items:collection([{id:'gun',name:'Test Cannon',type:'weapon',system:{damage:'5',critical:3,range:'close',metadata:{},source:{book:'Test Source',page:'1'}}}])});
game.actors.push(hero,second,ship);
const combatants=collection([hero,second].map((actor,i)=>({id:`s${i+1}`,name:actor.name,actor,actorId:actor.id,tokenId:`t${i+1}`,initiative:2,flags:{'star-wars-ffg':{slotSide:'pc'}}})));
game.combat=documentOf({uuid:'Combat.c',id:'c',started:true,round:1,turn:1,turns:[combatants[1],combatants[0]],combatants,flags:{}});game.combats.push(game.combat);
const outcome={passed:true,success:1,advantage:2,threat:0,triumph:1,despair:0};
const message=documentOf({id:'native',uuid:'ChatMessage.native',author:player,isContentVisible:true,rolls:[{options:{starWars:{outcome}}}],flags:{'star-wars-ffg':{actorUuid:hero.uuid,outcome}}});game.messages.push(message);
const {registerTurnEconomy}=await import('/src/turn-economy-foundry.mjs');registerTurnEconomy();
const module=await import('/src/tabletop-foundry.mjs');module.registerTabletopWorkflows();Hooks.callAll('ready');await (await import('/src/document-transactions.mjs')).getDocumentTransactionBroker().takeAuthority('Fixture GM selects the transaction tab');
globalThis.fixture={hookCount:()=>Array.from(listeners.values()).reduce((n,rows)=>n+rows.length,0),playtest:globalThis.__playtest??{run:0,seed:0},...module,hero,second,ship,message,notices,documents,gm,player};
