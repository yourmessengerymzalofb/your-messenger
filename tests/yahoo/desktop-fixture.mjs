import {JSDOM} from 'jsdom';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {tick,portPair} from '../hub/helpers.mjs';
import {TERMS_VERSION} from '../../src/yahoo/terms.mjs';

// The client keeps clocks and polling intervals; unref them so the test process can exit.
for(const name of ['setTimeout','setInterval']){const real=globalThis[name];globalThis[name]=(...a)=>{const h=real(...a);h?.unref?.();return h;};}

// Runs the built desktop (extension/yahoo/app, made by `npm run build`) on a fake Zalo page.
// The fake proxy answers like a signed-out YM v2 server; no network is used. Like chat.zalo.me,
// the page has its own #contact-search (a div), ahead of Yahoo's search box in the document.
// stored: chrome.storage.local at start (e.g. {ymBuddyLayout:'separate'}); the automatic guest Y! ID is off
// unless a test turns it on (ymAutoGuest:true).
// routes(message): a reply for other proxy calls ({status,body}), or nothing for 404.
export async function zaloWithDesktop({account={authenticated:false},hub=false,stored:seed={},routes=()=>null}={}){
  const dom=new JSDOM('<!doctype html><html><head><title>Zalo</title></head><body><div id="app"><div id="contact-search"><div class="group-search"><input placeholder="Tìm kiếm"></div></div><div id="conversationList">Zalo</div></div></body></html>',{url:'https://chat.zalo.me/',pretendToBeVisual:true});
  // The first-run terms count as accepted unless a test asks for them (ymTerms:undefined).
  const w=dom.window,requests=[],stored={ymAutoGuest:false,ymTerms:TERMS_VERSION,...seed};
  w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const port={onMessage:{l:[],addListener(f){this.l.push(f);}},onDisconnect:{addListener(){}},
    postMessage(m){requests.push(m);const routed=m.op==='fetch'?routes(m):null;const reply=routed?{status:routed.status||200,headers:[['content-type','application/json']],text:JSON.stringify(routed.body??{})}:m.op==='origin'?{origin:'https://chat.ymvn.site'}:m.path==='/api/account'?{status:200,headers:[['content-type','application/json']],text:JSON.stringify(account)}:{status:404,headers:[['content-type','application/json']],text:'{"error":"not found"}'};
      setTimeout(()=>port.onMessage.l.forEach(f=>f({id:m.id,...reply})));}};
  // hub: the Facebook source router (shared/protocol.js + registry.js loaded as on chat.zalo.me).
  const hubPorts=[];
  if(hub)for(const f of ['extension/shared/protocol.js','extension/shared/registry.js'])(0,eval)(await readFile(f,'utf8'));
  w.chrome={runtime:{id:'ext',getURL:p=>'chrome-extension://ext/'+p,connect:({name}={})=>{if(name!=='yhub-hub')return port;const p=portPair(name,{});hubPorts.push(p);return p.client;}},storage:{local:{get:async d=>({...d,...stored}),set:async v=>Object.assign(stored,v),remove:async k=>{for(const key of [k].flat())delete stored[key];}}}};
  for(const k of ['window','document','chrome','HTMLElement','HTMLDialogElement','HTMLImageElement','Node','MutationObserver','getComputedStyle','matchMedia','requestAnimationFrame','cancelAnimationFrame','innerWidth','innerHeight','addEventListener','removeEventListener','DOMParser','Image','CSS','FileReader','KeyboardEvent','MouseEvent','InputEvent','Event','CustomEvent','FocusEvent'])
    Object.defineProperty(globalThis,k,{value:w[k]?.bind&&/^[a-z]/.test(k)&&typeof w[k]==='function'?w[k].bind(w):w[k],configurable:true,writable:true});
  // A stand-in for the Zalo skin (adapters/zalo/content.js) so the channel window is created.
  const skin={attached:null,attach(h){this.attached=h;},pause(){}};globalThis.YahooZaloSkin=skin;
  const {boot}=await import(pathToFileURL(path.resolve('extension/yahoo/app/boot.js')).href);
  // boot() waits on the first-run terms dialog while they are not accepted: return once it is up.
  let booted=false;const booting=boot().then(()=>{booted=true;});
  for(let t=Date.now();!booted&&!w.document.querySelector('.ym-terms-dialog')&&Date.now()-t<10000;)await tick(20);
  if(booted)await booting;await tick(300);
  return {dom,w,d:w.document,requests,stored,skin,hubPorts};
}

