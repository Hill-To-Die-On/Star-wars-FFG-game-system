import {SYSTEM_PATH} from './config.mjs';
/** Replace only Foundry's automatic, untouched new-world demonstration scene. */
export function welcomeSceneBackdrop(data,{theme,sceneCount}={}) {
  if(!theme || sceneCount!==0 || data?._id!=='NUEDEFAULTSCENE0')return null;
  const levels=data.levels;
  if(levels?.length!==1 || levels[0].background?.src!=='nue/defaultscene/fvtt-background.webp')return null;
  if(['tokens','drawings','walls','notes','sounds','regions'].some(key=>data[key]?.length))return null;
  if(data.tiles?.some(tile=>tile.texture?.src!=='nue/defaultscene/fvtt-logo.webp'))return null;
  return {
    name:'Star Wars FFG · Welcome',width:4800,height:2160,thumb:`${SYSTEM_PATH}/assets/ui/saturn-enceladus-concept.webp`,
    levels:[{...structuredClone(levels[0]),name:'Welcome',background:{...levels[0].background,src:`${SYSTEM_PATH}/assets/ui/saturn-enceladus-concept.webp`,color:'#071014'}}],
    tiles:[],lights:[]
  };
}
export function registerWelcomeBackdrop() {
  Hooks.on('preCreateScene',scene=>{
    if(!game.user.isGM)return;
    const patch=welcomeSceneBackdrop(scene.toObject(),{theme:document.body.dataset.starWarsTheme,sceneCount:game.scenes.size});
    if(patch)scene.updateSource(patch,{recursive:false});
  });
}
