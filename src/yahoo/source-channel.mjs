/* An app that publishes from its own tab (Facebook Messages, Telegram Web) in the Yahoo desktop on
   Zalo: a buddy window fed by that tab (adapters/<id> + shared/bridge.js, through the service-worker
   router) and Yahoo chat windows that mirror the conversation open in that tab. Sends go through the
   app's native editor and Send button on that tab, only on a trusted Enter or click.
   facebook-channel.mjs and telegram-channel.mjs give each app its words, colours and groups. */
import {YM_ASSET} from './env.mjs';
import {whenDesktop} from './desktop-bridge.mjs';
import {createChannelWindow} from './channel-window.mjs';
import {appendLinked} from './chat-links.mjs';
import {joinHub,post,request as ask,connected} from './hub-port.mjs';
import EMOTICONS from '../../vendor/yahoo-v2/client/emoticons.mjs';

// Status an adapter gives the open conversation when the app says the person is active now.
export const ACTIVE='Đang hoạt động';
const PLACEHOLDER={image:'[Ảnh]',sticker:'[Sticker]',file:'[Tệp]',call:'[Cuộc gọi]',link:'[Liên kết]',other:'[Nội dung khác]'};
// Yahoo chat controls that have no counterpart in the app stay visible but disabled.
const UNSUPPORTED=['activities','sounds-open','format-toggle','buzz','attach-file','my-avatar-preview','conversation-menu','edit-menu','view-menu','actions-menu','chat-help'];
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
function face(){const d=el('div','default-avatar');d.append(el('i'),el('i'),el('b'));return d;}
function picture(src){
  if(!src)return face();
  const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.src=src;img.addEventListener('error',()=>img.replaceWith(face()),{once:true});return img;
}
// The default words, for an app named `label` whose tab is `tab` (e.g. "tab Facebook Messages").
function words({label,tab,oldTab}){
  return {
    reasons:{
      'no-source':'Chưa mở '+tab+'. Bấm dòng trạng thái trong danh sách '+label+' để mở. '+oldTab,
      'no-hub':'Mất kết nối với plugin. Đang thử lại…',
      'reloaded':'Plugin vừa được cập nhật. Tải lại trang (F5) để dùng tiếp.',
      'not-ready':label+' chưa sẵn sàng (chưa đăng nhập?).',
      'not-visible':'Hội thoại không còn trong danh sách đang hiển thị trên '+label+'.',
      'ambiguous':'Có nhiều hội thoại trùng tên trên '+label+'; hãy mở trực tiếp trên '+label+'.',
      'not-opened':label+' chưa mở được hội thoại này.',
      'not-active':'Hội thoại này không còn mở trên '+label+'. Bấm “Nối lại”.',
      'draft-not-empty':'Ô soạn tin trên '+label+' đang có bản nháp. Hãy gửi hoặc xóa nó trên '+label+'. Chưa gửi.',
      'editor-mismatch':label+' không nhận nội dung. Chưa gửi.',
      'no-editor':'Không tìm thấy ô soạn tin của '+label+'. Chưa gửi.',
      'no-send':'Không tìm thấy đúng một nút Gửi của '+label+'. Chưa gửi.',
      'attach-failed':label+' không nhận ảnh. Chưa gửi.',
      'attach-unconfirmed':label+' chưa nhận xong ảnh nên chưa gửi. Ảnh có thể đang nằm trong ô soạn tin trên tab '+label+': xem lại ở đó trước khi gửi lại.',
      'unconfirmed':'Đã bấm Gửi nhưng chưa xác nhận được. Kiểm tra trên '+label+'; plugin không gửi lại.',
      'timeout':label+' chưa trả lời kịp ('+tab+' chạy nền có thể chậm). Nếu vừa gửi tin, hãy xem lại trên '+label+' trước khi gửi lại.',
      'unknown-key':'Hội thoại không còn trong danh sách '+label+'.',
      'no-call':label+' không có nút gọi cho hội thoại này.',
      'no-info':'Không thấy nút Thông tin hội thoại trên tab '+label+'.',
      'no-compose':'Không thấy nút tạo hội thoại mới trên tab '+label+'.'
    },
    status:{closed:'Chưa mở '+tab+' — bấm để mở (tab chạy nền). '+oldTab,login:label+' chưa đăng nhập — bấm để xem tab',unrecognized:'Tab '+label+' không ở trang chat — bấm để xem tab',connecting:'Đang kết nối '+label+'…'}
  };
}

