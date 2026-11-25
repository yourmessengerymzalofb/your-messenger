import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {read,installEditing} from './helpers.mjs';
const same=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);

// Synthetic, fake-data Telegram Web A page, shaped as observed on web.telegram.org/a/ (2026-11):
// hashed class names left out, only the stable ones the adapter reads.
const row=(id,name,{cls='private',badge='',online=false,time='09:41'}={})=>`
 <div class="ListItem Chat chat-item-clickable ${cls} has-ripple"><a class="ListItem-button" href="#${id}">
  <div class="status"><div class="avatar-wrapper"><div class="Avatar size-large no-photo"><div class="inner"><span class="letters">${name[0]}</span></div></div>
   <div class="avatar-badge-wrapper"><div class="avatar-online avatar-badge${online?' avatar-online-shown':''}"></div></div></div></div>
  <div class="info"><div class="info-row"><div class="title"><h3 class="fullName">${name}</h3></div><div class="separator"></div><div class="LastMessageMeta"><span class="time">${time}</span></div></div>
   <div class="subtitle"><p class="last-message"><span class="last-message-summary">…</span></p>${badge?`<div class="chat-badge-transition shown open"><div>${badge}</div></div>`:''}</div></div>
 </a></div>`;
const page=`<!doctype html><body><div id="UiLoader"><div id="Main">
<div id="LeftColumn"><div class="chat-list custom-scroll">
 ${row('111','Lan Anh',{online:true})}
 ${row('-1001','Hội cờ tướng',{cls:'group',badge:'<span>4</span>'})}
 ${row('222','Minh',{badge:'<i class="icon icon-pin-filled"></i>'})}
</div></div>
<div id="MiddleColumn"><div class="MiddleHeader"><div class="ChatInfo"><div class="info"><div class="title"><h3 class="fullName">Lan Anh</h3></div><span class="status"><span class="user-status">online</span></span></div></div></div>
<div class="MessageList">
 <div id="message-1" class="Message message-list-item" data-message-id="1"><div class="message-content text"><div class="content-inner"><div class="text-content">Chào bạn <img class="emoji" alt="😀"><span class="MessageMeta"><span class="message-time">09:40</span></span></div></div></div></div>
 <div id="message-2" class="Message message-list-item own" data-message-id="2"><div class="message-content text"><div class="content-inner"><div class="text-content">Chào Lan<br>dòng hai<span class="MessageMeta"><span class="message-time">09:41</span></span></div></div></div></div>
 <div id="message-3" class="Message message-list-item" data-message-id="3"><div class="message-content sticker"><div class="StickerView"></div><span class="MessageMeta"><span class="message-time">09:42</span></span></div></div>
 <div class="ActionMessage message-list-item">Lan Anh joined Telegram</div>
</div>
<div class="Composer"><div id="editable-message-text" class="form-control" contenteditable="true" role="textbox" aria-label="Message"></div>
 <button class="Button record main-button" aria-label="Record voice message"></button></div>
</div></div></div></body>`;

