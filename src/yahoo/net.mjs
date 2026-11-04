/* fetch() for the Yahoo client on chat.zalo.me. Requests to the Yahoo site go to the extension
   service worker (background/yahoo-proxy.js) over the ym-net port; the reply becomes a real Response. */
export const YAHOO_ORIGINS=['https://chat.ymvn.site'];
export let YAHOO_ORIGIN=YAHOO_ORIGINS[0];
// Read through Reflect: the build defines globalThis.fetch as ymFetch for vendor code.
const realFetch=Reflect.get(globalThis,'fetch').bind(globalThis);
let port=null;const waiting=new Map();
// Realtime (popup switch, off by default): the socket opens from this tab, so it carries
// Origin https://chat.zalo.me, which the realtime worker accepts only once that origin is on
// its ALLOWED_ORIGINS list. Off: tickets are refused locally and the client keeps polling.
export let REALTIME=false;
export const flags=(async()=>{try{REALTIME=(await globalThis.chrome?.storage?.local?.get({ymRealtime:false}))?.ymRealtime===true;}catch{}})();

function connect(){
  if(port)return port;
  port=globalThis.chrome.runtime.connect({name:'ym-net'});
  port.onMessage.addListener(m=>{const job=waiting.get(m?.id);if(job){waiting.delete(m.id);job.resolve(m);}});
  // The service worker may restart; pending calls fail and the next call reconnects.
  port.onDisconnect.addListener(()=>{void globalThis.chrome?.runtime?.lastError;port=null;for(const[id,job]of waiting){waiting.delete(id);job.resolve({status:0,error:'disconnected'});}});
  return port;
}
function call(message,signal){
  return new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const abort=()=>{waiting.delete(id);reject(signal.reason instanceof Error?signal.reason:new DOMException('The operation was aborted.','AbortError'));};
    if(signal?.aborted)return abort();
    signal?.addEventListener('abort',abort,{once:true});
    waiting.set(id,{resolve:m=>{signal?.removeEventListener('abort',abort);resolve(m);}});
    try{connect().postMessage({id,...message});}catch{port=null;try{connect().postMessage({id,...message});}catch{waiting.delete(id);resolve({status:0,error:'port'});}}
  });
}
export const origin=()=>call({op:'origin'}).then(r=>{if(YAHOO_ORIGINS.includes(r?.origin))YAHOO_ORIGIN=r.origin;return YAHOO_ORIGIN;});

function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
function fromBase64(text){const s=atob(text),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}
async function encodeBody(body,headers){
  if(body==null)return undefined;
  if(typeof body==='string')return body;
  if(body instanceof URLSearchParams){if(!headers['content-type'])headers['content-type']='application/x-www-form-urlencoded;charset=UTF-8';return body.toString();}
  if(body instanceof Blob){if(!headers['content-type']&&body.type)headers['content-type']=body.type;return {base64:toBase64(new Uint8Array(await body.arrayBuffer()))};}
  if(body instanceof ArrayBuffer)return {base64:toBase64(new Uint8Array(body))};
  if(ArrayBuffer.isView(body))return {base64:toBase64(new Uint8Array(body.buffer,body.byteOffset,body.byteLength))};
  return String(body);
}
// Yahoo paths: "/api/…" relative to the site, or an absolute URL on a Yahoo origin.
export function yahooPath(input){
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input?.url;
  if(typeof raw!=='string')return null;
  if(raw.startsWith('/')&&!raw.startsWith('//'))return raw;
  try{const url=new URL(raw);return YAHOO_ORIGINS.includes(url.origin)?url.pathname+url.search:null;}catch{return null;}
}
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});

export async function ymFetch(input,init={}){
  const path=yahooPath(input);
  if(path===null)return realFetch(input,init);
  if(!REALTIME&&/^\/api\/realtime\/(account-)?ticket(\?|$)/.test(path))return json({enabled:false});
  const request=input instanceof Request?input:null;
  const method=String(init.method||request?.method||'GET').toUpperCase();
  const headers={};
  for(const[k,v]of new Headers(init.headers||request?.headers||{}))headers[k.toLowerCase()]=v;
  const body=await encodeBody(init.body??(request&&method!=='GET'&&method!=='HEAD'?await request.arrayBuffer():undefined),headers);
  const reply=await call({op:'fetch',path,method,headers,body},init.signal||request?.signal);
  if(!reply||!reply.status)throw new TypeError('Failed to fetch'+(reply?.error?' ('+reply.error+')':''));
  const nobody=[101,204,205,304].includes(reply.status)||method==='HEAD';
  const payload=nobody?null:reply.base64!=null?fromBase64(reply.base64):reply.text??'';
  return new Response(payload,{status:reply.status,statusText:reply.statusText||'',headers:reply.headers||[]});
}
