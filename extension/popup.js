/* Popup: YM! on Zalo Web on or off, one window or a window per app (on), the Zalo colour skin (off),
   and the Y! ID the plugin made. Which apps Tất cả shows is picked in the YM! window itself.
   Choices wait here until Lưu, which saves them with ymApplyAt; the Zalo tab then reloads itself
   (adapters/zalo/apply.js). */
(async () => {
  const store=chrome.storage.local;
  const $=id=>document.getElementById(id);
  const manifest=chrome.runtime.getManifest();$('version').textContent=manifest.version_name||manifest.version;
  $('open-zalo').addEventListener('click',()=>chrome.tabs.create({url:'https://chat.zalo.me/'}));
  // Without the Yahoo Desktop, the Zalo skin is off unless turned on here.
  const saved=await store.get({ymDesktop:true,ymBuddyLayout:'tabs',yzrEnabled:false,ymQuickId:null});
  const initial={ymDesktop:saved.ymDesktop===true,ymBuddyLayout:saved.ymBuddyLayout==='separate'?'separate':'tabs',yzrEnabled:saved.yzrEnabled===true};
  const now={...initial},save=$('save'),hint=$('save-hint');
  const changed=()=>Object.keys(now).filter(k=>now[k]!==initial[k]);
  const paint=()=>{$('ym-on').hidden=!now.ymDesktop;$('ym-off').hidden=now.ymDesktop;save.disabled=!changed().length;};
  const desktop=$('ym-desktop'),skin=document.querySelector('[data-skin=yzrEnabled]');
  desktop.checked=now.ymDesktop;skin.checked=now.yzrEnabled;
  desktop.addEventListener('change',()=>{now.ymDesktop=desktop.checked;paint();});
  skin.addEventListener('change',()=>{now.yzrEnabled=skin.checked;paint();});
  for(const input of document.querySelectorAll('input[name=ym-layout]')){
    input.checked=input.value===now.ymBuddyLayout;
    input.addEventListener('change',()=>{if(input.checked){now.ymBuddyLayout=input.value;paint();}});
  }
  paint();
  save.addEventListener('click',async()=>{
    const keys=changed();if(!keys.length)return;
    save.disabled=true;
    await store.set({...Object.fromEntries(keys.map(k=>[k,now[k]])),ymApplyAt:Date.now()});
    Object.assign(initial,now);
    hint.textContent='Đã lưu. Tab Zalo đang mở sẽ tự tải lại.';
    setTimeout(()=>window.close(),1200);
  });
  // The Y! ID the plugin created (src/yahoo/quick-id.mjs): guest_ + 6 digits when made by itself,
  // or the nick from "Tạo Y! ID 1 bấm". Shown on request, copied on request.
  const id=saved.ymQuickId;
  if(id?.nickname&&id.password){
    $('yahoo-id').hidden=false;$('yahoo-id-nick').textContent=id.nickname;
    $('yahoo-id-title').textContent=id.guest?'Y! ID khách trên máy này':'Y! ID trên máy này';
    const code=$('yahoo-id-password'),show=$('yahoo-id-show'),copy=$('yahoo-id-copy');let shown=false;
    show.addEventListener('click',()=>{shown=!shown;code.textContent=shown?id.password:'••••••••••••••••';show.textContent=shown?'Ẩn mật khẩu':'Hiện mật khẩu';});
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(id.password);copy.textContent='Đã chép';}catch{copy.textContent='Không chép được';}setTimeout(()=>copy.textContent='Chép',1500);});
  }
})();
