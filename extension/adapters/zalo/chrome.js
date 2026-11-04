/* Yahoo v100 furniture, ported from FB chrome.js. Only native control clicks send.
   Host mode (Yahoo Desktop 0.2): the YM v2 desktop owns the buddy list and the taskbar;
   this skin then only fills host.slot() with the Zalo list and wraps the native chat window. */
(() => {
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 const asset=path=>globalThis.chrome?.runtime?.id?chrome.runtime.getURL('adapters/zalo/'+path):'http://127.0.0.1:4213/'+path;
 const img=path=>{const n=el('img','');n.src=asset(path);n.alt='';return n;};
 const inert=n=>{if(!n.title)n.title='Tính năng YM! này chưa có trên Zalo';n.setAttribute('aria-disabled','true');n.addEventListener('click',e=>e.preventDefault());n.addEventListener('keydown',e=>{if([' ','Enter','ArrowDown','ArrowUp'].includes(e.key))e.preventDefault();});return n;};
 const button=(text,title,fn)=>{const n=el('button','',text);n.type='button';n.title=title;n.setAttribute('aria-label',title);if(fn)n.onclick=fn;else inert(n);return n;};
 function defaultAvatar(){const n=el('div','default-avatar');n.append(el('i',''),el('i',''),el('b',''));return n;}
 globalThis.YahooZaloChrome=({off,onNotice=()=>{},host=null})=>{
  // Message formatting: every key waits for Zalo's rich-text editor, then uses its native control.
  const FORMAT_KEYS=['format','bold','italic','underline','strike','color','fontSize','clear','bullet','numbering','indent','outdent','undo','redo'];
  // Zalo Web has no calling; Webcam/Voice Call explain where to call instead of staying dead.
  const CALL_NOTICE='Zalo Web chưa hỗ trợ gọi thoại và gọi video. Hãy gọi bằng ứng dụng Zalo trên điện thoại hoặc máy tính.';
  const wm=YahooZaloWindows(),transcript=YahooZaloTranscript(),buddies=YahooZaloBuddies({onChoose:choose,onNotice,groupPage:host?5:0,icons:!!host});
  const records=new Map(),bindings=new Map(),originals=new Map(),nativeProxies=new Set(),menus=new Set(),events=new AbortController();let desktop,nav,current,selected='',selectedGroup='',tasks,tray,taskObserver,chosen=false;
  function mark(n,k,v){if(!originals.has(n))originals.set(n,new Map());if(!originals.get(n).has(k))originals.get(n).set(k,n.getAttribute(k));if(n.getAttribute(k)!==v)n.setAttribute(k,v);}
  function own(n){n.dataset.yzrOwned='';return n;}
  function run(root,key,event){if(event?.isTrusted!==true)return false;if(key==='send'){const name=YahooZaloActions.peer(root);return YahooZaloActions.flushFormatting(root).then(ok=>ok&&bindings.has(root)&&YahooZaloActions.peer(root)===name&&YahooZaloActions.invoke(root,key,event));}
   if(FORMAT_KEYS.includes(key)){
    const binding=bindings.get(root);if(!binding)return false;const anchor=event.currentTarget||root.querySelector('.format-toolbar [data-yzr-action="'+key+'"]');wm.expectPortal(anchor,key);
    return YahooZaloActions.formatRich(root,key,event,{signal:binding.formatAbort.signal,onReady:()=>{if(key==='format'){const collapsed=root.hasAttribute('data-yzr-format-collapsed');if(collapsed)root.removeAttribute('data-yzr-format-collapsed');else mark(root,'data-yzr-format-collapsed','');}updateProxies();wm.syncPortals();}});
   }
   if(['emoji','sticker','emojiPicker','more','businessCard','quick','bankCard','attach','photo','screenshot','info'].includes(key))mark(root,'data-yzr-native-picker',key);wm.expectPortal(event.currentTarget||root.querySelector('[data-yzr-action="'+key+'"]'),key);const invoked=YahooZaloActions.invoke(root,key,event);if(invoked)wm.syncPortals();return invoked;
  }
  function proxy(root,key,label,icon,slot){const b=button(label,label,event=>{if(key==='video'||key==='voice'){onNotice(CALL_NOTICE);return false;}if(b.getAttribute('aria-disabled')==='true')return;const result=run(root,key,event);if(result?.then)return result.then(ok=>{if(!ok)onNotice('Không mở được công cụ định dạng Zalo. Hãy thử lại trong hội thoại này.');return ok;});if(!result)onNotice('Zalo chưa có điều khiển tương ứng hoặc có nhiều kết quả.');return result;});if(icon){b.replaceChildren(img(icon),el('span','',label));}if(FORMAT_KEYS.includes(key))b.addEventListener('pointerdown',e=>e.preventDefault());b.dataset.yzrAction=key;slot.append(b);return b;}
  function imvButton(root){const b=button('IMVironments ▾','Nền khung chat · chỉ hiện trên máy này, người kia không thấy',event=>{if(event?.isTrusted!==true)return false;const name=YahooZaloActions.peer(root);if(!name||!globalThis.YahooImv)return false;globalThis.YahooImv.menu(event.currentTarget,'zalo:'+name);return true;});b.replaceChildren(img('icons/leaves.svg'),el('span','','IMVironments ▾'));b.setAttribute('aria-haspopup','menu');return b;}
  function applyImv(root,name=YahooZaloActions.peer(root)){const view=root.querySelector('#messageViewContainer');if(view&&name)mark(view,'data-yzr-imv',globalThis.YahooImv?.get('zalo:'+name)||'classic');}
  const offImv=globalThis.YahooImv?.onChange(()=>{for(const p of bindings.values())applyImv(p.root);});
  function closeMenus(){for(const menu of menus){menu.hidden=true;menu.style.setProperty('display','none','important');menu._trigger?.setAttribute('aria-expanded','false');}}
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.yzr-action-menu,.yzr-menu-trigger'))closeMenus();},{signal:events.signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenus();for(const p of bindings.values()){p.root.removeAttribute('data-yzr-native-tool');p.root.removeAttribute('data-yzr-native-picker');}}},{signal:events.signal});
  function actionMenu(root,bar,label,items){const menu=own(el('div','yzr-action-menu'));menu.hidden=true;menu.style.setProperty('display','none','important');menu.setAttribute('role','menu');const trigger=button(label,label,event=>{const opening=menu.hidden;closeMenus();menu.hidden=!opening;menu.style.setProperty('display',opening?'block':'none','important');trigger.setAttribute('aria-expanded',String(opening));const a=trigger.getBoundingClientRect(),r=root.getBoundingClientRect();if(opening)menu.querySelector('button')?.focus({preventScroll:true});menu.style.left=Math.max(3,Math.min(a.left-r.left,root.clientWidth-225))+'px';menu.style.top=(a.bottom-r.top)+'px';});trigger.className='yzr-menu-trigger';trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');bar.append(trigger);for(const[key,text]of items){const item=proxy(root,key,text,null,menu);item.setAttribute('role','menuitem');item.addEventListener('click',closeMenus);}menu._trigger=trigger;root.append(menu);menus.add(menu);return menu;}
  function showAvatar(holder,src){src=src||'';if(holder.dataset.yzrAvatarSrc===src)return;holder.dataset.yzrAvatarSrc=src;if(src){const picture=el('img','');picture.alt='';picture.src=src;holder.replaceChildren(picture);}else holder.replaceChildren(defaultAvatar());}
  function disabled(label,why,icon){const b=button(label,why);if(icon)b.replaceChildren(img(icon),el('span','',label));return b;}
  function hideNative(n){n.setAttribute('data-yzr-native-proxy','');nativeProxies.add(n);}
  function updateProxies(){for(const n of nativeProxies)n.removeAttribute('data-yzr-native-proxy');nativeProxies.clear();for(const p of bindings.values()){
   for(const b of p.root.querySelectorAll('[data-yzr-owned] [data-yzr-action]')){const key=b.dataset.yzrAction;if(key==='format')b.setAttribute('aria-pressed',String(!p.root.hasAttribute('data-yzr-format-collapsed')));const target=YahooZaloActions.resolve(p.root,key),editor=YahooZaloActions.activeEditor(p.root),expand=YahooZaloActions.resolve(p.root,'expand'),formatKey=FORMAT_KEYS.includes(key),available=formatKey?!!editor&&!YahooZaloActions.adminOnly(p.root):!!target;if(key==='send'){const empty=!editor?.textContent.replace(/\u200b/g,'').trim();b.hidden=YahooZaloActions.adminOnly(p.root);b.disabled=empty||!editor||editor.getAttribute('contenteditable')!=='true'||!target;}if(['bold','italic','underline'].includes(key))b.setAttribute('aria-pressed',String(YahooZaloActions.formatPressed(p.root,key)));if(key==='send'?!b.disabled:available||key==='video'||key==='voice')b.removeAttribute('aria-disabled');else b.setAttribute('aria-disabled','true');b.title=['video','voice'].includes(key)?'Zalo Web không hỗ trợ gọi · bấm để xem cách gọi':key==='send'&&!editor?.textContent.replace(/\u200b/g,'').trim()?'Nhập tin nhắn để gửi':key==='font'?'Zalo không đổi phông chữ':key==='voiceMessage'?'Zalo Web chưa có nút ghi âm tương ứng':key==='format'?'Soạn có định dạng · Hiện/ẩn công cụ YM!':available?b.getAttribute('aria-label'):'Chưa tìm thấy điều khiển Zalo tương ứng duy nhất · dùng giao diện gốc nếu cần';if(target&&!['search','members','format'].includes(key))hideNative(target);}
   // The native emoji/quick-like remain in their original composer, with handlers.
   // The Yahoo smiley proxies the picker; quick-like is available with the skin off.
   const composer=p.root.querySelector('#chat-box-input-container-id');if(composer){for(const native of composer.querySelectorAll('.chat-input-container__right-layout > .normal-buttons-group .z--btn--v2'))if(!native.closest('[data-yzr-owned]'))hideNative(native);const emoji=YahooZaloActions.resolve(p.root,'emojiPicker');if(emoji)hideNative(emoji);for(const n of composer.querySelectorAll('button,[role="button"],.z--btn--v2'))if(!n.closest('[data-yzr-owned],#richInput')&&/^(👍|☺|🙂)$/.test(n.textContent.trim()))hideNative(n);}
  }}
  function task(name,panel,restore){const b=own(button('',name,restore));b.className='xp-task';b.append(img(host?'assets/happy.gif':'assets/xp/yahoo-icon.png'),el('span','',name));tasks.append(b);return b;}
  function ensureDesktop(){
   if(host){tasks=host.tasks();for(const [key,path]of [['bliss','assets/xp/bliss.jpg'],['hearts','assets/imv-hearts.svg']])document.documentElement.style.setProperty('--yzr-'+key,'url("'+asset(path)+'")');return;}
   if(desktop?.isConnected)return;
   desktop=own(el('div','yzr-desktop'));desktop.id='yzr-desktop';
   const bar=el('footer','taskbar xp-taskbar'),start=button('','Mở YM!',()=>nav&&wm.restore(nav));start.className='xp-start';start.append(img('assets/xp/start.png'));
   const strip=el('div','xp-task-strip'),left=button('‹','Cuộn tab trái',()=>tasks.scrollBy({left:-155,behavior:'smooth'})),right=button('›','Cuộn tab phải',()=>tasks.scrollBy({left:155,behavior:'smooth'}));left.className=right.className='xp-task-scroll';tasks=el('div','xp-tasks');strip.append(left,tasks,right);left.hidden=right.hidden=true;
   const overflow=()=>{left.hidden=right.hidden=tasks.scrollWidth<=tasks.clientWidth+1;};if(typeof ResizeObserver==='function'){taskObserver=new ResizeObserver(overflow);taskObserver.observe(strip);taskObserver.observe(tasks);}tasks.addEventListener('scroll',overflow);desktop._overflow=overflow;
   for(const [key,path]of [['bliss','assets/xp/bliss.jpg'],['hearts','assets/imv-hearts.svg']])document.documentElement.style.setProperty('--yzr-'+key,'url("'+asset(path)+'")');
   tray=el('div','xp-tray');const offButton=button('','Tắt skin YM!, trở về Zalo',off);offButton.append(img('assets/xp/yahoo-icon.png'));offButton.id='yzr-off';const clock=el('span','',new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}));clock.id='task-clock';tray.append(offButton,clock);bar.append(start,strip,tray);desktop.append(bar);document.body.append(desktop);
   if(wm.supported()){desktop.setAttribute('popover','manual');desktop.showPopover();}
  }
  function controls(root,kind,label){const title=own(el('div','titlebar yzr-titlebar')),cap=el('span',kind==='contacts'?'brand':'chat-title');if(kind==='contacts'){cap.append('YM!');}else cap.append(img('assets/happy.gif'),el('span','',label+(host?' — Zalo':' — Conversation')));
   const buttons=el('div','window-controls');buttons.append(button('−','Thu gọn '+label,()=>wm.minimize(root)),button('□','Phóng to / khôi phục '+label,()=>wm.maximize(root)),button('×','Đóng '+label,()=>{wm.minimize(root);if(kind!=='contacts'){const rec=records.get(label);if(rec){rec.closed=true;rec.task.hidden=true;}}}));title.append(cap,buttons);return title;
  }
  function buddy(root){const title=controls(root,'contacts','YM!'),content=own(el('div','yzr-buddy-content')),menu=el('div','menubar');const m=button('Messenger','Tùy chọn Messenger',()=>{theme.hidden=!theme.hidden;});const theme=el('div','yzr-theme-menu');theme.hidden=true;for(const[v,label]of[['purple','Tím Y!'],['blue','Xanh dương'],['rose','Hồng']])theme.append(button(label,'Màu giao diện: '+label,()=>{document.documentElement.dataset.yzrTheme=v;theme.hidden=true;}));menu.append(m,proxy(root,'contacts','Contacts',null,el('span','')));const buddyActions=actionMenu(root,menu,'Actions',[['group','Tạo nhóm chat'],['add','Thêm bạn'],['friendRequests','Lời mời kết bạn']]);menu.append(button('Help','Thông tin bản thử',()=>onNotice('Skin YM! 0.2.7 · Zalo giữ đăng nhập, tin nhắn và gửi/nhận.')));
   const profile=el('div','my-profile'),av=proxy(root,'profile','Tài khoản Zalo',null,el('span',''));av.className='my-avatar avatar';av.dataset.yzrSelfAvatar='';av.append(defaultAvatar());const detail=el('div','my-details');const name=proxy(root,'profile','Zalo Web',null,el('span',''));name.className='my-name';const status=el('div','status-editor'),statusInput=el('input','');statusInput.placeholder='Share a status message...';statusInput.readOnly=true;inert(statusInput);statusInput.title='Zalo không đồng bộ status Y!';status.append(statusInput,disabled('▾','Zalo không có status Y!'));const presence=el('div','presence-row'),dot=el('span','presence-dot offline'),select=el('select','');inert(select);select.addEventListener('pointerdown',e=>e.preventDefault());select.title='Không suy đoán trạng thái tài khoản Zalo';select.append(el('option','','Available'));const blog=disabled('My Y!360','Blog Y! không có trên Zalo');blog.className='my-y360-quick';presence.append(dot,select,blog);detail.append(name,status,presence);profile.append(av,detail);
   const search=el('div','contact-search'),slotHint=el('span','yzr-search-slot');search.append(slotHint,el('span','yzr-search-caret','☷ ▾'));
   const group=el('div','group-actions');proxy(root,'group','☷ Tạo nhóm chat',null,group).className='classic-button';group.append(el('span','','Conference'));const slot=el('div','yzr-buddy-slot');
   const bottom=el('div','contact-bottom');proxy(root,'add','✚ Thêm bạn',null,bottom).className='classic-button';bottom.append(proxy(root,'friendRequests','Lời mời',null,el('span','')));
   const footer=el('div','buddy-searchbar'),word=el('span','wordmark','Y!');word.append(el('small','','FIND FRIENDS'));const form=el('form','');const find=el('input','');find.readOnly=true;inert(find);find.setAttribute('aria-label','Tìm nickname để kết bạn');form.append(find,proxy(root,'add','➜',null,el('span','')));footer.append(word,form);
   content.append(menu,theme,profile,search,group,slot,bottom,footer);const statusbar=own(el('div','statusbar'));statusbar.append(el('span','','● Zalo Web'),el('span','','Hội thoại đã tải'));
   root.prepend(title,content);root.append(statusbar);wm.bind(root,title,'contacts');const p={root,kind:'contacts',nodes:[title,content,statusbar,buddyActions],slot,search};bindings.set(root,p);return p;
  }
  function format(root){
   const row=own(el('div','format-options'));
   for(const[tag,text,key,label]of [['b','B','bold','Chữ đậm'],['i','I','italic','Chữ nghiêng'],['u','U','underline','Gạch chân'],['s','S','strike','Gạch ngang chữ']]){const b=proxy(root,key,label,null,row);b.replaceChildren(el(tag,'',text));}
   const palette=proxy(root,'color','Màu chữ Zalo','icons/palette.svg',row);palette.className='color-control';palette.querySelector('span')?.remove();
   const font=proxy(root,'font','Phông chữ',null,row);font.dataset.chatControl='font';font.textContent='Arial ▾';const size=proxy(root,'fontSize','Cỡ chữ',null,row);size.dataset.chatControl='font-size';size.textContent='10 ▾';font.setAttribute('aria-haspopup','menu');size.setAttribute('aria-haspopup','menu');
   for(const[text,key,label]of [['T̸','clear','Bỏ tất cả định dạng'],['•≡','bullet','Gạch đầu dòng'],['1≡','numbering','Đánh số'],['⇥','indent','Thụt lề'],['⇤','outdent','Bỏ thụt lề'],['↶','undo','Hoàn tác'],['↷','redo','Khôi phục hoàn tác']]){const b=proxy(root,key,label,null,row);b.className='yzr-rtf-extra';b.textContent=text;}
   return row;
  }
  function conversation(root,label,parked=false){const header=own(el('div','yzr-chat-header')),title=controls(root,'conversation',label),menu=el('div','menubar chat-menu'),menuNodes=[];
   menuNodes.push(actionMenu(root,menu,'Conversation',[['info','Thông tin hội thoại'],['searchMessage','Tìm tin nhắn'],['addToConversation','Thêm người vào hội thoại'],['photo','Gửi hình ảnh'],['attach','Đính kèm file']]));
   menuNodes.push(actionMenu(root,menu,'Edit',[['format','Định dạng tin nhắn'],['bold','In đậm'],['italic','In nghiêng'],['underline','Gạch chân'],['color','Đổi màu chữ'],['fontSize','Cỡ chữ'],['strike','Gạch ngang chữ'],['expand','Mở rộng định dạng']]));
   menuNodes.push(actionMenu(root,menu,'View',[['info','Thông tin hội thoại']]));
   menuNodes.push(actionMenu(root,menu,'Actions',[['photo','Gửi hình ảnh'],['attach','Đính kèm file'],['sticker','Sticker'],['screenshot','Chụp màn hình'],['businessCard','Gửi danh thiếp'],['reminder','Nhắc hẹn'],['poll','Bình chọn'],['mention','Nhắc tên'],['quick','Chèn tin nhắn nhanh'],['more','Tùy chọn khác của Zalo']]));
   menu.append(button('Help','Thông tin tiện ích',()=>onNotice('Chỉ gọi điều khiển Zalo gốc; mục chưa có tương ứng sẽ không hoạt động.')));
   const toolbar=el('div','toolbar');proxy(root,'video','Webcam','icons/webcam.svg',toolbar);proxy(root,'voice','Voice Call','icons/mic.svg',toolbar);toolbar.append(el('span','toolbar-spacer'),imvButton(root),disabled('Games','Zalo không có Games Y!','icons/chess.svg'),proxy(root,'info','Avatars','icons/photos.svg',el('span','')));
   const peer=el('div','peer-status'),status=el('span','yzr-peer-access',''),members=proxy(root,'members','Thành viên ▾',null,el('span',''));members.className='room-action';members.hidden=true;const dot=el('span','presence-dot');dot.hidden=true;peer.append(dot,el('b','',label),status,members);header.append(title,menu,toolbar,peer);root.prepend(header);
   const avatar=own(el('aside','avatar-column yzr-avatars')),big=el('div','avatar big-avatar');big.dataset.yzrPeerAvatar='';big.append(defaultAvatar());const mine=proxy(root,'profile','Tài khoản Zalo',null,el('span',''));mine.className='avatar my-big-avatar';mine.dataset.yzrSelfAvatar='';mine.append(defaultAvatar());avatar.append(big,el('small','',label),mine);root.append(avatar);
   const options=format(root),tools=own(el('div','format-toolbar'));proxy(root,'emoji','Gửi sticker', 'assets/happy.gif',tools);proxy(root,'photo','Gửi hình ảnh','icons/photos.svg',tools);proxy(root,'attach','Đính kèm file','icons/paperclip.svg',tools);proxy(root,'businessCard','Gửi danh thiếp','icons/card.svg',tools);proxy(root,'screenshot','Chụp kèm với cửa sổ Zalo','icons/screenshot.svg',tools);const text=proxy(root,'format','Định dạng tin nhắn',null,tools),buzz=disabled('','Zalo không có BUZZ!');text.replaceChildren(el('span','text-symbol','T'));proxy(root,'quick','Chèn tin nhắn nhanh','icons/quick.svg',tools);proxy(root,'bankCard','Gửi nhanh số tài khoản','icons/bank.svg',tools);proxy(root,'more','Tùy chọn thêm: nhắc hẹn, tin quan trọng, tin khẩn cấp','icons/more.svg',tools);buzz.append(el('span','buzz-symbol','!'));tools.append(buzz);tools.append(el('span','format-spacer'),proxy(root,'info','Thông tin hội thoại','icons/contact-pane.svg',el('span','')));for(const control of tools.querySelectorAll('[data-yzr-action]')){control.dataset.yzrIconOnly='';for(const n of [...control.childNodes])if(n.nodeType===3||(n.nodeType===1&&n.tagName==='SPAN'&&!n.classList.contains('text-symbol')))n.remove();}
   const sendbar=own(el('div','yzr-sendbar composer'));const send=proxy(root,'send','Send',null,sendbar);send.className='classic-button send';
   const footer=own(el('div','statusbar'));footer.append(el('span','','Enter để gửi · Shift + Enter để xuống dòng'),el('span','resize-grip','⠿'));
   const composer=root.querySelector('#chat-box-input-container-id');if(composer)composer.before(options,tools);else root.append(options,tools);if(composer)composer.append(sendbar);else root.append(sendbar);root.append(footer);
   const p={root,label,kind:'conversation',nodes:[header,avatar,options,tools,sendbar,footer,...menuNodes],header,peer,big,status,dot,members,formatAbort:new AbortController()};bindings.set(root,p);wm.bind(root,title,'conversation');if(parked){root.dataset.yzrParked='';const note=own(el('div','yzr-parked-note'));note.append(el('p','','Zalo chỉ hiển thị một hội thoại gốc tại một thời điểm.'),button('Mở lại hội thoại Zalo','Mở '+label,event=>choose(label,records.get(label)?.group,true,event)));header.after(note);p.nodes.push(note);}
   return p;
  }
  function unbind(root){const p=bindings.get(root);if(!p)return;p.formatAbort?.abort();root.removeAttribute('data-yzr-format-diagnostic');wm.remove(root);for(const n of p.nodes){menus.delete(n);n.remove();}bindings.delete(root);}
  function choose(name,group,reopen=false,event){if(reopen&&bindings.get(current)?.label!==name){void buddies.openName(name,event);return;}chosen=true;selectedGroup=group;selected=name;const rec=records.get(name);if(rec){rec.closed=false;rec.task.hidden=false;}if(current)wm.restore(current);}
  function sync(sidebar,main){ensureDesktop();nav=sidebar;
   if(host)buddies.sync(nav,host.slot());else syncBuddyWindow();
   // Host mode: no window for Zalo's welcome screen; only for an open conversation.
   if(main&&host&&!YahooZaloActions.peer(main)){if(current){unbind(current);current=null;}main=null;}
   if(main)syncConversation(main);
   for(const n of document.querySelectorAll('[data-yzr-self-avatar]'))showAvatar(n,YahooZaloActions.ownAvatar(nav));
   updateProxies();wm.syncPortals();desktop?._overflow?.();
  }
  function syncBuddyWindow(){mark(nav,'data-yzr-window','');if(!nav.classList.contains('window'))mark(nav,'class',nav.className+' window buddies');let b=bindings.get(nav);if(!b){b=buddy(nav);b.task=task('YM!',nav,()=>wm.restore(nav));}
   buddies.sync(nav,b.slot);
   const search=nav.querySelector('#contact-search'),input=YahooZaloActions.resolve(nav,'search');if(search&&input){mark(search,'data-yzr-native-search','');mark(input,'placeholder','type some contact information...');nav.style.setProperty('--yzr-search-top',(b.search.getBoundingClientRect().top-nav.getBoundingClientRect().top+5)+'px');nav.style.setProperty('--yzr-search-width',Math.max(0,b.search.offsetWidth-39)+'px');for(let n=input.parentElement;n&&n!==nav;n=n.parentElement){mark(n,'data-yzr-search-chain','');if(n===search)break;}}

   const slotRect=b.slot.getBoundingClientRect(),navRect=nav.getBoundingClientRect();nav.style.setProperty('--yzr-list-top',(slotRect.top-navRect.top)+'px');nav.style.setProperty('--yzr-list-bottom',(navRect.bottom-slotRect.bottom)+'px');
   // Give AutoSizer a real viewport even when the host uses flex-1/h0 wrappers.
   // Stop before the shared search/list ancestor so the original input stays put.
   const listChain=[];for(let n=nav.querySelector('#conversationList')?.parentElement;n&&n!==nav&&!n.contains(search);n=n.parentElement)listChain.push(n);
   for(const n of listChain)mark(n,n===listChain.at(-1)?'data-yzr-native-list-shell':'data-yzr-native-list-flow','');
   for(const result of nav.querySelectorAll('#searchResultList'))if(!result.parentElement.closest('#searchResultList'))mark(result,'data-yzr-search-results',input?.value.trim()?'true':'false');
  }
  function syncConversation(main){{const name=YahooZaloActions.peer(main)||selected||'Conversation';if(current!==main||bindings.get(main)?.label!==name){
     const old=bindings.get(current);if(!host&&old?.label&&records.has(old.label)&&!records.get(old.label).closed){const rec=records.get(old.label);const parked=own(el('section','window conversation-window'));parked.dataset.yzrWindow='';desktop.append(parked);conversation(parked,old.label,true);rec.panel=parked;}
     if(current)unbind(current);current=main;
     const rec=records.get(name);if(rec?.panel!==main&&rec?.panel){unbind(rec.panel);rec.panel.remove();}
     mark(main,'data-yzr-window','');mark(main,'data-yzr-live','');if(host)mark(main,'data-ym-channel','zalo');if(!main.classList.contains('window'))mark(main,'class',main.className+' window conversation-window');conversation(main,name);
     // A conversation Zalo restored by itself waits in the taskbar until the user opens one.
     if(host&&!chosen)wm.minimize(main);
     if(!records.has(name)){const rec={panel:main,group:selectedGroup};rec.task=task(name,main,event=>choose(name,rec.group,true,event));records.set(name,rec);}else records.get(name).panel=main;
   }
   const p=bindings.get(main),editor=YahooZaloActions.activeEditor(main);if(editor){for(let node=editor.parentElement;node&&node!==main.querySelector('#chat-box-input-container-id');node=node.parentElement)mark(node,'data-yzr-editor-flow','');}main.style.setProperty('--yzr-body-top',p.header.offsetHeight+'px');transcript.sync(main,name,records.get(name)?.group==='Group');applyImv(main,name);
   showAvatar(p.big,YahooZaloActions.peerAvatar(main));
   const info=YahooZaloActions.groupInfo(main),peers=[...nav.querySelectorAll('#conversationList .msg-item')].filter(n=>YahooZaloBuddy.rowName(n)===name),group=!!info||!!main.querySelector('#header .zavatar-multi')||(peers.length===1&&YahooZaloBuddy.classify(peers[0])==='Group');if(group)buddies.setGroup(name);const access=YahooZaloActions.presence(main.querySelector('#header'),{header:true});p.status.textContent=group?(info?.text||'Hội thoại nhóm'):(access.state==='unknown'?'':access.text);/* YM!'s yellow face when Zalo's header says 10 minutes or less, grey when longer; none when it says nothing. */const ago=group?null:access.minutes;p.dot.hidden=ago==null;p.dot.className='presence-dot'+(ago!=null&&ago>10?' offline':'');if(ago!=null)buddies.setSeen?.(name,ago);p.status.title=p.status.textContent;p.members.hidden=!group;}
  }
  function clear(){const hadWindows=bindings.size>0;const nativeGrid=nav?.querySelector('#conversationList');closeMenus();menus.clear();taskObserver?.disconnect();taskObserver=null;for(const n of nativeProxies)n.removeAttribute('data-yzr-native-proxy');nativeProxies.clear();buddies.clear();transcript.clear();for(const root of [...bindings.keys()]){unbind(root);if(root.hasAttribute('data-yzr-owned'))root.remove();}for(const[n,attrs]of originals)for(const[k,v]of attrs){if(v===null)n.removeAttribute(k);else n.setAttribute(k,v);}originals.clear();for(const n of [nav,current]){n?.style.removeProperty('--yzr-search-top');n?.style.removeProperty('--yzr-search-width');n?.style.removeProperty('--yzr-list-top');n?.style.removeProperty('--yzr-list-bottom');n?.style.removeProperty('--yzr-body-top');}wm.clear();if(desktop?.matches(':popover-open'))desktop.hidePopover();desktop?.remove();desktop=null;for(const key of ['bliss','hearts'])document.documentElement.style.removeProperty('--yzr-'+key);for(const rec of records.values())rec.task?.remove();records.clear();current=null;nav=null;selected='';if(hadWindows){window.dispatchEvent(new Event('resize'));const remeasure=()=>{if(document.documentElement.hasAttribute('data-yzr-active')||!nativeGrid?.isConnected)return;const viewport=nativeGrid.closest('.virtualized-scroll')||nativeGrid.parentElement,height=viewport?.clientHeight;if(height>0&&nativeGrid.getBoundingClientRect().height>height+1)nativeGrid.style.height=height+'px';nativeGrid.scrollTop=0;window.dispatchEvent(new Event('resize'));};if(typeof requestAnimationFrame==='function')requestAnimationFrame(remeasure);else setTimeout(remeasure,0);}}
  return {sync,clear,dispose(){clear();events.abort();offImv?.();wm.dispose();},supported:wm.supported};
 };
})();

