import { SYSTEM_ID } from "./config.mjs";
import { isDefaultActorImage, isProceduralIconSource } from "./actor-icons.mjs";
import { shadowSettings, projectAltitudeShadow, shadowReceivers, canCastAltitudeShadow, shadowRasterPlan, shadowIntersectsArtwork } from "./altitude-shadows.mjs";

export function shadowArtworkGeometry(doc,texture,token=doc.object) {
  const size=doc.getSize(),mesh=token?.mesh;
  if(mesh && !mesh.destroyed)return {x:mesh.position.x,y:mesh.position.y,width:Math.abs(mesh.width),height:Math.abs(mesh.height),
    angle:mesh.angle,anchorX:mesh.anchor.x,anchorY:mesh.anchor.y,flipX:mesh.scale.x<0,flipY:mesh.scale.y<0};
  const t=doc.texture,w=texture.width,h=texture.height,fit=t.fit??"contain";
  let sx=size.width/w,sy=size.height/h;
  if(fit==="cover")sx=sy=Math.max(sx,sy);
  else if(fit==="width")sy=sx;
  else if(fit==="height")sx=sy;
  else if(fit!=="fill")sx=sy=Math.min(sx,sy);
  const managed=isDefaultActorImage(t.src,doc.actor.type)||isProceduralIconSource(t.src)||
    doc.flags?.[SYSTEM_ID]?.proceduralToken?.enabled===true||t.src===doc.actor.img;
  return {x:doc.x+size.width/2,y:doc.y+size.height/2,width:w*sx*Math.abs(t.scaleX??1),height:h*sy*Math.abs(t.scaleY??1),
    angle:doc.lockRotation?0:(Number(doc.rotation)||0)+(managed?180:0),
    anchorX:t.anchorX??.5,anchorY:t.anchorY??.5,flipX:t.scaleX<0,flipY:t.scaleY<0};
}

function makeShadowTexture(source,geometry,projection) {
  const plan=shadowRasterPlan(geometry.width,geometry.height,projection.blur);
  const surface=document.createElement("canvas");surface.width=plan.width;surface.height=plan.height;
  const ctx=surface.getContext("2d");
  // Baked once per artwork/size/height change, never a per-frame GPU blur filter.
  ctx.filter=`blur(${plan.blur}px)`;
  ctx.drawImage(source,plan.padding,plan.padding,plan.artWidth,plan.artHeight);
  ctx.filter="none";ctx.globalCompositeOperation="source-in";ctx.fillStyle=projection.mask?"#ffffff":"#000000";ctx.fillRect(0,0,plan.width,plan.height);
  return {texture:PIXI.Texture.from(surface),plan};
}

