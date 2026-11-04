/* Service worker entry: the Facebook source router and the YM v2 network proxy. */
importScripts('../shared/protocol.js','../shared/registry.js','router.js','yahoo-proxy.js');
// The terms dialog on chat.zalo.me opens the full safety page (an extension page, not web-accessible).
chrome.runtime.onMessage.addListener((m,sender)=>{
  if(sender?.id===chrome.runtime.id&&m?.type==='ym:safety')chrome.tabs.create({url:chrome.runtime.getURL('safety.html')}).catch(()=>{});
  return false;
});
// Installed, or updated with new terms: the welcome page asks first (shared/terms.json, welcome.html),
// so the terms are read before Zalo, which may jump to its QR sign-in page, is even open.
chrome.runtime.onInstalled.addListener(async({reason})=>{
  if(reason!=='install'&&reason!=='update')return;
  try{
    const terms=await (await fetch(chrome.runtime.getURL('shared/terms.json'))).json();
    if((await chrome.storage.local.get({ymTerms:''})).ymTerms!==terms.version)await chrome.tabs.create({url:chrome.runtime.getURL('welcome.html')});
  }catch{}
});
