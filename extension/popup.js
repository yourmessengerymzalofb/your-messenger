/* Popup: desktop and list choices, the plugin-made Y! ID, and the Zalo skin switch. */
(async () => {
  const store=chrome.storage.local;
  // Without the Yahoo Desktop, the Zalo skin is off unless turned on here.
  const SKIN_DEFAULTS={yzrEnabled:false};
  const $=id=>document.getElementById(id);
  const manifest=chrome.runtime.getManifest();$('version').textContent=manifest.version_name||manifest.version;
  $('open-zalo').addEventListener('click',()=>chrome.tabs.create({url:'https://chat.zalo.me/'}));
  for(const input of document.querySelectorAll('[data-skin]')){
    const key=input.dataset.skin;input.checked=(await store.get({[key]:SKIN_DEFAULTS[key]}))[key]===true;
    input.addEventListener('change',()=>store.set({[key]:input.checked}));
  }
  const desktop=$('ym-desktop');desktop.checked=(await store.get({ymDesktop:true})).ymDesktop===true;
  desktop.addEventListener('change',()=>store.set({ymDesktop:desktop.checked}));
  const layout=(await store.get({ymBuddyLayout:'tabs'})).ymBuddyLayout==='separate'?'separate':'tabs';
  for(const input of document.querySelectorAll('input[name=ym-layout]')){
    input.checked=input.value===layout;
    input.addEventListener('change',()=>{if(input.checked)store.set({ymBuddyLayout:input.value});});
  }
  // Which apps the desktop lists (a hidden app keeps working underneath).
  const apps=(await store.get({ymApps:{}})).ymApps||{};
  for(const input of document.querySelectorAll('[data-app]')){
    input.checked=apps[input.dataset.app]!==false;
    input.addEventListener('change',async()=>{const now=(await store.get({ymApps:{}})).ymApps||{};await store.set({ymApps:{...now,[input.dataset.app]:input.checked}});});
  }
  // The Y! ID the plugin created (src/yahoo/quick-id.mjs): shown on request, copied on request.
  const saved=(await store.get({ymQuickId:null})).ymQuickId;
  if(saved?.nickname&&saved.password){
    $('yahoo-id').hidden=false;$('yahoo-id-nick').textContent=saved.nickname;
    const code=$('yahoo-id-password'),show=$('yahoo-id-show'),copy=$('yahoo-id-copy');let shown=false;
    show.addEventListener('click',()=>{shown=!shown;code.textContent=shown?saved.password:'••••••••••••••••';show.textContent=shown?'Ẩn mật khẩu':'Hiện mật khẩu';});
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(saved.password);copy.textContent='Đã chép';}catch{copy.textContent='Không chép được';}setTimeout(()=>copy.textContent='Chép',1500);});
  }
})();
