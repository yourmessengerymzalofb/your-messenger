import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {read,portPair,tick} from './helpers.mjs';

async function boot({settings={}}={}){
  const dom=new JSDOM('<!doctype html><body><ul id="list"></ul></body>',{url:'https://www.facebook.com/messages/',runScripts:'outside-only'}),w=dom.window,ports=[],changes=[],writes=[];
  w.chrome={runtime:{id:'ext',connect:({name})=>{const p=portPair(name,{});ports.push(p);return p.client;}},
    storage:{local:{get:async d=>({...d,yhubSources:settings}),set:async v=>writes.push(v)},onChanged:{addListener:f=>changes.push(f)}}};
  for(const f of ['extension/shared/protocol.js','extension/shared/bridge.js'])w.eval(await read(f));
  const calls=[];let entries=[{key:'n:A',name:'A'}];
  const adapter={id:'facebook',read:()=>({state:'ready',entries,transcript:{key:'n:A',title:'A',canSend:true,messages:[]}}),
    open:async key=>{calls.push(['open',key]);return {ok:true};},send:async(key,text)=>{calls.push(['send',key,text]);return {ok:false,reason:'draft-not-empty'};}};
  const bridge=w.YahooHubBridge(adapter,{debounce:5,reconnectDelay:5});await tick(5);
  const setEntries=e=>{entries=e;};
  return {dom,w,d:w.document,ports,changes,writes,calls,bridge,setEntries};
}

test('Bridge publishes a snapshot on connect and again only when the page changes',async()=>{
  const {dom,d,ports,writes,setEntries}=await boot();
  try{
    assert.equal(ports.length,1);assert.equal(ports[0].client.name,'yhub-source:facebook');
    const sent=()=>ports[0].client.sent.filter(m=>m.type==='snapshot');
    assert.equal(sent().length,1);
    d.getElementById('list').append(d.createElement('li'));await tick(30);
    assert.equal(sent().length,1,'unchanged snapshot is not resent');
    setEntries([{key:'n:A',name:'A'},{key:'n:B',name:'B'}]);d.getElementById('list').append(d.createElement('li'));await tick(30);
    assert.equal(sent().length,2);assert.equal(sent()[1].entries.length,2);
    assert.equal(writes.length,0,'nothing is written to storage');
  }finally{dom.window.close();}
});

test('A change after a quiet spell goes out without waiting for a timer (background tabs delay them)',async()=>{
  const {dom,w,d,ports,setEntries}=await boot();
  try{
    const sent=()=>ports[0].client.sent.filter(m=>m.type==='snapshot');
    await tick(20);
    // A background tab's timers may wait a minute: none may run here.
    const later=w.setTimeout;w.setTimeout=()=>0;
    setEntries([{key:'n:A',name:'A'},{key:'n:C',name:'C'}]);d.getElementById('list').append(d.createElement('li'));
    await new Promise(r=>later(r,0));
    assert.equal(sent().length,2);assert.equal(sent()[1].entries.length,2);
    w.setTimeout=later;
  }finally{dom.window.close();}
});

test('Bridge runs open/send through the adapter and returns its result',async()=>{
  const {dom,ports,calls}=await boot();
  try{
    ports[0].server.postMessage({type:'open',key:'n:A',requestId:'req-00000001'});await tick(5);
    ports[0].server.postMessage({type:'send',key:'n:A',text:'chào',requestId:'req-00000002'});await tick(5);
    ports[0].server.postMessage({type:'send',key:'n:A',text:'x',requestId:'bad id'});await tick(5);
    assert.deepEqual(calls,[['open','n:A'],['send','n:A','chào']]);
    const results=ports[0].client.sent.filter(m=>/Result$/.test(m.type));
    assert.deepEqual(results.map(r=>[r.type,r.requestId,r.ok,r.reason]),[['openResult','req-00000001',true,''],['sendResult','req-00000002',false,'draft-not-empty']]);
  }finally{dom.window.close();}
});

test('A visible tab announces focus; a disabled source stops all publishing',async()=>{
  const {dom,d,w,ports,changes}=await boot();
  try{
    Object.defineProperty(d,'visibilityState',{configurable:true,get:()=>'visible'});
    d.dispatchEvent(new w.Event('visibilitychange'));
    assert.equal(ports[0].client.sent.at(-1).type,'focus');
    for(const f of changes)f({yhubSources:{newValue:{facebook:false}}},'local');
    assert.equal(ports[0].open,false,'turning the source off disconnects');
  }finally{dom.window.close();}
  const off=await boot({settings:{facebook:false}});
  try{assert.equal(off.ports.length,0);}finally{off.dom.window.close();}
});

test('Bridge reconnects and republishes after the service worker restarts',async()=>{
  const {dom,ports}=await boot();
  try{
    ports[0].server.disconnect();await tick(30);
    assert.equal(ports.length,2);
    assert.equal(ports[1].client.sent.filter(m=>m.type==='snapshot').length,1);
  }finally{dom.window.close();}
});