export class AltitudeShadowRenderer {
  constructor({environment=()=>({canvas:globalThis.canvas,game:globalThis.game}),loadTexture=src=>foundry.canvas.loadTexture(src),
    bake=makeShadowTexture,createSprite=texture=>new PIXI.Sprite(texture)}={}) {
    Object.assign(this,{environment,loadTexture,bake,createSprite});this.entries=new Map();this.masks=new Map();this.frame=null;this.epoch=0;
  }
  schedule() {
    if(this.frame!==null || !this.environment().canvas?.ready)return;
    this.frame=requestAnimationFrame(()=>{this.frame=null;this.refresh();});
  }
  remove(key) {
    const entry=this.entries.get(key);if(!entry)return;
    this.releaseRaster(entry);this.entries.delete(key);
  }
  releaseRaster(entry) {
    if(entry.sprite)entry.sprite.mask=null;
    entry.sprite?.parent?.removeChild(entry.sprite);entry.sprite?.destroy({texture:true,baseTexture:true});
    delete entry.sprite;delete entry.plan;delete entry.signature;
  }
  removeMask(key) {
    const mask=this.masks.get(key);if(!mask)return;
    mask.sprite.parent?.removeChild(mask.sprite);mask.sprite.destroy({texture:true,baseTexture:true});this.masks.delete(key);
  }
  receiverMask(token,geometry,primary) {
    const doc=token.document,source=token.mesh.texture.baseTexture?.resource?.source;
    if(!source)return null;
    const signature=JSON.stringify([doc.texture.src,geometry.width,geometry.height]);
    let entry=this.masks.get(doc.id);
    if(entry?.signature!==signature){
      const baked=this.bake(source,geometry,{blur:0,mask:true});
      if(entry){const old=entry.sprite.texture;entry.sprite.texture=baked.texture;old.destroy(true);}
      else {entry={sprite:this.createSprite(baked.texture)};entry.sprite.eventMode="none";primary.addChild(entry.sprite);this.masks.set(doc.id,entry);}
      entry.signature=signature;
    }
    const mask=entry.sprite;
    mask.position.set(geometry.x,geometry.y);mask.anchor.set(geometry.anchorX,geometry.anchorY);
    mask.width=geometry.width;mask.height=geometry.height;mask.angle=geometry.angle;
    mask.scale.x=Math.abs(mask.scale.x)*(geometry.flipX?-1:1);mask.scale.y=Math.abs(mask.scale.y)*(geometry.flipY?-1:1);
    return mask;
  }
  clear() {
    this.epoch++;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;
    for(const key of this.entries.keys())this.remove(key);
    for(const key of this.masks.keys())this.removeMask(key);
  }
  refresh() {
    const {canvas,game}=this.environment(),settings=shadowSettings(canvas?.scene?.flags?.[SYSTEM_ID]?.altitudeShadows);
    if(!canvas?.ready || !canvas.primary || !settings.enabled || game.settings.get(SYSTEM_ID,"altitudeShadows")===false){this.clear();return;}
    const grid=canvas.scene.grid,pixelsPerUnit=grid.size/grid.distance,keep=new Set(),maskKeep=new Set();
    const surfaces=shadowReceivers(canvas.scene,canvas.level);
    for(const token of canvas.tokens?.placeables??[]) {
      const doc=token.document;
      if(token.visible===false || !token.mesh?.texture || !canCastAltitudeShadow(doc))continue;
      surfaces.push({id:`token:${doc.id}`,token,elevation:Number(doc.elevation)+Math.max(0,Number(doc.depth)||0)*grid.distance});
    }
    // Read documents rather than the viewed token layer: higher levels need not be rendered.
    for(const doc of canvas.scene.tokens??[]) {
      if(!canCastAltitudeShadow(doc))continue;
      for(const surface of surfaces) {
        if(surface.token?.document.id===doc.id)continue;
        const projection=projectAltitudeShadow({elevation:Number(doc.elevation),surface:surface.elevation,pixelsPerUnit,...settings});
        if(!projection)continue;
        const key=`${doc.id}:${surface.id}`;keep.add(key);
        let entry=this.entries.get(key);
        if(entry?.src!==doc.texture.src){this.remove(key);entry=null;}
        if(!entry){
          entry={src:doc.texture.src};this.entries.set(key,entry);const epoch=this.epoch;
          Promise.resolve(this.loadTexture(entry.src)).then(texture=>{
            if(this.epoch!==epoch || this.entries.get(key)!==entry)return;
            entry.texture=texture;this.schedule();
          }).catch(error=>{if(this.entries.get(key)===entry)console.warn(`${SYSTEM_ID} shadow texture unavailable`,error);});
        }
        if(!entry.texture)continue;
        const geometry=shadowArtworkGeometry(doc,entry.texture);
        if(!(geometry.width>0 && geometry.height>0))continue;
        const receiver=surface.token,receiverGeometry=receiver?shadowArtworkGeometry(receiver.document,receiver.mesh.texture,receiver):null;
        if(receiver && !shadowIntersectsArtwork(geometry,receiverGeometry,projection)){
          // Retain the shared source lookup, but never accumulate rasters for past overlaps.
          this.releaseRaster(entry);
          continue;
        }
        const signature=JSON.stringify([geometry.width,geometry.height,projection.blur]);
        if(entry.signature!==signature){
          const source=entry.texture.baseTexture?.resource?.source;
          if(!source)continue;
          const baked=this.bake(source,geometry,projection);
          if(entry.sprite){const old=entry.sprite.texture;entry.sprite.texture=baked.texture;old.destroy(true);}
          else {entry.sprite=this.createSprite(baked.texture);entry.sprite.eventMode="none";entry.sprite.name=`Star Wars altitude shadow ${key}`;canvas.primary.addChild(entry.sprite);}
          entry.plan=baked.plan;entry.signature=signature;
        }
        const sprite=entry.sprite,p=entry.plan;
        sprite.visible=true;
        sprite.position.set(geometry.x+projection.dx,geometry.y+projection.dy);
        sprite.anchor.set((p.padding+geometry.anchorX*p.artWidth)/p.width,(p.padding+geometry.anchorY*p.artHeight)/p.height);
        sprite.width=p.worldWidth;sprite.height=p.worldHeight;
        sprite.scale.x=Math.abs(sprite.scale.x)*(geometry.flipX?-1:1);sprite.scale.y=Math.abs(sprite.scale.y)*(geometry.flipY?-1:1);
        sprite.angle=geometry.angle;sprite.alpha=projection.opacity*(doc.alpha??1);
        sprite.elevation=receiver?Number(receiver.document.elevation):surface.elevation;
        sprite.sortLayer=receiver?700:650;sprite.sort=receiver?.document.sort??0;sprite.zIndex=receiver?(receiver.mesh.zIndex??0)+.001:0;
        if(receiver){
          const mask=this.receiverMask(receiver,receiverGeometry,canvas.primary);
          sprite.mask=mask;sprite.visible=!!mask;if(mask)maskKeep.add(receiver.document.id);
        }
      }
    }
    for(const key of this.entries.keys())if(!keep.has(key))this.remove(key);
    for(const key of this.masks.keys())if(!maskKeep.has(key))this.removeMask(key);
    canvas.primary.sortDirty=true;
  }
}

