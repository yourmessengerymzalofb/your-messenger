/* Combined buddy list: the Zalo and Facebook lists move into YM!'s own buddy window,
   under a tab strip (Tất cả / Yahoo / Zalo / Facebook). The lists are the same nodes the channel
   adapters keep painting, so moving them changes nothing for the adapters. The popup can still
   choose one window per app (channel-window.mjs mount()). */
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};

export const YAHOO_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="4" fill="#6a35b2"/><text x="8" y="12" font-family="Tahoma,Arial" font-size="10" font-weight="bold" fill="#fff" text-anchor="middle">Y!</text></svg>');
const TAB_KEY='ymBuddyTab',FOLD_KEY='ymBuddyFolded',ALL_KEY='ymBuddyAllHidden';

// lists: channel windows from createChannelWindow() ({id,label,icon,list,refresh,setQuery}).
// yahoo/search: the Yahoo list and the search box (Yahoo's own buddy window by default; the guest
// window's sign-up list before sign-in). groups: per app, the handler of Yahoo's "Tạo nhóm chat" button
// on that app's tab ({zalo,facebook}: a trusted click). destroy() puts the Yahoo list back and leaves the channel
// lists detached for the next combineBuddyLists().
export function combineBuddyLists(root,lists,{store=globalThis.chrome?.storage?.local,yahoo:contacts=root.querySelector('#buddy-window #contacts'),search=root.querySelector('#contact-search'),groups={}}={}){
  if(!contacts)return null;
  const sources=[{id:'yahoo',label:'Y!',icon:YAHOO_ICON,list:contacts},...lists];
  const box=el('div','contacts ym-combined'),bar=el('div','ym-buddy-tabs'),tabs=new Map(),sections=new Map(),watches=[];
  bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Nguồn danh sách bạn');
  const tab=(id,label,icon)=>{
    const b=el('button','ym-buddy-tab');b.type='button';b.dataset.tab=id;b.setAttribute('role','tab');b.title=label;
    if(icon){const img=el('img','');img.alt='';img.src=icon;b.append(img);}
    const count=el('span','ym-tab-unread');count.hidden=true;b.append(el('span','',label),count);
    b.addEventListener('click',()=>select(id,true));bar.append(b);tabs.set(id,{button:b,count});
  };
  tab('all','Tất cả');
  contacts.before(bar);contacts.before(box);
  // "Chưa đọc": copies of the unread rows of every app in Tất cả, of that app alone on the Zalo,
  // Facebook and Telegram tabs (the Yahoo tab is YM!'s own list); a click goes to the real row.
  // Zalo official accounts and Facebook Pages (rows marked data-ym-business by their adapters) go to
  // a second list after it, so people come first. Each heading folds its list away like an app's
  // (remembered as "unread" and "unreadBusiness").
  const unreadLists=new Map();
  for(const[id,title]of[['unread','Chưa đọc'],['unreadBusiness','OA / Page / Bot chưa đọc']]){
    const section=el('section','ym-source ym-unread-source'+(id==='unread'?'':' ym-unread-business')),head=el('button','ym-source-head ym-unread-head'),label=el('span'),list=el('div','contacts ym-unread-list');
    head.type='button';head.title='Thu gọn hoặc mở '+title;head.setAttribute('aria-expanded','true');head.append(el('span','ym-fold','▾'),label);
    section.hidden=true;section.dataset.unread=id;section.append(head,list);box.append(section);
    head.addEventListener('click',()=>toggle(id));
    unreadLists.set(id,{section,head,label,list,title});
  }
  // In Tất cả a heading folds its app away (remembered); the tabs show one app.
  let folded={};
  const fold=(id,on)=>{const s=unreadLists.get(id)||sections.get(id);if(!s)return;s.section.toggleAttribute('data-folded',on);s.head.setAttribute('aria-expanded',String(!on));};
  const toggle=id=>{folded={...folded,[id]:!folded[id]};fold(id,folded[id]);try{store?.set?.({[FOLD_KEY]:folded});}catch{}};
  for(const s of sources){
    tab(s.id,s.label,s.icon);
    const section=el('section','ym-source ym-src-'+s.id+(s.id==='yahoo'?'':' ym-channel-source')),head=el('button','ym-source-head');head.type='button';
    const img=el('img','');img.alt='';img.src=s.icon;head.append(el('span','ym-fold','▾'),img,el('span','',s.label));head.setAttribute('aria-expanded','true');head.title='Thu gọn hoặc mở '+s.label;
    head.addEventListener('click',()=>toggle(s.id));
    section.append(head,s.list);box.append(section);sections.set(s.id,{section,head});
    const watch=new MutationObserver(countUnread);watch.observe(s.list,{childList:true,subtree:true,characterData:true});watches.push(watch);
  }
  let current='all';
  /* Tất cả shows the apps picked in its dropdown (a click on Tất cả opens it). Remembered as the
     apps left out, so an app added later shows. At least one app stays. The app tabs are unchanged. */
  let hiddenApps=new Set();
  const allButton=tabs.get('all').button,anchor=el('div','ym-app-anchor'),menu=el('div','ym-app-picker'),picks=new Map();
  allButton.setAttribute('aria-haspopup','true');allButton.setAttribute('aria-expanded','false');
  menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Ứng dụng hiện trong Tất cả');
  menu.append(el('div','ym-app-picker-title','Hiện trong Tất cả:'));
  for(const s of sources){
    const item=el('label','ym-app-pick'),check=el('input'),img=el('img');
    check.type='checkbox';check.dataset.app=s.id;img.alt='';img.src=s.icon;
    item.append(check,img,el('span','',s.id==='yahoo'?'Yahoo':s.label));menu.append(item);picks.set(s.id,check);
    check.addEventListener('change',()=>pick(s.id,check.checked));
  }
  anchor.append(menu);bar.after(anchor);
  const shownApps=()=>sources.filter(s=>!hiddenApps.has(s.id));
  function paintPicker(){
    const shown=shownApps();
    for(const[id,check]of picks){check.checked=!hiddenApps.has(id);check.disabled=check.checked&&shown.length===1;}
    allButton.toggleAttribute('data-ym-filtered',hiddenApps.size>0);
    allButton.title=hiddenApps.size?'Tất cả: '+shown.map(s=>s.id==='yahoo'?'Yahoo':s.label).join(', '):'Tất cả';
  }
  function pick(id,on){
    if(!on&&shownApps().every(s=>s.id===id)){paintPicker();return;}
    if(on)hiddenApps.delete(id);else hiddenApps.add(id);
    paintPicker();select(current,false);countUnread();
    try{store?.set?.({[ALL_KEY]:[...hiddenApps]});}catch{}
  }
  function openMenu(open){menu.hidden=!open;allButton.setAttribute('aria-expanded',String(open));}
  allButton.addEventListener('click',()=>openMenu(menu.hidden));
  const doc=root.ownerDocument||globalThis.document;
  const onOutside=e=>{if(!menu.hidden&&!menu.contains(e.target)&&!allButton.contains(e.target))openMenu(false);};
  const onEscape=e=>{if(e.key==='Escape'&&!menu.hidden){openMenu(false);allButton.focus();}};
  doc?.addEventListener('click',onOutside,true);menu.addEventListener('keydown',onEscape);allButton.addEventListener('keydown',onEscape);
  // "Tạo nhóm chat" belongs to one app: Yahoo's own on the Yahoo tab, the app's own on the Zalo and
  // Facebook tabs, none on Tất cả (there is no app to create the group in).
  const groupRow=contacts.closest('#buddy-window')?.querySelector('.group-actions'),groupButton=groupRow?.querySelector('#create-group'),groupTitle=groupButton?.title||'';
  const onGroup=e=>{if(current==='yahoo'||!e.target.closest?.('#create-group'))return;e.preventDefault();e.stopPropagation();if(e.isTrusted&&groups[current])groups[current](e);};
  groupRow?.addEventListener('click',onGroup,true);
  function select(id,remember){
    if(!tabs.has(id))id='all';current=id;box.dataset.tab=id;
    for(const[key,{button}]of tabs){const on=key===id;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}
    for(const[key,{section,head}]of sections){section.hidden=id==='all'?hiddenApps.has(key):id!==key;head.hidden=id!=='all';}
    if(id!=='all')openMenu(false);
    if(groupRow){groupRow.hidden=id!=='yahoo'&&!groups[id];if(groupButton)groupButton.title=id==='yahoo'||id==='all'?groupTitle:'Tạo nhóm chat trên '+(sources.find(s=>s.id===id)?.label||'');}
    paintUnread();
    box.scrollTop=0;
    if(remember)try{store?.set?.({[TAB_KEY]:id});}catch{}
  }
  bar.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight'].includes(e.key))return;
    const ids=[...tabs.keys()],next=ids[(ids.indexOf(current)+(e.key==='ArrowRight'?1:ids.length-1))%ids.length];
    e.preventDefault();select(next,true);tabs.get(next).button.focus();
  });
  // Unread counts per tab: the sum of the rows' own unread badges (Facebook's "●" counts as one).
  let pending=false,disposed=false;
  const unread=badge=>{
    const text=badge?.textContent.trim();
    if(!text)return 0;
    const count=parseInt(text,10);
    return Number.isNaN(count)?1:Math.max(0,count);
  };
  function countUnread(){
    if(pending)return;pending=true;
    queueMicrotask(()=>{pending=false;if(disposed)return;let all=0;
      for(const s of sources){
        const n=[...s.list.querySelectorAll('.contact-unread')].reduce((sum,b)=>sum+unread(b),0);if(!hiddenApps.has(s.id))all+=n;
        show(tabs.get(s.id).count,n);
      }
      show(tabs.get('all').count,all);
      paintUnread();
    });
  }
  const label=row=>(row.querySelector('.contact-first b')?.textContent||row.textContent).trim();
  const avatarOf=row=>row.querySelector('.tiny-avatar img')?.getAttribute('src')||'';
  const rowKey=(app,row)=>app==='zalo'?JSON.stringify([label(row),avatarOf(row)]):row.dataset.ymKey||label(row);
  const zalo=lists.find(s=>s.id==='zalo');
  const marked='data-ym-unread-attention';
  let chatNodes=[],zaloChat=null;
  function syncAttention(){
    const open=new Map();
    for(const node of chatNodes){
      if(node.hidden)continue;
      const app=node.dataset.ymChannel||'yahoo';
      if(!open.has(app))open.set(app,new Set());
      open.get(app).add(node.dataset.ymChatKey);
    }
    if(zaloChat?.node.isConnected&&!zaloChat.node.hidden&&!zaloChat.node.hasAttribute('data-yzr-minimized')){
      const matches=[...zalo.list.querySelectorAll('.contact-row')].filter(row=>label(row)===zaloChat.name);
      const withAvatar=matches.filter(row=>zaloChat.avatar&&avatarOf(row)===zaloChat.avatar);
      const visible=matches.length===1?matches[0]:withAvatar.length===1?withAvatar[0]:null;
      if(visible)open.set('zalo',new Set([rowKey('zalo',visible)]));
    }
    const update=(list,app)=>{
      for(const row of list.querySelectorAll('.contact-row:has(.contact-unread),['+marked+']')){
        const source=app||row.dataset.app;
        const visible=open.get(source)?.has(rowKey(source,row));
        row.toggleAttribute(marked,!!unread(row.querySelector('.contact-unread'))&&!visible);
      }
    };
    for(const s of sources)update(s.list,s.id);
    for(const u of unreadLists.values())update(u.list);
  }
  // Watch only window creation/removal and visibility, without observing chat transcript updates.
  const windowWatch=new MutationObserver(records=>{
    if(records.some(r=>r.type==='childList'))watchWindows();else syncAttention();
  });
  function watchWindows(){
    windowWatch.disconnect();
    windowWatch.observe(root,{childList:true});
    chatNodes=[...root.children].filter(node=>node.hasAttribute('data-ym-chat-key'));
    for(const node of chatNodes)windowWatch.observe(node,{attributes:true,attributeFilter:['hidden']});
    zaloChat=zalo?.getConversation?.();
    if(zaloChat)windowWatch.observe(zaloChat.node,{attributes:true,attributeFilter:['hidden','data-yzr-minimized']});
    syncAttention();
  }
  root.addEventListener('ym-zalo-conversation',watchWindows);
  // The real row at click time: adapters repaint their rows, so look it up again.
  function forward(s,key,event){
    const row=[...s.list.querySelectorAll('.contact-row')].find(r=>rowKey(s.id,r)===key);if(!row)return;
    // Zalo rows and Facebook rows check that the click is the user's own (event.isTrusted): hand
    // them this click. Yahoo's rows are its own client's.
    if(typeof row.ymActivate==='function')row.ymActivate(event);else if(typeof row.onclick==='function')row.onclick(event);else row.click();
  }
  function paintUnread(){
    const apps=current==='all'?shownApps():current==='yahoo'?[]:sources.filter(s=>s.id===current);
    const rows=apps.flatMap(s=>[...s.list.querySelectorAll('.contact-row')].filter(r=>(!r.hidden||r.hasAttribute('data-ym-paged')&&!search?.value.trim())&&unread(r.querySelector('.contact-unread'))).map(r=>({s,r})));
    for(const[id,u]of unreadLists){
      const mine=rows.filter(({r})=>(id==='unreadBusiness')===!!r.dataset.ymBusiness);
      u.section.hidden=!mine.length;u.label.textContent=u.title+' ('+mine.length+')';
      u.list.replaceChildren(...mine.map(({s,r})=>{
        const copy=r.cloneNode(true),name=label(r);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
        copy.classList.add('ym-unread-row');copy.dataset.app=s.id;copy.title=s.label+(r.dataset.ymBusiness?' '+r.dataset.ymBusiness:'')+': '+name;
        const key=rowKey(s.id,r);
        copy.addEventListener('click',e=>forward(s,key,e));return copy;
      }));
    }
    syncAttention();
  }
  const show=(badge,n)=>{badge.hidden=!n;badge.textContent=n>99?'99+':String(n||'');};
  // Yahoo's search box filters the Zalo and Facebook lists too.
  // "Chưa đọc" shows only the unread rows the search leaves.
  const filter=()=>{lists.forEach(l=>l.setQuery(search.value));countUnread();};
  search?.addEventListener('input',filter);
  function destroy(){
    disposed=true;
    windowWatch.disconnect();root.removeEventListener('ym-zalo-conversation',watchWindows);
    for(const s of sources)for(const row of s.list.querySelectorAll('['+marked+']'))row.removeAttribute(marked);
    watches.forEach(w=>w.disconnect());doc?.removeEventListener('click',onOutside,true);anchor.remove();groupRow?.removeEventListener('click',onGroup,true);if(groupRow)groupRow.hidden=false;if(groupButton)groupButton.title=groupTitle;search?.removeEventListener('input',filter);lists.forEach(l=>l.setQuery(''));
    box.parentNode?.insertBefore(contacts,box);box.remove();bar.remove();
  }
  watchWindows();paintPicker();select('all',false);countUnread();
  Promise.resolve(store?.get?.({[TAB_KEY]:'all',[FOLD_KEY]:{},[ALL_KEY]:[]})).then(v=>{
    if(disposed)return;
    folded=v?.[FOLD_KEY]||{};for(const id of Object.keys(folded))fold(id,!!folded[id]);
    const left=Array.isArray(v?.[ALL_KEY])?v[ALL_KEY].filter(id=>picks.has(id)):[];
    if(left.length&&left.length<sources.length){hiddenApps=new Set(left);paintPicker();select(current,false);countUnread();}
    if(v?.[TAB_KEY]&&current==='all')select(v[TAB_KEY],false);
  }).catch(()=>{});
  return {bar,box,select,get tab(){return current;},countUnread,destroy};
}
