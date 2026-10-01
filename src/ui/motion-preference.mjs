/** One event listener while a canvas consumer is mounted; no timer or ticker. */
export function createMotionPreference(matchMedia=query=>globalThis.matchMedia?.(query)) {
  let media;
  const listeners=new Set();
  const read=()=>media??=matchMedia('(prefers-reduced-motion: reduce)');
  const change=()=>{for(const listener of listeners)listener(!!read()?.matches);};
  return {
    reduced:()=>!!read()?.matches,
    subscribe(listener) {
      if(!listeners.size)read()?.addEventListener?.('change',change);
      listeners.add(listener);listener(!!read()?.matches);
      let subscribed=true;
      return ()=>{
        if(!subscribed)return;subscribed=false;listeners.delete(listener);
        if(!listeners.size){media?.removeEventListener?.('change',change);media=undefined;}
      };
    },
  };
}
export const motionPreference=createMotionPreference();
