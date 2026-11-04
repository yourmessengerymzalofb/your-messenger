/* Globals seen by the vendored YM v2 client. esbuild `inject` binds every free reference to
   fetch, WebSocket, history, location, localStorage and navigator in vendor code to these exports,
   and `define` maps document.body / document.documentElement to YM_ROOT and document lookups
   (querySelector, querySelectorAll, getElementById) to the YM_QUERY helpers below. The real Zalo
   page keeps its own globals: nothing here touches window, history or storage of chat.zalo.me. */
import {ymFetch,YAHOO_ORIGIN,REALTIME,flags} from './net.mjs';

const ext=globalThis.chrome;
// Every desktop node lives under this element; scoped CSS targets #ym-root.
export const YM_ROOT=document.createElement('div');
YM_ROOT.id='ym-root';
// Yahoo ids can repeat on chat.zalo.me (Zalo has its own #contact-search, earlier in the page):
// vendor lookups look under #ym-root first and fall back to the page only when nothing is there.
// (globalThis.document: the build's define would turn document.querySelector here into YM_QUERY.)
const page=globalThis.document,idSelector=id=>'[id="'+String(id).replace(/["\\]/g,'\\$&')+'"]';
export const YM_QUERY=selector=>YM_ROOT.querySelector(selector)??page.querySelector(selector);
export const YM_QUERY_ALL=selector=>{const own=YM_ROOT.querySelectorAll(selector);return own.length?own:page.querySelectorAll(selector);};
export const YM_BY_ID=id=>YM_ROOT.querySelector(idSelector(id))??page.getElementById(id);
// Base URL of the packaged Yahoo assets (rewritten from /assets/, /icons/, /avatars/).
export const YM_ASSET=ext?.runtime?.getURL?ext.runtime.getURL('yahoo/static/'):'/';
// Placeholder image for /api/ media until media.mjs swaps in a blob fetched through the proxy.
export const YM_MEDIA='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#ym-api/';
export const fetch=ymFetch,YM_FETCH=ymFetch;

// Realtime sockets open from this tab only when the popup switch is on, and only to the
// Cloudflare realtime worker (spike 0.2: the service worker cannot give a socket the Yahoo Origin).
// Otherwise every socket fails at once and the client keeps polling.
const RealWebSocket=Reflect.get(globalThis,'WebSocket');
const realtimeUrl=url=>{try{const u=new URL(String(url));return u.protocol==='wss:'&&u.hostname.endsWith('.workers.dev')&&!u.search;}catch{return false;}};
export class WebSocket extends EventTarget{
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  constructor(url){if(REALTIME&&realtimeUrl(url))return new RealWebSocket(String(url));super();this.url=String(url);this.readyState=3;this.onopen=this.onmessage=this.onerror=this.onclose=null;
    setTimeout(()=>{const error=new Event('error');this.onerror?.(error);this.dispatchEvent(error);const close=Object.assign(new Event('close'),{code:1006,reason:'',wasClean:false});this.onclose?.(close);this.dispatchEvent(close);});}
  send(){}close(){}
}

// The desktop always behaves as if it were at the root of the Yahoo site.
// YAHOO_ORIGIN is a live binding: net.mjs settles it from the proxy before the client starts.
const site=()=>new URL(YAHOO_ORIGIN+'/');
// Y! 360° (/360) opens in its own desktop window: boot.mjs sets ymLinks.blog (y360-window.mjs).
export const ymLinks={blog:null};
const blogHref=href=>{const u=new URL(href);return u.origin===site().origin&&u.pathname==='/360';};
// href: absolute. A new tab, unless it is the blog and the click does not ask for a tab.
function goYahoo(href,newTab=false){
  if(!newTab&&ymLinks.blog&&blogHref(href)){ymLinks.blog(href);return true;}
  globalThis.open(href,'_blank','noopener');return false;
}
function openYahoo(url){
  const yahoo=site(),target=new URL(String(url),yahoo);
  if(target.origin===yahoo.origin&&target.pathname==='/'&&!target.search)return;
  goYahoo(target.href);
}
export const location={
  get origin(){return site().origin;},get href(){return site().href;},get protocol(){return 'https:';},get host(){return site().host;},
  get hostname(){return site().hostname;},get port(){return '';},get pathname(){return '/';},get search(){return '';},get hash(){return '';},
  assign:openYahoo,replace:openYahoo,reload(){globalThis.location.reload();},toString(){return site().href;}
};
// Root-relative links in the client (Blog 360 in the profile menu, the IE home page, a buddy's blog)
// mean the Yahoo site, not chat.zalo.me. window.open in vendor code is defined to YM_OPEN; links
// are caught after the client's own handlers (which cancel the in-app ones, like "Xem bàn").
const yahooHref=url=>new URL(String(url??''),site()).href;
export const YM_OPEN=(url,...rest)=>{
  if(url==null)return globalThis.open(url,...rest);
  const href=yahooHref(url);
  return blogHref(href)&&goYahoo(href)?null:globalThis.open(href,...rest);
};
function yahooLink(e){
  if(e.defaultPrevented||e.button>1)return;
  const a=e.target.closest?.('a[href]');if(!a||!YM_ROOT.contains(a)||a.hasAttribute('download'))return;
  // Absolute links keep the browser's handling, except the Yahoo blog (bot messages link it in full).
  const raw=a.getAttribute('href'),relative=/^\/(?!\/|api\/)/.test(raw),href=relative?yahooHref(raw):a.href;
  if(!relative&&!blogHref(href))return;
  e.preventDefault();goYahoo(href,e.button===1||e.ctrlKey||e.metaKey||e.shiftKey);
}
YM_ROOT.addEventListener('click',yahooLink);YM_ROOT.addEventListener('auxclick',yahooLink);
export const history={state:null,length:1,pushState(state){this.state=state;},replaceState(state){this.state=state;},back(){},forward(){},go(){}};

// localStorage for the desktop is kept in chrome.storage.local (key ymLocal), not in Zalo's origin.
const memory=new Map();let saveTimer=0;
function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{ext?.storage?.local?.set({ymLocal:Object.fromEntries(memory)});}catch{}},250);}
export const localStorage={
  get length(){return memory.size;},key:i=>[...memory.keys()][i]??null,
  getItem:k=>memory.has(String(k))?memory.get(String(k)):null,
  setItem(k,v){memory.set(String(k),String(v));persist();},
  removeItem(k){memory.delete(String(k));persist();},
  clear(){memory.clear();persist();}
};
export const ready=(async()=>{await flags;try{const v=await ext?.storage?.local?.get({ymLocal:{}});for(const[k,val]of Object.entries(v?.ymLocal||{}))if(typeof val==='string')memory.set(k,val);}catch{}})();

// No service worker or push on chat.zalo.me: hide them so the client skips registration.
const realNavigator=globalThis.navigator;
export const navigator=new Proxy(realNavigator,{
  has:(t,k)=>k==='serviceWorker'?false:k in t,
  get:(t,k)=>{if(k==='serviceWorker')return undefined;const v=Reflect.get(t,k,t);return typeof v==='function'?v.bind(t):v;}
});