// app: {id, label, icon, tab, oldTab, hint, search, groups:{group:'Group', business:'Page'|null},
//  businessTitle, calls (true: video/voice buttons point at the app's own), photosClass, reasons, status}
export function hostSource(root,app){
  const P=globalThis.YahooHubProtocol,REG=globalThis.YahooHubRegistry,runtime=globalThis.chrome?.runtime;
  if(!P||!REG?.source(app.id)||!runtime?.connect)return null;
  const {id,label,icon}=app,base=words(app),REASONS={...base.reasons,...app.reasons},STATUS={...base.status,...app.status};
  const GROUP=app.groups?.group||'Group',FRIENDS=app.groups?.friends||'Friends',BUSINESS=app.groups?.business||null;
  const reasonText=(reason,detail)=>(REASONS[reason]||label+': không thực hiện được ('+(reason||'lỗi')+').')+(detail?' ('+detail+')':'');
  const list=createChannelWindow(root,{id,label,icon,hint:app.hint,searchPlaceholder:app.search});
  let source={connected:false,state:'closed',entries:[],transcript:null},painted='',serial=0;
  const windows=new Map(),creating=new Map(),closedGroups=new Set();
  const request=message=>ask({...message,source:id});
  // Pictures pasted in a chat window go out through the app's own composer (adapters that say so).
  const uploads=!!REG.source(id)?.uploads,MAX_PICTURE=5*1024*1024;

  function onSources(sources){
    source=sources.find(s=>s.id===id)||source;
    // A new or reloaded tab may have more chats to load again.
    if(!source.connected||source.state!=='ready')exhausted=moreFailed=false;
    list.setProfile(source.profile?.avatar||icon);paint();for(const w of windows.values())render(w);
  }

  /* ---- buddy window: Yahoo contact rows grouped like the app's own list ---- */
  function row(e){
    const b=el('button','contact-row'+(e.group==='Online'?' online':''));b.type='button';
    b.setAttribute('aria-label','Chat với '+e.name+' trên '+label);b.dataset.ymKey=e.key;
    const pic=el('span','tiny-avatar');pic.append(picture(e.avatar));
    const text=el('span','contact-text'),first=el('span','contact-first');
    // A business (Facebook Page) has no online status; Chưa đọc lists it apart (buddy-tabs.mjs).
    const business=!!BUSINESS&&e.group===BUSINESS;if(business)b.dataset.ymBusiness=BUSINESS;
    if(!business)first.append(el('span','presence-dot'+(e.group==='Online'?'':' offline')));
    first.append(el('b','',e.name));
    if(e.group===GROUP)first.append(el('span','virtual-badge group-badge','Nhóm'));
    if(business)first.append(el('span','virtual-badge group-badge',BUSINESS));
    text.append(first,el('small','',e.time||(e.group==='Online'?ACTIVE:business?app.businessTitle||BUSINESS:label)));
    b.append(pic,text);
    if(e.unread)b.append(el('span','contact-unread','●'));
    // ymActivate: the combined list's "Chưa đọc" copy hands over the user's own click.
    b.ymActivate=ev=>{if(ev?.isTrusted)openWindow(e.key,e.name,e.avatar);};
    b.addEventListener('click',b.ymActivate);
    return b;
  }
  function statusRow(){
    const state=source.connected?source.state:'closed',b=el('button','ym-channel-status'+(state==='connecting'?' ym-channel-loading':''),STATUS[state]||STATUS.unrecognized);b.type='button';
    b.addEventListener('click',ev=>{if(ev.isTrusted)post({type:source.connected?'reveal':'launch',source:id});});
    return b;
  }
  /* The list as Zalo's: groups first, then friends (online or not, in the app's order), then the
     business accounts (Facebook Pages, Telegram bots) last, like Zalo's OA. Groups and friends show
     a page at a time; "Tải thêm" shows the next page, and asks the app's tab for more chats once
     the ones it has sent are all shown. Rows past the page stay in the list, hidden, so the search
     and "Chưa đọc" still find them. */
  const PAGE={group:5,friends:20,...app.pages};
  const shown={group:PAGE.group,friends:PAGE.friends};
  let loading=false,exhausted=false,moreFailed=false;
  async function loadMore(page,members){
    if(loading)return;
    shown[page]+=PAGE[page];
    if(members<shown[page]&&!exhausted){
      loading=true;moreFailed=false;paint();
      const r=await request({type:'more'});
      loading=false;if(r.reason==='end')exhausted=true;else if(!r.ok)moreFailed=true;
    }
    paint();
  }
  function paint(){
    const ready=source.connected&&source.state==='ready';
    // Snapshots arrive on every change of the app's page; rebuild only when the list changed.
    // The open conversation's header says "active now" more reliably than the list's dot guess:
    // that person is Online here too, so the list and the chat window agree.
    const live=source.transcript,entries=source.entries.map(e=>e.group!==GROUP&&e.group!==BUSINESS&&live?.key===e.key&&live.status===ACTIVE?{...e,group:'Online'}:e);
    const signature=JSON.stringify([source.connected,source.state,ready?entries:[],shown,loading,exhausted,moreFailed]);
    if(signature===painted)return;
    painted=signature;
    if(!ready){list.slot.replaceChildren(statusRow());return;}
    if(!entries.length){list.slot.replaceChildren(el('div','ym-channel-hint','Chưa thấy hội thoại nào trên '+label+'.'));return;}
    const sections=[
      {g:GROUP,page:'group',more:'Tải thêm nhóm',members:entries.filter(e=>e.group===GROUP)},
      {g:FRIENDS,page:'friends',more:'Tải thêm bạn bè',members:entries.filter(e=>e.group!==GROUP&&e.group!==BUSINESS)},
      {g:BUSINESS,members:BUSINESS?entries.filter(e=>e.group===BUSINESS):[]}
    ];
    const groups=[];
    for(const{g,page,more,members}of sections){
      const canLoad=!!page&&!exhausted;
      if(!members.length&&!canLoad)continue;
      const limit=page?shown[page]:Infinity,visible=Math.min(limit,members.length);
      const d=el('details','contact-group');d.open=!closedGroups.has(g);d.dataset.ymSection=page||'business';
      d.addEventListener('toggle',()=>{if(d.open)closedGroups.delete(g);else closedGroups.add(g);});
      const rows=members.map((e,i)=>{const r=row(e);if(i>=limit){r.hidden=true;r.dataset.ymPaged='';}return r;});
      d.append(el('summary','',g+' ('+(visible<members.length?visible+'/':'')+members.length+')'),...rows);
      if(page&&(members.length>limit||canLoad)){
        const b=el('button','classic-button ym-more',loading?'Đang tải…':moreFailed&&members.length<=limit?'Thử tải lại':more);b.type='button';b.disabled=loading;
        if(moreFailed)b.title=label+' chưa tải thêm được hội thoại. Thử lại sau.';
        b.onclick=ev=>{if(ev?.isTrusted)return loadMore(page,members.length);};
        d.append(b);
      }
      groups.push(d);
    }
    list.slot.replaceChildren(...groups);
  }

  /* ---- chat windows: a copy of Yahoo's own chat window, mirroring the app's tab ---- */
  async function createWindow(key,name,avatar){
    const desktop=await whenDesktop(),template=root.querySelector('#chat-window');
    const node=template.cloneNode(true),wid=id+'-chat-'+(++serial);
    node.id=wid;node.dataset.window=wid;node.dataset.ymChannel=id;node.dataset.ymChatKey=key;
    node.classList.add('conversation-window','ym-'+id+'-chat','ym-source-chat');node.classList.remove('maximized','window-moved','shake','unread-attention');node.hidden=false;
    for(const n of node.querySelectorAll('[id]')){n.dataset.chatControl=n.id;n.removeAttribute('id');}
    const q=name=>node.querySelector('[data-chat-control="'+name+'"]');
    node.querySelector('[data-chat-control=chat-content]').classList.add('conversation-content');q('chat-tabs')?.remove();
    for(const control of UNSUPPORTED){const n=q(control);if(n){n.disabled=true;n.title='Không dùng được với '+label;}}
    // Text formatting too: these apps' messages carry plain text from here.
    for(const n of q('format-options').querySelectorAll('button,select')){n.disabled=true;n.title=label+' không hỗ trợ chữ đậm, nghiêng, gạch chân, màu hay phông chữ';}
    q('emoticons').hidden=true;q('buzz-effect').hidden=true;q('group-members-open').hidden=true;q('peer-blog-link').hidden=true;
    q('peer-dot').className='presence-dot';q('peer-avatar').replaceChildren(picture(avatar));q('peer-avatar-name').textContent=name;
    q('chat-statusbar').textContent='Enter để gửi qua tab '+label+' · Shift + Enter để xuống dòng';
    const reveal=el('button','mini-button ym-reveal','Xem trên '+label);reveal.type='button';q('peer-status').after(reveal);
    const notice=el('div','ym-mirror-notice'),noticeText=el('span'),rejoin=el('button','classic-button','Nối lại');
    notice.setAttribute('role','status');notice.hidden=true;rejoin.type='button';rejoin.hidden=true;notice.append(noticeText,rejoin);
    node.querySelector('.peer-status').after(notice);
    const input=q('message-input');input.value='';input.maxLength=P.LIMITS.text;input.placeholder='Gõ tin nhắn gửi qua '+label+'…';
    const width=Math.min(520,innerWidth-16),offset=(windows.size%4)*32;
    node.style.cssText='left:'+Math.max(8,Math.min(360+offset,innerWidth-width-8))+'px;top:'+Math.min(70+offset,Math.max(8,innerHeight-420))+'px;width:'+width+'px;';
    const task=el('button','xp-task ym-channel-task'),taskIcon=el('img');task.type='button';taskIcon.alt='';taskIcon.src=icon;task.append(taskIcon,el('span','',name));
    root.querySelector('.xp-tasks')?.append(task);root.append(node);
    const w={key,name,id:wid,node,task,q,desktop,input,notice,noticeText,rejoin,messages:q('messages'),send:q('send'),last:null,signature:'',sending:false,error:'',opened:false,openFailed:false};
    desktop.register(wid,node,task,{minimum:{width:360,height:360},onRestore:()=>task.classList.remove('has-new-message')});
    node.addEventListener('pointerdown',()=>task.classList.remove('has-new-message'));
    q('chat-minimize').addEventListener('click',()=>desktop.minimize(wid));
    q('chat-maximize').addEventListener('click',()=>node.classList.toggle('maximized'));
    q('chat-close').addEventListener('click',()=>close(w));
    // Conversation info (as on the Zalo windows): the app's own panel, opened on its tab.
    for(const control of ['toggle-chat-avatar','avatars-open']){const b=q(control);b.title='Thông tin hội thoại · mở trên tab '+label;b.setAttribute('aria-label','Thông tin hội thoại');b.addEventListener('click',e=>{if(e.isTrusted)info(w);});}
    emoticons(w);
    reveal.addEventListener('click',e=>{if(e.isTrusted)post({type:'reveal',source:id});});
    // IMVironments: a background on this computer only (shared store with the Zalo windows).
    q('environment').title='Nền khung chat · chỉ hiện trên máy này, người kia không thấy';
    q('environment').addEventListener('click',e=>{if(e.isTrusted)globalThis.YahooImv?.menu(e.currentTarget,id+':'+key);});
    for(const[control,media,callLabel]of[['video-call','video','gọi video'],['voice-call','voice','gọi thoại']]){
      const b=q(control);
      if(!app.calls){b.title='Chưa gọi được '+label+' từ YM!';continue;}
      b.title='Mở tab '+label+' và chỉ nút '+callLabel+' để bạn bấm';b.addEventListener('click',e=>{if(e.isTrusted)call(w,media,callLabel);});
    }
    rejoin.addEventListener('click',e=>{if(e.isTrusted)openWindow(key,w.name);});
    q('message-form').addEventListener('submit',e=>{e.preventDefault();if(e.isTrusted)submit(w);});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(e.isTrusted&&!e.repeat)submit(w);}});
    input.addEventListener('input',()=>{w.send.disabled=!canSend(w)||!sendable(w);});
    // Pasted pictures wait above the text box, like the app's own "1 ảnh · Xoá tất cả".
    w.images=[];w.tray=el('div','ym-paste-tray');w.tray.hidden=true;q('message-form').before(w.tray);
    input.addEventListener('paste',e=>paste(w,e));
    return w;
  }
  function paste(w,e){
    const files=[...(e.clipboardData?.files||[])].filter(f=>/^image\//.test(f.type));
    if(!files.length)return;
    e.preventDefault();
    if(!uploads){setNotice(w,label+' chưa nhận ảnh dán từ YM!. Hãy gửi ảnh trên tab '+label+'.');return;}
    void addPictures(w,files);
  }
  const readData=file=>new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(typeof r.result==='string'?r.result:'');r.onerror=()=>resolve('');r.readAsDataURL(file);});
  async function addPictures(w,files){
    let problem='';
    for(const f of files){
      if(w.images.length>=P.LIMITS.uploads){problem='Mỗi lần gửi tối đa '+P.LIMITS.uploads+' ảnh.';break;}
      if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type)){problem='Chỉ gửi được ảnh PNG, JPEG, WebP hoặc GIF từ YM!.';continue;}
      if(f.size>MAX_PICTURE){problem='Ảnh lớn hơn 5 MB: hãy gửi trên tab '+label+'.';continue;}
      const data=await readData(f);
      if(P.uploads([data]).length)w.images.push(data);else problem='Không đọc được ảnh vừa dán.';
    }
    if(windows.get(w.key)!==w)return;
    paintTray(w);render(w);if(problem)setNotice(w,problem);
  }
  function paintTray(w){
    w.tray.hidden=!w.images.length;if(!w.images.length){w.tray.replaceChildren();return;}
    const head=el('div','ym-paste-head'),clear=el('button','mini-button','Xoá tất cả'),list=el('div','ym-paste-list');
    clear.type='button';clear.addEventListener('click',()=>{w.images=[];paintTray(w);render(w);});
    head.append(el('b','',w.images.length+' ảnh'),el('span','',' · gửi qua tab '+label),clear);
    w.images.forEach((data,i)=>{
      const item=el('span','ym-paste-item'),img=el('img'),remove=el('button','ym-paste-remove','×');
      img.alt='Ảnh '+(i+1);img.src=data;remove.type='button';remove.title='Bỏ ảnh này';remove.setAttribute('aria-label','Bỏ ảnh '+(i+1));
      remove.addEventListener('click',()=>{w.images.splice(i,1);paintTray(w);render(w);});
      item.append(img,remove);list.append(item);
    });
    w.tray.replaceChildren(head,list);
  }
  // Yahoo's emoticon picker inserts the classic codes as text; the app shows them as typed.
  function emoticons(w){
    const grid=w.q('emoticon-grid'),panel=w.q('emoticons'),toggle=w.q('emoticons-toggle');
    const fill=()=>{if(grid.children.length)return;for(const emoji of EMOTICONS){const b=el('button');b.type='button';b.title=emoji.label+' '+emoji.code;const img=el('img');img.src=YM_ASSET+'assets/'+emoji.id+'.gif';img.alt=emoji.code;b.append(img);b.addEventListener('click',()=>{const {selectionStart:start,selectionEnd:end}=w.input;w.input.setRangeText(emoji.code,start,end,'end');w.input.focus();w.input.dispatchEvent(new Event('input'));panel.hidden=true;});grid.append(b);}};
    toggle.addEventListener('click',()=>{fill();panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
    w.q('close-emoticons').addEventListener('click',()=>{panel.hidden=true;});
    w.q('emoticon-search').addEventListener('input',()=>{fill();const text=w.q('emoticon-search').value.toLowerCase();for(const b of grid.children)b.hidden=!b.title.toLowerCase().includes(text);});
  }
  // A call is placed in the app's own pop-up, which only a click on its tab may open: the tab comes
  // forward with its call button marked, and the user clicks it there.
  async function call(w,media,callLabel){
    if(!live(w)){setNotice(w,'Mở lại hội thoại này trên '+label+' trước khi gọi.',{rejoin:true});return;}
    const r=await request({type:'call',key:w.key,media});
    if(windows.get(w.key)!==w)return;
    w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)setNotice(w,'Đã chuyển sang tab '+label+': bấm nút '+callLabel+' đang được tô vàng để gọi.');
  }
  async function info(w){
    if(!live(w)){setNotice(w,'Mở lại hội thoại này trên '+label+' để xem thông tin.',{rejoin:true});return;}
    const r=await request({type:'info',key:w.key});
    if(windows.get(w.key)!==w)return;
    w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)setNotice(w,'Đã chuyển sang tab '+label+': thông tin hội thoại đang mở ở cột bên phải.');
  }
  function close(w){w.desktop.unregister(w.id);w.node.remove();w.task.remove();windows.delete(w.key);}
  const live=w=>!!(source.connected&&source.state==='ready'&&source.transcript?.key===w.key);
  const canSend=w=>live(w)&&source.transcript.canSend&&connected()&&!w.sending;
  const sendable=w=>!!P.outgoing(w.input.value)||w.images.length>0;
  function setNotice(w,text,{rejoin=false}={}){w.noticeText.textContent=text;w.rejoin.hidden=!rejoin;w.notice.hidden=!text;}
  function line(m,w){
    const n=el('div','message-line'),mine=m.from==='me';
    n.append(el('span','sender'+(mine?' me':''),(mine?'Bạn':m.sender||w.name)+':'));
    const pics=m.images||[];
    if(m.kind==='text')n.append(appendLinked(el('span','message-body'),m.text));
    else if(m.kind==='call')n.append(el('span','message-body ym-placeholder','📞 '+(m.text||'Cuộc gọi')));
    else if(!pics.length)n.append(el('span','message-body ym-placeholder',PLACEHOLDER[m.kind]+(m.text?' '+m.text:'')+' — xem trên '+label));
    else if(m.text)n.append(appendLinked(el('span','message-body'),m.text));
    // Photos as the app's tab shows them (small copies of pictures held by that page).
    if(pics.length){const box=el('span','ym-src-photos'+(app.photosClass?' '+app.photosClass:''));for(const src of pics){const img=el('img');img.alt='Ảnh';img.title='Ảnh từ '+label;img.referrerPolicy='no-referrer';img.src=src;img.addEventListener('error',()=>img.replaceWith(el('span','ym-placeholder','[Ảnh] — xem trên '+label)),{once:true});img.addEventListener('load',()=>{if(w.messages.scrollHeight-w.messages.scrollTop-w.messages.clientHeight<img.height+40)w.messages.scrollTop=w.messages.scrollHeight;},{once:true});box.append(img);}n.append(box);}
    if(m.time)n.append(el('time','',m.time));
    return n;
  }
  function render(w){
    const t=source.transcript,on=live(w);
    if(on)w.last=t;
    // The app may show the conversation after the open request timed out: drop that error.
    if(on&&w.openFailed){w.openFailed=false;w.opened=true;w.error='';}
    const shown=w.last?.messages||[],signature=JSON.stringify(shown);
    if(signature!==w.signature){
      const stick=w.messages.scrollTop+w.messages.clientHeight>=w.messages.scrollHeight-24,first=!w.signature;
      w.signature=signature;
      w.messages.replaceChildren(...(shown.length?shown.map(m=>line(m,w)):[el('div','empty-chat',on?'Chưa có tin nhắn đang hiển thị.':'Đang chờ nội dung từ '+label+'…')]));
      if(stick||first)w.messages.scrollTop=w.messages.scrollHeight;
      if(!first&&shown.length&&!w.desktop.focused(w.id))w.task.classList.add('has-new-message');
    }
    if(w.last?.title)w.name=w.last.title;
    w.q('chat-title').textContent=w.name+' — '+label;w.q('peer-name').textContent=w.name;w.task.querySelector('span').textContent=w.name;
    w.node.setAttribute('aria-label','Trò chuyện '+label+' với '+w.name);
    w.q('peer-status').textContent=on?(t.status||label):'';
    // YM!'s yellow face only when the app says the person is active now; grey otherwise.
    w.q('peer-dot').className='presence-dot'+(on&&t.status===ACTIVE?'':' offline');
    w.input.disabled=!on;w.send.disabled=!canSend(w)||!sendable(w);
    w.q('toggle-chat-avatar').disabled=w.q('avatars-open').disabled=!on;
    w.q('video-call').disabled=w.q('voice-call').disabled=!on||!app.calls;
    w.messages.dataset.imvironment=globalThis.YahooImv?.get(id+':'+w.key)||'classic';
    const mine=source.profile?.avatar||'';if(w.avatar!==mine){w.avatar=mine;w.q('my-avatar-preview').replaceChildren(picture(mine));}
    if(w.error)setNotice(w,w.error,{rejoin:!on});
    else if(!source.connected)setNotice(w,'Chưa mở '+app.tab+'.');
    else if(!on&&w.opened)setNotice(w,'Tab '+label+' đang mở hội thoại khác.',{rejoin:true});
    else if(on&&!t.canSend)setNotice(w,'Không gửi được tin trong hội thoại này từ YM!');
    else setNotice(w,'');
  }
  async function openWindow(key,name,avatar=''){
    let w=windows.get(key);
    if(!w){
      // Two quick clicks share one window: the first click's creation is awaited by both.
      if(!creating.has(key))creating.set(key,createWindow(key,name,avatar).then(made=>{windows.set(key,made);creating.delete(key);return made;}));
      w=await creating.get(key);
    }
    w.desktop.restore(w.id,false);w.error='';render(w);setNotice(w,'Đang mở hội thoại trên '+label+'…');
    const r=await request({type:'open',key});
    if(windows.get(key)!==w)return;
    w.opened=r.ok;w.openFailed=!r.ok;w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)w.input.focus({preventScroll:true});
  }
  async function submit(w){
    const text=P.outgoing(w.input.value),images=[...w.images];if(!text&&!images.length||!canSend(w))return;
    w.sending=true;w.error='';render(w);
    if(images.length)setNotice(w,'Đang gửi '+images.length+' ảnh qua tab '+label+'…');
    const r=await request({type:'send',key:w.key,text,...(images.length?{images}:{})});
    w.sending=false;
    if(r.ok){w.input.value='';w.images=w.images.filter(data=>!images.includes(data));paintTray(w);}else w.error=reasonText(r.reason,r.detail);
    if(windows.get(w.key)===w)render(w);
  }

  // Until the app's tab publishes the user's picture: the channel logo.
  list.setProfile(icon);
  globalThis.YahooImv?.onChange(()=>{for(const w of windows.values())render(w);});
  joinHub(runtime,onSources);paint();
  return {buddies:list,mount:list.mount,setProfile:list.setProfile,get state(){return source;},windows,openWindow,submit:key=>windows.has(key)&&submit(windows.get(key)),
    call:(key,media)=>app.calls&&windows.has(key)&&call(windows.get(key),media,media==='video'?'gọi video':'gọi thoại'),info:key=>windows.has(key)&&info(windows.get(key)),
    // The app's own "new conversation" (pick several people for a group), on its tab brought forward.
    compose:()=>request({type:'compose'})};
}
