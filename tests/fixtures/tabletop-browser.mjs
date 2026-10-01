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
const SYSTEM_ID='star-wars-ffg',playtest=globalThis.__playtest??{run:0,seed:0,state:null},previous=playtest.state??null;
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const gm={id:'gm',name:'GM',isGM:true,active:true},player={id:'player',name:'Player',isGM:false,active:true};
const playerUsers=[2,3,4,5,6].map(id=>({id:`player${id}`,name:`Player ${id}`,isGM:false,active:true}));
const users=collection([gm,player,...playerUsers]);
const settings=new Map([
 ['campaign',clone(previous?.settings?.campaign)??{lines:['edge','age','force'],bookMode:'all',obligation:true,duty:true,morality:true}],
 ['destiny',clone(previous?.settings?.destiny)??{light:1,dark:1}],
 ['turnTrackerControl','gm'],
]);
const scenes=collection([{id:'hangar',name:'Outpost 07 Test Hangar'},{id:'relay',name:'Nysa Relay'},{id:'chase',name:'Debris Field Chase'}]);
const activeScene=scenes.get(previous?.scene?.id)??scenes[0];
const notices=[];
globalThis.game={socket:{on(){},off(){},emit(){}},user:gm,users,actors:collection([]),messages:collection([]),combats:[],scenes,settings:{get(_id,key){return settings.get(key);},set(_id,key,value){settings.set(key,clone(value));return Promise.resolve(value);},register(_id,key,config){if(!settings.has(key))settings.set(key,config.default);}},system:{api:{range:{}}}};
globalThis.ui={notifications:{info(text){notices.push(text);},warn(text){notices.push(text);},error(text){notices.push(text);}},combat:{render(){}}};
globalThis.canvas={tokens:{placeables:[]},scene:activeScene};
globalThis.fromUuid=async id=>documents.get(id);
let nextId=Number(previous?.idCounter??0);
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
const party=[hero,second,...Array.from({length:4},(_,i)=>actor(`party${i+3}`,`Party Member ${i+3}`))];
const allies=Array.from({length:2},(_,i)=>actor(`ally${i+1}`,`GM Ally ${i+1}`,{type:'npc',hasPlayerOwner:false,testUserPermission:u=>u.isGM}));
const ship=actor('ship','Test Freighter',{type:'vehicle',hasPlayerOwner:false,system:{hullTrauma:{value:1,max:20},systemStrain:{value:2,max:15},speed:{value:1,max:4},shields:{fore:1,aft:1,port:0,starboard:0},armor:2,silhouette:4,handling:-1,crew:'2',passengers:'4'},items:collection([{id:'gun',name:'Test Cannon',type:'weapon',system:{damage:'5',critical:3,range:'close',metadata:{},source:{book:'Test Source',page:'1'}}}])});
const group=documentOf({id:'group',uuid:'Actor.group',name:'Test Crew',type:'group',hasPlayerOwner:true,isOwner:true,items:collection([]),flags:{},system:{theme:'auto',base:{name:'Test Waystation'},members:{},startingAsset:{choice:'edge-ship',name:'Test Freighter',actorId:'ship',status:'Available',description:'Shared fixture transport'},resourceLedger:{seed:{kind:'starting-asset',name:'Test Freighter',change:0,note:'Shared fixture transport',at:'fixture',scene:'Outpost 07 Test Hangar'}},credits:100,resources:'',possessions:'',contacts:'',notes:''}});
const applySaved=(document,saved)=>{if(!saved)return;if(saved.system)document.system=clone(saved.system);if(saved.flags)document.flags[SYSTEM_ID]=clone(saved.flags);};
applySaved(hero,previous?.hero);applySaved(ship,previous?.ship);applySaved(group,previous?.group);
game.actors.push(...party,...allies,ship,group);
const combatants=collection([...party,...allies].map((combatantActor,i)=>({id:`s${i+1}`,name:combatantActor.name,actor:combatantActor,actorId:combatantActor.id,tokenId:`t${i+1}`,initiative:2,flags:{[SYSTEM_ID]:{slotSide:combatantActor.hasPlayerOwner?'pc':'npc'}}})));
game.combat=documentOf({uuid:'Combat.c',id:'c',started:true,round:1,turn:1,turns:[combatants[1],combatants[0],...combatants.slice(2)],combatants,flags:{}});game.combats.push(game.combat);
const stage=Number(previous?.stage??0),outcome={passed:true,success:1,advantage:2+stage*2,threat:0,triumph:1,despair:0};
const message=documentOf({id:'native',uuid:'ChatMessage.native',author:player,isContentVisible:true,rolls:[{options:{starWars:{outcome}}}],flags:{[SYSTEM_ID]:{actorUuid:hero.uuid,outcome,spending:clone(previous?.message?.spending??[])}}});game.messages.push(message);
const {planResourceEntry}=await import('/src/group-resources.mjs');
const travelScene=id=>{const next=scenes.get(id);if(!next)throw new Error(`Unknown fixture scene ${id}.`);canvas.scene=next;return next;};
const recordGroupResource=async(run,scene)=>{
 const at=`playtest-${run}`;
 await group.update(planResourceEntry(group.system,{kind:'credits',name:'Playtest reserve',change:10,note:'Cumulative state check'},{id:`credit${run}`,at,scene:scene.name}));
 await group.update(planResourceEntry(group.system,{kind:'gear',name:'Emergency repair patch',change:1,note:'Cumulative state check'},{id:`gear${run}`,at,scene:scene.name}));
 return group.system;
};
const snapshotPlaytestState=()=>({
 version:1,stage:Number(playtest.run??0),idCounter:nextId,
 settings:{campaign:clone(settings.get('campaign')),destiny:clone(settings.get('destiny'))},
 scene:{id:canvas.scene?.id??'',name:canvas.scene?.name??''},
 hero:{system:clone(hero.system),flags:clone(hero.flags[SYSTEM_ID]??{})},
 ship:{system:clone(ship.system),flags:clone(ship.flags[SYSTEM_ID]??{})},
 group:{system:clone(group.system),flags:clone(group.flags[SYSTEM_ID]??{})},
 message:{spending:clone(message.flags[SYSTEM_ID]?.spending??[])},
 roster:{players:party.map(row=>({id:row.id,name:row.name,type:row.type})),allies:allies.map(row=>({id:row.id,name:row.name,type:row.type}))},
});
const {registerTurnEconomy}=await import('/src/turn-economy-foundry.mjs');registerTurnEconomy();
const module=await import('/src/tabletop-foundry.mjs');module.registerTabletopWorkflows();Hooks.callAll('ready');await (await import('/src/document-transactions.mjs')).getDocumentTransactionBroker().takeAuthority('Fixture GM selects the transaction tab');
globalThis.fixture={hookCount:()=>Array.from(listeners.values()).reduce((n,rows)=>n+rows.length,0),playtest,...module,hero,second,ship,group,party,allies,message,notices,documents,gm,player,travelScene,recordGroupResource,snapshotPlaytestState};
