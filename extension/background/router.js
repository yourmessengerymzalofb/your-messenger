/* Yahoo Hub service worker: a pure router between source tabs (Facebook) and hub tabs (the
   Yahoo Desktop on chat.zalo.me).
   State lives only in memory. No fetch, cookies, storage writes or network transport. */
if(typeof importScripts==='function'&&!globalThis.YahooHubProtocol)importScripts('../shared/protocol.js','../shared/registry.js');

globalThis.YahooHubRouter=chromeApi=>{
  const P=globalThis.YahooHubProtocol,REG=globalThis.YahooHubRegistry;
  const tabs=new Map(),hubs=new Set(),pending=new Map();
  const TIMEOUT=20000;let order=0;
  // An app may be open in several tabs; every one stays connected and publishing, and the
  // hub follows one: a tab showing the chat (ready) beats one that is logged out or parked
  // by the app, and among equals the tab connected or looked at last wins. Losing the
  // followed tab falls back to another one without user action.
  const rank=rec=>(rec.state==='ready'?2**40:0)+rec.order;
  function active(id){let best=null;for(const rec of tabs.get(id)||[])if(!best||rank(rec)>rank(best))best=rec;return best;}
  function snapshot(){
    return {type:'state',sources:REG.sources.map(def=>{const rec=active(def.id);return {id:def.id,label:def.label,connected:!!rec,state:rec?.state||'closed',entries:rec?.entries||[],transcript:rec?.transcript||null,profile:rec?.profile||{avatar:''}};})};
  }
  function post(port,message){try{port.postMessage(message);return true;}catch{return false;}}
  function broadcast(){const m=snapshot();for(const hub of hubs)post(hub,m);}
  function settle(requestId,reply){const p=pending.get(requestId);if(!p)return;pending.delete(requestId);clearTimeout(p.timer);
    // A call is placed by the user on the source tab itself (Facebook opens it in a pop-up that
    // only a click there may open): bring that tab forward once its call button is marked.
    if((p.kind==='call'||p.kind==='compose'||p.kind==='info')&&reply?.ok===true)reveal(p.source);post(p.hub,{type:p.kind+'Result',source:p.source,key:p.key,requestId,...P.result(reply)});}
  function forward(hub,kind,source,key,payload){
    const requestId=P.requestId(payload.requestId);if(!requestId)return;
    const rec=active(source);
    if(!rec){post(hub,{type:kind+'Result',source,key,requestId,ok:false,reason:'no-source'});return;}
    // Only keys the source itself published can be opened; sends target the live conversation.
    if(kind==='open'&&!rec.entries.some(e=>e.key===key)&&rec.transcript?.key!==key){post(hub,{type:'openResult',source,key,requestId,ok:false,reason:'unknown-key'});return;}
    pending.set(requestId,{hub,port:rec.port,source,key,kind,timer:setTimeout(()=>settle(requestId,{ok:false,reason:'timeout'}),TIMEOUT)});
    if(!post(rec.port,{type:kind,key,requestId,...(kind==='send'?{text:payload.text}:kind==='call'?{media:payload.media}:{})}))settle(requestId,{ok:false,reason:'no-source'});
  }
  async function reveal(source){
    const rec=active(source);if(!rec)return;
    try{const tab=await chromeApi.tabs.update(rec.tabId,{active:true});if(tab?.windowId!=null)await chromeApi.windows.update(tab.windowId,{focused:true});}catch{}
  }
  function fromHub(hub,m){
    if(!m||typeof m!=='object')return;
    const def=REG.source(m.source),key=typeof m.key==='string'?m.key.slice(0,P.LIMITS.key):'';
    if(m.type==='open'&&def&&key)forward(hub,'open',def.id,key,m);
    else if(m.type==='send'&&def&&key){const text=P.outgoing(m.text);if(text)forward(hub,'send',def.id,key,{requestId:m.requestId,text});}
    else if(m.type==='call'&&def&&key&&P.CALLS.includes(m.media))forward(hub,'call',def.id,key,m);
    // New message (to start a group) on the source tab; the tab comes forward once it is open.
    else if(m.type==='compose'&&def)forward(hub,'compose',def.id,'',m);
    else if(m.type==='info'&&def&&key)forward(hub,'info',def.id,key,m);
    else if(m.type==='reveal'&&def)reveal(def.id);
    // The desktop stays in front; the source tab loads in the background (pin it to keep it).
    else if(m.type==='launch'&&def&&!tabs.get(def.id)?.length)chromeApi.tabs.create({url:def.openUrl,active:false}).catch(()=>{});
    else if(m.type==='resync')post(hub,snapshot());
  }
  function fromSource(id,rec,m){
    if(!m||typeof m!=='object')return;
    const before=active(id);
    if(m.type==='snapshot'){
      rec.state=P.state(m.state);rec.entries=rec.state==='ready'?P.roster(m.entries):[];rec.transcript=rec.state==='ready'?P.transcript(m.transcript):null;rec.profile=P.profile(rec.state==='ready'?m.profile:null);
    }else if(m.type==='focus')rec.order=++order;
    else if(m.type==='openResult'||m.type==='sendResult'||m.type==='callResult'||m.type==='composeResult'||m.type==='infoResult'){
      const p=pending.get(P.requestId(m.requestId));if(p&&p.port===rec.port&&p.kind+'Result'===m.type)settle(m.requestId,m);
      return;
    }else return;
    const after=active(id);if(after!==before||after===rec)broadcast();
  }
  function dropSource(id,rec){
    const list=tabs.get(id)||[],index=list.indexOf(rec);if(index<0)return;
    const was=active(id);list.splice(index,1);if(!list.length)tabs.delete(id);
    for(const[requestId,p]of pending)if(p.port===rec.port)settle(requestId,{ok:false,reason:'no-source'});
    if(was===rec)broadcast();
  }
  chromeApi.runtime.onConnect.addListener(port=>{
    const url=port.sender?.url,tabId=port.sender?.tab?.id;
    if(port.name===P.PORT_HUB){
      if(!REG.isHub(url)||tabId==null){port.disconnect();return;}
      hubs.add(port);
      port.onMessage.addListener(m=>fromHub(port,m));
      // A page going into the back/forward cache closes its port with a lastError: read it.
      port.onDisconnect.addListener(()=>{void chromeApi.runtime.lastError;hubs.delete(port);for(const[requestId,p]of pending)if(p.hub===port){clearTimeout(p.timer);pending.delete(requestId);}});
      post(port,snapshot());return;
    }
    if(typeof port.name==='string'&&port.name.startsWith(P.PORT_SOURCE)){
      const id=port.name.slice(P.PORT_SOURCE.length),def=REG.sourceForUrl(url);
      if(!def||def.id!==id||tabId==null){port.disconnect();return;}
      const rec={port,tabId,state:'connecting',entries:[],transcript:null,order:++order};
      if(!tabs.has(id))tabs.set(id,[]);
      tabs.get(id).push(rec);
      port.onMessage.addListener(m=>fromSource(id,rec,m));
      port.onDisconnect.addListener(()=>{void chromeApi.runtime.lastError;dropSource(id,rec);});
      if(active(id)===rec)broadcast();return;
    }
    // Other ports (ym-net) belong to the Yahoo proxy.
  });
  // Popup status: counts only, no names or message text.
  chromeApi.runtime.onMessage.addListener((m,sender,reply)=>{
    if(sender?.id!==chromeApi.runtime.id||sender.tab||m?.type!=='yhub:status')return false;
    reply({hubs:hubs.size,sources:snapshot().sources.map(s=>({id:s.id,label:s.label,connected:s.connected,state:s.state,count:s.entries.length}))});
    return false;
  });
  return {snapshot,_tabs:tabs,_hubs:hubs,_pending:pending};
};
if(globalThis.chrome?.runtime?.onConnect)globalThis.YahooHubRouter(globalThis.chrome);
