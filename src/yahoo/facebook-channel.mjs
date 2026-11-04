/* Facebook in the Yahoo desktop on Zalo: a dark-blue buddy window fed by the Facebook Messages
   tab (adapters/facebook + shared/bridge.js publish through the service-worker router) and
   Yahoo chat windows that mirror the conversation open in that tab. Sends go through the
   native Facebook editor and Send button of that tab, only on a trusted Enter or click. */
import {YM_ASSET} from './env.mjs';
import {whenDesktop} from './desktop-bridge.mjs';
import {createChannelWindow} from './channel-window.mjs';
import {appendLinked} from './chat-links.mjs';
import EMOTICONS from '../../vendor/yahoo-v2/client/emoticons.mjs';

const LABEL='Facebook';
// Status hub-adapter.js gives the open conversation when Facebook shows "Active now".
const ACTIVE='Đang hoạt động';
// A Messages tab open since before the plugin was installed, updated or reloaded runs without it
// until reloaded: the plugin has no access to find or reach that tab itself (no facebook.com host
// permission, so no way near Facebook's cookies either).
const OLD_TAB='Đã mở tab Messages từ trước khi cài hay cập nhật plugin? Bấm F5 trên tab đó.';
const REASONS={
  'no-source':'Chưa mở tab Facebook Messages. Bấm dòng trạng thái trong danh sách Facebook để mở. '+OLD_TAB,
  'no-hub':'Mất kết nối với plugin. Đang thử lại…',
  'reloaded':'Plugin vừa được cập nhật. Tải lại trang (F5) để dùng tiếp.',
  'not-ready':'Facebook chưa sẵn sàng (chưa đăng nhập?).',
  'not-visible':'Hội thoại không còn trong danh sách đang hiển thị trên Facebook.',
  'ambiguous':'Có nhiều hội thoại trùng tên trên Facebook; hãy mở trực tiếp trên Facebook.',
  'not-opened':'Facebook chưa mở được hội thoại này.',
  'not-active':'Hội thoại này không còn mở trên Facebook. Bấm “Nối lại”.',
  'draft-not-empty':'Ô soạn tin trên Facebook đang có bản nháp. Hãy gửi hoặc xóa nó trên Facebook. Chưa gửi.',
  'editor-mismatch':'Facebook không nhận nội dung. Chưa gửi.',
  'no-editor':'Không tìm thấy ô soạn tin của Facebook. Chưa gửi.',
  'no-send':'Không tìm thấy đúng một nút Gửi của Facebook. Chưa gửi.',
  'unconfirmed':'Đã bấm Gửi nhưng chưa xác nhận được. Kiểm tra trên Facebook; plugin không gửi lại.',
  'timeout':'Facebook chưa trả lời kịp (tab Facebook chạy nền có thể chậm). Nếu vừa gửi tin, hãy xem lại trên Facebook trước khi gửi lại.',
  'unknown-key':'Hội thoại không còn trong danh sách Facebook.',
  'no-call':'Facebook không có nút gọi cho hội thoại này.',
  'no-info':'Không thấy nút Thông tin hội thoại trên tab Facebook.'
};
const STATUS={closed:'Chưa mở Facebook Messages — bấm để mở (tab chạy nền). '+OLD_TAB,login:'Facebook chưa đăng nhập — bấm để xem tab',unrecognized:'Tab Facebook không ở trang Messages — bấm để xem tab',connecting:'Đang kết nối Facebook…'};
const PLACEHOLDER={image:'[Ảnh]',sticker:'[Sticker]',file:'[Tệp]',call:'[Cuộc gọi]',link:'[Liên kết]',other:'[Nội dung khác]'};
// Yahoo chat controls that have no Facebook counterpart stay visible but disabled. Text formatting
// too: Facebook messages carry plain text only.
const NO_FORMAT='Facebook không hỗ trợ chữ đậm, nghiêng, gạch chân, màu hay phông chữ';
const UNSUPPORTED=['activities','sounds-open','format-toggle','buzz','attach-file','my-avatar-preview','conversation-menu','edit-menu','view-menu','actions-menu','chat-help'];
const reasonText=(reason,detail)=>(REASONS[reason]||'Facebook: không thực hiện được ('+(reason||'lỗi')+').')+(detail?' ('+detail+')':'');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
function face(){const d=el('div','default-avatar');d.append(el('i'),el('i'),el('b'));return d;}
function picture(src){
  if(!src)return face();
  const img=el('img');img.alt='';img.referrerPolicy='no-referrer';img.src=src;img.addEventListener('error',()=>img.replaceWith(face()),{once:true});return img;
}
export const FACEBOOK_ICON='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#1b3f8f"/><text x="9" y="13.5" font-family="Arial" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">f</text></svg>');

