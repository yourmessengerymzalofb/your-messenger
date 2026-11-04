/* The terms of use (text: extension/shared/terms.json, also shown by the welcome page that opens when
   the plugin is installed, extension/welcome.html). Fallback on chat.zalo.me, for someone who closed
   that page without choosing: a YM! dialog before the desktop reads anything from Zalo or Facebook
   (boot.mjs waits for it). It waits for Zalo's signed-in screen, because a signed-out Zalo sends the
   tab to its QR sign-in page a few seconds after load and the dialog would vanish unread.
   Accepting is remembered per terms version (chrome.storage.local ymTerms), so changed terms are
   asked again. Declining turns the desktop off (ymDesktop:false) and leaves Zalo as it is. */
import TERMS from '../../extension/shared/terms.json' with {type:'json'};
export const TERMS_VERSION=TERMS.version;
const KEY='ymTerms';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};

// Zalo's signed-in screen (its sidebar or conversation list) is on the page.
export function zaloSignedIn(page=globalThis.document){
  const found=()=>!!page.querySelector('#sidebarNav,#conversationList');
  if(found())return Promise.resolve();
  return new Promise(resolve=>{const watch=new MutationObserver(()=>{if(found()){watch.disconnect();resolve();}});watch.observe(page.documentElement,{childList:true,subtree:true});});
}

// Resolves true once accepted (now or before), false when declined.
export async function acceptTerms(root,{store=globalThis.chrome?.storage?.local,openSafety=()=>globalThis.chrome?.runtime?.sendMessage?.({type:'ym:safety'}),ready=zaloSignedIn}={}){
  const accepted=async()=>{try{return (await store?.get?.({[KEY]:''}))?.[KEY]===TERMS_VERSION;}catch{return false;}};
  if(await accepted())return true;
  await ready();
  // Accepted meanwhile on the welcome page.
  if(await accepted())return true;
  return new Promise(resolve=>{
    const dialog=el('dialog','ym-quick-dialog ym-terms-dialog'),title=el('div','titlebar');
    title.append(el('span','',TERMS.title));
    const body=el('div','ym-quick-done ym-terms');
    const list=el('ol');
    for(const[lead,text]of TERMS.points){const li=el('li');li.append(el('b','',lead),' '+text);list.append(li);}
    const more=el('button','login-link','Xem chi tiết: An toàn & bản quyền');more.type='button';
    more.addEventListener('click',()=>{try{void openSafety();}catch{}});
    const accept=el('button','classic-button ym-terms-accept','Tôi đã đọc và đồng ý'),decline=el('button','classic-button ym-terms-decline','Không đồng ý');
    accept.type=decline.type='button';
    const actions=el('p','ym-quick-actions');actions.append(decline,accept);
    body.append(el('p','',TERMS.intro),list,more,actions);
    dialog.append(title,body);
    // No way around it: Escape does not close it.
    dialog.addEventListener('cancel',e=>e.preventDefault());
    const done=async ok=>{
      try{await store?.set?.(ok?{[KEY]:TERMS_VERSION}:{ymDesktop:false});}catch{}
      dialog.close();dialog.remove();resolve(ok);
    };
    accept.addEventListener('click',()=>void done(true));
    decline.addEventListener('click',()=>void done(false));
    root.append(dialog);dialog.showModal();accept.focus();
  });
}
