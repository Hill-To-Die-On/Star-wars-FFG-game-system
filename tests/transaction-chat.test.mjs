import test from 'node:test';
import assert from 'node:assert/strict';
import {renderTransactionMessage} from '../src/document-transactions.mjs';
const message=value=>({flags:{'star-wars-ffg':value}});
test('internal request and successful receipt cards stay out of play chat; errors and ordinary messages remain visible',()=>{
 const broker={isAuthority:()=>false,readReceipts:()=>({})};
 for(const value of [{authorityRequest:{id:'move'}},{authorityResponse:{ok:true}}]){
  const root={hidden:false,style:{}};renderTransactionMessage(message(value),root,broker);assert.equal(root.hidden,true);assert.equal(root.style.display,'none');
 }
 for(const value of [{authorityResponse:{ok:false,error:'Inspect state'}},{}]){
  const root={hidden:false,style:{}};renderTransactionMessage(message(value),root,broker);assert.equal(root.hidden,false);assert.equal(root.style.display,undefined);
 }
});