export async function configureAltitudeShadows() {
  if(!game.user.isGM || !canvas.scene)return;
  const scene=canvas.scene,level=canvas.level,s=shadowSettings(scene.flags?.[SYSTEM_ID]?.altitudeShadows),r=level?.flags?.[SYSTEM_ID]?.shadowSurface??{};
  const result=await foundry.applications.api.DialogV2.prompt({window:{title:"Altitude shadows",resizable:true},position:{width:480},classes:["star-wars"],rejectClose:false,
    content:`<div class="sf-dialog"><p>Sunlight casts actor silhouettes onto visible level surfaces and lower actors, including from ships on higher levels. Actor shadows follow the receiving artwork and its top height (elevation plus token depth). Heights use this scene's distance units.</p>
      <label><input type="checkbox" name="enabled" ${s.enabled?"checked":""}> Enable shadows in this scene</label>
      <label>Altitude scaling<select name="heightScale"><option value="log" ${s.heightScale==="log"?"selected":""}>Logarithmic</option><option value="linear" ${s.heightScale==="linear"?"selected":""}>Linear</option></select></label>
      <label>Logarithmic reference height (scene units)<input type="number" name="heightReference" value="${s.heightReference}" min="0.01" max="1000000" step="any" required></label>
      <p>Logarithmic scaling keeps high-altitude and orbital shadows within useful visual distances. A lower reference height compresses them more. Actual elevations and combat ranges are unchanged.</p>
      <label>Shadow direction (degrees clockwise from right)<input type="number" name="direction" value="${s.direction}" min="0" max="360" step="1" required></label>
      <label>Sun height (degrees above horizon)<input type="number" name="sunElevation" value="${s.sunElevation}" min="5" max="90" step="1" required></label>
      <label>Feathering per unit of altitude<input type="number" name="softness" value="${s.softness}" min="0" max="0.25" step="0.005" required></label>
      <label>Shadow opacity<input type="number" name="opacity" value="${s.opacity}" min="0" max="0.7" step="0.01" required></label>
      <hr><label><input type="checkbox" name="surfaceEnabled" ${r.enabled!==false?"checked":""}> Viewed level receives shadows</label>
      <label>Surface height (blank uses level base)<input type="number" name="surfaceElevation" value="${Number.isFinite(r.elevation)?r.elevation:""}" step="any"></label>
      <p>Disable the receiving surface for open sky or empty space. Hidden, invisible and embarked actors cast no shadow. This is a visual cue; it does not change sight, cover or dice.</p></div>`,
    ok:{label:"Apply shadows",callback:(_e,b)=>Object.fromEntries(new FormData(b.form))}});
  if(!result)return;
  await scene.setFlag(SYSTEM_ID,"altitudeShadows",shadowSettings({...result,enabled:result.enabled==="on"}));
  if(level)await level.setFlag(SYSTEM_ID,"shadowSurface",{enabled:result.surfaceEnabled==="on",elevation:result.surfaceElevation===""?null:Number(result.surfaceElevation)});
}

export function registerAltitudeShadows() {
  const renderer=new AltitudeShadowRenderer();
  game.settings.register(SYSTEM_ID,"altitudeShadows",{name:"Show altitude shadows",hint:"Project elevated actor artwork onto level surfaces and lower actors. Disable on this device if preferred.",scope:"client",config:true,type:Boolean,default:true,onChange:()=>renderer.schedule()});
  for(const hook of ["canvasReady","drawToken","refreshToken","createToken","updateToken","deleteToken","updateActor","updateScene","updateLevel","createLevel","deleteLevel"])
    Hooks.on(hook,()=>renderer.schedule());
  Hooks.on("canvasTearDown",()=>renderer.clear());
  Hooks.on("getSceneControlButtons",controls=>{
    const tools=controls.starWarsRange?.tools;
    if(tools)tools.shadows={name:"shadows",order:25,title:"Altitude shadows",icon:"fa-solid fa-sun",button:true,visible:game.user.isGM,
      onChange:()=>void configureAltitudeShadows().catch(error=>ui.notifications.error(error.message))};
  });
  return renderer;
}
