/* Yahoo Hub message contract shared by the service worker, the hub page and source adapters.
   Everything crossing a tab boundary is sanitized here; nothing is persisted. */
(() => {
  const LIMITS={entries:200,messages:120,key:300,name:120,text:4000,group:40,time:40,status:120,reason:60,detail:160,pictures:4,picture:80000};
  const KINDS=['text','image','sticker','file','call','link','other'];
  const STATES=['ready','login','unrecognized','connecting'];
  const str=(v,max)=>typeof v==='string'?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max):'';
  const httpsUrl=v=>{if(typeof v!=='string'||v.length>2000)return '';try{const u=new URL(v);return u.protocol==='https:'?u.href:'';}catch{return '';}};
  function entry(e){
    const key=str(e?.key,LIMITS.key),name=str(e?.name,LIMITS.name).replace(/\s+/g,' ').trim();
    if(!key||!name)return null;
    return {key,name,group:str(e.group,LIMITS.group)||'Friends',unread:!!e.unread,avatar:httpsUrl(e.avatar),time:str(e.time,LIMITS.time)};
  }
  function roster(list){
    if(!Array.isArray(list))return [];
    const seen=new Set(),out=[];
    for(const raw of list.slice(0,LIMITS.entries)){const e=entry(raw);if(e&&!seen.has(e.key)){seen.add(e.key);out.push(e);}}
    return out;
  }
  // Message pictures: https addresses, or small inline JPEG/PNG/WebP copies made by the source page.
  const pictureData=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
  const pictures=list=>Array.isArray(list)?list.slice(0,LIMITS.pictures).map(v=>typeof v==='string'&&v.length<=LIMITS.picture&&pictureData.test(v)?v:httpsUrl(v)).filter(Boolean):[];
  function message(m){
    const kind=KINDS.includes(m?.kind)?m.kind:'other',text=str(m?.text,LIMITS.text);
    if(kind==='text'&&!text.trim())return null;
    return {id:str(m?.id,80),from:m?.from==='me'?'me':'peer',sender:str(m?.sender,LIMITS.name),text,time:str(m?.time,LIMITS.time),kind,images:pictures(m?.images)};
  }
  function transcript(t){
    if(!t||typeof t!=='object')return null;
    const key=str(t.key,LIMITS.key);if(!key)return null;
    const messages=(Array.isArray(t.messages)?t.messages:[]).slice(-LIMITS.messages).map(message).filter(Boolean);
    return {key,title:str(t.title,LIMITS.name),status:str(t.status,LIMITS.status),canSend:t.canSend===true,messages};
  }
  // The signed-in user of a source, as the page shows it: only a picture, never a name or id.
  const profile=p=>({avatar:httpsUrl(p?.avatar)});
  const CALLS=['video','voice'];
  const state=s=>STATES.includes(s)?s:'unrecognized';
  const outgoing=text=>{const s=str(text,LIMITS.text);return s.trim()?s:'';};
  // detail: an optional short diagnostic shown to the user next to a failure reason.
  const result=r=>({ok:r?.ok===true,reason:str(r?.reason,LIMITS.reason),detail:str(r?.detail,LIMITS.detail)});
  const requestId=v=>typeof v==='string'&&/^[a-z0-9-]{8,64}$/i.test(v)?v:'';
  globalThis.YahooHubProtocol={LIMITS,KINDS,CALLS,roster,transcript,profile,state,outgoing,result,requestId,PORT_SOURCE:'yhub-source:',PORT_HUB:'yhub-hub',SETTINGS_KEY:'yhubSources'};
})();
