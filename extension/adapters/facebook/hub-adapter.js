/* Facebook Messages source for Yahoo Hub. Reads the rendered thread list and the
   accessibility envelope of rendered messages; reuses YahooRetroActions for Send. */
(() => {
  const A=globalThis.YahooRetroActions,C=globalThis.YahooHubCompose;
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const native=n=>!n.closest('[data-yfr-owned]');
  const THREAD=/^\/messages\/(?:t|e2ee\/t)\/[^/]+/;
  function threadKey(href){try{const u=new URL(href,location.href);if(u.origin!==location.origin)return '';return u.pathname.match(THREAD)?.[0]||'';}catch{return '';}}
  function main(){const mains=[...document.querySelectorAll('[role="main"],main')];return mains.length===1?mains[0]:null;}
  function links(){
    const m=main();
    return [...document.querySelectorAll('a[href]')].filter(a=>native(a)&&!(m&&m.contains(a))&&threadKey(a.getAttribute('href'))&&a.closest('[role="navigation"],nav,[role="complementary"],[data-yfr-group-source]'));
  }
  function detect(){
    if(links().length&&main())return 'ready';
    return document.querySelector('input[name="pass"],#login_form,form[action*="login"]')?'login':'unrecognized';
  }
  function linkName(a){
    const title=a.querySelector('[data-yfr-role="contact-title"]')||a.querySelector('[dir="auto"]');
    return clean(title?.textContent||a.textContent.split('\n')[0]).slice(0,100);
  }
  function roster(){
    const seen=new Set(),out=[];
    for(const a of links()){
      const key=threadKey(a.getAttribute('href'));if(seen.has(key))continue;seen.add(key);
      const name=linkName(a);if(!name)continue;
      const img=a.querySelector('img'),label=a.getAttribute('aria-label')||'';
      const group=typeof globalThis.YahooRetroClassifyBuddy==='function'?globalThis.YahooRetroClassifyBuddy(a,false):'Chưa rõ trạng thái';
      out.push({link:a,key,name,group,unread:/Unread message|Tin nhắn chưa đọc|Chưa đọc/i.test(label+' '+a.textContent),avatar:img?.currentSrc||img?.src||''});
    }
    return out;
  }
  const activeKey=()=>location.pathname.match(THREAD)?.[0]||'';
  function messages(root){
    const history=root.querySelector('[role="log"]')||root.querySelector('[role="grid"]');if(!history)return [];
    const out=[];
    for(const article of history.querySelectorAll('[role="article"]')){
      if(!native(article))continue;
      // Only messages with Facebook's own accessibility envelope; unknown cards are skipped.
      const receipt=[...article.querySelectorAll('[aria-label]')].map(n=>n.getAttribute('aria-label')).find(l=>/^Enter, Message sent .+ by /i.test(l))||'';
      const match=receipt.match(/^Enter, Message sent (.+?) by ([^:]+)(?::|$)/i);if(!match)continue;
      const sender=match[2].trim(),me=/^You$/i.test(sender);
      // Facebook's own notice at the start of encrypted chats ("a participant", dated 1970).
      if(/\b1970\b/.test(match[1]))continue;
      const body=[...article.querySelectorAll('[aria-roledescription="message"],[role="group"][aria-label^="At "]')].find(native)||article;
      const time=typeof globalThis.YahooRetroDisplayTime==='function'?globalThis.YahooRetroDisplayTime(match[1]):match[1];
      // Call cards: a heading (Missed audio call…) and the call's time, which is not message text.
      const call=callName([...body.querySelectorAll('h3')].filter(native).map(h=>clean(h.textContent)).find(t=>CALL.test(t))||'');
      if(call){out.push({id:article.id||'a'+out.length,from:me?'me':'peer',sender:me?'':sender,text:call,time,kind:'call',images:[]});continue;}
      const lines=[...body.querySelectorAll('[dir="auto"]')].filter(n=>native(n)&&!n.closest('button,[role="button"],a,h1,h2,h3,h4,h5,h6,[role="heading"]')&&![...n.querySelectorAll('[dir="auto"]')].length).map(n=>textOf(n).trim()).filter(Boolean);
      // Facebook's delivery line under your last message (Sent, Seen…) is not part of the message.
      while(me&&lines.length&&STATUS_LINE.test(lines.at(-1)))lines.pop();
      const text=lines.join('\n'),images=photos(body,sender);
      const kind=text?'text':images.length?'image':body.querySelector('img,video')?'image':'other';
      out.push({id:article.id||'a'+out.length,from:me?'me':'peer',sender:me?'':sender,text,time,kind,images});
    }
    // Pictures only for the latest messages: each snapshot crosses to the Zalo tab.
    for(const m of out.slice(0,-PHOTO_MESSAGES))m.images=[];
    return out;
  }
  // "Sent", "Sent 1m ago", "Seen by Lan", "Đã xem 5 phút trước"…
  const STATUS_LINE=/^(Sending|Sent|Delivered|Seen|Đang gửi|Đã gửi|Đã nhận|Đã xem)(\s+(\d+\s*\S+\s+(ago|trước)|just now|vừa xong|by .+|bởi .+))?$/i;
  const CALL=/^(Missed )?(audio|video|voice) call$|^(Cuộc gọi|Bạn đã bỏ lỡ cuộc gọi)/i;
  function callName(t){
    if(!t||!/^(Missed )?(audio|video|voice) call$/i.test(t))return t;
    const video=/video/i.test(t);
    return (video?'Cuộc gọi video':'Cuộc gọi thoại')+(/^Missed/i.test(t)?' nhỡ':'');
  }
  // Facebook draws emoji as small pictures inside the text: read them back as their characters.
  function textOf(n){let s='';for(const c of n.childNodes){if(c.nodeType===3)s+=c.textContent;else if(c.nodeType===1)s+=c.tagName==='IMG'?(c.getAttribute('alt')||''):textOf(c);}return s;}
  // Photos of a message, as shown on this page: an https picture address as is; a picture decrypted
  // in the page (end-to-end encrypted chats: data: or blob:, often hundreds of KB) as a small JPEG.
  const PHOTO_MESSAGES=15,thumbs=new Map();
  function photos(body,sender=''){
    const out=[];
    for(const img of body.querySelectorAll('img')){
      if(out.length>=4||!native(img)||!img.closest('[role="button"],a'))continue;
      // The sender's small profile picture sits inside the message too (alt = their name, 28px).
      if((sender&&clean(img.getAttribute('alt'))===sender)||(img.width>0&&img.width<40)||(img.height>0&&img.height<40))continue;
      const src=img.currentSrc||img.src||'';
      if(/^https:\/\/static\.[^/]*fbcdn\.net\//.test(src)||!img.complete||img.naturalWidth<40||img.naturalHeight<40)continue;
      const shown=/^https:/.test(src)?src:/^(data|blob):/.test(src)?thumb(img,src):'';
      if(shown)out.push(shown);
    }
    return out;
  }
  function thumb(img,src){
    const id=src.length+':'+src.slice(-80);if(thumbs.has(id))return thumbs.get(id);
    let data='';
    try{
      const scale=Math.min(1,240/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);data=canvas.toDataURL('image/jpeg',0.72);
    }catch{}
    thumbs.set(id,data);if(thumbs.size>60)thumbs.delete(thumbs.keys().next().value);
    return data;
  }
  function editor(root){const n=[...root.querySelectorAll('[contenteditable="true"][role="textbox"],textarea')].filter(native);return n.length===1?n[0]:null;}
  function transcript(list){
    const key=activeKey(),root=main();if(!key||!root)return null;
    const title=list.find(e=>e.key===key)?.name||A.peerName(root);
    return {key,title,status:A.presence(root)==='Available'?'Đang hoạt động':'Facebook',canSend:!!editor(root),messages:messages(root)};
  }
  async function open(key){
    if(detect()!=='ready')return {ok:false,reason:'not-ready'};
    if(activeKey()===key)return {ok:true};
    const hits=roster().filter(e=>e.key===key);
    if(hits.length!==1)return {ok:false,reason:'not-visible'};
    hits[0].link.click();
    return await C.wait(()=>activeKey()===key,3000)?{ok:true}:{ok:false,reason:'not-opened'};
  }
  async function send(key,text){
    if(!text)return {ok:false,reason:'empty'};
    const root=main();
    if(detect()!=='ready'||!root||activeKey()!==key)return {ok:false,reason:'not-active'};
    // Facebook swaps its Like button for "Press enter to send" only after the text is in, and a
    // background tab renders slowly: wait longer before giving up.
    return C.send({editor:editor(root),text,findSend:()=>A.resolve(root,'send'),press:n=>{n.click();return true;},settle:3000,findWait:3000,confirm:8000});
  }
  // The user's own picture from Facebook's account button (the "my avatar" of Yahoo windows).
  function profile(){
    const pics=[...document.querySelectorAll('svg[aria-label="Your profile"] image,svg[aria-label="Trang cá nhân của bạn"] image')].filter(native);
    return {avatar:pics.length?(pics[0].getAttribute('xlink:href')||pics[0].getAttribute('href')||''):''};
  }
  // Marks Facebook's own call button for the user to click: Facebook opens the call in a pop-up,
  // which only a click on this page may open. Nothing is clicked here.
  let mark=null;
  function unmark(){if(!mark)return;clearTimeout(mark.timer);mark.target.style.outline=mark.outline;mark.target.style.outlineOffset=mark.offset;mark.tip.remove();mark=null;}
  async function call(key,media){
    const root=main();
    if(detect()!=='ready'||!root||activeKey()!==key)return {ok:false,reason:'not-active'};
    const target=A.resolve(root,media);if(!target)return {ok:false,reason:'no-call'};
    unmark();
    const tip=document.createElement('div'),r=target.getBoundingClientRect();
    tip.dataset.yfrOwned='';tip.setAttribute('role','status');
    tip.textContent=media==='video'?'Your Messenger: bấm nút này để gọi video':'Your Messenger: bấm nút này để gọi thoại';
    tip.style.cssText='position:fixed;z-index:2147483647;top:'+Math.round(r.bottom+8)+'px;left:'+Math.max(8,Math.round(r.right-260))+'px;width:252px;padding:6px 8px;border:1px solid #c8a400;border-radius:4px;background:#fff8c8;color:#3a2c00;font:12px Tahoma,Arial,sans-serif;box-shadow:0 2px 6px #0004;pointer-events:none';
    mark={target,tip,outline:target.style.outline,offset:target.style.outlineOffset,timer:setTimeout(unmark,15000)};
    target.style.outline='3px solid #f2b600';target.style.outlineOffset='2px';document.body.append(tip);
    target.addEventListener('click',unmark,{once:true});
    return {ok:true};
  }
  // Facebook's own conversation information panel (forwarded user click); left open if it already is.
  async function info(key){
    const root=main();
    if(detect()!=='ready'||!root||activeKey()!==key)return {ok:false,reason:'not-active'};
    const target=A.resolve(root,'info');if(!target)return {ok:false,reason:'no-info'};
    if(target.getAttribute('aria-expanded')!=='true')target.click();
    return {ok:true};
  }
  function read(){
    const state=detect();if(state!=='ready')return {state};
    const list=roster();
    return {state,entries:list.map(({link,...e})=>e),transcript:transcript(list),profile:profile()};
  }
  // Facebook's own New message, where a group starts by adding several people (forwarded user click).
  async function compose(){
    if(detect()!=='ready')return {ok:false,reason:'not-ready'};
    const target=A.resolve(document,'newMessage');if(!target)return {ok:false,reason:'no-compose'};
    target.click();
    return await C.wait(()=>/^\/messages\/new\/?$/.test(location.pathname),3000)?{ok:true}:{ok:false,reason:'not-opened'};
  }
  globalThis.YahooHubFacebook={id:'facebook',read,open,send,call,compose,info,detect};
  if(globalThis.chrome?.runtime?.id&&globalThis.YahooHubBridge)globalThis.YahooHubFacebook.bridge=globalThis.YahooHubBridge(globalThis.YahooHubFacebook);
})();
