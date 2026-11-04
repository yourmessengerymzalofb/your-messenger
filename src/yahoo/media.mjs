/* Avatars and chat images live behind the Yahoo session cookie. The build rewrites their "/api/…"
   literals to YM_MEDIA (a 1×1 data: image tagged #ym-api/…) so the browser never asks chat.zalo.me
   for them; URLs that arrive in server data are caught by the img.src setter below. An observer
   fetches each tagged image through the proxy and swaps in a blob: URL. */
import {ymFetch,yahooPath} from './net.mjs';
import {YM_ASSET,YM_MEDIA} from './env.mjs';

const TAG='#ym-api/',cache=new Map(),MAX=200;
// Site-relative (or Yahoo-origin) image URLs → packaged asset or tagged placeholder.
export function mediaUrl(value){
  const text=String(value);const p=typeof value==='string'&&/^\/(?!\/)|^https:/.test(text)?yahooPath(text):null;
  if(!p)return text;
  if(p.startsWith('/api/'))return YM_MEDIA+p.slice(5);
  if(/^\/(assets|icons|avatars)\//.test(p))return YM_ASSET+p.slice(1);
  return text;
}
function blobFor(path){
  if(!cache.has(path)){
    if(cache.size>=MAX){const[old,url]=cache.entries().next().value;cache.delete(old);url.then(u=>u&&URL.revokeObjectURL(u));}
    cache.set(path,ymFetch('/api/'+path,{credentials:'same-origin'}).then(r=>r.ok?r.blob():null).then(b=>b?URL.createObjectURL(b):null).catch(()=>null));
  }
  return cache.get(path);
}
function swap(node,attr){
  const value=node.getAttribute(attr);if(!value)return;
  // Markup from innerHTML/setAttribute skips the setter: retag it here.
  // Links only for downloadable chat images; other /api/ links (e.g. blog connect) stay as they are.
  const mapped=attr==='src'||/^\/api\/chat-images\//.test(value)?mediaUrl(value):value;
  if(mapped!==value){node.setAttribute(attr,mapped);return;}
  const at=value.indexOf(TAG);if(at<0)return;
  const path=value.slice(at+TAG.length);
  blobFor(path).then(url=>{if(url&&node.getAttribute(attr)===value)node.setAttribute(attr,url);});
}
const SELECTOR='img[src*="#ym-api/"],a[href*="#ym-api/"],img[src^="/"],a[href^="/api/chat-images/"]';
function scan(node){
  if(node.nodeType!==1)return;
  for(const el of [node,...node.querySelectorAll(SELECTOR)]){
    if(el.tagName==='IMG')swap(el,'src');
    else if(el.tagName==='A')swap(el,'href');
  }
}
let patched=false;
// Content scripts have their own DOM wrappers: this setter only affects the extension's world.
function patchImageSrc(){
  if(patched)return;patched=true;
  const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  Object.defineProperty(HTMLImageElement.prototype,'src',{...desc,set(v){desc.set.call(this,mediaUrl(v));}});
}
export function watchMedia(root){
  patchImageSrc();scan(root);
  const observer=new MutationObserver(list=>{for(const m of list){if(m.type==='attributes')swap(m.target,m.attributeName);else m.addedNodes.forEach(scan);}});
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href']});
  return ()=>observer.disconnect();
}
