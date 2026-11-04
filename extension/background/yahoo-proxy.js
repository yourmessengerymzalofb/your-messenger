/* Yahoo Desktop network proxy. The YM v2 client runs on chat.zalo.me and reaches its own
   server only through here: fixed Yahoo origins, /api/ paths, JSON-safe port messages.
   A session DNR rule gives these extension requests the Yahoo origin, as the site expects. */
if(typeof importScripts==='function'&&!globalThis.YahooHubProtocol)importScripts('../shared/protocol.js');

globalThis.YahooHubProxy=(chromeApi,{fetchImpl=(...a)=>fetch(...a)}={})=>{
  const ORIGINS=['https://chat.ymvn.site'];
  const PORT_NET='ym-net',RULE_ORIGIN=9001,MAX_BODY=4*1024*1024;
  // Never Zalo's sign-in page (id.zalo.me): the plugin does not run where Zalo passwords are typed.
  const PAGES=['https://chat.zalo.me/'];
  let origin=ORIGINS[0];
  const pathAllowed=p=>typeof p==='string'&&p.length<2048&&/^\/(api\/[A-Za-z0-9/_.?=&%:,!'()*~+;@$-]*|game-modules\.json(\?[A-Za-z0-9=&.-]*)?)$/.test(p)&&!p.includes('..');
  const fromPage=port=>PAGES.some(p=>port.sender?.url?.startsWith(p))||port.sender?.url?.startsWith(chromeApi.runtime.getURL?.('')||'\u0000');
  function toBase64(buffer){const bytes=new Uint8Array(buffer);let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s);}
  function fromBase64(text){const s=atob(text),bytes=new Uint8Array(s.length);for(let i=0;i<s.length;i++)bytes[i]=s.charCodeAt(i);return bytes;}

  async function setOrigin(value){
    if(ORIGINS.includes(value))origin=value;
    // Requests made by the extension itself (tabIds -1) carry the Yahoo origin; tabs are never touched.
    const domains=ORIGINS.map(o=>new URL(o).hostname);
    try{
      await chromeApi.declarativeNetRequest.updateSessionRules({removeRuleIds:[RULE_ORIGIN],addRules:[{id:RULE_ORIGIN,priority:1,
        action:{type:'modifyHeaders',requestHeaders:[{header:'origin',operation:'set',value:origin}]},
        condition:{requestDomains:domains,tabIds:[chromeApi.tabs.TAB_ID_NONE??-1],resourceTypes:['xmlhttprequest','other']}}]});
      return true;
    }catch(error){lastError='rule:'+error.message;return false;}
  }
  let lastError='';

  async function request(m){
    if(!pathAllowed(m.path))return {status:0,error:'path'};
    const method=['GET','POST','PATCH','PUT','DELETE'].includes(m.method)?m.method:'GET';
    const headers={};for(const[k,v]of Object.entries(m.headers||{}))if(/^(content-type|accept|x-yahoo-[a-z-]+)$/i.test(k)&&typeof v==='string')headers[k]=v;
    let body;
    if(method!=='GET'&&m.body!=null){
      if(typeof m.body==='string'){if(m.body.length>MAX_BODY)return {status:0,error:'too-large'};body=m.body;}
      else if(typeof m.body?.base64==='string'){if(m.body.base64.length>MAX_BODY*1.4)return {status:0,error:'too-large'};body=fromBase64(m.body.base64);}
    }
    try{
      const r=await fetchImpl(origin+m.path,{method,headers,body,credentials:'include',cache:'no-store',redirect:'follow'});
      const out={status:r.status,statusText:r.statusText,headers:[...r.headers.entries()].filter(([k])=>k!=='set-cookie'),url:r.url};
      const type=r.headers.get('content-type')||'';
      if(/^(application\/json|text\/)/.test(type))out.text=await r.text();
      else out.base64=toBase64(await r.arrayBuffer());
      return out;
    }catch(error){return {status:0,error:'network:'+(error?.message||'')};}
  }

  function onNet(port){
    port.onMessage.addListener(async m=>{
      if(!m||typeof m.id!=='string')return;
      let reply;
      if(m.op==='fetch')reply=await request(m);
      else if(m.op==='origin')reply={origin,origins:ORIGINS,lastError};
      else reply={status:0,error:'op'};
      try{port.postMessage({id:m.id,...reply});}catch{}
    });
  }
  // Y! 360° (src/yahoo/y360-window.mjs) frames the Yahoo site on chat.zalo.me. That frame is
  // cross-site, so Chrome leaves out the Yahoo session cookie (SameSite=Lax) and the blog shows a
  // guest. These session rules give the Yahoo cookies to requests from chat.zalo.me tabs to the
  // Yahoo origin that are the frame itself, or that the blog in it makes to its own site.
  // Both match on the initiator: the frame only when this extension's page (yahoo/y360.html) or the
  // Yahoo site starts it, so a frame or form that Zalo's own scripts (initiator chat.zalo.me) point
  // at the Yahoo site never carries the session.
  const RULE_FRAME=9003,RULE_FRAME_LOADS=9004,FRAME_LOADS=['xmlhttprequest','script','stylesheet','image','font','media','other'];
  let frameTimer=0;
  // chat.zalo.me tabs with the desktop open: the tabs whose ym-net port is connected (tab id → ports).
  const pageTabs=new Map();
  const frameCookies=()=>{clearTimeout(frameTimer);frameTimer=setTimeout(()=>void syncFrameCookies(),150);};
  async function syncFrameCookies(){
    if(!chromeApi.cookies?.getAll)return false;
    try{
      const host=new URL(origin).hostname;
      const jar=await chromeApi.cookies.getAll({url:origin+'/'});
      const tabIds=[...pageTabs.keys()],value=jar.map(c=>c.name+'='+c.value).join('; '),self=chromeApi.runtime?.id;
      const action={type:'modifyHeaders',requestHeaders:[{header:'cookie',operation:'set',value}]};
      const addRules=tabIds.length&&value?[
        {id:RULE_FRAME,priority:2,action,condition:{requestDomains:[host],initiatorDomains:self?[self,host]:[host],tabIds,resourceTypes:['sub_frame']}},
        {id:RULE_FRAME_LOADS,priority:2,action,condition:{requestDomains:[host],initiatorDomains:[host],tabIds,resourceTypes:FRAME_LOADS}}]:[];
      await chromeApi.declarativeNetRequest.updateSessionRules({removeRuleIds:[RULE_FRAME,RULE_FRAME_LOADS],addRules});
      return true;
    }catch(error){lastError='frame-rule:'+error.message;return false;}
  }
  // Sign-in, sign-out and session refreshes change the cookies; a desktop tab opening or closing changes the tabs.
  chromeApi.cookies?.onChanged?.addListener(({cookie})=>{const host=new URL(origin).hostname,domain=(cookie?.domain||'').replace(/^\./,'');if(domain&&(host===domain||host.endsWith('.'+domain)))frameCookies();});
  chromeApi.runtime.onConnect.addListener(port=>{
    if(port.name!==PORT_NET)return;
    if(!fromPage(port)){port.disconnect();return;}
    onNet(port);const tab=PAGES.some(p=>port.sender?.url?.startsWith(p))?port.sender?.tab?.id:null;
    if(Number.isInteger(tab)){pageTabs.set(tab,(pageTabs.get(tab)||0)+1);port.onDisconnect?.addListener(()=>{const n=(pageTabs.get(tab)||1)-1;if(n>0)pageTabs.set(tab,n);else pageTabs.delete(tab);frameCookies();});}
    frameCookies();
  });
  const ready=(chromeApi.storage?.local?.get({ymOrigin:ORIGINS[0]}).then(v=>setOrigin(v.ymOrigin)).catch(()=>setOrigin(ORIGINS[0]))??setOrigin(ORIGINS[0])).then(r=>{frameCookies();return r;});
  chromeApi.storage?.onChanged?.addListener((c,area)=>{if(area==='local'&&c.ymOrigin)void setOrigin(c.ymOrigin.newValue).then(frameCookies);});
  return {ready,request,pathAllowed,syncFrameCookies,get origin(){return origin;},setOrigin};
};
if(globalThis.chrome?.runtime?.onConnect&&globalThis.chrome?.declarativeNetRequest)globalThis.YahooHubProxy(globalThis.chrome);
