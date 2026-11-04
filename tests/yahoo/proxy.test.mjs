import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read,portPair,tick} from '../hub/helpers.mjs';

async function boot({respond=async()=>new Response('{}',{headers:{'content-type':'application/json'}})}={}){
  const connect=[],rules=[],calls=[];
  const chrome={runtime:{id:'ext',onConnect:{addListener:f=>connect.push(f)},getURL:p=>'chrome-extension://ext/'+p},
    tabs:{TAB_ID_NONE:-1},declarativeNetRequest:{updateSessionRules:async r=>{rules.push(r);}},
    storage:{local:{get:async d=>d},onChanged:{addListener(){}}}};
  const fetchImpl=async(url,init)=>{calls.push([url,init]);return respond(url,init);};
  // No global chrome: only the instance under test listens (the script self-starts when chrome exists).
  const ctx=vm.createContext({URL,Response,Headers,btoa,atob,Uint8Array,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(await read('extension/shared/protocol.js'),ctx);
  vm.runInContext(await read('extension/background/yahoo-proxy.js'),ctx);
  const proxy=ctx.YahooHubProxy(chrome,{fetchImpl});await proxy.ready;
  const open=(name,url)=>{const p=portPair(name,{url});for(const f of connect)f(p.server);return p;};
  return {proxy,rules,calls,open};
}

test('Only Yahoo /api paths are allowed',async()=>{
  const {proxy}=await boot();
  for(const ok of ['/api/account','/api/messages?peer=abc','/api/chat-images/upload?peer=1&clientId=2','/game-modules.json?t=1'])assert.equal(proxy.pathAllowed(ok),true,ok);
  for(const bad of ['/api/../x','https://evil.example/api/x','//evil.example/api','/sw.js','/360','api/account'])assert.equal(proxy.pathAllowed(bad),false,bad);
});

test('The Origin rule targets only extension requests to the Yahoo origins',async()=>{
  const {rules}=await boot();
  const rule=rules[0].addRules[0];
  assert.equal(rule.action.requestHeaders[0].value,'https://chat.ymvn.site');
  assert.equal(JSON.stringify(rule.condition.tabIds),'[-1]','never applies to a tab');
  assert.equal(JSON.stringify(rule.condition.requestDomains),'["chat.ymvn.site"]');
});

test('Proxy keeps status, headers and binary bodies; strangers are refused',async()=>{
  const png=new Uint8Array([137,80,78,71,0,255]);
  const {calls,open}=await boot({respond:async url=>url.endsWith('/api/avatars/x')?new Response(png,{status:200,headers:{'content-type':'image/png'}}):new Response('{"error":"no"}',{status:401,headers:{'content-type':'application/json','x-yahoo-request-id':'r-1'}})});
  const evil=open('ym-net','https://evil.example/');assert.equal(evil.open,false);
  const page=open('ym-net','https://chat.zalo.me/');
  // server.sent = what the proxy posted back to the page.
  page.client.postMessage({id:'r1',op:'fetch',path:'/api/account',method:'GET'});await tick(10);
  const reply=page.server.sent.at(-1);
  assert.equal(reply.status,401);assert.equal(reply.text,'{"error":"no"}');
  assert.ok(reply.headers.some(([k,v])=>k==='x-yahoo-request-id'&&v==='r-1'));
  assert.equal(calls[0][0],'https://chat.ymvn.site/api/account');assert.equal(calls[0][1].credentials,'include');
  page.client.postMessage({id:'r2',op:'fetch',path:'/api/avatars/x',method:'GET'});await tick(10);
  assert.deepEqual([...Buffer.from(page.server.sent.at(-1).base64,'base64')],[...png]);
  page.client.postMessage({id:'r3',op:'fetch',path:'/api/chat-images/upload?peer=1',method:'POST',headers:{'content-type':'image/jpeg',cookie:'x'},body:{base64:Buffer.from([1,2,3]).toString('base64')}});await tick(10);
  const [,init]=calls.at(-1);
  assert.deepEqual([...init.body],[1,2,3]);assert.equal(init.headers.cookie,undefined,'only safe request headers pass');
  page.client.postMessage({id:'r4',op:'fetch',path:'/sw.js',method:'GET'});await tick(10);
  assert.equal(page.server.sent.at(-1).error,'path');
});

test('Y! 360° frame on chat.zalo.me gets the Yahoo cookies; Zalo\'s own requests never do',async()=>{
  const connect=[],rules=[],changed=[];let jar=[{name:'__Host-ym_session',value:'fake-session'},{name:'pref',value:'1'}];
  const chrome={runtime:{id:'ext',onConnect:{addListener:f=>connect.push(f)},getURL:p=>'chrome-extension://ext/'+p},
    tabs:{TAB_ID_NONE:-1},
    cookies:{getAll:async q=>{assert.equal(q.url,'https://chat.ymvn.site/');return jar;},onChanged:{addListener:f=>changed.push(f)}},
    declarativeNetRequest:{updateSessionRules:async r=>{rules.push(r);}},storage:{local:{get:async d=>d},onChanged:{addListener(){}}}};
  const ctx=vm.createContext({URL,Response,Headers,btoa,atob,Uint8Array,TextEncoder,setTimeout,clearTimeout});
  vm.runInContext(await read('extension/shared/protocol.js'),ctx);vm.runInContext(await read('extension/background/yahoo-proxy.js'),ctx);
  const proxy=ctx.YahooHubProxy(chrome,{fetchImpl:async()=>new Response('{}')});await proxy.ready;
  // Desktop tabs are the chat.zalo.me tabs connected to the proxy; another site's tab never counts.
  const port=(url,id)=>{const p=portPair('ym-net',{url,tab:{id}});for(const f of connect)f(p.server);return p;};
  const seven=port('https://chat.zalo.me/',7);port('https://chat.zalo.me/',9);port('chrome-extension://ext/popup.html',3);port('https://id.zalo.me/account?continue=https%3A%2F%2Fchat.zalo.me%2F',11);
  assert.equal(await proxy.syncFrameCookies(),true);
  const last=()=>rules.at(-1),[frame,loads]=last().addRules;
  assert.deepEqual(JSON.parse(JSON.stringify(last().removeRuleIds)),[9003,9004]);
  assert.equal(frame.action.requestHeaders[0].header,'cookie');assert.equal(frame.action.requestHeaders[0].value,'__Host-ym_session=fake-session; pref=1');
  assert.deepEqual(JSON.parse(JSON.stringify(frame.condition)),{requestDomains:['chat.ymvn.site'],initiatorDomains:['ext','chat.ymvn.site'],tabIds:[7,9],resourceTypes:['sub_frame']},'only frames that the plugin page (or the blog) starts, in chat.zalo.me tabs; never on id.zalo.me');
  assert.deepEqual(JSON.parse(JSON.stringify(loads.condition.initiatorDomains)),['chat.ymvn.site'],'loads only when the blog itself asks, never Zalo\'s scripts');
  assert.ok(!loads.condition.resourceTypes.includes('main_frame'));
  seven.client.disconnect();await new Promise(r=>setTimeout(r,250));
  assert.deepEqual(JSON.parse(JSON.stringify(last().addRules[0].condition.tabIds)),[9],'a closed desktop tab drops out (id.zalo.me never counts)');
  // Signed out: no cookies, no rules.
  jar=[];changed[0]({cookie:{domain:'chat.ymvn.site'}});await new Promise(r=>setTimeout(r,250));
  assert.deepEqual(JSON.parse(JSON.stringify(last().addRules)),[]);
});
