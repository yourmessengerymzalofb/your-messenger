/* Local UI adapter. Native session, transport, draft and editor remain Zalo's. */
(() => {
 'use strict';
 if(window.top!==window||document.getElementById('yzr-controls'))return;
 const demo=location.hostname==='127.0.0.1'&&location.port==='4212';
 if(location.origin!=='https://chat.zalo.me'&&!demo)return;
 const KEY='yzrEnabled';let enabled=true,active=false,reason='waiting',timer=0;
 let storage=null;try{storage=chrome.storage.local;}catch{}
 // Yahoo Hub: the skin hides and scrolls Zalo's native list, which the hub reads, so it is opt-in.
 if(storage)enabled=false;
 const host=document.createElement('div');host.id='yzr-controls';host.dataset.yzrOwned='';
 // Choose an empty area by hit-testing; never cover a native Zalo control.
 host.hidden=true;const enableButton=document.createElement('button');enableButton.type='button';enableButton.textContent='Bật YM!';enableButton.title='Bật giao diện YM! trên Zalo Web';enableButton.addEventListener('click',()=>void setEnabled(true));host.append(enableButton);document.documentElement.append(host);
 let furniture=YahooZaloChrome({off:()=>void setEnabled(false),onNotice:text=>{const n=document.querySelector('#yzr-desktop .xp-tray');if(n)n.title=text;}}),desktopHost=null;
 // Yahoo Desktop 0.2 (yahoo/app/boot.js) hosts the skin: its buddy list and taskbar replace ours,
 // and the skin is always on while the desktop is.
 globalThis.YahooZaloSkin={attach(desktop){if(desktopHost)return;desktopHost=desktop;furniture.dispose();furniture=YahooZaloChrome({off(){},onNotice:desktop.notice||(()=>{}),host:desktop});enabled=true;reconcile();},
  // While the user looks at plain Zalo, every native node goes back to how Zalo left it.
  pause(paused){if(!desktopHost)return;enabled=!paused;reconcile();}};
 function detect(){const app=document.getElementById('app-page'),container=document.getElementById('container'),nav=document.getElementById('sidebarNav'),list=document.getElementById('conversationList');return !!(app&&!app.hidden&&container&&nav&&list&&app.contains(container)&&container.contains(nav)&&nav.contains(list));}
 function placeEnable(){if(host.hidden)return;const r=enableButton.getBoundingClientRect(),w=Math.max(76,r.width),h=Math.max(30,r.height),history=document.querySelector('#messageViewContainer')?.getBoundingClientRect(),candidates=[...(history?[[history.left+8,history.bottom-h-8]]:[]),[innerWidth-w-8,innerHeight-h-8],[innerWidth-w-8,8],[72,innerHeight-h-8],[72,8],[innerWidth-w-8,Math.round(innerHeight*.5)],[72,Math.max(8,innerHeight-h-120)]];const interactive='button,[role="button"],.leftbar-tab,input,textarea,select,a,[contenteditable="true"],[tabindex],.cb-info-file-item,.file-layout__bot-container,.media-item,[class*="clickable"],#chatInfoGeneral,#chatInfo,.chat-info,.chat-item';
  for(const[x,y]of candidates){if(x<0||y<0||x+w>innerWidth||y+h>innerHeight)continue;host.style.left=x+'px';host.style.top=y+'px';host.style.right='auto';host.style.bottom='auto';const points=[[x+2,y+2],[x+w-2,y+2],[x+2,y+h-2],[x+w-2,y+h-2],[x+w/2,y+h/2]],safe=typeof document.elementsFromPoint!=='function'||points.every(([a,b])=>document.elementsFromPoint(a,b).every(n=>host.contains(n)||n===host||!n.closest(interactive)&&getComputedStyle(n).cursor!=='pointer'));if(safe){host.dataset.yzrPlacement='clear';return;}}
  host.dataset.yzrPlacement='no-empty-slot';host.hidden=true;
 }
 function reconcile(){timer=0;const supported=detect();active=enabled&&supported;reason=!enabled?'disabled':supported?'ready':'waiting';
  document.documentElement.toggleAttribute('data-yzr-host',active&&!!desktopHost);
  if(active){document.documentElement.setAttribute('data-yzr-active','');try{furniture.sync(document.getElementById('sidebarNav'),document.getElementById('chatViewContainer'));host.removeAttribute('data-yzr-error');}catch(error){furniture.clear();active=false;reason='layout-error';host.dataset.yzrError=String(error?.name||'Error')+': '+String(error?.message||'Layout adapter failed').slice(0,200);document.documentElement.removeAttribute('data-yzr-active');}}
  else{document.documentElement.removeAttribute('data-yzr-active');furniture.clear();}
  host.dataset.yzrReason=reason;
  host.hidden=!supported||active||!!desktopHost;
  if(!active)placeEnable();
 }
 function schedule(records){if(records?.every(r=>{const target=r.target.nodeType===1?r.target:r.target.parentElement;if(target===host||host.contains(target)||target?.closest('[data-yzr-owned]'))return true;if(r.type==='attributes'||r.type==='characterData')return !target?.closest('#conversationList .msg-item,#header,#main-tab,#chat-box-input-container-id,.zl-modal,.media-viewer,.popover-v3,.stickerSelector,[role="dialog"],[role="menu"],[role="listbox"],[data-yzr-typing-source],[data-typing-indicator],[class*="typing"],[class*="Typing"]');return [...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&n.hasAttribute('data-yzr-owned'));}))return;if(!timer)timer=setTimeout(reconcile,180);}
 async function setEnabled(value){enabled=!!value;reconcile();if(storage)try{await storage.set({[KEY]:enabled});}catch{}return{enabled,active,reason};}
 const observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style','class','aria-label','title','src','data-presence','data-online','data-translate-title','data-id','aria-disabled','aria-pressed','aria-checked','aria-hidden','hidden','disabled','contenteditable']});
 document.addEventListener('input',e=>{if(e.target.id==='contact-search-input'||e.target.closest?.('#chat-box-input-container-id'))schedule();});
 document.addEventListener('compositionend',e=>{if(e.target.closest?.('#chat-box-input-container-id'))schedule();});
 document.addEventListener('selectionchange',()=>{const n=window.getSelection()?.anchorNode;if(n?.parentElement?.closest('#chat-box-input-container-id'))schedule();});
 document.addEventListener('pointerup',()=>schedule());
 addEventListener('resize',()=>schedule());
 addEventListener('pageshow',reconcile);
 if(storage){try{chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[KEY]&&!desktopHost){enabled=changes[KEY].newValue!==false;reconcile();}});chrome.runtime.onMessage.addListener((msg,_sender,respond)=>{if(msg?.type==='yzr:state')respond({enabled,active,reason});if(msg?.type==='yzr:set'&&typeof msg.enabled==='boolean'){void setEnabled(msg.enabled).then(respond);return true;}});storage.get({[KEY]:false}).then(settings=>{enabled=!!desktopHost||settings[KEY]===true;reconcile();},reconcile);}catch{reconcile();}}else reconcile();
})();
