/* Source-tab side of Yahoo Hub. Publishes what the native page currently renders
   (roster + open conversation) to the service worker and runs open/send requests
   through the adapter. Snapshots stay in memory; nothing is written to storage. */
(() => {
  const P=globalThis.YahooHubProtocol;
  globalThis.YahooHubBridge=(adapter,{debounce=300,reconnectDelay=1000}={})=>{
    let port=null,observer=null,timer=0,due=0,lastAt=0,reconnectTimer=0,last='',enabled=false,busy=0,disposed=false;
    const runtime=()=>globalThis.chrome?.runtime;
    function read(){
      let snap;try{snap=adapter.read();}catch{snap={state:'unrecognized'};}
      const state=P.state(snap?.state);
      return {type:'snapshot',state,entries:state==='ready'?P.roster(snap.entries):[],transcript:state==='ready'?P.transcript(snap.transcript):null,profile:P.profile(state==='ready'?snap.profile:null)};
    }
    function publish(force){
      clearTimeout(timer);timer=0;if(!port)return;
      lastAt=Date.now();
      const snap=read(),text=JSON.stringify(snap);
      if(!force&&text===last)return;
      last=text;try{port.postMessage(snap);}catch{}
    }
    // Source tabs usually run in the background, where Chrome delays timers (up to a minute): a change
    // after a quiet spell goes out at once, and a later page change flushes an overdue one.
    function schedule(){
      if(!port)return;
      const now=Date.now();
      if(now-lastAt>=debounce||(timer&&now>=due)){publish(false);return;}
      if(!timer){due=lastAt+debounce;timer=setTimeout(()=>publish(false),due-now);}
    }
    async function run(m){
      const requestId=P.requestId(m.requestId);if(!requestId)return;
      busy++;let reply;
      try{reply=m.type==='open'?await adapter.open(m.key):m.type==='call'?(adapter.call&&P.CALLS.includes(m.media)?await adapter.call(m.key,m.media):{ok:false,reason:'no-call'}):m.type==='compose'?(adapter.compose?await adapter.compose():{ok:false,reason:'no-compose'}):m.type==='info'?(adapter.info?await adapter.info(m.key):{ok:false,reason:'no-info'}):await adapter.send(m.key,P.outgoing(m.text));}
      catch{reply={ok:false,reason:'adapter-error'};}
      finally{busy--;}
      try{port?.postMessage({type:m.type+'Result',requestId,...P.result(reply)});}catch{}
      publish(true);
    }
    function connect(){
      if(disposed||!enabled||port)return;
      try{port=runtime().connect({name:P.PORT_SOURCE+adapter.id});}catch{port=null;return;}
      last='';
      port.onMessage.addListener(m=>{
        if(['open','send','call','compose','info'].includes(m?.type))run(m);
        else if(m?.type==='resync')publish(true);
      });
      port.onDisconnect.addListener(()=>{
        void runtime()?.lastError;
        port=null;clearTimeout(timer);timer=0;
        // The service worker restarts after idling: reconnect and republish.
        if(!disposed&&enabled&&runtime()?.id)reconnectTimer=setTimeout(connect,reconnectDelay);
      });
      if(!observer){observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-current','aria-label','class','contenteditable']});}
      publish(true);
    }
    function disconnect(){
      clearTimeout(timer);clearTimeout(reconnectTimer);timer=0;observer?.disconnect();observer=null;
      const p=port;port=null;last='';try{p?.disconnect();}catch{}
    }
    function setEnabled(value){enabled=!!value;if(enabled)connect();else disconnect();}
    function onVisible(){
      // The tab the user looks at becomes the one the hub follows (among tabs showing the chat).
      if(document.visibilityState==='visible'&&port){try{port.postMessage({type:'focus'});}catch{}}
    }
    document.addEventListener('visibilitychange',onVisible);
    addEventListener('pagehide',()=>disconnect());
    const storage=globalThis.chrome?.storage;
    if(storage?.local){
      storage.local.get({[P.SETTINGS_KEY]:{}}).then(v=>setEnabled(v[P.SETTINGS_KEY]?.[adapter.id]!==false)).catch(()=>setEnabled(true));
      storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[P.SETTINGS_KEY])setEnabled(changes[P.SETTINGS_KEY].newValue?.[adapter.id]!==false);});
    }else setEnabled(true);
    return {publish:()=>publish(true),dispose(){disposed=true;document.removeEventListener('visibilitychange',onVisible);disconnect();},get connected(){return !!port;},get busy(){return busy>0;}};
  };
})();
