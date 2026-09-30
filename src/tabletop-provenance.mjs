import {sha256Text} from './browser-crypto.mjs';
import { SYSTEM_ID } from './config.mjs';
const userById=(users,id)=>users.get?.(id)??Array.from(users??[]).find(user=>user.id===id);
export async function messageFingerprint(message,key) {
  const payload=message.flags?.[SYSTEM_ID]?.[key];
  if(!payload || typeof payload!=='object')throw new Error('The workflow payload is missing.');
  const text=JSON.stringify({uuid:message.uuid,key,payload});
  if(text.length>100000)throw new Error('The workflow payload is too large.');
  return sha256Text(text);
}
/** creatorId must be the server-supplied createChatMessage hook argument. */
export async function createMessageProvenance(message,key,creatorId,users) {
  const user=userById(users,creatorId),author=message.author?.id??message.user?.id;
  if(!user?.active || author!==creatorId)throw new Error('The message author does not match its authenticated creator.');
  return {userId:user.id,key,fingerprint:await messageFingerprint(message,key)};
}
export async function verifyMessageProvenance(message,key,receipt,users,{requireActive=true}={}) {
  const author=message.author?.id??message.user?.id,user=userById(users,receipt?.userId);
  if(!receipt || receipt.key!==key || !user || requireActive&&!user.active || author!==receipt.userId || receipt.fingerprint!==await messageFingerprint(message,key))throw new Error('The workflow request lacks authenticated provenance or changed after submission. Resubmit it for review.');
  return user;
}
