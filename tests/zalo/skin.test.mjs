import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const code=await readFile(R('extension/content.js'),'utf8');
const fixture=await readFile(R('demo/index.html'),'utf8');
const fixtureCode=await readFile(R('demo/fixture.js'),'utf8');
const helpers=await Promise.all(['layout.js','actions.js','windows.js','transcript.js','buddies.js','chrome.js'].map(f=>readFile(R('extension/'+f),'utf8')));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function boot(html=fixture,{url='https://chat.zalo.me/',saved=true}={}){
  const dom=new JSDOM(html,{url,runScripts:'outside-only'});const w=dom.window;
  let onMessage,onChange;
  const storage={yzrEnabled:saved};
  w.chrome={storage:{local:{get:async()=>({...storage}),set:async obj=>Object.assign(storage,obj)},onChanged:{addListener:fn=>onChange=fn}},runtime:{onMessage:{addListener:fn=>onMessage=fn}}};
  for(const file of helpers)w.eval(file);w.eval(code);
  return {dom,w,storage,message(msg){return new Promise(resolve=>onMessage(msg,{},resolve));},change(value){onChange({yzrEnabled:{newValue:value}},'local');}};
}
test('Scoped permission set and no session/network transport',async()=>{
  const m=JSON.parse(await readFile(R('extension/manifest.json')));
  // 0.2.0: Yahoo Desktop on Zalo may reach only the YM v2 server, through the service worker
  // proxy (README "Quy tắc an toàn"). Zalo/Facebook adapters stay network-free.
  assert.deepEqual(m.permissions,['storage','declarativeNetRequestWithHostAccess','cookies']);
  assert.deepEqual(m.host_permissions,['https://chat.ymvn.site/*']);
  assert.deepEqual(m.background,{service_worker:'background/sw.js'});
  assert.ok(m.content_scripts.some(c=>JSON.stringify(c.matches)===JSON.stringify(['https://chat.zalo.me/*'])));
  assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|WebSocket|document\.cookie|localStorage|indexedDB|innerHTML\s*=/);
  const css=await readFile(R('extension/skin.css'),'utf8');
  assert.doesNotMatch(css,/@import|https?:\/\//);assert.match(css,/html\[data-yzr-active\]/);
});
test('Activates only on observed hierarchy; editor/list nodes, draft, native handlers unchanged',async()=>{
  const {dom,w,message}=boot();await wait(0);
  const editor=w.document.getElementById('richInput'),list=w.document.getElementById('conversationList');
  editor.textContent='Bản nháp tiếng Việt 😊';let count=0;editor.addEventListener('input',()=>count++);
  assert.equal(w.document.documentElement.hasAttribute('data-yzr-active'),true);
  await message({type:'yzr:set',enabled:false});assert.equal(w.document.documentElement.hasAttribute('data-yzr-active'),false);
  await message({type:'yzr:set',enabled:true});
  assert.equal(w.document.getElementById('richInput'),editor);assert.equal(w.document.getElementById('conversationList'),list);
  assert.equal(editor.textContent,'Bản nháp tiếng Việt 😊');editor.dispatchEvent(new w.Event('input'));assert.equal(count,1);
  w.eval(code);assert.equal(w.document.querySelectorAll('#yzr-controls').length,1);dom.window.close();
});
test('Login/unsupported markup untouched; supported login transition and logout fallback',async()=>{
  const {dom,w,message}=boot('<html><body><section id="login">QR login fixture</section></body></html>');await wait(0);
  assert.equal((await message({type:'yzr:state'})).reason,'waiting');
  assert.equal(w.document.documentElement.hasAttribute('data-yzr-active'),false);
  const template=new JSDOM(fixture);const root=w.document.importNode(template.window.document.getElementById('app-page'),true);template.window.close();
  w.document.body.append(root);await wait(240);assert.equal((await message({type:'yzr:state'})).active,true);
  root.remove();await wait(240);assert.equal((await message({type:'yzr:state'})).active,false);dom.window.close();
});
test('Saved off and changes from another tab are respected',async()=>{
  const {dom,w,change,message,storage}=boot(fixture,{saved:false});await wait(0);
  assert.equal((await message({type:'yzr:state'})).active,false);change(true);
  assert.equal((await message({type:'yzr:state'})).active,true);
  await message({type:'yzr:set',enabled:false});assert.equal(storage.yzrEnabled,false);dom.window.close();
});
test('Unrelated origin and child frames are not styled',async()=>{
  const {dom,w}=boot(fixture,{url:'https://example.com/'});await wait(0);
  assert.equal(w.document.getElementById('yzr-controls'),null);assert.equal(w.document.documentElement.hasAttribute('data-yzr-active'),false);dom.window.close();
});
test('Synthetic native composer sends once and keeps IME composition/Shift+Enter',async()=>{
  const {dom,w,message}=boot();w.eval(fixtureCode);await wait(0);
  const editor=w.document.getElementById('richInput');editor.textContent='Chào bạn, cùng hoài niệm nhé 😊';
  const before=w.document.querySelectorAll('.card').length;
  editor.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',shiftKey:true,bubbles:true,cancelable:true}));
  editor.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true,cancelable:true}));
  assert.equal(w.document.querySelectorAll('.card').length,before);
  await message({type:'yzr:set',enabled:false});await message({type:'yzr:set',enabled:true});
  w.document.getElementById('chatInput').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(w.document.querySelectorAll('.card').length,before+1);
  assert.match(w.document.querySelector('.chat-item:last-child .card').textContent,/Chào bạn, cùng hoài niệm nhé 😊/);
  assert.equal(editor.textContent,'');dom.window.close();
});
test('Synthetic SPA remount still activates and controls do not duplicate',async()=>{
  const {dom,w,message}=boot();w.eval(fixtureCode);await wait(0);
  const original=w.document.getElementById('richInput');w.document.getElementById('remount').click();await wait(240);
  assert.notEqual(w.document.getElementById('richInput'),original);assert.equal((await message({type:'yzr:state'})).active,true);
  assert.equal(w.document.querySelectorAll('#yzr-controls').length,1);
  w.document.getElementById('login-demo').click();await wait(240);assert.equal((await message({type:'yzr:state'})).active,false);
  w.document.querySelector('#login-screen button').click();await wait(240);assert.equal((await message({type:'yzr:state'})).active,true);dom.window.close();
});
test('Taskbar restores minimized live window; two chat shells keep one native history/editor',async()=>{
  const {dom,w,message}=boot();w.eval(fixtureCode);await wait(0);
  const native=w.document.getElementById('richInput'),history=w.document.getElementById('messageViewScroll');
  w.document.querySelector('button[aria-label="Thu gọn Minh Anh"]').click();assert.ok(w.document.getElementById('chatViewContainer').hasAttribute('data-yzr-minimized'));
  w.document.querySelector('.xp-tasks button[aria-label="Minh Anh"]').click();assert.ok(!w.document.getElementById('chatViewContainer').hasAttribute('data-yzr-minimized'));
  w.document.querySelector('#sidebarNav .contact-row').click();await wait(240);
  assert.equal(w.document.querySelectorAll('#richInput').length,1);assert.equal(w.document.getElementById('richInput'),native);assert.equal(w.document.getElementById('messageViewScroll'),history);
  await message({type:'yzr:set',enabled:false});assert.equal(w.document.querySelectorAll('[data-yzr-window]').length,0);assert.equal(w.document.querySelectorAll('[data-yzr-native-proxy]').length,0);assert.equal(w.document.querySelectorAll('.yzr-resize').length,0);dom.window.close();
});
