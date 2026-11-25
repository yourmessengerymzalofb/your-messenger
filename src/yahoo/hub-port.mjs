/* One connection from the desktop to the service-worker router (background/router.js), shared by
   every app that publishes from its own tab (Facebook, Telegram). The router sends the state of all
   apps to every hub port; each app's channel listens for its own part and its own replies. */
let port=null,runtime=null,last=null;
const listeners=new Set(),pending=new Map();
const RESULTS=new Set(['openResult','sendResult','callResult','composeResult','infoResult','moreResult']);

function connect(){
  if(port||!runtime)return;
  const P=globalThis.YahooHubProtocol;
  try{port=runtime.connect({name:P.PORT_HUB});}catch{port=null;return;}
  port.onMessage.addListener(m=>{
    if(m?.type==='state'&&Array.isArray(m.sources)){last=m.sources;for(const f of listeners)try{f(m.sources);}catch{}}
    else if(RESULTS.has(m?.type)){const resolve=pending.get(m.requestId);if(resolve){pending.delete(m.requestId);resolve({ok:m.ok===true,reason:m.reason||'',detail:m.detail||''});}}
  });
  port.onDisconnect.addListener(()=>{
    void runtime.lastError;
    port=null;
    for(const resolve of pending.values())resolve({ok:false,reason:'no-hub'});
    pending.clear();
    if(runtime.id)setTimeout(connect,1000);
  });
}
export function post(message){try{port?.postMessage(message);return !!port;}catch{return false;}}
export const connected=()=>!!port;
// message: {type, source, key?, …}. Resolves with the source tab's {ok, reason, detail}.
export function request(message){
  return new Promise(resolve=>{
    const requestId=crypto.randomUUID();
    pending.set(requestId,resolve);
    // After the extension reloads, this tab's script is orphaned until the page reloads.
    if(!post({...message,requestId})){pending.delete(requestId);resolve({ok:false,reason:runtime?.id?'no-hub':'reloaded'});}
  });
}
// onSources(sources): every router snapshot. Connects on first use.
export function joinHub(chromeRuntime,onSources){
  runtime??=chromeRuntime;listeners.add(onSources);connect();
  // Joined after the router's first snapshot: start from the latest one.
  if(last)try{onSources(last);}catch{}
  return ()=>listeners.delete(onSources);
}