async function boot(){
  const dom=new JSDOM(page,{url:'https://web.telegram.org/a/#111',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  for(const f of ['extension/shared/protocol.js','extension/shared/compose.js','extension/adapters/telegram/hub-adapter.js'])w.eval(await read(f));
  const d=w.document;
  // Telegram opens a chat when the mouse button goes down on its row (not on click).
  for(const a of d.querySelectorAll('a.ListItem-button'))a.addEventListener('mousedown',()=>{w.location.hash=a.getAttribute('href');});
  // Telegram swaps the microphone for Send once the editor has text.
  const editor=d.getElementById('editable-message-text'),main=d.querySelector('.main-button');
  editor.addEventListener('input',()=>{const on=!!editor.textContent.trim();main.classList.toggle('send',on);main.classList.toggle('record',!on);main.setAttribute('aria-label',on?'Send Message':'Record voice message');});
  return {dom,w,d,hub:w.YahooHubTelegram,editor,main};
}

test('Telegram adapter publishes the chat list (people, groups, online, unread) and the open chat',async()=>{
  const {dom,hub}=await boot();
  try{
    const snap=hub.read();
    assert.equal(snap.state,'ready');
    same(snap.entries.map(e=>[e.key,e.name,e.group,e.unread,e.time]),[['#111','Lan Anh','Online',false,'09:41'],['#-1001','Hội cờ tướng','Nhóm',true,'09:41'],['#222','Minh','Bạn bè',false,'09:41']],'a pin badge is not unread');
    const t=snap.transcript;
    same([t.key,t.title,t.status,t.canSend],['#111','Lan Anh','Đang hoạt động',true]);
    same(t.messages.map(m=>[m.id,m.from,m.kind,m.text,m.time]),[['1','peer','text','Chào bạn 😀','09:40'],['2','me','text','Chào Lan\ndòng hai','09:41'],['3','peer','sticker','','09:42']],'time stays out of the text; service lines are skipped');
  }finally{dom.window.close();}
});

test('Telegram adapter: signed out and loading pages publish no data',async()=>{
  for(const[html,state]of [['<div id="auth-pages"><div class="auth-form"></div></div>','login'],['<div id="LeftColumn"></div>','connecting'],['<p>other</p>','unrecognized']]){
    const dom=new JSDOM('<!doctype html><body>'+html+'</body>',{url:'https://web.telegram.org/a/',runScripts:'outside-only'}),w=dom.window;
    for(const f of ['extension/shared/protocol.js','extension/shared/compose.js','extension/adapters/telegram/hub-adapter.js'])w.eval(await read(f));
    same(w.YahooHubTelegram.read(),{state});dom.window.close();
  }
});

test('Telegram open presses the native row; send uses the native editor and Send button',async()=>{
  const {dom,w,d,hub,editor,main}=await boot();
  try{
    installEditing(w);
    let sent='';main.addEventListener('click',()=>{if(main.classList.contains('send')){sent=editor.textContent;editor.textContent='';editor.dispatchEvent(new w.Event('input'));}});
    assert.equal((await hub.send('#-1001','hi')).reason,'not-active');
    assert.equal((await hub.open('#-1001')).ok,true);
    assert.equal(w.location.hash,'#-1001');
    assert.equal((await hub.open('#999')).reason,'not-visible','only rows on the page');
    const r=await hub.send('#-1001','tối nay 8h');
    assert.equal(r.ok,true,r.reason);assert.equal(sent,'tối nay 8h');
  }finally{dom.window.close();}
});

test('Telegram send refuses a native draft and a missing Send button, and clears what it typed',async()=>{
  const {dom,w,d,hub,editor}=await boot();
  try{
    installEditing(w);
    editor.textContent='bản nháp';
    assert.equal((await hub.send('#111','xin chào')).reason,'draft-not-empty');
    assert.equal(editor.textContent,'bản nháp','the draft is left alone');
    editor.textContent='';d.querySelector('.main-button').remove();
    assert.equal((await hub.send('#111','xin chào')).reason,'no-send');
    assert.equal(editor.textContent,'');
  }finally{dom.window.close();}
});

test('Telegram adapter only runs on Telegram Web A and its manifest block asks for nothing new',async()=>{
  const manifest=JSON.parse(await read('extension/manifest.json'));
  const block=manifest.content_scripts.find(c=>c.js.includes('adapters/telegram/hub-adapter.js'));
  same(block.matches,['https://web.telegram.org/a/*']);
  same(block.js,['shared/protocol.js','shared/compose.js','shared/bridge.js','adapters/telegram/hub-adapter.js']);
  same(manifest.host_permissions,['https://chat.ymvn.site/*']);
  const src=await read('extension/adapters/telegram/hub-adapter.js');
  assert.doesNotMatch(src,/\bfetch\(|WebSocket|localStorage|storage\.local\.set/,'no network, no storage of its own');
  // Telegram's own copy (IndexedDB tt-data) is only read, for the user type of listed people.
  same(src.match(/indexedDB\.\w+\([^)]*\)/g),["indexedDB.open('tt-data')"]);
  assert.doesNotMatch(src,/readwrite|\.put\(|deleteDatabase|createObjectStore/,'never writes to it');
  same(src.match(/objectStore\([^)]*\)\.\w+/g),["objectStore('store').get"]);
});

// Telegram's list as observed: about 30 rows drawn, more once it scrolls to the bottom, 60 at most,
// each at style top 64 + 72 × its place.
function slidingList(d,w,total){
  const list=d.querySelector('.chat-list');list.classList.add('Transition_slide-active');
  let start=0,end=30,top=0;
  const draw=()=>{list.innerHTML=Array.from({length:end-start},(_,k)=>{const i=start+k,group=i%10===3;return row(String(5000+i),(group?'Nhóm ':'Bạn ')+i,{cls:group?'group':'private'}).replace('<div class="ListItem Chat','<div style="top: '+(64+i*72)+'px;" class="ListItem Chat');}).join('');};
  Object.defineProperty(list,'scrollTop',{get:()=>top,set:v=>{top=v;},configurable:true});
  Object.defineProperty(list,'scrollHeight',{get:()=>64+end*72,configurable:true});
  Object.defineProperty(list,'clientHeight',{get:()=>800,configurable:true});
  list.addEventListener('scroll',()=>{
    if(top+800>=64+end*72-10&&end<total){end=Math.min(total,end+30);start=Math.max(0,end-60);draw();}
    else if(top<64+start*72&&start>0){start=Math.max(0,start-30);end=Math.min(end,start+60);draw();}
  });
  d.addEventListener('mousedown',e=>{const a=e.target.closest?.('a.ListItem-button');if(a)w.location.hash=a.getAttribute('href');});
  draw();
  return {range:()=>[start,end]};
}

test('Telegram Tải thêm scrolls Telegram\'s own list for more chats, keeps them, and scrolls back',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    const {range}=slidingList(d,w,100);
    assert.equal(hub.read().entries.length,30);
    assert.equal((await hub.more()).ok,true);
    same(range(),[0,60],'back at the top of Telegram\'s list');
    assert.equal((await hub.more()).ok,true);
    same(range(),[0,60]);
    const entries=hub.read().entries;
    assert.equal(entries.length,90,'chats read further down are kept');
    same(entries.slice(0,4).map(e=>[e.key,e.group]),[['#5000','Bạn bè'],['#5001','Bạn bè'],['#5002','Bạn bè'],['#5003','Nhóm']]);
    assert.equal(entries[89].key,'#5089','in Telegram\'s order');
    // A kept chat that Telegram no longer draws: its row is scrolled to, pressed, and the list goes back.
    assert.equal((await hub.open('#5085')).ok,true);
    assert.equal(w.location.hash,'#5085');same(range(),[0,60]);
    assert.equal((await hub.more()).ok,true);assert.equal(hub.read().entries.length,100);
    same(await hub.more(),{ok:false,reason:'end'},'the end of the list');
  }finally{dom.window.close();}
});

