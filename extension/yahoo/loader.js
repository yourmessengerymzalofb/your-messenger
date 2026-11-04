/* Loads the Yahoo Desktop modules into chat.zalo.me (content-script world). Never on Zalo's sign-in
   page (id.zalo.me): the manifest does not inject it there. */
(async () => {
  if(window.top!==window)return;
  let flags={ymDesktop:true};try{flags=await chrome.storage.local.get(flags);}catch{}
  if(flags.ymDesktop){
    // The module can be briefly missing while the extension updates: try again before giving up.
    for(let attempt=0;attempt<4;attempt++){
      if(!chrome.runtime?.id)return;
      let app;try{app=await import(chrome.runtime.getURL('yahoo/app/boot.js'));}
      catch(error){if(attempt===3){console.warn('[Your Messenger] Chưa tải được giao diện. Tải lại trang (F5) để thử lại.',error);return;}}
      if(app){app.boot().catch(error=>console.error('[Your Messenger]',error));return;}
      await new Promise(r=>setTimeout(r,1500));
    }
  }
})();
