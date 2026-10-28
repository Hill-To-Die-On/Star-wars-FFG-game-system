/** Licensed native Foundry feature regression. Only disposable onboarding worlds. */
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

const {version:systemVersion}=JSON.parse(await readFile(new URL('../system.json',import.meta.url),'utf8'));

export async function nativeFeatureAcceptance({gm,player,report,output,filter}) {
  assert.equal(await gm.evaluate(()=>game.world.id),'onboarding-validation');
  gm.setDefaultTimeout(15000);player.setDefaultTimeout(15000);
  const checks=report.featureChecks=[],issues=report.featureIssues=[];
  const pattern=filter?new RegExp(filter):null;
  const close=async page=>{await page.evaluate(async()=>{
    foundry.nue.Tour.activeTour?.exit?.();
    for(const app of [...foundry.applications.instances.values()])
      if(app.rendered&&app.element?.querySelector(':scope > .window-header'))await app.close();
  });await page.waitForFunction(()=>!document.querySelector('dialog.application,.application.minimizing'));};
  const step=async(id,mode,run)=>{
    if(pattern&&!pattern.test(id)){checks.push({id,mode,skipped:true,reason:'Outside the requested native feature filter'});return;}
    console.log('FEATURE START '+id);const started=Date.now();
    try{await close(gm);await close(player);const details=await run();checks.push({id,mode,passed:true,elapsedMs:Date.now()-started,details:details??null});console.log('FEATURE PASS '+id);}
    catch(error){const issue={id,mode,passed:false,elapsedMs:Date.now()-started,error:error.stack,classification:'needs triage'};checks.push(issue);issues.push(issue);console.log('FEATURE FAIL '+id+': '+error.message);try{await gm.screenshot({path:join(output,'feature-failure-'+id+'.png'),timeout:5000});await writeFile(join(output,'feature-failure-'+id+'.html'),await gm.content());await writeFile(join(output,'feature-failure-'+id+'-state.json'),JSON.stringify(await gm.evaluate(()=>({notifications:[...document.querySelectorAll('#notifications p')].map(p=>p.textContent),actors:game.actors.map(a=>({id:a.id,name:a.name,xp:a.system.xp,advancement:a.system.advancement,items:a.items.filter(i=>['specialization','signatureAbility'].includes(i.type)).map(i=>({id:i.id,name:i.name,tree:i.system.tree,linkedSpecializationId:i.system.linkedSpecializationId}))})),tokens:canvas.scene.tokens.map(t=>({id:t.id,x:t.x,y:t.y,elevation:t.elevation,rotation:t.rotation,source:t._source.elevation}))})),null,2));}catch{}}
    await writeFile(join(output,'feature-progress.json'),JSON.stringify({kind:'licensed-native-Foundry',checks,issues},null,2));
  };
  const openActor=async(id,page=gm)=>{
    await page.evaluate(async id=>{await game.actors.get(id).sheet.render({force:true});},id);
    const sheet=page.locator('.sf-actor-sheet,.sf-group').first();await sheet.waitFor();return sheet;
  };
  const fixture=await gm.evaluate(async()=>{
    const owner=game.users.find(u=>u.name==='Onboarding Player');
    const campaign=game.settings.get('star-wars-ffg','campaign');
    await game.settings.set('star-wars-ffg','campaign',{...campaign,lines:['edge','age','force'],bookMode:'all',books:[],includeUnreferenced:true,obligation:true,duty:true,morality:true});
    const actors={};
    for(const type of ['character','minion','rival','nemesis','vehicle','group']){
      const system=type==='vehicle'?{crew:'4',passengers:'6',silhouette:3,speed:{value:1,max:3},hullTrauma:{value:0,max:25},systemStrain:{value:0,max:15}}:
        type==='group'?{}:{phase:'play',species:'Human',career:'QA career',xp:{available:200,total:200},characteristics:{brawn:3,agility:3,intellect:3,cunning:2,willpower:2,presence:2},wounds:{value:0,max:12},strain:{value:0,max:12},skills:{pilotingSpace:{rank:2},gunnery:{rank:2}}};
      actors[type]=(await Actor.create({name:'Beta QA '+type,type,system,ownership:{default:0,[owner.id]:type==='group'?2:['character','vehicle'].includes(type)?3:0}})).id;
    }
    const scene=await Scene.create({name:'Beta QA feature arena',width:2600,height:1800,grid:{type:1,size:100,distance:5,units:'m'},navigation:true});await scene.activate();
    const tokenSources=[];
    for(const [index,type]of ['character','vehicle','rival','nemesis'].entries())tokenSources.push((await game.actors.get(actors[type]).getTokenDocument({x:300+index*400,y:700,actorLink:true})).toObject());
    for(let i=0;i<3;i++)tokenSources.push((await game.actors.get(actors.minion).getTokenDocument({x:350+i*150,y:1100,actorLink:false})).toObject());
    const tokens=await scene.createEmbeddedDocuments('Token',tokenSources);
    globalThis.__betaFeatureFixture={actors,scene:scene.id,tokens:Object.fromEntries(tokens.slice(0,4).map((token,i)=>[['character','vehicle','rival','nemesis'][i],token.id])),minions:tokens.slice(4).map(t=>t.id)};
    return globalThis.__betaFeatureFixture;
  });
  await gm.waitForFunction(id=>canvas.ready&&canvas.scene.id===id,fixture.scene,{timeout:60000});
  await player.waitForFunction(id=>game.actors.has(id),fixture.actors.character);

  await step('runtime-and-assets','native runtime',async()=>{
    const result=await gm.evaluate(async()=>{
      const textures=await Promise.all(['systems/star-wars-ffg/assets/ui/saturn-enceladus-concept.webp',game.actors.get(__betaFeatureFixture.actors.character).img].map(async url=>({url,status:(await fetch(url)).status})));
      return {core:game.version,system:game.system.version,modules:[...game.modules.values()].filter(m=>m.active).map(m=>m.id),textures,api:Object.keys(game.system.api),credits:game.journal.has('SFFGArtCredits01')};
    });assert.equal(result.system,systemVersion);assert.deepEqual(result.modules,report.expectedModules??[]);assert.ok(result.credits);assert.ok(result.textures.every(t=>t.status===200));return result;
  });
  for(const [type,id]of Object.entries(fixture.actors))await step('sheet-'+type,'native UI',async()=>{
    const sheet=await openActor(id);assert.equal(await sheet.locator('[name="name"]').inputValue(),'Beta QA '+type);
    if(type!=='group')for(const tab of await sheet.locator('nav [data-tab]').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.dataset.tab))])){
      await sheet.locator('nav [data-tab="'+tab+'"]').first().click();await gm.evaluate(()=>new Promise(done=>requestAnimationFrame(done)));
      assert.equal(await sheet.locator('.sf-shell').count(),1);
    }
    await gm.screenshot({path:join(output,'feature-sheet-'+type+'.png')});return {tabs:type==='group'?'single form':await sheet.locator('nav [data-tab]').allTextContents()};
  });
  await step('item-sheets-all-types','native UI',async()=>{
    const types=await gm.evaluate(()=>Object.keys(CONFIG.Item.dataModels)),tested=[];
    for(const type of types){await close(gm);const id=await gm.evaluate(async type=>{const item=await Item.create({name:'Beta QA '+type,type});void item.sheet.render({force:true});return item.id;},type);
      const sheet=gm.locator('form.star-wars').filter({has:gm.locator('[name="name"]')});await sheet.waitFor();assert.ok((await sheet.innerText()).length>20);assert.equal(await sheet.locator('[name="name"]').inputValue(),'Beta QA '+type);tested.push({type,id});
    }return tested;
  });
  await step('dice-seven-types-and-core-dice','native UI and native Roll API',async()=>{
    await gm.locator('#sf-destiny-hud').click();const dice=['ability','proficiency','difficulty','challenge','boost','setback','force'];
    for(const die of dice)await gm.locator('dialog [name="'+die+'"]').fill('1');
    const before=await gm.evaluate(()=>game.messages.filter(m=>m.isRoll).length);await gm.getByRole('button',{name:'Roll pool',exact:true}).click();
    await gm.waitForFunction(before=>game.messages.filter(m=>m.isRoll).length>before,before);
    const core=await gm.evaluate(async()=>(await new foundry.dice.Roll('1d4+1d6+1d8+1d10+1d12+1d20+1d100').evaluate()).dice.map(d=>d.faces));
    assert.deepEqual(core,[4,6,8,10,12,20,100]);return {narrativeDice:dice,coreFaces:core};
  });
  if(report.expectedModules?.includes('dice-so-nice'))await step('dice-so-nice-seven-dice-two-clients','native optional-module WebGL renderer',async()=>{
    for(const page of [gm,player])await page.waitForFunction(()=>game.dice3d?.DiceFactory?.systems?.has('star-wars-ffg')&&game.dice3d?.box?.initialized,null,{timeout:60000});
    for(const page of [gm,player])await page.evaluate(()=>{globalThis.__betaDsn={started:[],completed:[]};Hooks.on('diceSoNiceRollStart',id=>__betaDsn.started.push(id));Hooks.on('diceSoNiceRollComplete',id=>__betaDsn.completed.push(id));});
    const id=await gm.evaluate(async()=>{await game.system.api.rollPool({ability:1,proficiency:1,difficulty:1,challenge:1,boost:1,setback:1,force:1},{label:'QA seven animated dice',turnCost:'none'});return game.messages.filter(m=>m.isRoll&&m.flavor==='QA seven animated dice').at(-1).id;});
    const results=[];for(const [name,page]of [['gm',gm],['player',player]]) {await page.waitForFunction(id=>__betaDsn.completed.includes(id),id,{timeout:90000});const value=await page.evaluate(id=>({module:game.modules.get('dice-so-nice').version,started:__betaDsn.started.includes(id),complete:__betaDsn.completed.includes(id),terms:game.messages.get(id).rolls[0].dice.map(d=>d.options.starWarsDie),renderer:!!game.dice3d.box.renderer?.domElement,meshes:game.dice3d.box.throwEngine.diceList.length}),id);assert.ok(value.started);assert.ok(value.complete);assert.ok(value.renderer);assert.equal(value.terms.length,7);assert.equal(value.meshes,7);await page.screenshot({path:join(output,'feature-dsn-'+name+'.png')});results.push({client:name,...value});}return results;
  });
  await step('compact-chat-dice-add-remove-clear-roll','native UI',async()=>{
    await gm.evaluate(async()=>{await game.settings.set('star-wars-ffg','compactChatDice',true);ui.sidebar.changeTab('chat','primary');ui.sidebar.expand();});
    const tray=gm.locator('.sf-compact-dice').first();await tray.waitFor();const ability=tray.locator('[data-compact-die="ability"]');
    await ability.click();await ability.click();await ability.click({modifiers:['Shift']});assert.equal(await ability.getAttribute('data-count'),'1');
    await tray.locator('[data-compact-clear]').click();assert.equal(await ability.getAttribute('data-count'),'0');assert.equal(await tray.locator('[data-compact-roll]').isDisabled(),true);
    await ability.click();const count=await gm.evaluate(()=>game.messages.filter(m=>m.isRoll).length);await tray.locator('[data-compact-roll]').click();
    await gm.waitForFunction(n=>game.messages.filter(m=>m.isRoll).length>n,count);assert.equal(await ability.getAttribute('data-count'),'0');
  });
  await step('destiny-flips-synchronize-and-player-permission','native UI',async()=>{
    await gm.evaluate(()=>game.settings.set('star-wars-ffg','destiny',{light:2,dark:1}));await gm.locator('#sf-destiny-hud').click();await gm.locator('dialog [data-action="light"]').click();await gm.locator('dialog [data-action="light"]').waitFor({state:'detached'});
    await player.waitForFunction(()=>game.settings.get('star-wars-ffg','destiny').light===1);assert.deepEqual(await player.evaluate(()=>game.settings.get('star-wars-ffg','destiny')),{light:1,dark:2});
    await gm.locator('#sf-destiny-hud').click();await gm.locator('dialog [data-action="dark"]').click();await gm.locator('dialog [data-action="dark"]').waitFor({state:'detached'});await gm.waitForFunction(()=>game.settings.get('star-wars-ffg','destiny').light===2);
    await player.locator('#sf-destiny-hud').click();assert.equal(await player.locator('dialog [data-action="light"]').count(),0);assert.equal(await player.locator('dialog [data-action="reset"]').count(),0);
  });
  await step('catalogue-search-category-details-and-pagination','native UI',async()=>{
    await gm.evaluate(()=>game.system.api.openReferenceBrowser());const catalogue=gm.locator('#star-wars-reference-browser');await catalogue.waitFor();
    assert.ok(await catalogue.locator('[data-action="select"]').count()>0);await catalogue.locator('[name="query"]').fill('blaster');await catalogue.locator('[data-action="search"]').click();
    await gm.waitForFunction(()=>document.querySelector('#star-wars-reference-browser [name="query"]').value==='blaster');await catalogue.locator('[data-action="select"]').first().click();
    assert.ok((await catalogue.innerText()).toLowerCase().includes('blaster'));await catalogue.locator('[name="query"]').fill('');await catalogue.locator('[name="category"]').selectOption('vehicles');
    await catalogue.locator('[data-action="select"]').first().waitFor();assert.ok((await catalogue.innerText()).includes('Vehicle'));
    await catalogue.locator('[data-action="next"]').click();assert.equal(await catalogue.locator('[data-action="previous"]').isDisabled(),false);await gm.screenshot({path:join(output,'feature-catalogue.png')});
  });
  await step('owned-books-filter-and-player-readonly','native API and UI',async()=>{
    const result=await gm.evaluate(async()=>{const before=game.settings.get('star-wars-ffg','campaign');await game.settings.set('star-wars-ffg','campaign',{...before,bookMode:'owned',books:[],includeUnreferenced:false});const empty=await game.system.api.searchReferences({});await game.settings.set('star-wars-ffg','campaign',before);return empty;});
    assert.equal(result.total,0);await player.evaluate(()=>game.system.api.openReferenceBrowser());await player.locator('#star-wars-reference-browser').waitFor();assert.equal(await player.locator('#star-wars-reference-browser [data-action="ownedBooks"]').count(),0);assert.equal(await player.locator('#star-wars-reference-browser [data-action="populate"]').count(),0);
  });
  await step('roll-tables-draw-cited-result','native UI',async()=>{
    await gm.evaluate(()=>game.system.api.openReferenceBrowser());await gm.locator('#star-wars-reference-browser [data-action="rollTables"]').click();const table=gm.locator('#star-wars-roll-tables');await table.waitFor();assert.ok((await table.innerText()).length>100);await table.locator('[data-action="roll"]').click();await table.locator('.sf-roll-result').waitFor();return await table.locator('.sf-roll-result').innerText();
  });
  await step('guided-character-creation-complete','native player UI',async()=>{
    const setup=await gm.evaluate(async()=>{const campaign=game.settings.get('star-wars-ffg','campaign');await game.settings.set('star-wars-ffg','campaign',{...campaign,duty:false,morality:false,obligation:true});const owner=game.users.find(u=>u.name==='Onboarding Player');return {campaign,id:(await Actor.create({name:'Beta QA guided PC',type:'character',ownership:{default:0,[owner.id]:3}})).id};});
    try {
      await player.waitForFunction(id=>game.actors.has(id),setup.id);const sheet=await openActor(setup.id,player);await sheet.locator('[data-action="createCharacter"][data-mode="guided"]').first().click();
      for(const key of ['role','combat','aptitude','force']){await player.locator('dialog [name="'+key+'"]').waitFor();await player.getByRole('button',{name:'Next',exact:true}).click();}
      await player.getByRole('button',{name:'Show all allowed choices',exact:true}).click();
      await player.getByRole('button',{name:'Show all allowed choices',exact:true}).waitFor({state:'hidden'});
      const selectNamed=async(name,label)=>{const select=player.locator('dialog [name="'+name+'"]').last(),value=await select.locator('option').evaluateAll((options,label)=>options.find(o=>o.textContent.split(' · ')[0]===label)?.value,label);assert.ok(value,label+' is available');await select.selectOption(value);};
      await selectNamed('species','Human');await selectNamed('career','Explorer');await player.getByRole('button',{name:'Choose specialization',exact:true}).click();await selectNamed('specialization','Scout (Explorer)');await player.getByRole('button',{name:'Choose free skills',exact:true}).click();
      for(let n=0;n<4;n++)await player.locator('dialog input[name^="career:"]').nth(n).check();for(let n=0;n<2;n++)await player.locator('dialog input[name^="specialization:"]').nth(n).check();await player.getByRole('button',{name:'Continue to species skills',exact:true}).click();for(let n=0;n<2;n++)await player.locator('dialog [name="nonCareerSkill"]').nth(n).check();await player.getByRole('button',{name:'Apply species skills',exact:true}).click();await player.getByRole('button',{name:'Continue to XP',exact:true}).click();
      await player.locator('dialog [name="characteristics:brawn"]').fill('1');await player.getByRole('button',{name:'Review character',exact:true}).click();await player.locator('[data-equipment-search]').fill('Heavy Clothing');await player.locator('[data-equipment-results]').selectOption({index:0});await player.locator('[data-add-starting-item]').click();await player.getByRole('button',{name:'Continue to starting XP',exact:true}).click();await player.locator('dialog [data-action="yes"]').click();await player.waitForFunction(id=>game.actors.get(id).system.creation?.applied,setup.id);
      await sheet.locator('[data-action="finishStartingFunds"]').click();await player.waitForFunction(id=>!game.actors.get(id).system.creation.pocketMoneyPending,setup.id);await sheet.locator('[data-action="finishCreation"]').click();await player.locator('dialog [data-action="yes"]').click();await player.waitForFunction(id=>game.actors.get(id).system.phase==='play',setup.id);
      const result=await player.evaluate(id=>{const a=game.actors.get(id);return {species:a.system.species,career:a.system.career,brawn:a.system.characteristics.brawn,armor:a.items.some(i=>i.type==='armor'),credits:a.system.credits};},setup.id);assert.equal(result.species,'Human');assert.equal(result.career,'Explorer');assert.equal(result.brawn,3);assert.ok(result.armor);assert.ok(result.credits>=450);return result;
    } finally {await gm.evaluate(campaign=>game.settings.set('star-wars-ffg','campaign',campaign),setup.campaign);}
  });
  await step('enemy-guide-reviewed-native-preset','native GM UI',async()=>{
    const id=await gm.evaluate(async()=> (await Actor.create({name:'Beta QA guided rival',type:'rival'})).id),sheet=await openActor(id);await sheet.locator('[data-action="enemyGuide"]').click();await gm.getByRole('button',{name:'Choose profile',exact:true}).click();
    const select=gm.locator('dialog [name="species"]');assert.equal(await select.inputValue(),'');const human=await select.locator('option').evaluateAll(options=>options.find(o=>o.textContent.split(' · ')[0]==='Human')?.value);assert.ok(human);await select.selectOption(human);await gm.getByRole('button',{name:'Preview enemy',exact:true}).click();await gm.locator('dialog [name="wounds"]').fill('1');await gm.getByRole('button',{name:'Apply reviewed enemy',exact:true}).click();await gm.waitForFunction(id=>game.actors.get(id).system.metadata.enemyGuideApplied,id);
    const result=await gm.evaluate(id=>{const a=game.actors.get(id);return {species:a.system.species,wounds:a.system.wounds.value,items:a.items.size};},id);assert.equal(result.species,'Human');assert.equal(result.wounds,1);assert.ok(result.items>=1);return result;
  });
  await step('advancement-shared-talents-and-xp','native UI',async()=>{
    const ids=await gm.evaluate(async()=>{
      const tree={verified:true,nodes:[{id:'entry',name:'QA shared training',entry:true,ranked:false,row:0,col:0,cost:5},{id:'deep',name:'QA advanced training',ranked:true,row:1,col:0,cost:10}],edges:[['entry','deep']]};
      const first={name:'QA path A',type:'specialization',system:{career:'QA career',tree}};
      const actor=await Actor.create({name:'Beta QA advancement',type:'character',system:{career:'QA career',phase:'play',xp:{available:100,total:100}},items:[first]});await actor.acquireSpecialization(await Item.create({...first,name:'QA path B'}));__betaFeatureFixture.advancement=actor.id;return {actor:actor.id};
    });const sheet=await openActor(ids.actor);await sheet.locator('[data-tab="advancement"]').first().click();
    await sheet.locator('.sf-tree').first().locator('[data-node="entry"]').click();await gm.waitForFunction(id=>game.actors.get(id).system.xp.available===75,ids.actor);
    assert.match(await sheet.locator('.sf-tree').nth(1).locator('[data-node="entry"]').innerText(),/Learned elsewhere/);
    await sheet.locator('.sf-tree').nth(1).locator('[data-node="deep"]').click();await gm.waitForFunction(id=>game.actors.get(id).system.xp.available===65,ids.actor);
    await gm.screenshot({path:join(output,'feature-advancement.png')});
  });
  await step('xp-insufficient-and-observer-denial','native API',async()=>{
    const result=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.advancement);await a.update({'system.xp.available':0});const before=a.system.advancement.length;let error='';try{await a.buySkill('athletics');}catch(e){error=e.message;}return {error,xp:a.system.xp.available,before,after:a.system.advancement.length};});assert.ok(result.error);assert.equal(result.xp,0);assert.equal(result.after,result.before);
    const denied=await player.evaluate(async id=>{try{await game.actors.get(id).buySkill('athletics');return '';}catch(e){return e.message;}},await gm.evaluate(()=>__betaFeatureFixture.advancement));assert.ok(denied);
    await gm.evaluate(()=>{ui.sidebar.changeTab('chat','primary');ui.sidebar.expand();});await gm.locator('[data-authority-review]').first().click();await gm.locator('dialog [name="note"]').fill('Synthetic QA: verified XP and advancement were unchanged after the refused purchase.');await gm.getByRole('button',{name:'I checked the state - release lock',exact:true}).click();
    await gm.waitForFunction(()=>!Object.values(game.settings.get('star-wars-ffg','authorityReceipts')).some(r=>r.status==='review'));
  });
  await step('signature-attachment-lock-unlock-and-purchase','native UI and document API',async()=>{
    const data=await gm.evaluate(async()=>{
      const a=game.actors.get(__betaFeatureFixture.advancement),spec=a.items.find(i=>i.name==='QA path A');await a.update({'system.xp.available':100});
      const ability=new Item({name:'QA signature',type:'signatureAbility',system:{eligibleCareers:['QA career'],matchingNodes:[true,false,false,false],tree:{verified:true,nodes:[{id:'base',name:'QA signature base',entry:true,ranked:false,row:0,col:0,cost:10}],edges:[]}}});const attached=await a.acquireSignatureAbility(ability,spec.id);return {actor:a.id,spec:spec.id,ability:attached.itemId};
    });const sheet=await openActor(data.actor);await sheet.locator('[data-tab="advancement"]').first().click();const base=sheet.locator('[data-item="'+data.ability+'"][data-node="base"]');assert.equal(await base.getAttribute('aria-disabled'),'true');
    await sheet.locator('[data-item="'+data.spec+'"][data-node="deep"]').click();await gm.waitForFunction(({actor,item})=>game.actors.get(actor).system.advancement.some(e=>e.itemId===item&&e.nodeId==='deep'),{actor:data.actor,item:data.spec});
    await base.click();await gm.waitForFunction(({actor,item})=>game.actors.get(actor).system.advancement.some(e=>e.itemId===item&&e.nodeId==='base'),{actor:data.actor,item:data.ability});assert.equal(await gm.evaluate(id=>game.actors.get(id).system.xp.available,data.actor),80);return data;
  });
  await step('custom-skills-and-motivations-crud','native API and rendered UI',async()=>{
    const value=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.actors.character);await a.createCustomSkill({label:'QA survey',characteristic:'intellect',rank:1,career:false});await a.createMotivation({name:'QA discovery',category:'Ambition',active:true,description:'Original synthetic QA motivation.'});return a.toObject().system;});assert.ok(JSON.stringify(value).includes('QA survey'));assert.ok(JSON.stringify(value).includes('QA discovery'));
    const sheet=await openActor(fixture.actors.character);await sheet.locator('[data-tab="story"]').first().click();assert.match(await sheet.innerText(),/QA discovery/);
    const edited=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.actors.character),skill=a.system.customSkills.find(s=>s.label==='QA survey'),motivation=a.system.motivations.find(m=>m.name==='QA discovery');await a.updateCustomSkill(skill.id,{...skill,label:'QA revised survey'});await a.updateMotivation(motivation.id,{...motivation,name:'QA revised discovery'});const changed={skill:a.system.customSkills.find(s=>s.id===skill.id).label,motivation:a.system.motivations.find(m=>m.id===motivation.id).name};await a.deleteCustomSkill(skill.id);await a.deleteMotivation(motivation.id);return {...changed,skillRemoved:!a.system.customSkills.some(s=>s.id===skill.id),motivationRemoved:!a.system.motivations.some(m=>m.id===motivation.id)};});assert.deepEqual(edited,{skill:'QA revised survey',motivation:'QA revised discovery',skillRemoved:true,motivationRemoved:true});return edited;
  });
  await step('group-member-link-and-story-sync','native UI',async()=>{
    const sheet=await openActor(fixture.actors.group);await sheet.locator('[data-action="addMember"]').click();const select=sheet.locator('select[name^="system.members."]').first();await select.waitFor();await select.selectOption(fixture.actors.character);await sheet.locator('[data-action="syncMembers"]').click();
    await gm.waitForFunction(({group,pc})=>Object.values(game.actors.get(group).system.members).some(m=>m.actorId===pc&&m.characterName==='Beta QA character'),{group:fixture.actors.group,pc:fixture.actors.character});assert.match(await sheet.innerText(),/Obligation/);assert.match(await sheet.innerText(),/Duty/);assert.match(await sheet.innerText(),/Morality/);await gm.screenshot({path:join(output,'feature-group.png')});
  });
  await step('group-resource-ledger-credit-and-spend','native UI',async()=>{
    const sheet=await openActor(fixture.actors.group);
    for(const change of [200,-50]){await sheet.locator('[data-action="recordResource"]').click();await gm.locator('dialog [name="name"]').fill('QA group credits');await gm.locator('dialog [name="change"]').fill(String(change));await gm.locator('dialog').getByRole('button',{name:'Record change',exact:true}).click();}
    await gm.waitForFunction(id=>game.actors.get(id).system.credits===150,fixture.actors.group);const group=await gm.evaluate(id=>game.actors.get(id).toObject().system,fixture.actors.group);assert.equal(group.credits,150);assert.equal(Object.values(group.resourceLedger).filter(e=>e.kind==='credits').length,2);return group;
  });
  await step('group-starting-asset-and-base-notes','native UI',async()=>{
    const sheet=await openActor(fixture.actors.group);await sheet.locator('[data-action="chooseAsset"]').click();await gm.locator('dialog [name="choice"]').selectOption({index:1});await gm.locator('dialog [name="name"]').fill('QA shared ship');await gm.locator('dialog [name="actorId"]').selectOption(fixture.actors.vehicle);await gm.getByRole('button',{name:'Record asset',exact:true}).click();
    await gm.waitForFunction(id=>game.actors.get(id).system.startingAsset.name==='QA shared ship',fixture.actors.group);await sheet.locator('[name="system.base.name"]').fill('QA base');await sheet.locator('[name="system.base.name"]').press('Tab');await gm.waitForFunction(id=>game.actors.get(id).system.base.name==='QA base',fixture.actors.group);
  });
  await step('vehicle-native-crew-tab-and-model-picker','native UI',async()=>{
    const sheet=await openActor(fixture.actors.vehicle);await sheet.locator('[data-tab="crew"]').first().click();assert.match(await sheet.innerText(),/crew|Crew/);await sheet.locator('[data-tab="overview"]').first().click();await sheet.getByRole('button',{name:'Show model choices',exact:true}).click();assert.ok(await sheet.locator('[data-action="selectVehicleChoice"][data-kind="model"]').count()>0);await gm.screenshot({path:join(output,'feature-vehicle.png')});
  });
  await step('vehicle-board-assign-pilot-and-disembark','native runtime API',async()=>{
    const result=await gm.evaluate(async()=>{const f=__betaFeatureFixture,scene=game.scenes.get(f.scene),pc=scene.tokens.get(f.tokens.character),ship=scene.tokens.get(f.tokens.vehicle);await game.system.api.crew.board(pc,ship);await game.system.api.crew.toggleRole(pc,'pilot');const roster=game.system.api.crew.roster(ship).map(r=>({id:r.id,roles:r.roles,count:r.count}));const skill=game.system.api.crew.assignedCheck(ship,'pilotingSpace');await game.system.api.crew.leave(pc,{x:300,y:700});return {roster,skill:skill?{actor:skill.actor?.name,rank:skill.rank,member:skill.member?.id}:null,remaining:game.system.api.crew.roster(ship).length,flag:pc.getFlag('star-wars-ffg','aboard')};});assert.equal(result.roster.length,1);assert.ok(result.roster[0].roles.includes('pilot'));assert.ok(result.skill);assert.equal(result.remaining,0);assert.ok(!result.flag);return result;
  });
  await step('vehicle-generate-prepared-crew-preview','native UI',async()=>{
    const sheet=await openActor(fixture.actors.vehicle);await sheet.locator('[data-tab="crew"]').first().click();const button=sheet.getByRole('button',{name:/Generate crew/});await button.click();await gm.locator('dialog [name="speciesId"]').waitFor();await gm.locator('dialog [name="count-pilot"]').fill('1');await gm.getByRole('button',{name:'Preview crew',exact:true}).click();await gm.locator('.sf-crew-generation-review').waitFor();assert.match(await gm.locator('.sf-crew-generation-review').innerText(),/NPC/);await gm.getByRole('button',{name:'Create crew',exact:true}).click();await gm.waitForFunction(id=>JSON.stringify(game.actors.get(id).flags).toLowerCase().includes('prepared') || game.system.api.crew.roster(game.scenes.get(__betaFeatureFixture.scene).tokens.get(__betaFeatureFixture.tokens.vehicle)).length>0,fixture.actors.vehicle);return await gm.evaluate(id=>game.actors.get(id).flags['star-wars-ffg'],fixture.actors.vehicle);
  });
  await step('prepared-crew-automatic-deployment','native UI and scene documents',async()=>{
    const id=await gm.evaluate(async()=>(await Actor.create({name:'QA prepared transport',type:'vehicle',system:{crew:'2',passengers:'0'}})).id);const sheet=await openActor(id);await sheet.locator('[data-tab="crew"]').first().click();await sheet.getByRole('button',{name:/Generate crew/}).click();await gm.locator('dialog [name="count-pilot"]').fill('1');await gm.getByRole('button',{name:'Preview crew',exact:true}).click();await gm.getByRole('button',{name:'Create crew',exact:true}).click();
    await gm.waitForFunction(id=>game.actors.get(id).getFlag('star-wars-ffg','preparedCrew')?.length>0,id);
    const token=await gm.evaluate(async id=>{const [t]=await canvas.scene.createEmbeddedDocuments('Token',[(await game.actors.get(id).getTokenDocument({x:1900,y:1100,actorLink:true})).toObject()]);return t.id;},id);
    await gm.waitForFunction(id=>game.system.api.crew.roster(canvas.scene.tokens.get(id)).some(r=>r.roles.includes('pilot')),token);return await gm.evaluate(id=>game.system.api.crew.roster(canvas.scene.tokens.get(id)).map(r=>({name:r.name,count:r.count,roles:r.roles})),token);
  });
  await step('minions-link-wounds-and-healing','native UI and native documents',async()=>{
    await gm.evaluate(async()=>{canvas.tokens.releaseAll();for(const id of __betaFeatureFixture.minions)canvas.tokens.get(id).control({releaseOthers:false});void (await import('/systems/star-wars-ffg/src/minion-groups-foundry.mjs')).formSelectedMinionGroup();});
    await gm.locator('dialog [name="name"]').fill('QA linked patrol');await gm.getByRole('button',{name:'Create minion group',exact:true}).click();await gm.waitForFunction(()=>game.actors.some(a=>a.name==='QA linked patrol'));
    const result=await gm.evaluate(async()=>{const m=await import('/systems/star-wars-ffg/src/minion-groups.mjs'),a=game.actors.find(a=>a.name==='QA linked patrol');__betaFeatureFixture.linkedMinions=a.id;const before=m.groupStateForActor(a).remaining;await a.update({'system.wounds.value':a.system.wounds.max+1});const after=m.groupStateForActor(a).remaining;await a.update({'system.wounds.value':0});return {before,after,healed:m.groupStateForActor(a).remaining};});assert.deepEqual(result,{before:3,after:2,healed:3});return result;
  });
  await step('turn-action-maneuver-undo-and-reset','native UI',async()=>{
    const sheet=await openActor(fixture.actors.character);await sheet.locator('[data-sf-turn="reset"]').first().click();const before=await gm.evaluate(id=>game.system.api.turns.read(game.actors.get(id)),fixture.actors.character);
    await sheet.locator('[data-sf-turn="action"]').first().click();await gm.waitForFunction(id=>game.system.api.turns.read(game.actors.get(id)).spent.actions===1,fixture.actors.character);await sheet.locator('[data-sf-turn="undo"]').first().click();await gm.waitForFunction(id=>game.system.api.turns.read(game.actors.get(id)).spent.actions===0,fixture.actors.character);
    await sheet.locator('[data-sf-turn="maneuver"]').first().click();await sheet.locator('[data-sf-turn="reset"]').first().click();await gm.waitForFunction(id=>game.system.api.turns.read(game.actors.get(id)).spent.maneuvers===0,fixture.actors.character);const after=await gm.evaluate(id=>game.system.api.turns.read(game.actors.get(id)),fixture.actors.character);assert.equal(after.spent.actions,0);assert.equal(after.spent.maneuvers,0);return {before,after};
  });
  await step('range-measure-and-native-token-facing','native canvas API',async()=>{
    const measured=await gm.evaluate(async()=>{const f=__betaFeatureFixture,s=game.scenes.get(f.scene),a=s.tokens.get(f.tokens.character),b=s.tokens.get(f.tokens.rival);const result=game.system.api.range.measureTokenRange(a,b),rotation=a.rotation;await game.system.api.turns.rotateToken(a,'cw');return {result,rotation,expected:(rotation+45)%360,profile:game.system.api.range.getProfileForToken(a)};});
    await gm.waitForFunction(({token,expected})=>canvas.scene.tokens.get(token).rotation===expected,{token:fixture.tokens.character,expected:measured.expected});assert.ok(measured.result);await gm.evaluate(async({token,rotation})=>{await canvas.scene.tokens.get(token).update({rotation,action:'displace'});},{token:fixture.tokens.character,rotation:measured.rotation});return measured;
  });
  await step('range-flight-and-scale-dialogs','native UI',async()=>{
    await gm.evaluate(()=>{void game.system.api.range.openScaleDialog();});await gm.locator('dialog').waitFor();assert.ok((await gm.locator('dialog').innerText()).length>40);await close(gm);
    await gm.evaluate(()=>{const f=__betaFeatureFixture;void game.system.api.range.openFlightDialog(game.scenes.get(f.scene).tokens.get(f.tokens.vehicle));});await gm.locator('dialog').waitFor();assert.ok((await gm.locator('dialog').innerText()).length>40);
  });
  await step('altitude-shadow-native-settings-and-renderer','native canvas API',async()=>{
    await gm.evaluate(async()=>{const t=canvas.tokens.get(__betaFeatureFixture.tokens.vehicle);await t.document.update({elevation:50,action:'displace'},{animate:false});});
    await gm.waitForFunction(()=>canvas.tokens.get(__betaFeatureFixture.tokens.vehicle).document.elevation===50);
    const result=await gm.evaluate(async()=>{const module=await import('/systems/star-wars-ffg/src/altitude-shadows-foundry.mjs'),t=canvas.tokens.get(__betaFeatureFixture.tokens.vehicle);const geo=module.shadowArtworkGeometry(t.document,{width:256,height:256},t);return {geo,elevation:t.document.elevation,scene:canvas.scene.id,canvasReady:canvas.ready};});assert.equal(result.elevation,50);assert.ok(result.geo.width>0);assert.ok(result.canvasReady);await gm.screenshot({path:join(output,'feature-altitude.png')});return result;
  });
  await step('altitude-shadow-visible-hidden-and-optout','native PIXI renderer',async()=>{
    const count=()=>gm.evaluate(()=>canvas.primary.children.filter(c=>c.name?.startsWith('Star Wars altitude shadow ')).length);
    await gm.waitForFunction(()=>canvas.primary.children.some(c=>c.name?.startsWith('Star Wars altitude shadow ')));const visible=await count();
    await gm.evaluate(()=>game.settings.set('star-wars-ffg','altitudeShadows',false));await gm.waitForFunction(()=>!canvas.primary.children.some(c=>c.name?.startsWith('Star Wars altitude shadow ')));
    await gm.evaluate(()=>game.settings.set('star-wars-ffg','altitudeShadows',true));await gm.waitForFunction(()=>canvas.primary.children.some(c=>c.name?.startsWith('Star Wars altitude shadow ')));
    await gm.evaluate(async()=>{const f=__betaFeatureFixture;await game.scenes.get(f.scene).tokens.get(f.tokens.vehicle).update({hidden:true});});await gm.waitForFunction(()=>!canvas.primary.children.some(c=>c.name?.startsWith('Star Wars altitude shadow ')));
    await gm.evaluate(async()=>{const f=__betaFeatureFixture;await game.scenes.get(f.scene).tokens.get(f.tokens.vehicle).update({hidden:false,elevation:0});});return {visible,clientOptOut:true,hiddenCasterRemoved:true};
  });
  await step('range-clear-wall-blocked-and-elevation','native canvas and wall documents',async()=>{
    await gm.evaluate(async()=>{const f=__betaFeatureFixture,s=game.scenes.get(f.scene);await s.tokens.get(f.tokens.character).update({x:300,y:300,elevation:0,action:'displace'},{animate:false});await s.tokens.get(f.tokens.rival).update({x:1300,y:300,elevation:0,action:'displace'},{animate:false});});
    await gm.waitForFunction(()=>{const f=__betaFeatureFixture,s=canvas.scene;return s.tokens.get(f.tokens.character).y===300&&s.tokens.get(f.tokens.rival).x===1300&&s.tokens.get(f.tokens.rival).elevation===0;});
    const result=await gm.evaluate(async()=>{const f=__betaFeatureFixture,s=canvas.scene,a=s.tokens.get(f.tokens.character),b=s.tokens.get(f.tokens.rival);const clear=game.system.api.range.measureTokenRange(a,b);const [wall]=await s.createEmbeddedDocuments('Wall',[{c:[800,0,800,1000],sight:20,move:20,light:20,sound:20}]);await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));const blocked=game.system.api.range.measureTokenRange(a,b);await wall.delete();await b.update({elevation:10,action:'displace'},{animate:false});return {clear,blocked};});
    await gm.waitForFunction(()=>canvas.scene.tokens.get(__betaFeatureFixture.tokens.rival).elevation===10);
    result.elevated=await gm.evaluate(()=>{const f=__betaFeatureFixture;return game.system.api.range.measureTokenRange(canvas.scene.tokens.get(f.tokens.character),canvas.scene.tokens.get(f.tokens.rival));});
    await gm.evaluate(async()=>{await canvas.scene.tokens.get(__betaFeatureFixture.tokens.rival).update({elevation:0,action:'displace'},{animate:false});});await gm.waitForFunction(()=>canvas.scene.tokens.get(__betaFeatureFixture.tokens.rival).elevation===0);
    assert.equal(result.clear.available,true);assert.equal(result.clear.lineOfSight,'clear');assert.equal(result.blocked.lineOfSight,'blocked');assert.equal(result.elevated.elevationApplied,true);assert.ok(result.elevated.sceneDistance>result.clear.sceneDistance);return result;
  });
  await step('range-attack-preview-and-send-pool','native canvas and UI',async()=>{
    const result=await gm.evaluate(async()=>{
      const f=__betaFeatureFixture,s=game.scenes.get(f.scene),a=s.tokens.get(f.tokens.character),b=s.tokens.get(f.tokens.rival);const [weapon]=await a.actor.createEmbeddedDocuments('Item',[{name:'QA test blaster',type:'weapon',system:{skill:'rangedLight',damage:'6',range:'long',scale:'personal'}}]);
      game.system.api.range.setAttackSelection(a.actor,{itemId:weapon.id});a.object.control({releaseOthers:true});b.object.setTarget(true,{releaseOthers:true});const preview=game.system.api.range.buildAttackTracePreview(a,b);game.system.api.range.showAttackTrace(a,b,{animate:false});return preview;
    });assert.ok(result.pool);assert.ok(!result.error,result.error);
    await gm.waitForFunction(()=>game.system.api.range.getAttackTraceState().some(s=>s.labelVisible));
    const point=await gm.evaluate(()=>{const queue=[canvas.stage];while(queue.length){const node=queue.shift();if(node.text?.includes('ACTION · SEND DICE TO POOL')&&node.worldVisible){const b=node.getBounds(),view=(canvas.app.canvas??canvas.app.view).getBoundingClientRect(),screen=canvas.app.renderer.screen;return {x:view.left+(b.x+b.width/2)*view.width/screen.width,y:view.top+(b.y+b.height/2)*view.height/screen.height};}queue.push(...(node.children??[]));}return null;});assert.ok(point);await gm.mouse.click(point.x,point.y);
    const pool=await gm.evaluate(async()=>(await import('/systems/star-wars-ffg/src/dice/compact-tray.mjs')).getCompactPoolState());assert.deepEqual(pool.pool,result.pool);await gm.screenshot({path:join(output,'feature-range-targeting.png')});return {pool:result.pool,range:result.range};
  });
  await step('combat-initiative-slots-next-round-and-cleanup','native Combat API and UI',async()=>{
    const result=await gm.evaluate(async()=>{
      await game.settings.set('star-wars-ffg','combatRangeAssistant',false);const f=__betaFeatureFixture,scene=game.scenes.get(f.scene),tokens=[scene.tokens.get(f.tokens.character),scene.tokens.get(f.tokens.rival)];
      const combat=await Combat.create({scene:scene.id,active:true});await combat.createEmbeddedDocuments('Combatant',tokens.map(t=>({tokenId:t.id,actorId:t.actorId,sceneId:scene.id})));await combat.rollInitiative(combat.combatants.map(c=>c.id),{skill:'cool'});await combat.startCombat();__betaFeatureFixture.combat=combat.id;return {id:combat.id,round:combat.round,slots:combat.combatants.map(c=>({id:c.id,initiative:c.initiative,side:c.getFlag('star-wars-ffg','slotSide')}))};
    });assert.equal(result.round,1);assert.deepEqual(result.slots.map(s=>s.side).sort(),['npc','pc']);assert.ok(result.slots.every(s=>Number.isFinite(s.initiative)));
    await gm.evaluate(()=>{void game.system.api.tabletop.initiative(game.combats.get(__betaFeatureFixture.combat));});await gm.locator('dialog [name="slotId"]').waitFor();await close(gm);
    const ended=await gm.evaluate(async()=>{const c=game.combats.get(__betaFeatureFixture.combat);await c.nextRound();const round=c.round;await c.delete();return {round,left:game.combats.has(c.id)};});assert.equal(ended.round,2);assert.equal(ended.left,false);return result;
  });
  await step('vehicle-dashboard-adjust-speed-and-shields','native UI',async()=>{
    await gm.evaluate(()=>{void game.system.api.tabletop.vehicle(game.actors.get(__betaFeatureFixture.actors.vehicle));});await gm.locator('.sf-vehicle-dashboard').waitFor();await gm.locator('[data-dashboard="state"]').click();await gm.locator('dialog [name="speed"]').fill('2');await gm.locator('dialog [name="fore"]').fill('1');await gm.getByRole('button',{name:'Review',exact:true}).click();await gm.getByRole('button',{name:'Apply reviewed changes',exact:true}).click();await gm.waitForFunction(id=>game.actors.get(id).system.speed.value===2&&game.actors.get(id).system.shields.fore===1,fixture.actors.vehicle);
  });
  await step('critical-condition-record-and-dice-modifier','native UI',async()=>{
    await gm.evaluate(()=>{void game.system.api.tabletop.resolve(game.actors.get(__betaFeatureFixture.actors.character));});await gm.locator('dialog [name="kind"]').selectOption('condition');await gm.locator('dialog [name="label"]').fill('QA distracted');await gm.locator('dialog [name="modifierDie"]').selectOption('setback');await gm.locator('dialog [name="note"]').fill('Original synthetic QA ruling for regression.');await gm.getByRole('button',{name:'Review change',exact:true}).click();await gm.getByRole('button',{name:'Apply reviewed changes',exact:true}).click();await gm.waitForFunction(id=>(game.actors.get(id).getFlag('star-wars-ffg','conditions')||[]).some(c=>c.name==='QA distracted'),fixture.actors.character);
    const result=await gm.evaluate(id=>game.actors.get(id).getFlag('star-wars-ffg','conditions'),fixture.actors.character);assert.equal(result.find(c=>c.name==='QA distracted').modifier.die,'setback');
    const roll=await gm.evaluate(async id=>{const r=await game.actors.get(id).rollSkill('athletics',{difficulty:0,turnCost:'none'});return r.pool;},fixture.actors.character);assert.ok(roll.setback>=1);
    await gm.evaluate(()=>{void game.system.api.tabletop.history(game.actors.get(__betaFeatureFixture.actors.character));});await gm.locator('dialog [data-undo]').first().click();await gm.waitForFunction(id=>!(game.actors.get(id).getFlag('star-wars-ffg','conditions')||[]).length,fixture.actors.character);await gm.locator('dialog h3').filter({hasText:'undone'}).waitFor();await gm.locator('dialog').getByRole('button',{name:'Close',exact:true}).click();return {condition:result,appliedPool:roll,undo:true};
  });
  await step('equipment-distribution-and-undo','native UI and embedded Item API',async()=>{
    const uuid=await gm.evaluate(async()=>(await Item.create({name:'QA distribution medpac',type:'gear',system:{quantity:1}})).uuid);
    await gm.evaluate(()=>{void game.system.api.tabletop.equipment(game.actors.get(__betaFeatureFixture.actors.character));});
    await gm.locator(`dialog [name="give-${uuid}"]`).check();await gm.locator(`dialog [name="qty-${uuid}"]`).fill('2');
    await gm.getByRole('button',{name:'Preview handout',exact:true}).click();await gm.locator('dialog .sf-equipment-review').getByText('QA distribution medpac').waitFor();
    await gm.getByRole('button',{name:'Give reviewed equipment',exact:true}).click();
    await gm.waitForFunction(id=>game.actors.get(id).items.some(i=>i.name==='QA distribution medpac'&&i.system.quantity===2),fixture.actors.character);
    const given=await gm.evaluate(id=>{const item=game.actors.get(id).items.find(i=>i.name==='QA distribution medpac');return {quantity:item.system.quantity,duplicateSource:item._stats.duplicateSource,history:game.actors.get(id).getFlag('star-wars-ffg','workflowHistory').at(-1).kind};},fixture.actors.character);
    assert.equal(given.duplicateSource,uuid);assert.equal(given.history,'equipment');
    await gm.evaluate(()=>{void game.system.api.tabletop.history(game.actors.get(__betaFeatureFixture.actors.character));});await gm.locator('dialog [data-undo]').first().click();
    await gm.waitForFunction(id=>!game.actors.get(id).items.some(i=>i.name==='QA distribution medpac'),fixture.actors.character);await gm.locator('dialog h3').filter({hasText:'undone'}).first().waitFor();await gm.locator('dialog').getByRole('button',{name:'Close',exact:true}).click();
    return {...given,undo:true};
  });
  await step('session-story-checks-and-morality','native UI, Roll and actor history',async()=>{
    // Party Obligation of 100 or more triggers on every d100, so the check is deterministic.
    const before=await gm.evaluate(async id=>{const campaign=game.settings.get('star-wars-ffg','campaign');await game.settings.set('star-wars-ffg','campaign',{...campaign,obligation:true,duty:false,morality:true});
      await game.actors.get(id).update({'system.obligation.value':100,'system.morality.value':50,'system.morality.conflict':3});
      return {campaign,strain:Object.fromEntries(game.actors.filter(a=>a.type==='character'&&a.hasPlayerOwner).map(a=>[a.id,a.system.strain.max]))};},fixture.actors.character);
    try {
      await gm.evaluate(()=>{void game.system.api.tabletop.sessionStart();});await gm.getByRole('button',{name:'Roll checks',exact:true}).click();
      await gm.getByRole('button',{name:'Apply reviewed changes',exact:true}).click();
      await gm.waitForFunction(({id,max})=>game.actors.get(id).system.strain.max<max,{id:fixture.actors.character,max:before.strain[fixture.actors.character]});
      const started=await gm.evaluate(id=>game.actors.get(id).system.strain.max,fixture.actors.character);
      assert.ok([2,4].includes(before.strain[fixture.actors.character]-started),'the triggered character loses two strain threshold, or four on doubles');
      await gm.evaluate(()=>{void game.system.api.tabletop.sessionEnd();});await gm.getByRole('button',{name:'Roll and preview',exact:true}).click();
      await gm.getByRole('button',{name:'Apply reviewed changes',exact:true}).click();
      await gm.waitForFunction(strain=>Object.entries(strain).every(([id,max])=>game.actors.get(id).system.strain.max===max),before.strain);
      await gm.waitForFunction(id=>game.actors.get(id).system.morality.conflict===0,fixture.actors.character);
      const ended=await gm.evaluate(id=>{const a=game.actors.get(id);return {morality:a.system.morality.value,kinds:a.getFlag('star-wars-ffg','workflowHistory').map(e=>e.kind).slice(-3)};},fixture.actors.character);
      assert.deepEqual(ended.kinds,['session-story','session-story-end','morality']);assert.ok(ended.morality>=48&&ended.morality<=57,'Morality moves by d10 minus 3 Conflict');
      return {startedStrainMax:started,...ended};
    } finally {await gm.evaluate(campaign=>game.settings.set('star-wars-ffg','campaign',campaign),before.campaign);}
  });
  await step('critical-table-roll-and-undo','native UI and Roll',async()=>{
    const campaign=await gm.evaluate(async()=>{const c=game.settings.get('star-wars-ffg','campaign');await game.settings.set('star-wars-ffg','campaign',{...c,bookMode:'all'});return c;});
    try {
      await gm.evaluate(()=>{void game.system.api.tabletop.resolve(game.actors.get(__betaFeatureFixture.actors.character));});await gm.locator('dialog [name="kind"]').selectOption('critical');
      assert.equal(await gm.locator('dialog [name="rollCritical"]').isChecked(),true);await gm.locator('dialog [name="note"]').fill('Original synthetic QA critical.');
      await gm.getByRole('button',{name:'Review change',exact:true}).click();await gm.locator('dialog .sf-review-change').getByText(/d100 \d+ →/).waitFor();
      await gm.getByRole('button',{name:'Apply reviewed changes',exact:true}).click();
      await gm.waitForFunction(id=>(game.actors.get(id).system.criticals??[]).some(c=>c.total),fixture.actors.character);
      const critical=await gm.evaluate(id=>game.actors.get(id).system.criticals.find(c=>c.total),fixture.actors.character);
      assert.ok(critical.name&&critical.total>=1&&/Core Book/.test(critical.source.book));
      await gm.evaluate(()=>{void game.system.api.tabletop.history(game.actors.get(__betaFeatureFixture.actors.character));});await gm.locator('dialog [data-undo]').first().click();
      await gm.waitForFunction(id=>!(game.actors.get(id).system.criticals??[]).some(c=>c.total),fixture.actors.character);await gm.locator('dialog').getByRole('button',{name:'Close',exact:true}).click();
      return critical;
    } finally {await gm.evaluate(c=>game.settings.set('star-wars-ffg','campaign',c),campaign);}
  });
  await step('narrative-spending-core-table-preset','native UI and bundled catalogue',async()=>{
    const campaign=await gm.evaluate(async()=>{const c=game.settings.get('star-wars-ffg','campaign');await game.settings.set('star-wars-ffg','campaign',{...c,bookMode:'all'});return c;});
    try {
      const message=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.actors.character);for(let n=0;n<4;n++){const roll=await game.system.api.rollPool({boost:10},{actor:a,label:'QA preset roll',turnCost:'none'});if(roll.outcome.advantage>0)return game.messages.filter(m=>m.isRoll&&m.flavor==='QA preset roll').at(-1).id;}throw Error('No spendable result in four rolls');});
      await gm.evaluate(id=>{void game.system.api.tabletop.spend(game.messages.get(id));},message);
      const value=await gm.locator('dialog [name="preset"] option',{hasText:'The acting character regains 1 strain.'}).getAttribute('value');
      await gm.locator('dialog [name="preset"]').selectOption(value);
      assert.equal(await gm.locator('dialog [name="advantage"]').inputValue(),'1');assert.equal(await gm.locator('dialog [name="book"]').inputValue(),'Edge of The Empire - Core Book');
      await gm.getByRole('button',{name:'Review decision',exact:true}).click();await gm.getByRole('button',{name:'Record GM decision',exact:true}).click();
      await gm.waitForFunction(id=>game.messages.get(id).getFlag('star-wars-ffg','spending')?.length===1,message);
      const entry=await gm.evaluate(id=>game.messages.get(id).getFlag('star-wars-ffg','spending')[0],message);
      assert.deepEqual([entry.cost.advantage,entry.source.page,entry.source.verification],[1,'206','gm-reviewed']);return entry;
    } finally {await gm.evaluate(c=>game.settings.set('star-wars-ffg','campaign',c),campaign);}
  });
  await step('weapon-quality-pool-effects','native sheet roll builder',async()=>{
    const result=await gm.evaluate(async id=>{
      const actor=game.actors.get(id),[item]=await actor.createEmbeddedDocuments('Item',[{name:'QA heavy repeater',type:'weapon',system:{skill:'rangedHeavy',damage:9,range:'medium',qualities:'Accurate 2, Superior, Cumbersome 9, Vicious 2'}}]);
      try {
        const {poolBuilderContext}=await import('/systems/star-wars-ffg/src/sheets.mjs'),definition=actor.skillDefinition('rangedHeavy');
        const context=poolBuilderContext(actor,'rangedHeavy',item,definition,definition.characteristic,actor.skillRank('rangedHeavy'));
        return {boost:context.boost,advantage:context.qualityAdvantage,difficulty:context.qualityDifficulty,brawn:actor.system.characteristics.brawn,reasons:context.qualityReasons};
      } finally {await item.delete();}
    },fixture.actors.character);
    assert.ok(result.boost>=2);assert.equal(result.advantage,1);assert.equal(result.difficulty,Math.max(0,9-result.brawn));
    assert.ok(result.reasons.some(reason=>/Accurate 2: 2 boost/.test(reason)));return result;
  });
  await step('narrative-spending-future-die-used-once','native UI and authenticated roll',async()=>{
    const message=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.actors.character);for(let n=0;n<4;n++){const roll=await game.system.api.rollPool({boost:10},{actor:a,label:'QA spendable roll',turnCost:'none'});if(roll.outcome.advantage>0){const message=game.messages.filter(m=>m.isRoll&&m.flavor==='QA spendable roll').at(-1);return message.id;}}throw Error('No spendable result in four rolls');});
    await gm.evaluate(id=>{void game.system.api.tabletop.spend(game.messages.get(id));},message);await gm.locator('dialog [name="advantage"]').fill('1');await gm.locator('dialog [name="label"]').fill('QA next check');await gm.locator('dialog [name="note"]').fill('Original synthetic QA ruling.');await gm.locator('dialog [name="futureDie"]').selectOption('boost');await gm.locator('dialog [name="futureActorUuid"]').selectOption('Actor.'+fixture.actors.character);await gm.getByRole('button',{name:'Review decision',exact:true}).click();await gm.getByRole('button',{name:'Record GM decision',exact:true}).click();await gm.waitForFunction(id=>game.messages.get(id).getFlag('star-wars-ffg','spending')?.length===1,message);
    const result=await gm.evaluate(async id=>{const a=game.actors.get(id),first=await a.rollSkill('athletics',{difficulty:0,turnCost:'none'}),second=await a.rollSkill('athletics',{difficulty:0,turnCost:'none'});return {first:first.pool,second:second.pool,effects:a.getFlag('star-wars-ffg','narrativeEffects')};},fixture.actors.character);assert.equal(result.first.boost,1);assert.equal(result.second.boost,0);assert.ok(result.effects[0].consumedBy);return result;
  });
  await step('force-rating-commitment-and-pip-spending','native actor API and UI',async()=>{
    const result=await gm.evaluate(async id=>{const a=game.actors.get(id);await a.update({'system.forceRating':2,'system.committedForce':1});const rolled=await a.rollForce({turnCost:'none'});const m=game.messages.filter(m=>m.isRoll&&m.getFlag('star-wars-ffg','actorUuid')===a.uuid).at(-1);return {pool:rolled.pool,outcome:rolled.outcome,message:m.id};},fixture.actors.character);assert.equal(result.pool.force,1);
    await gm.evaluate(id=>{void game.system.api.tabletop.spend(game.messages.get(id));},result.message);const side=result.outcome.light>0?'light':'dark';await gm.locator('dialog [name="'+side+'"]').fill('1');await gm.locator('dialog [name="label"]').fill('QA Force ruling');await gm.getByRole('button',{name:'Review decision',exact:true}).click();await gm.getByRole('button',{name:'Record GM decision',exact:true}).click();await gm.waitForFunction(id=>game.messages.get(id).getFlag('star-wars-ffg','spending')?.length===1,result.message);return {forceDice:result.pool.force,spent:side};
  });
  await step('rule-review-validate-save-and-player-denial','native UI and permission API',async()=>{
    const id=await gm.evaluate(async()=>{const item=await Item.create({name:'QA reviewed gear',type:'gear'});void (await import('/systems/star-wars-ffg/src/data-review.mjs')).openDataReview();return item.id;});const review=gm.locator('#star-wars-data-review');await review.waitFor();await review.getByRole('button',{name:'QA reviewed gear',exact:true}).click();await review.locator('[name="sourceBook"]').fill('Original QA source');await review.locator('[name="sourcePage"]').fill('1');await review.locator('[name="description"]').fill('Original synthetic QA guidance.');await review.locator('[data-action="validate"]').click();await review.locator('[data-action="save"]').click();await gm.waitForFunction(id=>game.items.get(id).system.source.book==='Original QA source',id);
    const denied=await player.evaluate(async()=>{try{(await import('/systems/star-wars-ffg/src/data-review.mjs')).openDataReview();return '';}catch(e){return e.message;}});assert.ok(denied);
  });
  await step('integration-roundtrip-character-and-all-actor-types','native API',async()=>{
    const result=await gm.evaluate(async()=>{const results=[];for(const [type,id]of Object.entries(__betaFeatureFixture.actors)){const packet=await game.system.api.integration.exportActor(game.actors.get(id));game.system.api.integration.validatePackage(packet);const imported=await game.system.api.integration.importPackage(packet),actor=game.actors.get(imported.actorId);if(actor?.type!==type)throw Error('Imported Actor type differs: '+type);const again=await game.system.api.integration.exportActor(actor);if(JSON.stringify(again.payload.system)!==JSON.stringify(packet.payload.system))throw Error('Imported Actor fields differ: '+type);results.push({type,format:packet.format,version:packet.version,fieldsPreserved:true});}const legacy=await game.system.api.integration.exportCharacter(game.actors.get(__betaFeatureFixture.actors.character)),imported=await game.system.api.integration.importPackage(legacy);if(game.actors.get(imported.actorId)?.type!=='character')throw Error('Legacy character import failed');return {actors:results,legacyVersion:legacy.version};});assert.equal(result.actors.length,6);assert.equal(result.legacyVersion,1);return result;
  });
  await step('integration-actor-group-reviewed-file-import','native GM UI and document verification',async()=>{
    const packet=await gm.evaluate(async()=>{const actors=[];for(const type of ['character','rival']){const p=await game.system.api.integration.exportActor(game.actors.get(__betaFeatureFixture.actors[type]));actors.push({id:type,actor:{...p.payload,name:'QA graph '+type}});}return {format:'star-wars-ffg-interchange',version:3,kind:'actorGroup',source:{id:'qa.native',name:'Original QA fixture',version:'1.0.0'},payload:{id:'qa-graph',name:'QA authored graph',actors,nodes:[{id:'hero-node',name:'QA hero',role:'player-character',actorRefs:['character'],position:{x:40,y:75}},{id:'enemy-node',name:'QA enemy',role:'enemy-rival',actorRefs:['rival'],position:{x:320,y:75}}],relationships:[{id:'qa-pursuit',fromNodeId:'enemy-node',toNodeId:'hero-node',kind:'pursues',label:'Original QA relationship'}]}};});
    await gm.evaluate(()=>{globalThis.__betaGraphResult=null;Hooks.once('starWarsFFGIntegrationImported',result=>globalThis.__betaGraphResult=result);void game.system.api.integration.openImportDialog();});await gm.locator('dialog [name="integrationFile"]').setInputFiles({name:'qa-graph.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(packet))});await gm.getByRole('button',{name:'Review import',exact:true}).click();await gm.getByRole('button',{name:'Import into this world',exact:true}).click();await gm.waitForFunction(()=>__betaGraphResult?.kind==='actorGroup');
    const result=await gm.evaluate(()=>({result:__betaGraphResult,flags:__betaGraphResult.actors.map(a=>game.actors.get(a.actorId).getFlag('star-wars-ffg','integration').actorGroup)}));assert.equal(result.result.actors.length,2);assert.ok(result.flags.every(f=>f.relationships[0].fromNodeId==='enemy-node'&&f.relationships[0].toNodeId==='hero-node'));const denial=await player.evaluate(async packet=>{try{await game.system.api.integration.importPackage(packet);return '';}catch(e){return e.message;}},packet);assert.match(denial,/Only the GM/);return result;
  });
  await step('integration-community-rules-preserve-and-replace','native Compendium API and player access',async()=>{
    const result=await gm.evaluate(async()=>{const packet={format:'star-wars-ffg-interchange',version:2,kind:'rulePack',source:{id:'qa.native',name:'Original QA fixture',version:'1.0.0'},payload:{id:'qa-rules',name:'QA community rules',version:'1.0.0',rules:[{key:'qa-tool',name:'QA community tool',type:'gear',system:{description:'Original synthetic QA rule.',quantity:1}}]}};const first=await game.system.api.integration.importPackage(packet),pack=game.packs.get(first.pack);await pack.getIndex();const id=pack.index.find(i=>i.name==='QA community tool')._id;await pack.configure({locked:true});packet.payload.rules[0].name='QA revised community tool';const preserved=await game.system.api.integration.importPackage(packet),before=(await pack.getDocument(id)).name,replaced=await game.system.api.integration.importPackage(packet,{conflict:'replace'}),after=(await pack.getDocument(id)).name;return {first,preserved,replaced,before,after,id,locked:pack.locked};});assert.equal(result.first.created,1);assert.equal(result.preserved.preserved,1);assert.equal(result.before,'QA community tool');assert.equal(result.replaced.updated,1);assert.equal(result.after,'QA revised community tool');assert.ok(result.locked);await player.waitForFunction(()=>game.packs.get('world.star-wars-community-rules')?.visible);const readable=await player.evaluate(async id=>({name:(await game.packs.get('world.star-wars-community-rules').getDocument(id)).name}),result.id);assert.equal(readable.name,result.after);return result;
  });
  await step('integration-review-dialog-and-executable-rejection','native UI and validation API',async()=>{
    await gm.evaluate(()=>{void game.system.api.integration.openImportDialog();});await gm.locator('dialog [name="integrationFile"]').waitFor();
    const denied=await gm.evaluate(async()=>{const packet=await game.system.api.integration.exportActor(game.actors.get(__betaFeatureFixture.actors.character));packet.payload.flags={script:'globalThis.compromised=true'};try{game.system.api.integration.validatePackage(packet);return '';}catch(e){return e.message;}});assert.ok(denied);
  });
  await step('private-library-import-ui-and-player-denial','native UI and API',async()=>{
    await gm.evaluate(()=>{void game.system.api.importDialog();});await gm.locator('dialog [type="file"]').waitFor();await gm.locator('dialog [type="file"]').waitFor();
    const denied=await player.evaluate(async()=>{try{await game.system.api.importLibrary({});return '';}catch(e){return e.message;}});assert.ok(denied);
  });
  await step('gm-private-source-encryption-and-permission','native cryptography and permission API',async()=>{
    const result=await gm.evaluate(async()=>{const m=await import('/systems/star-wars-ffg/src/gm-notes.mjs');const docs=await m.preparePrivateNotes([{_id:'BetaQANotes00001',name:'QA notes',flags:{'star-wars-ffg':{gmSource:{name:'QA notes',source:'Original synthetic QA',text:'PRIVATE_QA_SENTINEL_731'}}}}],null);const doc=docs[0];return {encrypted:!!doc.flags['star-wars-ffg'].gmSealed,plaintext:JSON.stringify(doc).includes('PRIVATE_QA_SENTINEL_731'),ownership:doc.ownership};});assert.ok(result.encrypted);assert.equal(result.plaintext,false);assert.equal(result.ownership.default,0);
    const denied=await player.evaluate(()=>{try{game.system.api.searchGMSourceNotes('QA');return '';}catch(e){return e.message;}});assert.ok(denied);return result;
  });
  await step('private-library-native-import-encrypted-storage-and-reimport','native UI and Compendium API',async()=>{
    const itemId='QAItem01'.padEnd(16,'0'),noteId='QANote01'.padEnd(16,'0');
    const bundle={format:'star-wars-ffg-library',version:1,documents:{Item:[{_id:itemId,name:'QA private tool',type:'gear',system:{description:'Original synthetic QA equipment.',quantity:1}}],JournalEntry:[{_id:noteId,name:'QA private notes',flags:{'star-wars-ffg':{gmOnly:true,gmSource:{name:'QA private notes',source:'Original synthetic QA',text:'PRIVATE_NATIVE_QA_SENTINEL'}}}}]}};
    await gm.evaluate(()=>{void game.system.api.importDialog();});await gm.locator('dialog [type="file"]').setInputFiles({name:'qa-library.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await gm.locator('dialog').getByRole('button',{name:'Import library',exact:true}).click();
    await gm.waitForFunction(id=>game.packs.get('world.star-wars-gm-notes')?.index.has(id),noteId,{timeout:30000});
    const result=await gm.evaluate(async({bundle,noteId})=>{const m=await import('/systems/star-wars-ffg/src/gm-notes.mjs');await m.refreshGMNotes();const note=await game.packs.get('world.star-wars-gm-notes').getDocument(noteId),source=note.toObject(),again=await game.system.api.importLibrary(bundle);return {sealed:!!source.flags['star-wars-ffg'].gmSealed,plaintext:JSON.stringify(source).includes('PRIVATE_NATIVE_QA_SENTINEL'),search:game.system.api.searchGMSourceNotes('PRIVATE_NATIVE_QA_SENTINEL').length,again};},{bundle,noteId});assert.ok(result.sealed);assert.equal(result.plaintext,false);assert.equal(result.search,1);assert.equal(result.again.GMNotes.created,0);assert.equal(result.again.Item.created,0);
    const visible=await player.evaluate(()=>Boolean(game.packs.get('world.star-wars-gm-notes')?.visible));assert.equal(visible,false);return result;
  });
  await step('swa-adversary-import-ui-and-synthetic-conversion','native UI and API',async()=>{
    await gm.evaluate(()=>{void game.system.api.importSwaDialog();});await gm.locator('dialog [name="adversaries"]').waitFor();assert.ok(await gm.locator('dialog [name="privateNotes"]').isChecked());
    const converted=await gm.evaluate(()=>game.system.api.convertSwa({id:'qa-rival',name:'QA rival',type:'rival',characteristics:{Brawn:2,Agility:2,Intellect:2,Cunning:2,Willpower:2,Presence:2},derived:{soak:2,wounds:10},skills:{},tags:['species:Human']}));assert.equal(converted.documents.Actor[0].type,'rival');return {convertedType:converted.documents.Actor[0].type};
  });
  await step('help-coverage-filter-and-privacy-safe-diagnostics','native UI and API',async()=>{
    await gm.evaluate(()=>game.system.api.support.open());const help=gm.locator('#star-wars-support');await help.waitFor();await help.locator('[name="actorId"]').selectOption(fixture.actors.character);assert.ok((await help.innerText()).length>100);
    const report=await gm.evaluate(()=>game.system.api.support.diagnostics());assert.equal(JSON.stringify(report).includes('PRIVATE_QA_SENTINEL_731'),false);assert.equal(JSON.stringify(report).includes('Beta QA character'),false);await gm.screenshot({path:join(output,'feature-help.png')});return report;
  });
  await step('compendium-population-and-safe-reimport','native UI and Compendium API',async()=>{
    await gm.evaluate(()=>game.system.api.openReferenceBrowser());await gm.locator('#star-wars-reference-browser [data-action="populate"]').click();await gm.locator('dialog [data-action="yes"]').click();
    await gm.waitForFunction(()=>['world.star-wars-item','world.star-wars-actor','world.star-wars-journalentry'].every(id=>game.packs.get(id)?.index.size>0),null,{timeout:120000});
    await gm.waitForFunction(()=>document.querySelector('#notifications')?.textContent.includes('Reference import complete.'),null,{timeout:120000});const result=await gm.evaluate(async()=>{const ids=['world.star-wars-item','world.star-wars-actor','world.star-wars-journalentry'];const before=Object.fromEntries(ids.map(id=>[id,game.packs.get(id).index.size]));const reimport=await game.system.api.importPublishedLibrary();const after=Object.fromEntries(ids.map(id=>[id,game.packs.get(id).index.size]));return {before,after,reimport};});assert.deepEqual(result.after,result.before);assert.ok(Object.values(result.reimport).every(r=>r.created===0));return result;
  });
  await step('theme-switching-and-reduced-motion','native UI',async()=>{
    const sheet=await openActor(fixture.actors.character);for(const theme of ['frontier','rebellion','mystic']){await sheet.locator('[name="system.theme"]').selectOption(theme);await gm.waitForFunction(({id,theme})=>game.actors.get(id).system.theme===theme,{id:fixture.actors.character,theme});assert.equal(await sheet.locator('.sf-shell').getAttribute('data-theme'),theme);}
    await gm.emulateMedia({reducedMotion:'reduce'});await sheet.locator('[data-tab="skills"]').first().click();assert.ok(await sheet.locator('.sf-skill-sheet').count());await gm.emulateMedia({reducedMotion:'no-preference'});
  });
  await step('director-adapter-context-capabilities-and-safety','native system adapter API; external module absent',async()=>{
    const result=await gm.evaluate(async()=>{const a=game.actors.get(__betaFeatureFixture.actors.character),api=game.system.api.directorOfRealms;return {methods:Object.keys(api),actor:game.system.api.actorContext(a),capabilities:game.system.api.integration.getCapabilities()};});assert.ok(result.actor);assert.ok(result.methods.length>5);return {methods:result.methods,capabilities:result.capabilities};
  });
  await step('settings-every-menu-renders','native UI',async()=>{
    const keys=await gm.evaluate(()=>[...game.settings.menus.entries()].filter(([key])=>key.startsWith('star-wars-ffg.')).map(([key])=>key));const tested=[];
    for(const key of keys){await close(gm);await gm.evaluate(key=>{const Menu=game.settings.menus.get(key).type;new Menu().render({force:true});},key);await gm.locator('.application .window-header').first().waitFor();tested.push(key);}
    return tested;
  });
  await step('reload-world-data-identity-and-persistence','native GM/player reload',async()=>{
    const before=await gm.evaluate(()=>Object.fromEntries(Object.entries(__betaFeatureFixture.actors).map(([type,id])=>[type,game.actors.get(id).toObject()])));await gm.reload({waitUntil:'domcontentloaded',timeout:60000});await gm.waitForFunction(()=>game.ready);const after=await gm.evaluate(ids=>Object.fromEntries(Object.entries(ids).map(([type,id])=>[type,game.actors.get(id).toObject()])),fixture.actors);assert.deepEqual(after,before);await player.reload({waitUntil:'domcontentloaded',timeout:60000});await player.waitForFunction(()=>game.ready);assert.equal(await player.evaluate(id=>game.actors.get(id).name,fixture.actors.character),'Beta QA character');
  });
  report.notTested=[...(report.expectedModules?.includes('dice-so-nice')?[]:['Dice So Nice animated rendering (system-only run)']),'External Director of Realms runtime/provider workflows','All possible species, talents, vehicle loadouts and campaign configurations','Independent human play acceptance'];
  report.featureSummary={passed:checks.filter(c=>c.passed).length,failed:issues.length,skipped:checks.filter(c=>c.skipped).length,filter:filter??null,nativeFoundry:true,independentHumanReview:false};
  console.log('FEATURE SUMMARY '+JSON.stringify(report.featureSummary));
  assert.equal(issues.length,0,'Native feature failures require triage; see feature-progress.json');
}
