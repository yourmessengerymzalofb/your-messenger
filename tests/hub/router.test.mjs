import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,portPair,tick} from './helpers.mjs';

const HUB='https://chat.zalo.me/';
async function boot(){
  const connect=[],message=[],tabs=[],windows=[],created=[];
  const chrome={runtime:{id:'ext',onConnect:{addListener:f=>connect.push(f)},onMessage:{addListener:f=>message.push(f)}},
    tabs:{update:async(id,o)=>{tabs.push([id,o]);return {id,windowId:7};},create:async o=>{created.push(o);return {};}},
    windows:{update:async(id,o)=>{windows.push([id,o]);return {};}}};
  const ctx=vm.createContext({chrome,URL,setTimeout,clearTimeout,JSON});
  for(const f of ['extension/shared/protocol.js','extension/shared/registry.js','extension/background/router.js'])vm.runInContext(await read(f),ctx);
  const open=(name,url,tabId=1)=>{const p=portPair(name,{url,tab:{id:tabId}});for(const f of connect)f(p.server);return p;};
  const status=()=>new Promise(r=>{for(const f of message)f({type:'yhub:status'},{id:'ext'},r);});
  return {open,status,tabs,windows,created};
}
// port.server.sent = what the router delivered to that client.
const last=port=>port.sent.at(-1);

test('Router accepts hubs and sources only from their registered origins',async()=>{
  const r=await boot();
  assert.equal(r.open('yhub-hub','https://evil.example/').open,false);
  assert.equal(r.open('yhub-hub','https://yahoo-v2.racingisle5.chatgpt.site/').open,false,'the Yahoo site is no longer a hub');
  assert.equal(r.open('yhub-source:zalo','https://chat.zalo.me/').open,false,'Zalo hosts the desktop, it is not a source');
  assert.equal(r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1').open,true);
  assert.equal(r.open('yhub-source:facebook','https://www.facebook.com/settings').open,false);
  // Zalo's sign-in page never hosts the desktop: the plugin does not run where Zalo passwords are typed.
  assert.equal(r.open('yhub-hub','https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',8).open,false);
  assert.equal(r.open('yhub-hub','https://zalo.me/',6).open,false);
  const hub=r.open('yhub-hub',HUB,9);assert.equal(hub.open,true);
  assert.equal(last(hub.server).type,'state');
  assert.equal(last(hub.server).sources.find(s=>s.id==='facebook').connected,true);
});

test('Source snapshots are sanitized before reaching the hub; disconnect clears them',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'  A  ',avatar:'javascript:alert(1)',group:'Friends'},{key:'n:A',name:'dup'},{name:'no key'}],
    transcript:{key:'n:A',title:'A',canSend:true,messages:[{from:'me',text:'x'.repeat(5000),kind:'text'},{from:'peer',text:'',kind:'text'},{from:'evil',kind:'script'}]}});
  const z=last(hub.server).sources.find(s=>s.id==='facebook');
  assert.deepEqual(z.entries,[{key:'n:A',name:'A',group:'Friends',unread:false,avatar:'',time:''}]);
  assert.equal(z.transcript.messages.length,2);
  assert.equal(z.transcript.messages[0].text.length,4000);
  assert.deepEqual([z.transcript.messages[1].from,z.transcript.messages[1].kind],['peer','other']);
  fb.client.disconnect();
  const after=last(hub.server).sources.find(s=>s.id==='facebook');
  assert.equal(after.connected,false);assert.deepEqual(after.entries,[]);assert.equal(after.transcript,null);
});

test('Open is forwarded only for published keys; results go back to the asking hub',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'A'}]});
  hub.client.postMessage({type:'open',source:'facebook',key:'n:Z',requestId:'req-00000001'});
  assert.deepEqual([last(hub.server).type,last(hub.server).reason],['openResult','unknown-key']);
  assert.equal(fb.server.sent.length,0);
  hub.client.postMessage({type:'open',source:'facebook',key:'n:A',requestId:'req-00000002'});
  assert.deepEqual(last(fb.server),{type:'open',key:'n:A',requestId:'req-00000002'});
  fb.client.postMessage({type:'openResult',requestId:'req-00000002',ok:true});
  assert.equal(last(hub.server).type,'openResult');assert.equal(last(hub.server).ok,true);
});

test('Send forwards non-empty text; a source that disappears fails pending requests',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'A'}]});
  hub.client.postMessage({type:'send',source:'facebook',key:'n:A',text:'   ',requestId:'req-00000003'});
  assert.equal(fb.server.sent.length,0);
  hub.client.postMessage({type:'send',source:'facebook',key:'n:A',text:'chào',requestId:'req-00000004'});
  assert.deepEqual(last(fb.server),{type:'send',key:'n:A',requestId:'req-00000004',text:'chào'});
  fb.client.disconnect();
  const result=hub.server.sent.find(m=>m.type==='sendResult');
  assert.equal(result.ok,false);assert.equal(result.reason,'no-source');
});

test('A parked or logged-out tab never takes the source from a tab showing the chat',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9);
  const fbOf=()=>last(hub.server).sources.find(s=>s.id==='facebook');
  const first=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  first.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'A'}]});
  // Facebook shows a non-chat page in the newer tab: it stays a candidate only.
  const second=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',4);
  second.client.postMessage({type:'snapshot',state:'unrecognized'});
  assert.equal(fbOf().state,'ready');assert.equal(fbOf().entries.length,1);
  hub.client.postMessage({type:'open',source:'facebook',key:'n:A',requestId:'req-00000005'});
  assert.equal(last(first.server).type,'open');assert.equal(second.server.sent.length,0);
  // Closing the followed tab falls back to the remaining one.
  first.client.disconnect();
  assert.equal(hub.server.sent.find(m=>m.type==='openResult').reason,'no-source');
  assert.equal(fbOf().connected,true);assert.equal(fbOf().state,'unrecognized');
  second.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:B',name:'B'}]});
  assert.equal(fbOf().entries[0].key,'n:B');
});