export function hostFacebook(root){
  const P=globalThis.YahooHubProtocol,REG=globalThis.YahooHubRegistry,runtime=globalThis.chrome?.runtime;
  if(!P||!REG?.source('facebook')||!runtime?.connect)return null;
  const list=createChannelWindow(root,{id:'facebook',label:LABEL,icon:FACEBOOK_ICON,hint:'Hội thoại trên tab Facebook Messages',searchPlaceholder:'Tìm hội thoại Facebook...'});
  let port=null,source={connected:false,state:'closed',entries:[],transcript:null},painted='',serial=0;
  const pending=new Map(),windows=new Map(),creating=new Map(),closedGroups=new Set();

  /* ---- connection to the service-worker router ---- */
  function connect(){
    if(port)return;
    try{port=runtime.connect({name:P.PORT_HUB});}catch{return;}
    port.onMessage.addListener(onMessage);
    port.onDisconnect.addListener(()=>{
      void runtime.lastError;
      port=null;
      for(const resolve of pending.values())resolve({ok:false,reason:'no-hub'});
      pending.clear();
      if(runtime.id)setTimeout(connect,1000);
    });
  }
  function post(message){try{port?.postMessage(message);return !!port;}catch{return false;}}
  function request(message){
    return new Promise(resolve=>{
      const requestId=crypto.randomUUID();
      pending.set(requestId,resolve);
      // After the extension reloads, this tab's script is orphaned until the page reloads.
      if(!post({...message,source:'facebook',requestId})){pending.delete(requestId);resolve({ok:false,reason:runtime.id?'no-hub':'reloaded'});}
    });
  }
  function onMessage(m){
    if(m?.type==='state'&&Array.isArray(m.sources)){source=m.sources.find(s=>s.id==='facebook')||source;list.setProfile(source.profile?.avatar||FACEBOOK_ICON);paint();for(const w of windows.values())render(w);}
    else if(m?.type==='openResult'||m?.type==='sendResult'||m?.type==='callResult'||m?.type==='composeResult'||m?.type==='infoResult'){const resolve=pending.get(m.requestId);if(resolve){pending.delete(m.requestId);resolve({ok:m.ok===true,reason:m.reason||'',detail:m.detail||''});}}
  }

  /* ---- buddy window: Yahoo contact rows grouped like the Facebook skin ---- */
  function row(e){
    const b=el('button','contact-row'+(e.group==='Online'?' online':''));b.type='button';
    b.setAttribute('aria-label','Chat với '+e.name+' trên Facebook');b.dataset.ymKey=e.key;
    const pic=el('span','tiny-avatar');pic.append(picture(e.avatar));
    const text=el('span','contact-text'),first=el('span','contact-first');
    // A Page (shop, brand, bot) has no online status; Chưa đọc lists it apart (buddy-tabs.mjs).
    const page=e.group==='Page';if(page)b.dataset.ymBusiness='Page';
    if(!page)first.append(el('span','presence-dot'+(e.group==='Online'?'':' offline')));
    first.append(el('b','',e.name));
    if(e.group==='Group')first.append(el('span','virtual-badge group-badge','Nhóm'));
    if(page)first.append(el('span','virtual-badge group-badge','Page'));
    text.append(first,el('small','',e.time||(e.group==='Online'?'Đang hoạt động':page?'Trang Facebook':'Facebook')));
    b.append(pic,text);
    if(e.unread)b.append(el('span','contact-unread','●'));
    // ymActivate: the combined list's "Chưa đọc" copy hands over the user's own click.
    b.ymActivate=ev=>{if(ev?.isTrusted)openWindow(e.key,e.name,e.avatar);};
    b.addEventListener('click',b.ymActivate);
    return b;
  }
  function statusRow(){
    const state=source.connected?source.state:'closed',b=el('button','ym-channel-status'+(state==='connecting'?' ym-channel-loading':''),STATUS[state]||STATUS.unrecognized);b.type='button';
    b.addEventListener('click',ev=>{if(ev.isTrusted)post({type:source.connected?'reveal':'launch',source:'facebook'});});
    return b;
  }
  function paint(){
    const ready=source.connected&&source.state==='ready';
    // Snapshots arrive on every change of the Facebook page; rebuild only when the list changed.
    // The open conversation's header says "Active now" more reliably than the list's dot guess:
    // that person is Online here too, so the list and the chat window agree.
    const live=source.transcript,entries=source.entries.map(e=>e.group!=='Group'&&e.group!=='Page'&&live?.key===e.key&&live.status===ACTIVE?{...e,group:'Online'}:e);
    const signature=JSON.stringify([source.connected,source.state,ready?entries:[]]);
    if(signature===painted)return;
    painted=signature;
    if(!ready){list.slot.replaceChildren(statusRow());return;}
    const groups=[],order=[...new Set([...(REG.source('facebook').groups||[]),...entries.map(e=>e.group)])];
    for(const g of order){
      const members=entries.filter(e=>e.group===g);if(!members.length)continue;
      const d=el('details','contact-group');d.open=!closedGroups.has(g);
      d.addEventListener('toggle',()=>{if(d.open)closedGroups.delete(g);else closedGroups.add(g);});
      d.append(el('summary','',g+' ('+members.length+')'),...members.map(row));groups.push(d);
    }
    list.slot.replaceChildren(...(groups.length?groups:[el('div','ym-channel-hint','Chưa thấy hội thoại nào trên Facebook.')]));
  }

  /* ---- chat windows: a copy of Yahoo's own chat window, mirroring the Facebook tab ---- */
  async function createWindow(key,name,avatar){
    const desktop=await whenDesktop(),template=root.querySelector('#chat-window');
    const node=template.cloneNode(true),id='facebook-chat-'+(++serial);
    node.id=id;node.dataset.window=id;node.dataset.ymChannel='facebook';
    node.classList.add('conversation-window','ym-facebook-chat');node.classList.remove('maximized','window-moved','shake','unread-attention');node.hidden=false;
    for(const n of node.querySelectorAll('[id]')){n.dataset.chatControl=n.id;n.removeAttribute('id');}
    const q=name=>node.querySelector('[data-chat-control="'+name+'"]');
    node.querySelector('[data-chat-control=chat-content]').classList.add('conversation-content');q('chat-tabs')?.remove();
    for(const control of UNSUPPORTED){const n=q(control);if(n){n.disabled=true;n.title='Không dùng được với Facebook';}}
    for(const n of q('format-options').querySelectorAll('button,select')){n.disabled=true;n.title=NO_FORMAT;}
    q('emoticons').hidden=true;q('buzz-effect').hidden=true;q('group-members-open').hidden=true;q('peer-blog-link').hidden=true;
    q('peer-dot').className='presence-dot';q('peer-avatar').replaceChildren(picture(avatar));q('peer-avatar-name').textContent=name;
    q('chat-statusbar').textContent='Enter để gửi qua tab Facebook · Shift + Enter để xuống dòng';
    const reveal=el('button','mini-button ym-reveal','Xem trên Facebook');reveal.type='button';q('peer-status').after(reveal);
    const notice=el('div','ym-mirror-notice'),noticeText=el('span'),rejoin=el('button','classic-button','Nối lại');
    notice.setAttribute('role','status');notice.hidden=true;rejoin.type='button';rejoin.hidden=true;notice.append(noticeText,rejoin);
    node.querySelector('.peer-status').after(notice);
    const input=q('message-input');input.value='';input.maxLength=P.LIMITS.text;input.placeholder='Gõ tin nhắn gửi qua Facebook…';
    const width=Math.min(520,innerWidth-16),offset=(windows.size%4)*32;
    node.style.cssText='left:'+Math.max(8,Math.min(360+offset,innerWidth-width-8))+'px;top:'+Math.min(70+offset,Math.max(8,innerHeight-420))+'px;width:'+width+'px;';
    const task=el('button','xp-task ym-channel-task'),taskIcon=el('img');task.type='button';taskIcon.alt='';taskIcon.src=FACEBOOK_ICON;task.append(taskIcon,el('span','',name));
    root.querySelector('.xp-tasks')?.append(task);root.append(node);
    const w={key,name,id,node,task,q,desktop,input,notice,noticeText,rejoin,messages:q('messages'),send:q('send'),last:null,signature:'',sending:false,error:'',opened:false,openFailed:false};
    desktop.register(id,node,task,{minimum:{width:360,height:360},onRestore:()=>task.classList.remove('has-new-message')});
    node.addEventListener('pointerdown',()=>task.classList.remove('has-new-message'));
    q('chat-minimize').addEventListener('click',()=>desktop.minimize(id));
    q('chat-maximize').addEventListener('click',()=>node.classList.toggle('maximized'));
    q('chat-close').addEventListener('click',()=>close(w));
    // Conversation info (as on the Zalo windows): Facebook's own panel, opened on the Facebook tab.
    for(const control of ['toggle-chat-avatar','avatars-open']){const b=q(control);b.title='Thông tin hội thoại · mở trên tab Facebook';b.setAttribute('aria-label','Thông tin hội thoại');b.addEventListener('click',e=>{if(e.isTrusted)info(w);});}
    emoticons(w);
    reveal.addEventListener('click',e=>{if(e.isTrusted)post({type:'reveal',source:'facebook'});});
    // IMVironments: a background on this computer only (shared store with the Zalo windows).
    q('environment').title='Nền khung chat · chỉ hiện trên máy này, người kia không thấy';
    q('environment').addEventListener('click',e=>{if(e.isTrusted)globalThis.YahooImv?.menu(e.currentTarget,'facebook:'+key);});
    for(const[control,media,label]of[['video-call','video','gọi video'],['voice-call','voice','gọi thoại']]){const b=q(control);b.title='Mở tab Facebook và chỉ nút '+label+' để bạn bấm';b.addEventListener('click',e=>{if(e.isTrusted)call(w,media,label);});}
    rejoin.addEventListener('click',e=>{if(e.isTrusted)openWindow(key,w.name);});
    q('message-form').addEventListener('submit',e=>{e.preventDefault();if(e.isTrusted)submit(w);});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){e.preventDefault();if(e.isTrusted&&!e.repeat)submit(w);}});
    input.addEventListener('input',()=>{w.send.disabled=!canSend(w)||!P.outgoing(input.value);});
    return w;
  }
  // Yahoo's emoticon picker inserts the classic codes as text; Facebook shows them as typed.
  function emoticons(w){
    const grid=w.q('emoticon-grid'),panel=w.q('emoticons'),toggle=w.q('emoticons-toggle');
    const fill=()=>{if(grid.children.length)return;for(const emoji of EMOTICONS){const b=el('button');b.type='button';b.title=emoji.label+' '+emoji.code;const img=el('img');img.src=YM_ASSET+'assets/'+emoji.id+'.gif';img.alt=emoji.code;b.append(img);b.addEventListener('click',()=>{const {selectionStart:start,selectionEnd:end}=w.input;w.input.setRangeText(emoji.code,start,end,'end');w.input.focus();w.input.dispatchEvent(new Event('input'));panel.hidden=true;});grid.append(b);}};
    toggle.addEventListener('click',()=>{fill();panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
    w.q('close-emoticons').addEventListener('click',()=>{panel.hidden=true;});
    w.q('emoticon-search').addEventListener('input',()=>{fill();const text=w.q('emoticon-search').value.toLowerCase();for(const b of grid.children)b.hidden=!b.title.toLowerCase().includes(text);});
  }
  // Facebook places a call in its own pop-up, which only a click on the Facebook tab may open:
  // the tab comes forward with its call button marked, and the user clicks it there.
  async function call(w,media,label){
    if(!live(w)){setNotice(w,'Mở lại hội thoại này trên Facebook trước khi gọi.',{rejoin:true});return;}
    const r=await request({type:'call',key:w.key,media});
    if(windows.get(w.key)!==w)return;
    w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)setNotice(w,'Đã chuyển sang tab Facebook: bấm nút '+label+' đang được tô vàng để gọi.');
  }
  async function info(w){
    if(!live(w)){setNotice(w,'Mở lại hội thoại này trên Facebook để xem thông tin.',{rejoin:true});return;}
    const r=await request({type:'info',key:w.key});
    if(windows.get(w.key)!==w)return;
    w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)setNotice(w,'Đã chuyển sang tab Facebook: thông tin hội thoại đang mở ở cột bên phải.');
  }
  function close(w){w.desktop.unregister(w.id);w.node.remove();w.task.remove();windows.delete(w.key);}
  const live=w=>!!(source.connected&&source.state==='ready'&&source.transcript?.key===w.key);
  const canSend=w=>live(w)&&source.transcript.canSend&&!!port&&!w.sending;
  function setNotice(w,text,{rejoin=false}={}){w.noticeText.textContent=text;w.rejoin.hidden=!rejoin;w.notice.hidden=!text;}
  function line(m,w){
    const n=el('div','message-line'),mine=m.from==='me';
    n.append(el('span','sender'+(mine?' me':''),(mine?'Bạn':m.sender||w.name)+':'));
    const pics=m.images||[];
    if(m.kind==='text')n.append(appendLinked(el('span','message-body'),m.text));
    else if(m.kind==='call')n.append(el('span','message-body ym-placeholder','📞 '+(m.text||'Cuộc gọi')));
    else if(!pics.length)n.append(el('span','message-body ym-placeholder',PLACEHOLDER[m.kind]+(m.text?' '+m.text:'')+' — xem trên Facebook'));
    // Photos as the Facebook tab shows them (small copies for end-to-end encrypted chats).
    if(pics.length){const box=el('span','ym-fb-photos');for(const src of pics){const img=el('img');img.alt='Ảnh';img.title='Ảnh từ Facebook';img.referrerPolicy='no-referrer';img.src=src;img.addEventListener('error',()=>img.replaceWith(el('span','ym-placeholder','[Ảnh] — xem trên Facebook')),{once:true});img.addEventListener('load',()=>{if(w.messages.scrollHeight-w.messages.scrollTop-w.messages.clientHeight<img.height+40)w.messages.scrollTop=w.messages.scrollHeight;},{once:true});box.append(img);}n.append(box);}
    if(m.time)n.append(el('time','',m.time));
    return n;
  }
  function render(w){
    const t=source.transcript,on=live(w);
    if(on)w.last=t;
    // Facebook may show the conversation after the open request timed out: drop that error.
    if(on&&w.openFailed){w.openFailed=false;w.opened=true;w.error='';}
    const shown=w.last?.messages||[],signature=JSON.stringify(shown);
    if(signature!==w.signature){
      const stick=w.messages.scrollTop+w.messages.clientHeight>=w.messages.scrollHeight-24,first=!w.signature;
      w.signature=signature;
      w.messages.replaceChildren(...(shown.length?shown.map(m=>line(m,w)):[el('div','empty-chat',on?'Chưa có tin nhắn đang hiển thị.':'Đang chờ nội dung từ Facebook…')]));
      if(stick||first)w.messages.scrollTop=w.messages.scrollHeight;
      if(!first&&shown.length&&!w.desktop.focused(w.id))w.task.classList.add('has-new-message');
    }
    if(w.last?.title)w.name=w.last.title;
    w.q('chat-title').textContent=w.name+' — Facebook';w.q('peer-name').textContent=w.name;w.task.querySelector('span').textContent=w.name;
    w.node.setAttribute('aria-label','Trò chuyện Facebook với '+w.name);
    w.q('peer-status').textContent=on?(t.status||LABEL):'';
    // YM!'s yellow face only when Facebook says the person is active now; grey otherwise.
    w.q('peer-dot').className='presence-dot'+(on&&t.status===ACTIVE?'':' offline');
    w.input.disabled=!on;w.send.disabled=!canSend(w)||!P.outgoing(w.input.value);
    w.q('video-call').disabled=w.q('voice-call').disabled=w.q('toggle-chat-avatar').disabled=w.q('avatars-open').disabled=!on;
    w.messages.dataset.imvironment=globalThis.YahooImv?.get('facebook:'+w.key)||'classic';
    const mine=source.profile?.avatar||'';if(w.avatar!==mine){w.avatar=mine;w.q('my-avatar-preview').replaceChildren(picture(mine));}
    if(w.error)setNotice(w,w.error,{rejoin:!on});
    else if(!source.connected)setNotice(w,'Chưa mở tab Facebook Messages.');
    else if(!on&&w.opened)setNotice(w,'Tab Facebook đang mở hội thoại khác.',{rejoin:true});
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
    w.desktop.restore(w.id,false);w.error='';render(w);setNotice(w,'Đang mở hội thoại trên Facebook…');
    const r=await request({type:'open',key});
    if(windows.get(key)!==w)return;
    w.opened=r.ok;w.openFailed=!r.ok;w.error=r.ok?'':reasonText(r.reason,r.detail);render(w);
    if(r.ok)w.input.focus({preventScroll:true});
  }
  async function submit(w){
    const text=P.outgoing(w.input.value);if(!text||!canSend(w))return;
    w.sending=true;w.error='';render(w);
    const r=await request({type:'send',key:w.key,text});
    w.sending=false;
    if(r.ok)w.input.value='';else w.error=reasonText(r.reason,r.detail);
    if(windows.get(w.key)===w)render(w);
  }

  // Until the Facebook tab publishes the user's picture: the channel logo.
  list.setProfile(FACEBOOK_ICON);
  globalThis.YahooImv?.onChange(()=>{for(const w of windows.values())render(w);});
  connect();paint();
  return {buddies:list,mount:list.mount,setProfile:list.setProfile,get state(){return source;},windows,openWindow,submit:key=>windows.has(key)&&submit(windows.get(key)),call:(key,media)=>windows.has(key)&&call(windows.get(key),media,media==='video'?'gọi video':'gọi thoại'),info:key=>windows.has(key)&&info(windows.get(key)),
    // Facebook's New message (pick several people for a group), on the Facebook tab brought forward.
    compose:()=>request({type:'compose'})};
}
