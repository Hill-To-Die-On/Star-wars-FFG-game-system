import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageProvenance,verifyMessageProvenance,assertLocalTabletopAuthority} from '../src/tabletop-provenance.mjs';
const gm={id:'gm',isGM:true,active:true},player={id:'player',active:true},users=[gm,player],key='tabletopRequest';
const request=()=>({uuid:'ChatMessage.request',author:player,flags:{'star-wars-ffg':{[key]:{command:'claim',args:{actorUuid:'Actor.a'}}}}});
test('server creator rejects a player-authored request forged as the GM while a legitimate player request authenticates',async()=>{
 const message=request(),receipt=await createMessageProvenance(message,key,player.id,users);
 assert.equal(await verifyMessageProvenance(message,key,receipt,users),player);
 message.author=gm;
 await assert.rejects(createMessageProvenance(message,key,player.id,users),/authenticated creator/);
 await assert.rejects(verifyMessageProvenance(message,key,receipt,users),/provenance/);
});
test('editing command, target or claimed author after receipt cannot elevate a player request',async()=>{
 const message=request(),receipt=await createMessageProvenance(message,key,player.id,users);
 message.flags['star-wars-ffg'][key]={command:'effect',args:{actorUuid:'Actor.secret'}};
 await assert.rejects(verifyMessageProvenance(message,key,receipt,users),/changed/);
 message.author=gm;await assert.rejects(verifyMessageProvenance(message,key,receipt,users),/provenance/);
 await assert.rejects(verifyMessageProvenance(request(),key,null,users),/provenance/);
});
test('a stale GM browser cannot submit an unauthenticated tabletop request',()=>{
 const broker={isAuthority:()=>false};
 assert.throws(()=>assertLocalTabletopAuthority(gm,broker),/Transaction authority/);
 assert.doesNotThrow(()=>assertLocalTabletopAuthority(player,broker),
   'a player may submit to the separately selected GM browser');
 assert.doesNotThrow(()=>assertLocalTabletopAuthority(gm,{isAuthority:()=>true}));
});