test('Among ready tabs the one looked at last wins; reveal focuses it; launch opens the app',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9);
  hub.client.postMessage({type:'launch',source:'facebook'});
  assert.equal(r.created[0].url,'https://www.facebook.com/messages/');assert.equal(r.created[0].active,false,'the desktop stays in front');
  const first=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3),second=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',4);
  first.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'A'}]});
  second.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:B',name:'B'}]});
  assert.equal(last(hub.server).sources.find(s=>s.id==='facebook').entries[0].key,'n:B');
  first.client.postMessage({type:'focus'});
  assert.equal(last(hub.server).sources.find(s=>s.id==='facebook').entries[0].key,'n:A');
  second.client.postMessage({type:'focus'});
  hub.client.postMessage({type:'reveal',source:'facebook'});await tick();
  assert.equal(JSON.stringify(r.tabs[0]),"[4,{\"active\":true}]");assert.equal(JSON.stringify(r.windows[0]),"[7,{\"focused\":true}]");
  second.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'n:A',name:'Bí mật'}]});
  const status=await r.status();
  assert.equal(status.sources.find(s=>s.id==='facebook').count,1);
  assert.doesNotMatch(JSON.stringify(status),/Bí mật/,'popup status carries counts only');
});

test('Call: forwarded to the source with the media only; a marked button brings that tab forward',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'k1',name:'Lan'}],transcript:{key:'k1',title:'Lan',canSend:true,messages:[]},profile:{avatar:'https://scontent.example/me.jpg',name:'leak'}});
  assert.equal(JSON.stringify(last(hub.server).sources.find(s=>s.id==='facebook').profile),JSON.stringify({avatar:'https://scontent.example/me.jpg'}),'only the picture crosses');
  hub.client.postMessage({type:'call',source:'facebook',key:'k1',media:'screen',requestId:'req-call-0'});
  assert.notEqual(last(fb.server)?.type,'call','unknown media is dropped');
  hub.client.postMessage({type:'call',source:'facebook',key:'k1',media:'video',requestId:'req-call-1',text:'x'});
  const ask=last(fb.server);assert.deepEqual({...ask},{type:'call',key:'k1',requestId:'req-call-1',media:'video'});
  assert.equal(r.tabs.length,0,'no tab switch before the button is marked');
  fb.client.postMessage({type:'callResult',requestId:'req-call-1',ok:true});await tick();
  assert.deepEqual([last(hub.server).type,last(hub.server).ok],['callResult',true]);
  assert.equal(JSON.stringify(r.tabs.at(-1)),JSON.stringify([3,{active:true}]));
});

test('Message pictures: https or small inline JPEG/PNG/WebP only, at most 4',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  const jpeg='data:image/jpeg;base64,'+'A'.repeat(100);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[{key:'k1',name:'Lan'}],transcript:{key:'k1',title:'Lan',canSend:true,messages:[{from:'peer',kind:'image',text:'',images:[jpeg,'https://scontent.example/a.jpg','javascript:alert(1)','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,'+'A'.repeat(90000),'https://x.example/5.jpg','https://x.example/6.jpg']}]}});
  const m=last(hub.server).sources.find(s=>s.id==='facebook').transcript.messages[0];
  assert.equal(JSON.stringify(m.images),JSON.stringify([jpeg,'https://scontent.example/a.jpg']));
});

test('Conversation info: forwarded with its key; the tab comes forward only when the panel opened',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[],transcript:null});
  hub.client.postMessage({type:'info',source:'facebook',key:'k1',requestId:'req-info-1'});
  assert.equal(JSON.stringify(last(fb.server)),JSON.stringify({type:'info',key:'k1',requestId:'req-info-1'}));
  fb.client.postMessage({type:'infoResult',requestId:'req-info-1',ok:false,reason:'no-info'});await tick();
  assert.equal(r.tabs.length,0);assert.equal(last(hub.server).reason,'no-info');
  hub.client.postMessage({type:'info',source:'facebook',key:'k1',requestId:'req-info-2'});
  fb.client.postMessage({type:'infoResult',requestId:'req-info-2',ok:true});await tick();
  assert.equal(JSON.stringify(r.tabs.at(-1)),JSON.stringify([3,{active:true}]));
});

test('Compose: forwarded to the source; the tab comes forward only once New message is open',async()=>{
  const r=await boot(),hub=r.open('yhub-hub',HUB,9),fb=r.open('yhub-source:facebook','https://www.facebook.com/messages/t/1',3);
  fb.client.postMessage({type:'snapshot',state:'ready',entries:[],transcript:null});
  hub.client.postMessage({type:'compose',source:'facebook',requestId:'req-compose-1',text:'x'});
  assert.equal(JSON.stringify(last(fb.server)),JSON.stringify({type:'compose',key:'',requestId:'req-compose-1'}));
  fb.client.postMessage({type:'composeResult',requestId:'req-compose-1',ok:false,reason:'no-compose'});await tick();
  assert.equal(r.tabs.length,0);assert.equal(last(hub.server).reason,'no-compose');
  hub.client.postMessage({type:'compose',source:'facebook',requestId:'req-compose-2'});
  fb.client.postMessage({type:'composeResult',requestId:'req-compose-2',ok:true});await tick();
  assert.equal(JSON.stringify(r.tabs.at(-1)),JSON.stringify([3,{active:true}]));
});
