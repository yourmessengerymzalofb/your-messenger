/* Native nodes stay in their React parents. Manual popovers escape ancestor clipping. */
globalThis.YahooZaloWindows = () => {
  const states=new Map(),portals=new Map();let front, expectedPortal, layer=300; const barHeight=()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--xp-bar-height"))||30;
  const SIDE_WIDTH=344;
  const clamp=(v,min,max)=>Math.max(min,Math.min(Math.max(min,max),v));
  const supported=()=>typeof HTMLElement.prototype.showPopover==='function';
  function apply(s){for(const[k,v]of Object.entries(s.rect))s.panel.style.setProperty('--yzr-'+k,v+'px');for(const[n,p]of portals)if(p.dock===s.panel)placePortal(n,p);}
  function constrain(s){const maxW=Math.max(1,innerWidth-16),maxH=Math.max(1,innerHeight-42);s.rect.w=clamp(s.rect.w,Math.min(s.kind==='contacts'?240:360,maxW),maxW);s.rect.h=clamp(s.rect.h,Math.min(s.kind==='contacts'?360:380,maxH),maxH);s.rect.x=clamp(s.rect.x,0,innerWidth-s.rect.w);s.rect.y=clamp(s.rect.y,0,innerHeight-barHeight()-s.rect.h);apply(s);}
  function add(panel,kind,promote){
    if(states.has(panel))return states.get(panel);
    // Defaults copied from desktop-reference.css and chat-windows.mjs (v100).
    // Clamp remaining height exactly as the app, rather than letting the taskbar cover it.
    // desktop-reference.css: Messenger x105/w282, chat x410 (23px gap).
    // The native chat replaces v2's fixed desktop chat, so use that placement,
    // rather than chat-windows.mjs's overlapping extra-chat cascade at x330.
    const mobile=innerWidth<=720,contacts=[...states.values()].find(s=>s.kind==='contacts'),right=contacts?contacts.rect.x+contacts.rect.w:387,chatX=right+23,room=innerWidth-chatX-8;
    const rect=kind==='contacts'?{x:mobile?8:105,y:mobile?8:52,w:mobile?innerWidth-16:282,h:Math.min(640,innerHeight-barHeight()-94)}:{x:mobile||room<360?8:chatX,y:mobile?80:Math.min(60,Math.max(8,innerHeight-420)),w:Math.min(570,mobile||room<360?innerWidth-16:room),h:mobile?innerHeight-barHeight()-100:Math.min(640,innerHeight-barHeight()-80)};
    const s={panel,kind,rect,originalPopover:panel.getAttribute('popover'),originalZ:panel.style.zIndex,abort:new AbortController(),vars:new Map(),minimized:false,maximized:false};
    for(const k of ['x','y','w','h'])s.vars.set(k,[panel.style.getPropertyValue('--yzr-'+k),panel.style.getPropertyPriority('--yzr-'+k)]);
    states.set(panel,s);constrain(s);
    if(promote&&supported()&&s.originalPopover===null){panel.setAttribute('popover','manual');s.promoted=true;panel.showPopover();front=panel;}
    return s;
  }
  function bind(panel,header,kind,promote=true){
    const s=add(panel,kind,promote),signal=s.abort.signal;
    if(s.header===header)return;s.header=header;
    panel.addEventListener('pointerdown',e=>{if(!e.target.closest('[data-yzr-portal]'))raise(panel);},{signal,capture:true});
    header.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button')||s.maximized)return;start(e,s,'move');},{signal});
    for(const dir of ['n','ne','e','se','s','sw','w','nw']){
      const handle=document.createElement('button');handle.type='button';handle.className='yzr-resize yzr-resize-'+dir+' window-resize-handle resize-'+dir;handle.dataset.yzrOwned='';handle.setAttribute('aria-label','Đổi kích thước '+dir.toUpperCase());
      handle.addEventListener('pointerdown',e=>{if(e.button===0&&!s.maximized)start(e,s,dir);},{signal});
      handle.addEventListener('keydown',e=>{const d={ArrowRight:[8,0],ArrowLeft:[-8,0],ArrowDown:[0,8],ArrowUp:[0,-8]}[e.key];if(!d||s.maximized)return;e.preventDefault();resize(s,dir,d[0],d[1],{...s.rect});},{signal});panel.append(handle);
    }
  }
  function resize(s,dir,dx,dy,base){
    const minW=Math.min(innerWidth-16,s.kind==='contacts'?240:360),minH=Math.min(innerHeight-42,s.kind==='contacts'?360:380);
    s.rect={...base};
    if(dir.includes('e'))s.rect.w=clamp(base.w+dx,minW,innerWidth-base.x);
    if(dir.includes('s'))s.rect.h=clamp(base.h+dy,minH,innerHeight-barHeight()-base.y);
    if(dir.includes('w')){s.rect.x=clamp(base.x+dx,0,base.x+base.w-minW);s.rect.w=base.x+base.w-s.rect.x;}
    if(dir.includes('n')){s.rect.y=clamp(base.y+dy,0,base.y+base.h-minH);s.rect.h=base.y+base.h-s.rect.y;}
    apply(s);
  }
  function start(e,s,dir){
    e.preventDefault();const control=e.currentTarget,base={...s.rect},x=e.clientX,y=e.clientY;
    control.setPointerCapture?.(e.pointerId);
    const move=event=>{if(event.pointerId!==e.pointerId)return;const dx=event.clientX-x,dy=event.clientY-y;if(dir==='move'){s.rect.x=clamp(base.x+dx,0,innerWidth-base.w);s.rect.y=clamp(base.y+dy,0,innerHeight-barHeight()-base.h);apply(s);}else resize(s,dir,dx,dy,base);};
    const stop=()=>{control.removeEventListener('pointermove',move);control.removeEventListener('pointerup',stop);control.removeEventListener('pointercancel',stop);};
    control.addEventListener('pointermove',move);control.addEventListener('pointerup',stop,{once:true});control.addEventListener('pointercancel',stop,{once:true});
  }
  function minimize(panel){const s=states.get(panel);if(!s)return;s.minimized=true;panel.setAttribute('data-yzr-minimized','true');if(s.promoted&&panel.matches(':popover-open'))panel.hidePopover();for(const[n,p]of portals)if(p.dock===panel&&n.matches(':popover-open'))n.hidePopover();}
  function showDocked(panel){for(const[n,p]of portals)if(p.dock===panel&&n.isConnected&&!n.matches(':popover-open')){placePortal(n,p);n.showPopover();}}
  function liftPortals(){for(const[n]of portals)if(n.isConnected&&n.matches(':popover-open')){n.hidePopover();n.showPopover();}}
  function raise(panel){const s=states.get(panel);if(!s||s.minimized||front===panel)return;const focused=document.activeElement,selection=window.getSelection(),range=focused&&panel.contains(focused)&&selection?.rangeCount?selection.getRangeAt(0).cloneRange():null;if(s.promoted){if(panel.matches(':popover-open'))panel.hidePopover();panel.showPopover();}else panel.style.zIndex=String(++layer);front=panel;liftPortals();if(focused?.isConnected&&panel.contains(focused)){focused.focus({preventScroll:true});if(range?.startContainer.isConnected){selection.removeAllRanges();selection.addRange(range);}}}
  function restore(panel){const s=states.get(panel);if(!s)return;s.minimized=false;panel.removeAttribute('data-yzr-minimized');if(s.promoted&&!panel.matches(':popover-open')){panel.showPopover();front=panel;showDocked(panel);liftPortals();}else{showDocked(panel);raise(panel);}}
  function maximize(panel){const s=states.get(panel);if(!s)return;s.maximized=!s.maximized;panel.toggleAttribute('data-yzr-maximized',s.maximized);panel.classList.toggle('maximized',s.maximized);}
  function remove(panel){const s=states.get(panel);if(!s)return;s.abort.abort();if(s.promoted){if(panel.matches(':popover-open'))panel.hidePopover();panel.removeAttribute('popover');}panel.style.zIndex=s.originalZ;panel.classList.remove('maximized');panel.removeAttribute('data-yzr-minimized');panel.removeAttribute('data-yzr-maximized');for(const[k,[v,p]]of s.vars){if(v)panel.style.setProperty('--yzr-'+k,v,p);else panel.style.removeProperty('--yzr-'+k);}for(const h of panel.querySelectorAll('.yzr-resize'))h.remove();states.delete(panel);if(front===panel)front=null;}
  function restorePortal(n,p){if(n.matches(':popover-open'))n.hidePopover();n.removeAttribute('popover');n.removeAttribute('data-yzr-portal');n.removeAttribute('data-yzr-fullscreen');n.removeAttribute('data-yzr-docked');for(const[k,[v,priority]]of p.vars){if(v)n.style.setProperty(k,v,priority);else n.style.removeProperty(k);}}
  function nativeOpen(n){if(!n.isConnected||n.closest('[hidden],[aria-hidden="true"]'))return false;const promoted=n.hasAttribute('data-yzr-portal');if(promoted)n.removeAttribute('data-yzr-portal');const style=getComputedStyle(n);let open=style.display!=='none'&&style.opacity!=='0';for(let p=n.parentElement;open&&p;p=p.parentElement)if(getComputedStyle(p).display==='none')open=false;if(promoted)n.setAttribute('data-yzr-portal','');return open;}
  function expectPortal(anchor,key){expectedPortal=anchor?.isConnected?{anchor,key,until:Date.now()+2000}:null;}
  // Side panels (conversation info, message search) sit against the chat window: right, else left.
  function placeDocked(n,p){const s=states.get(p.dock),r=s&&!s.maximized?s.rect:{x:0,y:0,w:innerWidth,h:innerHeight-barHeight()},w=Math.min(SIDE_WIDTH,innerWidth),h=Math.min(r.h,innerHeight-barHeight());const x=r.x+r.w+w<=innerWidth?r.x+r.w:r.x-w>=0?r.x-w:innerWidth-w;for(const[k,v]of Object.entries({x,y:clamp(r.y,0,innerHeight-barHeight()-h),w,h}))n.style.setProperty('--yzr-portal-'+k,v+'px');}
  function placePortal(n,p){if(p.dock){placeDocked(n,p);return;}if(p.fullscreen){for(const[k,v]of Object.entries({x:0,y:0,w:innerWidth,h:innerHeight}))n.style.setProperty('--yzr-portal-'+k,v+'px');return;}const r=p.rect,a=p.anchor?.isConnected?p.anchor.getBoundingClientRect():null,w=Math.min(r.width,innerWidth),h=Math.min(r.height,innerHeight-barHeight());const x=a?a.left:r.x,y=a?(a.top-h-5>=0?a.top-h-5:a.bottom+5):r.y;for(const[k,v]of Object.entries({x:clamp(x,0,innerWidth-w),y:clamp(y,0,innerHeight-barHeight()-h),w,h}))n.style.setProperty('--yzr-portal-'+k,v+'px');}
  function syncPortals(){
    if(!supported())return;
    for(const[n,p]of portals)if(!nativeOpen(n)){restorePortal(n,p);portals.delete(n);}else placePortal(n,p);
    // Zalo's sticker panel has no ARIA role. Promote its OUTER native popover,
    // retaining React parents and outside-click/Escape handlers. Other native
    // menus/viewers share this popover class or their semantic menu/dialog role.
    const candidates=[...document.querySelectorAll('.zl-modal,.media-viewer,.popover-v3,.stickerSelector,[role="dialog"],[role="menu"],[role="listbox"]')].filter(n=>!n.closest('[data-yzr-owned],[data-yzr-portal]')&&!states.has(n)&&!n.hasAttribute('popover')&&nativeOpen(n)&&n.getClientRects().length);
    for(const n of candidates){
      if(candidates.some(parent=>parent!==n&&parent.contains(n)))continue;
      const r=n.getBoundingClientRect();if(r.width<20||r.height<20)continue;
      const vars=new Map();for(const k of ['x','y','w','h'])vars.set('--yzr-portal-'+k,[n.style.getPropertyValue('--yzr-portal-'+k),n.style.getPropertyPriority('--yzr-portal-'+k)]);
      const fullscreen=n.matches('.zl-modal,.media-viewer'),p={vars,rect:r,fullscreen,anchor:!fullscreen&&expectedPortal?.until>=Date.now()?expectedPortal.anchor:null};placePortal(n,p);n.dataset.yzrPortal='';if(fullscreen)n.dataset.yzrFullscreen='';n.setAttribute('popover','manual');n.showPopover();portals.set(n,p);
    }
    // Zalo opens conversation info and message search as an <aside> next to the chat, inside its
    // hidden layout: show it docked to that chat window.
    for(const[panel,s]of states){
      if(s.kind==='contacts'||!panel.parentElement)continue;
      for(const n of panel.parentElement.children){
        if(n.tagName!=='ASIDE'||portals.has(n)||n.hasAttribute('popover')||n.closest('[data-yzr-owned]')||!nativeOpen(n)||!n.getClientRects().length)continue;
        const vars=new Map();for(const k of ['x','y','w','h'])vars.set('--yzr-portal-'+k,[n.style.getPropertyValue('--yzr-portal-'+k),n.style.getPropertyPriority('--yzr-portal-'+k)]);
        const p={vars,dock:panel};placePortal(n,p);n.dataset.yzrPortal='';n.dataset.yzrDocked='';n.setAttribute('popover','manual');if(!s.minimized)n.showPopover();portals.set(n,p);
      }
    }
  }
  const onResize=()=>{for(const s of states.values())constrain(s);for(const[n,p]of portals)placePortal(n,p);};addEventListener('resize',onResize);
  return{supported,bind,minimize,restore,maximize,remove,syncPortals,expectPortal,clear(){expectedPortal=null;for(const[n,p]of portals)restorePortal(n,p);portals.clear();for(const panel of [...states.keys()])remove(panel);},dispose(){this.clear();removeEventListener('resize',onResize);}};
};