// IMVironments for Zalo and Facebook windows: a chat background the user picks per conversation,
// kept in chrome.storage.local on this computer only. Nothing goes to Zalo, Facebook or Yahoo, so
// the other person never sees it. White ("Cổ điển") by default.
(() => {
 const KEY='ymImv',LIMIT=300,store=globalThis.chrome?.storage?.local,saved={},listeners=new Set();
 const CHOICES=[['classic','Cổ điển (trắng)','#fff'],['hearts','Trái tim hồng','#ffcdce'],['sky','Bầu trời xanh','linear-gradient(#b9e2fa,#effaff)'],['garden','Vườn nắng','linear-gradient(160deg,#effbe6,#d6ecd0)']];
 const valid=id=>CHOICES.some(c=>c[0]===id);
 const notify=()=>{for(const f of listeners)try{f();}catch{}};
 function replace(value){for(const k of Object.keys(saved))delete saved[k];if(value&&typeof value==='object')for(const[k,v]of Object.entries(value))if(valid(v))saved[k]=v;notify();}
 const ready=(async()=>{try{replace((await store?.get({[KEY]:{}}))?.[KEY]);}catch{}})();
 globalThis.chrome?.storage?.onChanged?.addListener((c,area)=>{if(area==='local'&&c[KEY])replace(c[KEY].newValue);});
 const get=key=>valid(saved[key])?saved[key]:'classic';
 function set(key,id){if(!valid(id)||typeof key!=='string')return;delete saved[key];if(id!=='classic')saved[key]=id;const keys=Object.keys(saved);for(const k of keys.slice(0,Math.max(0,keys.length-LIMIT)))delete saved[k];try{store?.set({[KEY]:{...saved}});}catch{}notify();}
 let open=null;
 function close(){if(!open)return;open._anchor?.setAttribute('aria-expanded','false');open.remove();open=null;}
 function menu(anchor,key){
  if(open&&open._anchor===anchor){close();return;}close();
  const box=document.createElement('div'),r=anchor.getBoundingClientRect();box.dataset.yzrOwned='';box.className='ym-imv-menu';box.setAttribute('role','menu');box._anchor=anchor;
  box.style.cssText='position:fixed;inset:auto;margin:0;z-index:2147483647;top:'+Math.round(r.bottom+2)+'px;left:'+Math.round(Math.max(4,Math.min(r.left,innerWidth-210)))+'px;width:200px;padding:3px;border:1px solid #7f9db9;background:#fff;box-shadow:2px 3px 6px #0005;font:12px Tahoma,Arial,sans-serif;color:#000';
  const note=document.createElement('div');note.textContent='Nền riêng trên máy này · người kia không thấy';note.style.cssText='padding:3px 6px 5px;color:#666;font-size:11px;border-bottom:1px solid #ddd;margin-bottom:2px';box.append(note);
  for(const[id,label,swatch]of CHOICES){const item=document.createElement('button');item.type='button';item.setAttribute('role','menuitemradio');item.setAttribute('aria-checked',String(get(key)===id));item.dataset.imvChoice=id;
   item.style.cssText='display:flex;align-items:center;gap:8px;width:100%;padding:4px 6px;border:0;background:'+(get(key)===id?'#dbe8fb':'transparent')+';font:inherit;color:inherit;text-align:left;cursor:pointer';
   const chip=document.createElement('span');chip.style.cssText='width:22px;height:14px;border:1px solid #999;background:'+swatch;item.append(chip,document.createTextNode(label));
   item.addEventListener('click',e=>{if(e.isTrusted!==true)return;set(key,id);close();});box.append(item);}
  anchor.setAttribute('aria-expanded','true');document.body.append(box);open=box;
  // Zalo chat windows sit in the top layer (popover) above the Yahoo desktop: the menu joins it, last.
  if(typeof box.showPopover==='function'){box.setAttribute('popover','manual');try{box.showPopover();}catch{}}
 }
 document.addEventListener('pointerdown',e=>{if(open&&!open.contains(e.target)&&!open._anchor?.contains(e.target))close();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();},true);
 globalThis.YahooImv={CHOICES,get,set,menu,close,ready,onChange(f){listeners.add(f);return ()=>listeners.delete(f);}};
})();
