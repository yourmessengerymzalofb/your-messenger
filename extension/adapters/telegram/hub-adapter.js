/* Telegram Web (web.telegram.org/a/) source for Yahoo Hub. Reads the rendered chat list and the
   messages of the open chat; opens a chat and sends through Telegram's own controls.
   Shapes as observed on Telegram Web A (2026-11): chat rows .ListItem.Chat (class private or group)
   with a link a.ListItem-button href="#<peer id>"; the open chat's id in the page hash; messages
   .Message[data-message-id] (class own for yours); the editor #editable-message-text; the send
   button .Composer .main-button, which has class send once there is text (record before). */
(() => {
  const C=globalThis.YahooHubCompose;
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const native=n=>!n.closest('[data-yfr-owned]');
  // Peer id from "#123" (a person or bot) or "#-100123" (a group or channel); "#-100123_45" is a topic.
  const keyOf=href=>{const m=String(href||'').match(/^#(-?\d+)/);return m?'#'+m[1]:'';};
  const activeKey=()=>keyOf(location.hash);
  const left=()=>document.querySelector('#LeftColumn');
  const middle=()=>document.querySelector('#MiddleColumn');
  function detect(){
    if(document.querySelector('#auth-pages,.auth-form,#auth-qr-form,#sign-in-phone-number'))return 'login';
    if(left()?.querySelector('.chat-list')&&middle())return 'ready';
    return left()?'connecting':'unrecognized';
  }
  // Telegram draws emoji (and custom emoji) as pictures inside text: read them back from alt.
  function textOf(n){let s='';for(const c of n.childNodes){if(c.nodeType===3)s+=c.textContent;else if(c.nodeType===1){if(c.tagName==='IMG')s+=c.getAttribute('alt')||'';else if(c.tagName==='BR')s+='\n';else s+=textOf(c);}}return s;}
  // The chat list on show (each folder tab has its own; the active one slides in).
  const chatList=()=>left()?.querySelector('.chat-list.Transition_slide-active')||left()?.querySelector('.chat-list')||null;
  function rows(list=chatList()){
    const seen=new Set(),out=[];
    for(const item of list?.querySelectorAll('.ListItem.Chat')||[]){
      if(!native(item))continue;
      const link=item.querySelector('a.ListItem-button[href^="#"]'),key=keyOf(link?.getAttribute('href'));
      if(!key||seen.has(key))continue;seen.add(key);out.push({item,link,key});
    }
    return out;
  }
  // Unread: the badge shows a count ("4", "1.9K") or a mention; a pinned chat's badge is a pin icon.
  function unread(item){
    const badge=item.querySelector('.chat-badge-transition');if(!badge)return false;
    return /[\d@]/.test(badge.textContent||'');
  }
  // Avatars are blob: pictures held by the page: small JPEG copies (blob: is not readable elsewhere).
  const thumbs=new Map(),waiting=new WeakSet();
  function later(img){if(waiting.has(img))return;waiting.add(img);img.addEventListener('load',()=>globalThis.YahooHubTelegram?.bridge?.publish?.(),{once:true});}
  function thumb(img,max,quality){
    const src=img.currentSrc||img.src||'';if(!src)return '';
    if(/^https:/.test(src))return src;
    if(!/^(blob|data):/.test(src))return '';
    if(!img.complete||!img.naturalWidth){later(img);return '';}
    const id=max+':'+src.length+':'+src.slice(-80);if(thumbs.has(id))return thumbs.get(id);
    let data='';
    try{
      const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',quality);
    }catch{}
    thumbs.set(id,data);if(thumbs.size>200)thumbs.delete(thumbs.keys().next().value);
    return data;
  }
  /* Bots. Telegram's list draws a bot like a person. Telegram Web keeps its own copy of what it knows
     (IndexedDB "tt-data", on this computer); the user type of the listed people is read from it,
     read-only, at most once a minute, and only "is a bot" is kept, in memory. The open chat's
     header saying "bot" settles it too. */
  const bots=new Set(),known=new Set();let botsAt=0,botsBusy=false;
  function readTypes(wanted){
    return new Promise(resolve=>{
      let req;try{req=indexedDB.open('tt-data');}catch{resolve(null);return;}
      // Never create the database: Telegram's own copy or nothing.
      req.onupgradeneeded=()=>{try{req.transaction.abort();}catch{}};
      req.onerror=req.onblocked=()=>resolve(null);
      req.onsuccess=()=>{
        const db=req.result,done=v=>{try{db.close();}catch{}resolve(v);};
        try{
          if(!db.objectStoreNames.contains('store'))return done(null);
          const get=db.transaction('store','readonly').objectStore('store').get('tt-global-state');
          get.onerror=()=>done(null);
          get.onsuccess=()=>{
            try{
              const state=typeof get.result==='string'?JSON.parse(get.result):get.result,users=state?.users?.byId;
              if(!users||typeof users!=='object')return done(null);
              const out=new Map();for(const key of wanted){const type=users[key.slice(1)]?.type;if(typeof type==='string')out.set(key,type==='userTypeBot');}
              done(out);
            }catch{done(null);}
          };
        }catch{done(null);}
      };
    });
  }
  function learnBots(keys){
    const wanted=keys.filter(k=>!known.has(k));
    if(!wanted.length||botsBusy||Date.now()-botsAt<60000||typeof indexedDB==='undefined')return;
    botsBusy=true;botsAt=Date.now();
    readTypes(wanted).then(types=>{
      let changed=false;
      for(const[key,bot]of types||[]){known.add(key);if(bot&&!bots.has(key)){bots.add(key);changed=true;}}
      if(changed)globalThis.YahooHubTelegram?.bridge?.publish?.();
    }).finally(()=>{botsBusy=false;});
  }
  /* Telegram draws about 30 chats and more as its list scrolls, keeping 60 at most (rows sit at
     style top px). Chats read once stay in a list here, in memory, in Telegram's order, so "Tải
     thêm" can grow the Yahoo list past what Telegram draws at the moment. */
  const CACHE=200,AVATARS=120,ROW=72;
  let cache=new Map(),cacheList=null;
  const posOf=(item,i)=>{const t=parseFloat(item.style?.top);return Number.isFinite(t)?t:i*ROW;};
  function describe(item){
    const name=clean(textOf(item.querySelector('.info .title h3')||item.querySelector('.info .title')||document.createElement('i'))).slice(0,100);
    const person=item.classList.contains('private');
    // The green dot on the avatar is drawn for people online now.
    const online=person&&!!item.querySelector('.avatar-online[class*="shown"]');
    const img=item.querySelector('.Avatar img.Avatar__media,.Avatar img');
    return {name,person,online,unread:unread(item),img,time:clean(item.querySelector('.LastMessageMeta .time')?.textContent)};
  }
  function roster(){
    const list=chatList();
    if(list!==cacheList){cacheList=list;cache=new Map();}
    const drawn=rows(list).map(({item,key},i)=>({key,pos:posOf(item,i),...describe(item)})).filter(e=>e.name);
    if(drawn.length){
      // A chat no longer drawn where Telegram now draws others has moved or gone.
      const keys=new Set(drawn.map(e=>e.key)),lo=Math.min(...drawn.map(e=>e.pos)),hi=Math.max(...drawn.map(e=>e.pos));
      for(const[key,e]of cache)if(!keys.has(key)&&e.pos>=lo&&e.pos<=hi)cache.delete(key);
    }
    for(const{img,...e}of drawn){const old=cache.get(e.key);cache.set(e.key,{...e,avatar:old?.avatar||''});}
    const ordered=[...cache.values()].sort((a,b)=>a.pos-b.pos);
    for(const e of ordered.slice(CACHE))cache.delete(e.key);
    // Pictures: small copies for the first rows (each snapshot crosses to the Zalo tab).
    const index=new Map(ordered.map((e,i)=>[e.key,i]));
    for(const{key,img}of drawn){const e=cache.get(key);if(e&&img&&index.get(key)<AVATARS)e.avatar=thumb(img,40,0.7)||e.avatar;}
    const shown=ordered.slice(0,CACHE);
    learnBots(shown.filter(e=>e.person).map(e=>e.key));
    return shown.map(e=>({key:e.key,name:e.name,group:!e.person?'Nhóm':bots.has(e.key)?'Bot':e.online?'Online':'Bạn bè',unread:e.unread,avatar:index.get(e.key)<AVATARS?e.avatar:'',time:e.time}));
  }
  // Scrolling Telegram's own list (what a user's wheel does); done in steps, each awaiting Telegram's redraw.
  const drawnPos=list=>rows(list).map(({item},i)=>posOf(item,i));
  const firstPos=list=>Math.min(Infinity,...drawnPos(list));
  const lastPos=list=>Math.max(-Infinity,...drawnPos(list));
  function scrollList(list,top){list.scrollTop=Math.max(0,top);list.dispatchEvent(new Event('scroll'));}
  // Back to where the list was: Telegram draws the rows above again 30 at a time.
  const pause=ms=>new Promise(r=>setTimeout(r,ms));
  async function restore(list,saved,first){
    for(let step=0;step<20;step++){
      const top=firstPos(list);if(!(top>first))break;
      scrollList(list,top-list.clientHeight);
      if(!await C.wait(()=>firstPos(list)<top,2500))break;
      await pause(200);
    }
    scrollList(list,saved);
  }
  /* More chats: Telegram draws the next 30 when its list reaches the bottom. From the top, the chats
     already kept are drawn again first (Telegram trims back to 30 rows a moment after the list is at
     the top, as observed), so it takes one step per 30 kept; a step that draws nothing is tried
     once more before the list counts as ended. */
  async function more(){
    if(detect()!=='ready')return {ok:false,reason:'not-ready'};
    const list=chatList();if(!list)return {ok:false,reason:'not-ready'};
    roster();const before=cache.size,saved=list.scrollTop,first=firstPos(list);
    try{
      for(let step=0,misses=0;step<Math.ceil(before/30)+4&&cache.size<before+30&&cache.size<CACHE;step++){
        const last=lastPos(list);
        scrollList(list,list.scrollHeight-list.clientHeight);
        const grew=await C.wait(()=>lastPos(list)>last,2000);
        roster();
        if(grew){misses=0;await pause(250);}else if(++misses>=2)break;
      }
    }finally{await restore(list,saved,first);}
    // The new people get their bot check now rather than in a minute.
    botsAt=0;roster();
    return cache.size>before?{ok:true}:{ok:false,reason:'end'};
  }
  function header(){
    const info=middle()?.querySelector('.MiddleHeader .ChatInfo');if(!info)return {title:'',status:''};
    return {info,title:clean(textOf(info.querySelector('.fullName')||info.querySelector('.title')||document.createElement('i'))),status:clean(info.querySelector('.status')?.textContent)};
  }
  const PHOTO_MESSAGES=15;
  function messages(){
    const list=[...(middle()?.querySelectorAll('.MessageList .Message[data-message-id]')||[])].filter(native).slice(-120);
    return list.map((m,i)=>{
      const me=m.classList.contains('own'),content=m.querySelector('.message-content')||m;
      const body=m.querySelector('.text-content');let text='';
      if(body){const copy=body.cloneNode(true);copy.querySelectorAll('.MessageMeta,.Reactions,.message-reactions').forEach(n=>n.remove());text=textOf(copy).replace(/\n{3,}/g,'\n\n').trim();}
      const sender=me?'':clean(m.querySelector('.message-title-name,.sender-title')?.textContent);
      const time=clean(m.querySelector('.MessageMeta .message-time')?.textContent);
      // Photos as small copies, only for the latest messages (every snapshot crosses to the Zalo tab).
      const images=[],recent=i>=list.length-PHOTO_MESSAGES;
      for(const img of recent?m.querySelectorAll('.media-inner img,.Photo img'):[]){
        if(images.length>=4||!native(img)||/(^|\s)thumb(nail)?(\s|$)/.test(img.className))continue;
        if(img.naturalWidth&&img.naturalWidth<40)continue;
        const data=thumb(img,240,0.72);if(data)images.push(data);
      }
      let kind,label='';
      if(content.matches('.sticker,.custom-shape')||m.querySelector('.sticker-message,.StickerView,.AnimatedSticker'))kind='sticker';
      else if(m.querySelector('.Audio,.voice'))kind='file',label='Tin nhắn thoại';
      else if(m.querySelector('.File,.document'))kind='file';
      else if(images.length||m.querySelector('.media-inner img,.Photo'))kind='image';
      else if(m.querySelector('.media-inner video,.Video'))kind='image',label='Video';
      else if(text)kind='text';
      else kind='other',label=m.querySelector('.Poll')?'Bình chọn':'';
      // A caption goes with its photo or file; a label names what Telegram shows instead of text.
      return {id:m.getAttribute('data-message-id'),from:me?'me':'peer',sender,text:[label,kind==='sticker'?'':text].filter(Boolean).join(' '),time,kind,images};
    });
  }
  function editor(){
    const list=[...document.querySelectorAll('#editable-message-text[contenteditable="true"]')].filter(n=>native(n)&&n.getAttribute('aria-disabled')!=='true');
    return list.length===1?list[0]:null;
  }
  function findSend(){
    const list=[...(middle()?.querySelectorAll('.Composer button.main-button')||[])].filter(b=>native(b)&&(b.classList.contains('send')||/^(Send Message|Gửi tin nhắn)$/i.test(b.getAttribute('aria-label')||'')));
    return list.length===1?list[0]:null;
  }
  const ONLINE=/^(online|trực tuyến)$/i;
  function transcript(list){
    const key=activeKey();if(!key)return null;
    const {title,status}=header();if(!title)return null;
    return {key,title:list.find(e=>e.key===key)?.name||title,status:ONLINE.test(status)?'Đang hoạt động':status||'Telegram',canSend:!!editor(),messages:messages()};
  }
  // Telegram opens a chat on the mouse button going down on its row (a bare click() does nothing).
  function press(n){
    const r=n.getBoundingClientRect(),opt={bubbles:true,cancelable:true,button:0,buttons:1,clientX:r.left+Math.min(20,r.width/2),clientY:r.top+Math.min(20,r.height/2),view:window};
    const Pointer=globalThis.PointerEvent||MouseEvent;
    n.dispatchEvent(new Pointer('pointerdown',opt));n.dispatchEvent(new MouseEvent('mousedown',opt));
    n.dispatchEvent(new Pointer('pointerup',{...opt,buttons:0}));n.dispatchEvent(new MouseEvent('mouseup',{...opt,buttons:0}));
  }
  async function open(key){
    if(detect()!=='ready')return {ok:false,reason:'not-ready'};
    if(activeKey()===key&&header().title)return {ok:true};
    const list=chatList(),find=()=>rows(list).filter(e=>e.key===key);
    let hits=find(),moved=null;
    // A chat read earlier but no longer drawn: scroll Telegram's list to it, then back.
    if(!hits.length&&list&&cache.has(key)){
      moved={saved:list.scrollTop,first:firstPos(list)};const target=cache.get(key).pos;
      for(let step=0;step<12&&!hits.length;step++){
        const lo=firstPos(list),hi=lastPos(list);
        scrollList(list,target<lo?lo-list.clientHeight:Math.min(target-list.clientHeight/2,list.scrollHeight));
        await C.wait(()=>find().length||firstPos(list)!==lo||lastPos(list)!==hi,2500);
        hits=find();if(!hits.length&&firstPos(list)===lo&&lastPos(list)===hi)break;
      }
    }
    try{
      if(hits.length!==1)return {ok:false,reason:'not-visible'};
      press(hits[0].link);
      // Chrome slows a background tab's timers (to once a minute after a while), and Telegram draws
      // the opened chat on them: wait longer there. A failure says how far Telegram got.
      if(await C.wait(()=>activeKey()===key&&!!header().title,document.hidden?12000:3000))return {ok:true};
      const switched=activeKey()===key;
      return {ok:false,reason:'not-opened',detail:(switched?'Telegram đã chuyển sang hội thoại nhưng chưa vẽ xong':'Telegram chưa nhận cú bấm vào hội thoại')+(document.hidden?'; tab Telegram đang chạy nền':'')};
    }finally{if(moved)await restore(list,moved.saved,moved.first);}
  }
  async function send(key,text){
    if(!text)return {ok:false,reason:'empty'};
    if(detect()!=='ready'||activeKey()!==key)return {ok:false,reason:'not-active'};
    // The send button replaces the microphone only once the text is in; a background tab is slow.
    return C.send({editor:editor(),text,findSend,press:n=>{n.click();return true;},settle:3000,findWait:3000,confirm:8000});
  }
  // Telegram's own chat profile panel (forwarded user click): the header opens it.
  async function info(key){
    if(detect()!=='ready'||activeKey()!==key)return {ok:false,reason:'not-active'};
    const {info:target}=header();if(!target)return {ok:false,reason:'no-info'};
    target.click();
    return {ok:true};
  }
  // Telegram's own "new chat" button (New Group / New Channel / New Message menu), on a user click.
  async function compose(){
    if(detect()!=='ready')return {ok:false,reason:'not-ready'};
    const list=[...(left()?.querySelectorAll('.NewChatButton button,button[aria-label="Create new chat"],button[aria-label="New Message"]')||[])].filter(native);
    if(list.length!==1)return {ok:false,reason:'no-compose'};
    list[0].click();
    return {ok:true};
  }
  function read(){
    const state=detect();if(state!=='ready')return {state};
    // The open chat's header says "bot" under a bot's name.
    const here=activeKey();if(here&&here.charAt(1)!=='-'&&/^bot$/i.test(header().status)){bots.add(here);known.add(here);}
    const list=roster();
    return {state,entries:list.map(({link,...e})=>e),transcript:transcript(list),profile:{avatar:''}};
  }
  globalThis.YahooHubTelegram={id:'telegram',read,open,send,info,compose,more,detect};
  if(globalThis.chrome?.runtime?.id&&globalThis.YahooHubBridge)globalThis.YahooHubTelegram.bridge=globalThis.YahooHubBridge(globalThis.YahooHubTelegram);
})();
