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
      let group=typeof globalThis.YahooRetroClassifyBuddy==='function'?globalThis.YahooRetroClassifyBuddy(a,false):'Chưa rõ trạng thái';
      if(group!=='Group'&&isPage(key))group='Page';
      out.push({link:a,key,name,group,unread:/Unread message|Tin nhắn chưa đọc|Chưa đọc/i.test(label+' '+a.textContent),avatar:img?.currentSrc||img?.src||''});
    }
    return out;
  }
  const activeKey=()=>location.pathname.match(THREAD)?.[0]||'';
  // Facebook Pages (shops, brands, bots) look like people in Facebook's list: same row, no badge.
  // As observed on facebook.com/messages: a chat with a person is end-to-end encrypted
  // (/messages/e2ee/t/…) or, when older, numbered with the person's account id (1000…, 15 digits);
  // a Page's chat is neither. The conversation open on the page settles it: a Page has "Page
  // options" in its header, a person has call buttons. What was seen is kept for this page's life.
  const seen=new Map();
  function isPage(key){
    if(seen.has(key))return seen.get(key)==='Page';
    if(/^\/messages\/e2ee\//.test(key))return false;
    const id=key.match(/^\/messages\/t\/(\d{15,16})$/)?.[1];
    return !!id&&!/^1000\d{11}$/.test(id);
  }
  function learn(root){
    const key=activeKey();if(!key||!root)return;
    if(root.querySelector('[aria-label="Page options"],[aria-label="Tùy chọn Trang"]'))seen.set(key,'Page');
    else if(A?.resolve?.(root,'voice')||A?.resolve?.(root,'video'))seen.set(key,'person');
  }
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
      if(call){out.push({call:{id:article.id||'a'+out.length,from:me?'me':'peer',sender:me?'':sender,text:call,time,kind:'call',images:[]}});continue;}
      const lines=[...body.querySelectorAll('[dir="auto"]')].filter(n=>native(n)&&!n.closest('button,[role="button"],a,h1,h2,h3,h4,h5,h6,[role="heading"]')&&![...n.querySelectorAll('[dir="auto"]')].length).map(n=>textOf(n).trim()).filter(Boolean);
      // Facebook's delivery line under your last message (Sent, Seen…) is not part of the message.
      while(me&&lines.length&&STATUS_LINE.test(lines.at(-1)))lines.pop();
      // A shared link (Google Meet, a news page…): its address, not the preview card's picture.
      for(const url of outside(body))if(!bare(lines.join(' ')).includes(bare(url)))lines.push(url);
      // What Facebook's own envelope says was sent ("…by Hung: 👍"): the big Like and other pictures
      // Facebook draws as vector art have no text or photo of their own in the page.
      const said=clean(receipt.slice(match[0].length));
      out.push({id:article.id||'a'+out.length,me,sender,lines,time,body,said});
    }
    // Every snapshot crosses to the Zalo tab: photo addresses (short) for every message, pictures
    // copied out of the page (encrypted chats, tens of KB each) only for the latest messages.
    return out.map((m,i)=>{
      if(m.call)return m.call;
      const images=photos(m.body,m.sender,{encoded:i>=out.length-PHOTO_MESSAGES});
      const text=m.lines.join('\n')||(!images.length&&!media(m.body)?m.said:'');
      const kind=text?'text':images.length||media(m.body)?'image':'other';
      return {id:m.id,from:m.me?'me':'peer',sender:m.me?'':m.sender,text,time:m.time,kind,images};
    });
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
  // Where a link in a message goes: Facebook wraps outside addresses in l.facebook.com/l.php?u=….
  // '' for Facebook's own pages (a photo viewer, a profile) and anything not http(s).
  function target(a){
    try{
      let u=new URL(a.getAttribute('href')||'',location.href);
      if(/^l[m]?\.facebook\.com$/.test(u.hostname)&&u.searchParams.get('u'))u=new URL(u.searchParams.get('u'));
      if(!/^https?:$/.test(u.protocol)||/(^|\.)(facebook\.com|messenger\.com|fbcdn\.net)$/.test(u.hostname))return '';
      // Facebook's tracking parameter on outgoing links.
      u.searchParams.delete('fbclid');
      return u.href;
    }catch{return '';}
  }
  // An address as people write it: "meet.google.com/abc" and "https://meet.google.com/abc/" match.
  const bare=s=>s.toLowerCase().replace(/\bhttps?:\/\/(www\.)?/g,'').replace(/\/(?=\s|$)/g,'');
  function outside(body){return [...new Set([...body.querySelectorAll('a[href]')].filter(native).map(target).filter(Boolean))].slice(0,4);}
  // A video, or a picture that is not an emoji, an icon or the sender's small profile picture.
  function media(body){
    return [...body.querySelectorAll('img,video')].some(n=>native(n)&&(n.tagName==='VIDEO'||(!/^https:\/\/static\.[^/]*fbcdn\.net\//.test(n.currentSrc||n.src||'')&&!(n.width>0&&n.width<40)&&!(n.height>0&&n.height<40))));
  }
  // A background tab often has not loaded a photo yet when the snapshot is read, and a picture
  // finishing its load changes nothing the bridge watches: publish again once it has loaded.
  const waiting=new WeakSet();
  function later(img){if(waiting.has(img))return;waiting.add(img);img.addEventListener('load',()=>globalThis.YahooHubFacebook?.bridge?.publish?.(),{once:true});}
  // Size as drawn on the page, else as loaded, else as the markup says (0: not known).
  const size=(img,k)=>img[k]||(img.complete?img['natural'+k[0].toUpperCase()+k.slice(1)]:0)||+img.getAttribute(k)||0;
  function photos(body,sender='',{encoded=true}={}){
    const out=[];
    for(const img of body.querySelectorAll('img')){
      if(out.length>=4||!native(img))continue;
      // A link's preview picture (the Google Meet logo of a meeting link) is not a photo of the message.
      const a=img.closest('a[href]');if(a&&target(a))continue;
      const src=img.currentSrc||img.src||'',w=size(img,'width'),h=size(img,'height');
      // Emoji and Facebook's own icons; the sender's small profile picture (alt = their name, 28px).
      if(/^https:\/\/static\.[^/]*fbcdn\.net\//.test(src)||(sender&&clean(img.getAttribute('alt'))===sender))continue;
      if((w&&w<40)||(h&&h<40))continue;
      // A photo is a picture you can open (button or link), or one drawn large; Facebook's photo
      // addresses (scontent…fbcdn.net) count even before their size is known.
      const photoHost=/^https:\/\/[^/]*\.fbcdn\.net\//.test(src);
      if(!w&&!h&&!photoHost){later(img);continue;}
      if(!img.closest('[role="button"],a')&&!(w>=80&&h>=80)&&!photoHost)continue;
      if(/^https:/.test(src)){out.push(src);continue;}
      if(!/^(data|blob):/.test(src)||!encoded)continue;
      if(!img.complete||img.naturalWidth<40||img.naturalHeight<40){later(img);continue;}
      const shown=thumb(img,src);if(shown)out.push(shown);
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
    // Chrome slows a background tab's timers (to once a minute after a while), and Facebook moves to
    // the chat on them: wait longer there. A failure says where it stopped.
    if(await C.wait(()=>activeKey()===key,document.hidden?12000:3000))return {ok:true};
    return {ok:false,reason:'not-opened',detail:(activeKey()?'Facebook vẫn ở hội thoại khác':'Facebook chưa chuyển sang hội thoại')+(document.hidden?'; tab Facebook đang chạy nền':'')};
  }
  // A picture pasted in the Yahoo window, as a file for Facebook's composer.
  function file(data,i){
    const type=data.slice(5,data.indexOf(';')),bin=atob(data.slice(data.indexOf(',')+1)),bytes=new Uint8Array(bin.length);
    for(let j=0;j<bin.length;j++)bytes[j]=bin.charCodeAt(j);
    return new File([bytes],'yahoo-'+(i+1)+'.'+(type==='image/jpeg'?'jpg':type.slice(6)),{type});
  }
  // Facebook's own file input of this composer (behind its "Attach a file" button), as when the user
  // picks files there; without exactly one, a paste into its editor.
  function attach(root,files){
    const ed=editor(root);if(!ed)return false;
    const dt=new DataTransfer();for(const f of files)dt.items.add(f);
    let box=ed.parentElement,inputs=[];
    while(box&&root.contains(box)&&!inputs.length){inputs=[...box.querySelectorAll('input[type="file"]')].filter(n=>native(n)&&(!n.accept||/image/.test(n.accept)));box=box.parentElement;}
    if(inputs.length===1&&(files.length===1||inputs[0].multiple)){
      inputs[0].files=dt.files;
      inputs[0].dispatchEvent(new Event('input',{bubbles:true}));inputs[0].dispatchEvent(new Event('change',{bubbles:true}));
      return true;
    }
    ed.focus({preventScroll:true});
    ed.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));
    return true;
  }
  async function send(key,text,images=[]){
    if(!text&&!images.length)return {ok:false,reason:'empty'};
    const root=main();
    if(detect()!=='ready'||!root||activeKey()!==key)return {ok:false,reason:'not-active'};
    // Facebook swaps its Like button for "Press enter to send" only after the text (or a picture) is
    // in, and a background tab renders slowly: wait longer before giving up.
    return C.send({editor:editor(root),text,files:images.map(file),attach:files=>attach(root,files),findSend:()=>A.resolve(root,'send'),press:n=>{n.click();return true;},settle:3000,findWait:3000,confirm:images.length?30000:8000});
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
    learn(main());
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
