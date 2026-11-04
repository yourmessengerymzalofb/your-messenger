/* Native DOM adapter. No transport, private application state or automatic actions. */
(() => {
 const labels={
  send:['Gửi','Send'],group:['Tạo nhóm','Tạo nhóm trò chuyện','Tạo nhóm chat'],add:['Thêm bạn','Thêm bạn bè'],contacts:['Danh bạ'],friendRequests:['Lời mời kết bạn'],profile:['Tài khoản','Hồ sơ của bạn'],
  font:['Phông chữ'],reminder:['Tạo nhắc hẹn','Nhắc hẹn'],poll:['Tạo bình chọn','Bình chọn'],mention:['Nhắc tên','Nhắc đến'],voiceMessage:['Ghi âm','Gửi tin nhắn thoại']
 };
 // These keys/data-ids were observed on real Zalo in SUPERVISOR-REVIEW-5.md.
 const stable={
  send:{keys:['STR_SEND'],ids:[]},
  emoji:{keys:['STR_SEND_STICKER'],ids:['div_Sticker_Menu']},sticker:{keys:['STR_SEND_STICKER'],ids:['div_Sticker_Menu']},
  emojiPicker:{keys:['STR_EMOTICON_TT','STR_TOOLTIP_EMOJI'],ids:[]},
  photo:{keys:['STR_SEND_PHOTO'],ids:[]},attach:{keys:['STR_TIP_ATTACH_FILE'],ids:[]},businessCard:{keys:['STR_SEND_CONTACT'],ids:['div_CT_Menu']},screenshot:{keys:['STR_SCREENSHOT_WITH_ZALO_0'],ids:[]},
  format:{keys:['STR_FORMAT_TEXT_WITH_HOTKEY'],ids:['div_RTF_Menu']},bold:{keys:['STR_FORMAT_BOLD'],ids:['btn_RTF_Bold']},italic:{keys:['STR_FORMAT_ITALIC'],ids:['btn_RTF_Italic']},underline:{keys:['STR_FORMAT_UNDERLINE'],ids:['btn_RTF_Underline']},strike:{keys:['STR_STRIKE_THROUGH'],ids:['btn_RTF_Strikethrough']},
  color:{keys:['STR_TEXT_COLOR'],ids:[]},fontSize:{keys:['STR_FORMAT_FONT_SIZE'],ids:[]},expand:{keys:['STR_RTF_EXPAND'],ids:[]},quick:{keys:['STR_QR_INSERT'],ids:['btn_QuickMsg_Entry']},bankCard:{keys:['STR_TOOLTIP_PROMOTE_BANK_CARD_TITLE'],ids:[]},
  // Rich-text toolbar (shown after div_RTF_Menu), observed on chat.zalo.me 2026-11-02.
  clear:{keys:[],ids:['btn_RTF_Clear']},bullet:{keys:[],ids:['btn_RTF_Bullet']},numbering:{keys:[],ids:['btn_RTF_Numbering']},indent:{keys:[],ids:['btn_RTF_Tab']},outdent:{keys:[],ids:['btn_RTF_Detab']},undo:{keys:[],ids:['btn_RTF_Undo']},redo:{keys:[],ids:['btn_RTF_Redo']},more:{keys:['STR_MORE_OPTION_TIP'],ids:['div_More_Menu']},
  info:{keys:['STR_CONVERSATION_INFO'],ids:[],header:true},searchMessage:{keys:['STR_SEARCH_MESSAGE_TITLE'],ids:[],header:true},addToConversation:{keys:['STR_ADD_FRIEND_TO_CONVERSATION'],ids:['btn_ChatTitle_Search','btn_Grp_AddMem'],header:true}
 };
 const normalized=s=>(s||'').normalize('NFC').trim().toLocaleLowerCase();
 const name=n=>n.getAttribute('aria-label')||n.getAttribute('title')||n.textContent||'';
 const excluded='[data-yzr-owned],#messageView,#messageViewContainer,#messageViewScroll,.chat-item,#conversationList,#searchResultList';
 const usable=n=>!!n&&!n.closest(excluded)&&!n.disabled&&n.getAttribute('aria-disabled')!=='true'&&!n.closest('[hidden],[aria-hidden="true"]');
 function controlTarget(n,ids=[]){
  const keyed=[...n.querySelectorAll('[data-id]')].filter(c=>ids.includes(c.getAttribute('data-id'))&&usable(c));
  if(keyed.length)return keyed.length===1?controlTarget(keyed[0]):null;
  if(n.matches('button,[role="button"],input[type="submit"]'))return n;
  const inner=[...n.querySelectorAll('button,[role="button"],input[type="submit"],.z--btn--v2')].filter(usable);
  return inner.length===1?inner[0]:inner.length===0?n:null;
 }
 function resolve(root,key){
  // Actual 1:1 Zalo Web has no calling controls; do not advertise a fake call.
  if(key==='video'||key==='voice')return null;
  // No stable native contract for these tools was observed. Expose Zalo's More menu
  // instead of enabling a guessed label mapping (especially a recording/sending action).
  if(['font','voiceMessage','reminder','poll','mention'].includes(key))return null;
  if(key==='members')return groupInfo(root)?.target||null;
  if(key==='myDocuments'){const area=root.querySelector('#main-tab')||root;const hits=[...new Set([...area.querySelectorAll('[data-translate-title="KEY_NAME_SEND2ME"]')].filter(usable).map(n=>controlTarget(n)).filter(usable))];return hits.length===1?hits[0]:null;}
  if(key==='search'){const n=root.querySelector('#contact-search-input');return n&&!n.disabled?n:null;}
  if(key==='profile'){
   const nav=root.querySelector('#main-tab')||document.querySelector('#sidebarNav #main-tab'),images=nav?.querySelectorAll('.nav__tabs__zalo .zavatar-single img.a-child');
   if(images?.length===1){const n=images[0].closest('.zavatar-container.clickable,button,[role="button"]');if(usable(n))return n;}
  }
  const spec=stable[key];
  if(spec){
   const area=root.querySelector(spec.header?'#header':'#chat-box-input-container-id');if(!area)return null;
   const nodes=[...new Set([...area.querySelectorAll('[data-translate-title],[data-id]')].filter(n=>usable(n)&&(spec.keys.includes(n.getAttribute('data-translate-title'))||spec.ids.includes(n.getAttribute('data-id')))).map(n=>controlTarget(n,spec.ids)).filter(usable))];
   if(!nodes.length&&key==='emoji')return resolve(root,'emojiPicker');
   if(key!=='send'||nodes.length)return nodes.length===1?nodes[0]:null;
  }
  // Normal mode may omit STR_SEND. Exact native Send metadata/text is
  // allowed only in the composer, never the history, and never substituted by thumbs-up.
  const area=key==='send'?root.querySelector('#chat-box-input-container-id'):root;if(!area)return null;
  const expected=(labels[key]||[]).map(normalized);
  const nodes=[...new Set([...area.querySelectorAll('button,[role="button"],[aria-label],[title],input[type="submit"],.z--btn--v2')].filter(n=>usable(n)&&expected.includes(normalized(name(n)))).map(n=>controlTarget(n)).filter(usable))];
  return nodes.length===1?nodes[0]:null;
 }
 function rowTarget(row){if(!row?.matches('.msg-item'))return null;const hits=[...row.querySelectorAll('.conv-item')];return hits.length===1?hits[0]:hits.length===0?row:null;}
 function activateRow(row,event){const n=rowTarget(row);return !!n&&activate(n,event);}
 function activate(n,event){
  if(!n?.isConnected||event?.type!=='click'||event.isTrusted!==true)return false;
  const r=n.getBoundingClientRect(),opts={bubbles:true,cancelable:true,view:window,button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2},Pointer=window.PointerEvent||window.MouseEvent;
  n.dispatchEvent(new Pointer('pointerdown',{...opts,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:1}));n.dispatchEvent(new MouseEvent('mousedown',{...opts,buttons:1}));
  n.dispatchEvent(new Pointer('pointerup',{...opts,pointerId:1,pointerType:'mouse',isPrimary:true,buttons:0}));n.dispatchEvent(new MouseEvent('mouseup',{...opts,buttons:0}));n.dispatchEvent(new MouseEvent('click',{...opts,buttons:0}));return true;
 }
 function invoke(root,key,event){const n=resolve(root,key);if(!n||event?.type!=='click'||event.isTrusted!==true)return false;if(key==='search'){n.focus({preventScroll:true});return true;}return activate(n,event);}
 function activeEditor(root){const area=root?.querySelector('#chat-box-input-container-id');if(!area)return null;const rich=[...area.querySelectorAll('.input-v4[contenteditable="true"]')].filter(n=>!n.closest('[hidden],[aria-hidden="true"],[data-yzr-owned]'));if(rich.length)return rich.length===1?rich[0]:null;const normal=area.querySelectorAll('#richInput');return normal.length===1?normal[0]:null;}
 function adminOnly(root){const area=root?.querySelector('#chat-box-input-container-id');if(!area)return false;const editor=activeEditor(root);if(editor?.getAttribute('contenteditable')==='true')return false;return !!area.querySelector('[data-admin-only-notice],.group-admin-only-notice')||/chỉ (?:trưởng|phó|quản trị viên|admin)[^.!\n]{0,100}(?:gửi|nhắn)|chỉ[^.!\n]{0,60}(?:trưởng|phó|quản trị viên)[^.!\n]{0,60}(?:gửi|nhắn)/i.test(area.textContent||'');}
 function selectionBookmark(editor){const s=window.getSelection();if(!editor||!s?.rangeCount||!editor.contains(s.anchorNode)||!editor.contains(s.focusNode))return null;const range=s.getRangeAt(0),prefix=range.cloneRange();prefix.selectNodeContents(editor);prefix.setEnd(range.startContainer,range.startOffset);return {text:editor.textContent,start:prefix.toString().length,length:range.toString().length};}
 function restoreBookmark(editor,bookmark){if(!bookmark||editor.textContent!==bookmark.text)return;const walker=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT),points=[];let total=0,node;while((node=walker.nextNode())){points.push({node,start:total,end:total+node.textContent.length});total+=node.textContent.length;}const range=document.createRange();if(!points.length){range.selectNodeContents(editor);range.collapse(true);}else{const point=offset=>{const p=points.find(p=>p.end>=offset)||points.at(-1);return[p.node,Math.max(0,Math.min(p.node.textContent.length,offset-p.start))];};range.setStart(...point(bookmark.start));range.setEnd(...point(bookmark.start+bookmark.length));}const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
 function diagnostic(root,key,phase,path=''){root.dataset.yzrFormatDiagnostic=JSON.stringify({key,phase,path});}
 function shortcut(editor,key,{shift=false}={}){if(!editor?.isConnected)return false;editor.focus({preventScroll:true});const code=key.toUpperCase().charCodeAt(0),options={bubbles:true,cancelable:true,ctrlKey:true,shiftKey:shift,key:shift?key.toUpperCase():key,code:'Key'+key.toUpperCase(),keyCode:code,which:code};const down=new KeyboardEvent('keydown',options);editor.dispatchEvent(down);editor.dispatchEvent(new KeyboardEvent('keyup',options));return down.defaultPrevented;}
 function richEditorReady(root,event,signal,key='format'){if(signal?.aborted||event?.isTrusted!==true||event.type!=='click')return Promise.resolve(null);const current=activeEditor(root);if(current?.matches('.input-v4[contenteditable="true"]'))return Promise.resolve(current);if(!current||adminOnly(root)){diagnostic(root,key,'no-editable-composer');return Promise.resolve(null);}const bookmark=selectionBookmark(current),expand=resolve(root,'expand');current.focus({preventScroll:true});if(bookmark)restoreBookmark(current,bookmark);
  return new Promise(resolveReady=>{let watch,timer,fallback,done=false,path=expand?'native-expand':'keyboard-expand';const finish=editor=>{if(done)return;done=true;watch?.disconnect();clearTimeout(timer);clearTimeout(fallback);signal?.removeEventListener('abort',cancel);if(editor){editor.focus({preventScroll:true});editor=activeEditor(root)||editor;restoreBookmark(editor,bookmark);}diagnostic(root,key,editor?'rtf-ready':signal?.aborted?'cancelled':'rtf-timeout',path);resolveReady(editor);};const cancel=()=>finish(null),check=()=>{if(signal?.aborted||!root.isConnected)return cancel();const n=activeEditor(root);if(n?.matches('.input-v4[contenteditable="true"]'))finish(n);};const keyboardExpand=()=>{if(done)return;path='keyboard-ctrl-shift-x';shortcut(activeEditor(root),'x',{shift:true});check();if(!done&&['bold','italic','underline'].includes(key)&&(!current.textContent||bookmark?.length)){fallback=setTimeout(()=>{if(done)return;path='keyboard-'+key;shortcut(activeEditor(root),{bold:'b',italic:'i',underline:'u'}[key]);check();},200);}};watch=new MutationObserver(check);watch.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class','contenteditable']});signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(cancel,1500);if(expand){activate(expand,event);check();if(!done)fallback=setTimeout(keyboardExpand,150);}else keyboardExpand();});
 }
 const typingStates=new WeakMap();
 function caretStyle(root,key){const editor=activeEditor(root),selection=window.getSelection();let node=selection?.anchorNode?.nodeType===3?selection.anchorNode.parentElement:selection?.anchorNode;if(!editor?.contains(node))return null;const style=getComputedStyle(node);if(key==='bold')return parseInt(style.fontWeight,10)>=500||/bold/i.test(style.fontWeight);if(key==='italic')return style.fontStyle==='italic';for(;node&&editor.contains(node);node=node.parentElement)if(/underline/.test(getComputedStyle(node).textDecorationLine||getComputedStyle(node).textDecoration))return true;return false;}
 function nativeFormatPressed(root,key){const n=resolve(root,key);if(n){for(const p of [n,n.closest('[data-id]'),n.closest('[data-translate-title]')].filter(Boolean)){if(p.getAttribute('aria-pressed')==='true'||p.getAttribute('aria-checked')==='true'||/(^|\s)(?:active|selected|is-active|is-selected|\S+--active)(\s|$)/.test(p.className)||p.classList.contains('rtf-tool-button')&&p.classList.contains('focused'))return true;if(p.getAttribute('aria-pressed')==='false')return false;}}return caretStyle(root,key)||false;}
 function formatPressed(root,key){const state=typingStates.get(root),bookmark=selectionBookmark(activeEditor(root));if(state?.pending&&key in state.pending&&(!bookmark||!bookmark.length))return state.pending[key];return nativeFormatPressed(root,key);}
 function pickerChoice(key,target){if(!target?.closest||target.closest('[data-yzr-owned]'))return null;const option=target.closest(key==='color'?'.text-color-menu-container .text-color-menu':'.popover-v3 .zmenu-item');if(!option||!option.getClientRects().length)return null;if(key==='color')return{option,value:getComputedStyle(option).backgroundColor};const value=option.textContent.normalize('NFC').trim();return ['Rất lớn','Lớn','Trung bình','Nhỏ'].includes(value)?{option,value}:null;}
 function findPickerChoice(key,value){const selector=key==='color'?'.text-color-menu-container .text-color-menu':'.popover-v3 .zmenu-item';return [...document.querySelectorAll(selector)].find(n=>!n.closest('[data-yzr-owned]')&&n.getClientRects().length&&(key==='color'?getComputedStyle(n).backgroundColor===value:n.textContent.normalize('NFC').trim()===value));}
 function pickerIndicator(root,key,value){if(key==='color')root.style.setProperty('--chat-ink',value);else for(const button of root.querySelectorAll('.format-options[data-yzr-owned] [data-yzr-action=fontSize]')){button.textContent=value+' ▾';button.title='Cỡ chữ: '+value;}}
 function deferPickerChoice(root,option,event){const state=typingStates.get(root),picker=state?.picker;if(!picker||state.applying||event?.type!=='click'||event.isTrusted!==true||state.signal?.aborted||peer(root)!==picker.peer)return false;const choice=pickerChoice(picker.key,option);if(!choice||choice.option!==option)return false;const editor=activeEditor(root);if(!editor||editor.textContent!==picker.bookmark.text)return false;state.picker=null;state.activePickerKey=null;state.generation++;state.pending={...state.pending,[picker.key]:{value:choice.value}};state.before=null;state.event=event;invoke(root,picker.key,event);activeEditor(root)?.focus({preventScroll:true});restoreBookmark(activeEditor(root),picker.bookmark);
  pickerIndicator(root,picker.key,choice.value);diagnostic(root,picker.key,'pending-next-input','native-picker');state.onReady();return true;}
 function ensureTyping(root,signal,onReady){let state=typingStates.get(root);if(state)return state;state={pending:null,before:null,picker:null,originalInk:[root.style.getPropertyValue('--chat-ink'),root.style.getPropertyPriority('--chat-ink')],timer:0,applying:false,composing:false,job:null,peer:peer(root),event:null,onReady,signal,generation:0};typingStates.set(root,state);const options=signal?{signal,capture:true}:{capture:true};
  const capture=event=>{if(state.applying||!state.pending||!/^insert(?:Text|CompositionText|FromComposition)$/.test(event.inputType||''))return;const editor=activeEditor(root);if(!editor?.contains(event.target)&&event.target!==editor)return;const bookmark=selectionBookmark(editor);if(bookmark&&!state.before)state.before={...bookmark,peer:peer(root)};};
  const schedule=()=>{if(!state.before||state.applying||state.composing)return;clearTimeout(state.timer);state.timer=setTimeout(()=>{state.timer=0;void flushFormatting(root);},0);};
  const intercept=event=>{const key=state.picker?.key||state.activePickerKey;if(!key||state.applying||event.isTrusted!==true)return;const choice=pickerChoice(key,event.target);if(!choice){if(event.type==='pointerdown'&&!event.target.closest('.popover-v3,[data-yzr-action=color],[data-yzr-action=fontSize]'))state.picker=state.activePickerKey=null;return;}if(!state.picker){if(event.type==='mousedown'||event.type==='click'){pickerIndicator(root,key,choice.value);state.activePickerKey=null;state.onReady();}return;}event.preventDefault();event.stopImmediatePropagation();if(event.type==='click')deferPickerChoice(root,choice.option,event);};for(const type of ['pointerdown','mousedown','click'])document.addEventListener(type,intercept,options);document.addEventListener('keydown',event=>{if(event.key==='Escape')state.picker=state.activePickerKey=null;},options);
  root.addEventListener('beforeinput',capture,options);root.addEventListener('input',schedule,options);root.addEventListener('compositionstart',()=>{state.composing=true;},options);root.addEventListener('compositionend',()=>{state.composing=false;schedule();},options);
  signal?.addEventListener('abort',()=>{clearTimeout(state.timer);state.generation++;state.pending=state.before=state.picker=state.activePickerKey=null;const[v,priority]=state.originalInk;if(v)root.style.setProperty('--chat-ink',v,priority);else root.style.removeProperty('--chat-ink');typingStates.delete(root);},{once:true});return state;
 }
 async function flushFormatting(root){const state=typingStates.get(root);if(!state)return true;if(state.job)return state.job;if(!state.before||!state.pending)return true;clearTimeout(state.timer);state.timer=0;const before=state.before,pending={...state.pending},generation=state.generation;
  const live=()=>!state.signal?.aborted&&root.isConnected&&peer(root)===before.peer&&state.generation===generation;
  state.applying=true;state.job=(async()=>{try{await Promise.resolve();let editor=activeEditor(root);if(!live()||!editor)return false;const text=editor.textContent,count=text.length-before.text.length+before.length;if(count<=0)return false;if(text.slice(0,before.start)!==before.text.slice(0,before.start)||text.slice(before.start+count)!==before.text.slice(before.start+before.length)){diagnostic(root,'typing','range-changed');return false;}
    const caret=selectionBookmark(editor);if(!caret||caret.length||caret.start!==before.start+count){diagnostic(root,'typing','caret-moved');return false;}
    for(const[key,desired]of Object.entries(pending)){if(!live())return false;editor=activeEditor(root);restoreBookmark(editor,{text:editor.textContent,start:before.start,length:count});if(key==='color'||key==='fontSize'){invoke(root,key,state.event);await Promise.resolve();const option=findPickerChoice(key,desired.value);if(!option){restoreBookmark(activeEditor(root),{text:activeEditor(root).textContent,start:before.start+count,length:0});diagnostic(root,key,'picker-choice-unavailable');return false;}activate(option,state.event);await Promise.resolve();continue;}if(nativeFormatPressed(root,key)!==desired){const invoked=invoke(root,key,state.event);if(!invoked)shortcut(editor,{bold:'b',italic:'i',underline:'u'}[key]);await Promise.resolve();}}
    if(!live())return false;editor=activeEditor(root);restoreBookmark(editor,{text:editor.textContent,start:before.start+count,length:0});state.pending=null;diagnostic(root,'typing','applied','native-new-text-range');return true;
   }finally{state.before=null;state.applying=false;state.job=null;state.onReady();}})();return state.job;
 }
 async function formatRich(root,key,event,{signal,onReady=()=>{}}={}){if(event?.type!=='click'||event.isTrusted!==true||signal?.aborted)return false;const peerAtStart=peer(root),toggle=['bold','italic','underline'].includes(key),desired=toggle?!formatPressed(root,key):false;diagnostic(root,key,'starting');const editor=await richEditorReady(root,event,signal,key);if(!editor||signal?.aborted||!root.isConnected||peer(root)!==peerAtStart){if(editor)diagnostic(root,key,'cancelled-peer');return false;}let ok=false,path='native-control';
  if(key==='format')ok=true;
  else if(toggle){const state=ensureTyping(root,signal,onReady),bookmark=selectionBookmark(editor);state.onReady=onReady;state.event=event;
   if(state.applying){diagnostic(root,key,'typing-busy');return false;}
   if(bookmark?.length){state.pending=null;state.before=null;ok=invoke(root,key,event);if(!ok){shortcut(editor,{bold:'b',italic:'i',underline:'u'}[key]);ok=true;}path='native-selection';}
   else{state.generation++;state.pending={...state.pending,[key]:desired};state.before=null;ok=true;path='native-next-input';
    // Native empty-editor toggles update Zalo's model and survive React remounts.
    // At a word boundary defer until the new text exists, select only that range,
    // then use the same native controls. Never restyle the preceding word.
    if(!editor.textContent&&nativeFormatPressed(root,key)!==desired){ok=invoke(root,key,event);if(!ok){shortcut(editor,{bold:'b',italic:'i',underline:'u'}[key]);ok=true;}}}
  }else if(key==='color'||key==='fontSize'){const state=ensureTyping(root,signal,onReady),bookmark=selectionBookmark(editor);state.onReady=onReady;state.event=event;state.activePickerKey=key;state.picker=bookmark&&!bookmark.length&&editor.textContent?{key,bookmark,peer:peer(root)}:null;ok=invoke(root,key,event);if(!ok)state.picker=null;}else ok=invoke(root,key,event);
  diagnostic(root,key,ok?'applied':'format-unavailable',path);onReady();return ok;
 }
 function ownAvatar(nav){const hits=nav?.querySelectorAll('#main-tab .nav__tabs__zalo .zavatar-single img.a-child');return hits?.length===1?hits[0].getAttribute('src'):null;}
 function peerAvatar(root){
  const header=root?.querySelector('#header');if(!header)return null;
  const multi=header.querySelectorAll('#ava_chat_box_view.zavatar-multi,#ava_chat_box_view .zavatar-multi,.threadChat .zavatar-multi');
  // REVIEW-6: a group composite may start with the owner. Only a different photo
  // may represent the peer; never reuse the owner's photo in that frame.
  const self=ownAvatar(document.querySelector('#sidebarNav'));
  if(multi.length===1){if(!self)return null;const identity=src=>{try{const u=new URL(src,location.href);return u.protocol==='data:'?src:u.origin+u.pathname;}catch{return src;}};return [...multi[0].querySelectorAll('img[src]')].map(n=>n.getAttribute('src')).find(src=>src&&identity(src)!==identity(self))||null;}
  let hits=[...header.querySelectorAll('#ava_chat_box_view img,.threadChat .zavatar-container img,[data-peer-avatar]')].filter(n=>n.tagName==='IMG');if(!hits.length)hits=[...header.querySelectorAll('img')];return hits.length===1?hits[0].getAttribute('src'):null;
 }
 function groupInfo(root){const header=root?.querySelector('#header');if(!header)return null;const isCount=n=>/^\d+\s+thành viên$/i.test((n.textContent||'').trim());const hits=[...header.querySelectorAll('*')].filter(n=>!n.closest('[data-yzr-owned]')&&isCount(n)&&![...n.children].some(isCount));if(hits.length!==1)return null;const n=hits[0],control=n.closest('button,[role="button"],.clickable');return {text:n.textContent.trim(),target:control&&header.contains(control)?control:n};}
 function presence(root,{header=false}={}){
  if(!root)return {state:'unknown',text:'Chưa rõ trạng thái',minutes:null};
  const signals=new Set();let status='',minutes=null;
  const online=/^(đang online|đang hoạt động|đang truy cập|vừa mới truy cập|vừa truy cập|online|online now)$/i;
  const offline=/^(offline|ngoại tuyến|không trực tuyến|truy cập (?:(?:\d+|một|vài) (?:phút|giờ|ngày) )+trước|truy cập hôm qua)$/i;
  // "Truy cập 7 phút trước" (or "Active 7 minutes ago"): 10 minutes or less counts as online (the
  // user's rule), shown as "Đang truy cập (7 phút trước)". Hours and days never do.
  // minutes: how long ago, read only from Zalo's own words (null when it did not say).
  const recent=/^(?:truy cập|active|last seen)\s+(\d{1,2}|một|vài|a|one|a few)\s+(?:phút|minutes?|mins?)\s+(?:trước|ago)$/i,count=n=>/^\d+$/.test(n)?+n:/^(một|a|one)$/i.test(n)?1:5;
  const ago=t=>{let total=0,any=false;for(const[,n,unit]of t.matchAll(/(\d+|một|vài) (phút|giờ|ngày)/gi)){any=true;total+=count(n)*(/giờ/i.test(unit)?60:/ngày/i.test(unit)?1440:1);}return any?total:/hôm qua/i.test(t)?1440:Infinity;};
  function read(text){const clean=(text||'').normalize('NFC').replace(/\s+/g,' ').replace(/(truy cập)(?=\d)/i,'$1 ').trim();const m=recent.exec(clean);
   if(m&&count(m[1])<=10){signals.add('online');minutes=count(m[1]);status='Đang truy cập ('+(/^\d+$/.test(m[1])?m[1]:m[1].toLowerCase())+' phút trước)';}
   else if(online.test(clean)){signals.add('online');minutes=0;status=clean;}else if(offline.test(clean)){signals.add('offline');minutes=ago(clean);status=clean;}}
  for(const n of [root,...root.querySelectorAll('[data-presence],[data-online],[aria-label],[title]')]){
   if(n.closest('.conv-item-body,.preview-message,.message-preview,[data-message-preview],[hidden],[aria-hidden="true"]'))continue;
   const explicit=n.getAttribute('data-presence');if(explicit==='online'||explicit==='offline')signals.add(explicit);const flag=n.getAttribute('data-online');if(flag==='true')signals.add('online');if(flag==='false')signals.add('offline');read(n.getAttribute('aria-label'));read(n.getAttribute('title'));
  }
  // Header field aggregate text handles split text nodes without reading a nickname/preview.
  if(header)for(const n of root.querySelectorAll('[data-access-status],.threadChat .subtitle,.threadChat .sub-title,.threadChat .header-subtitle'))if(!n.closest('[data-yzr-owned],[hidden],[aria-hidden="true"]'))read(n.textContent);
  if(signals.size!==1)return {state:'unknown',text:'Chưa rõ trạng thái',minutes:null};const state=[...signals][0];return {state,text:status||(state==='online'?'Đang truy cập':'Ngoại tuyến'),minutes};
 }
 function peer(root){const n=root?.querySelector('#header .threadChat [data-peer-name],#header .threadChat .header-title,#header .threadChat .truncate');return (n?.textContent||root?.querySelector('#header .threadChat b')?.textContent||'').trim().slice(0,100);}
 globalThis.YahooZaloActions={resolve,invoke,activate,activateRow,rowTarget,controlTarget,peer,ownAvatar,peerAvatar,groupInfo,presence,activeEditor,adminOnly,richEditorReady,formatRich,formatPressed,flushFormatting,deferPickerChoice,shortcut,selectionBookmark,restoreBookmark,labels,stable};
})();