test('Telegram bots: read from Telegram\'s own cache (read-only) and from the open chat\'s header',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    const users={'111':{type:'userTypeRegular'},'222':{type:'userTypeBot'}},modes=[];
    // A stand-in for Telegram's IndexedDB: database tt-data, store "store", key tt-global-state.
    w.indexedDB={open(name){const req={};setTimeout(()=>{req.result={objectStoreNames:{contains:n=>n==='store'},close(){},transaction(store,mode){modes.push(name+'/'+store+'/'+mode);return {objectStore:()=>({get(key){const g={};setTimeout(()=>{g.result=key==='tt-global-state'?{users:{byId:users}}:undefined;g.onsuccess();});return g;}})};}};req.onsuccess();});return req;}};
    same(hub.read().entries.map(e=>[e.key,e.group]),[['#111','Online'],['#-1001','Nhóm'],['#222','Bạn bè']]);
    await new Promise(r=>setTimeout(r,30));
    same(hub.read().entries.map(e=>[e.key,e.group]),[['#111','Online'],['#-1001','Nhóm'],['#222','Bot']]);
    same(modes,['tt-data/store/readonly']);
    hub.read();await new Promise(r=>setTimeout(r,30));
    assert.equal(modes.length,1,'people already known are not read again');
    // The open chat's header says "bot" (here #111, which the cache did not call a bot).
    d.querySelector('.MiddleHeader .status').textContent='bot';
    same(hub.read().entries.map(e=>[e.key,e.group]),[['#111','Bot'],['#-1001','Nhóm'],['#222','Bot']]);
  }finally{dom.window.close();}
});

test('Telegram open that does not take says how far Telegram got',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    // A row Telegram ignores: the hash never changes.
    const a=d.querySelector('a.ListItem-button[href="#-1001"]'),quiet=a.cloneNode(true);a.replaceWith(quiet);
    const r=await hub.open('#-1001');
    assert.equal(r.ok,false);assert.equal(r.reason,'not-opened');assert.match(r.detail,/chưa nhận cú bấm/);
    // The hash moves but the header is not drawn yet (a slowed background tab).
    quiet.addEventListener('mousedown',()=>{w.location.hash='#-1001';d.querySelector('.MiddleHeader .ChatInfo')?.remove();});
    const r2=await hub.open('#-1001');
    assert.equal(r2.reason,'not-opened');assert.match(r2.detail,/chưa vẽ xong/);
  }finally{dom.window.close();}
});
