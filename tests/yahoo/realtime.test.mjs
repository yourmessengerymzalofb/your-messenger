import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// The popup's Realtime switch is on: tickets go to the Yahoo server and sockets to the
// Cloudflare realtime worker open from the Zalo tab. Fake runtime and sockets; no network.
test('Realtime switch: tickets reach the server, only realtime-worker sockets open for real',async()=>{
  const dom=new JSDOM('<!doctype html><body></body>',{url:'https://chat.zalo.me/'});
  const sent=[],opened=[];
  const port={onMessage:{l:[],addListener(f){this.l.push(f);}},onDisconnect:{addListener(){}},
    postMessage(m){sent.push(m);setTimeout(()=>port.onMessage.l.forEach(f=>f({id:m.id,status:200,headers:[['content-type','application/json']],text:'{"enabled":true}'})));}};
  const globals={document:dom.window.document,chrome:{runtime:{id:'ext',getURL:p=>'chrome-extension://ext/'+p,connect:()=>port},storage:{local:{get:async d=>({...d,ymRealtime:true})}}},
    WebSocket:class{constructor(url){this.url=url;opened.push(url);}}};
  const saved=Object.fromEntries(Object.keys(globals).map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  for(const[k,v]of Object.entries(globals))Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});
  try{
    const env=await import('../../src/yahoo/env.mjs');await env.ready;
    const ticket=await env.fetch('/api/realtime/ticket',{method:'POST',body:'{}'});
    assert.deepEqual(await ticket.json(),{enabled:true});
    assert.equal(sent.at(-1).path,'/api/realtime/ticket','the ticket request went through the proxy');
    const live=new env.WebSocket('wss://ym-vietnam001-pilot.example.workers.dev/connect');
    assert.deepEqual(opened,['wss://ym-vietnam001-pilot.example.workers.dev/connect']);assert.equal(live.url,opened[0]);
    for(const url of ['wss://evil.example/connect','ws://x.workers.dev/connect','wss://x.workers.dev/connect?x=1']){
      const stub=new env.WebSocket(url);assert.equal(stub.readyState,3,url+' stays closed');
    }
    assert.equal(opened.length,1);
  }finally{
    for(const[k,d]of Object.entries(saved)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
    dom.window.close();
  }
});
