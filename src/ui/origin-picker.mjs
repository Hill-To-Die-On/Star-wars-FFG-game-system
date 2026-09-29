import {fuzzyOriginOptions} from '../character-origins.mjs';
const bindings=new WeakMap();let nextId=0;

/** Editable combobox: arrows preview; only Enter/click selects a valid option. */
export function bindOriginPicker(picker,options=[]) {
  bindings.get(picker)?.();
  const input=picker.querySelector('[data-origin-search]'),menu=picker.querySelector('[data-origin-menu]');
  if(!input||!menu)return ()=>{};
  const controller=new AbortController(),listen=(element,type,callback)=>element?.addEventListener(type,callback,{signal:controller.signal});
  const toggle=picker.querySelector('[data-origin-toggle]'),empty=picker.querySelector('[data-origin-empty]'),custom=picker.querySelector('[data-homebrew-choice]');
  const buttons=new Map(Array.from(menu.querySelectorAll('[data-document-id]'),button=>[button.dataset.documentId,button]));
  let active=null,visible=[];
  menu.id ||= `sf-origin-options-${++nextId}`;
  input.setAttribute('aria-controls',menu.id);input.setAttribute('aria-haspopup','listbox');
  toggle?.setAttribute('aria-controls',menu.id);if(toggle)toggle.tabIndex=-1;
  let status=picker.querySelector('[data-origin-status]');
  if(!status){status=document.createElement('span');status.dataset.originStatus='';status.className='sf-sr-only';status.setAttribute('role','status');status.setAttribute('aria-live','polite');picker.append(status);}
  const setActive=button=>{
    active=button;
    for(const choice of [...buttons.values(),custom].filter(Boolean))choice.setAttribute('aria-selected',String(choice===button));
    if(button){input.setAttribute('aria-activedescendant',button.id);button.scrollIntoView?.({block:'nearest',behavior:'instant'});}
    else input.removeAttribute('aria-activedescendant');
  };
  for(const [index,button] of [...buttons.values(),custom].filter(Boolean).entries()){
    button.id ||= `${menu.id}-${index}`;button.tabIndex=-1;
    listen(button,'mousedown',event=>event.preventDefault());
  }
  const setOpen=open=>{menu.hidden=!open;input.setAttribute('aria-expanded',String(open));toggle?.setAttribute('aria-expanded',String(open));if(!open)setActive(null);};
  const refresh=()=>{
    const query=input.value===picker.dataset.current?'':input.value,matches=fuzzyOriginOptions(options,query,32),ids=new Set(matches.map(row=>row.id));
    for(const [id,button] of buttons)button.hidden=!ids.has(id);
    for(const row of matches){const button=buttons.get(row.id);if(button)menu.insertBefore(button,empty);}
    if(empty)empty.hidden=matches.length>0;
    if(custom){const name=input.value.trim();custom.hidden=!name||name===picker.dataset.current;custom.textContent=`Use “${name}” as homebrew ${picker.dataset.originPicker}`;}
    visible=Array.from(menu.querySelectorAll('[role="option"]')).filter(button=>!button.hidden&&!button.disabled);
    setActive(null);status.textContent=`${matches.length} matching ${picker.dataset.originPicker} choices${custom&&!custom.hidden?', plus homebrew':''}. Use up and down arrows, then Enter to choose.`;
  };
  listen(input,'focus',()=>{input.select();refresh();setOpen(true);});
  listen(input,'input',()=>{refresh();setOpen(true);});
  listen(input,'keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();input.value=picker.dataset.current??'';setOpen(false);return;}
    if(event.key==='Tab'){input.value=picker.dataset.current??'';setOpen(false);return;}
    if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();event.stopPropagation();if(menu.hidden){refresh();setOpen(true);}
      const index=visible.indexOf(active),step=event.key==='ArrowDown'?1:-1;
      setActive(visible[(index<0?(step>0?0:visible.length-1):(index+step+visible.length)%visible.length)]??null);
    } else if(event.key==='Enter') {
      event.preventDefault();event.stopPropagation();if(!menu.hidden){const choice=active??visible[0];if(choice)choice.click();}
    } else if(active&&!menu.hidden&&['Home','End'].includes(event.key)){
      event.preventDefault();setActive(event.key==='Home'?visible[0]:visible.at(-1));
    }
  });
  listen(menu,'click',event=>{if(event.target.closest('[role="option"]'))setOpen(false);});
  listen(toggle,'click',()=>{const open=menu.hidden;input.focus();refresh();setOpen(open);});
  listen(picker,'focusout',event=>{if(!picker.contains(event.relatedTarget)){input.value=picker.dataset.current??'';setOpen(false);}});
  const dispose=()=>{controller.abort();setOpen(false);};bindings.set(picker,dispose);return dispose;
}
