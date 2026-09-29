import {secureRandomId} from '../../src/browser-crypto.mjs';
import {DocumentTransactionBroker} from '../../src/document-transactions.mjs';
export function transactionWorld(users) {
 const clients=[],messages=new Map(),errors=[];let receipts={},next=0,session=null;
 const emit=(name,...args)=>{for(const client of clients)for(const row of client.listeners.values())if(row.name===name)row.fn(...args);};
 const world={users,messages,errors,get receipts(){return structuredClone(receipts);},emit,
  async create(user,data,author=user){const id='m'+(++next),message={...structuredClone(data),id,uuid:'ChatMessage.'+id,author};messages.set(message.uuid,message);emit('createChatMessage',message,{},user.id);return message;},
  client(user){const sessionId=secureRandomId();if(user.isGM&&!session)session={userId:user.id,sessionId};const listeners=new Map();let sequence=0;const hooks={on(name,fn){const id=++sequence;listeners.set(id,{name,fn});return id;},off(_name,id){listeners.delete(id);}};
   const transport=new DocumentTransactionBroker({hooks,sessionId,readSession:()=>structuredClone(session),writeSession:async value=>{if(!user.isGM)throw new Error('Only GM may select session');session=structuredClone(value);},currentUser:()=>user,users:()=>users,readReceipts:()=>structuredClone(receipts),writeReceipts:async value=>{if(!user.isGM)throw new Error('Only GM may write receipts');receipts=structuredClone(value);emit('updateSetting',{});},createMessage:data=>world.create(user,data),resolveMessage:async uuid=>messages.get(uuid),timeoutMs:1000,onError:error=>errors.push(error.message)});
   const client={user,hooks,listeners,transport};clients.push(client);return client;
  },stop(){for(const c of clients)c.transport.stop();},async until(predicate){for(let i=0;i<100;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,2));}throw new Error('Fixture condition timed out');}
 };return world;
}
