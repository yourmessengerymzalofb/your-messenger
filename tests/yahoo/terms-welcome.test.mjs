import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {tick} from '../hub/helpers.mjs';

const terms=JSON.parse(await readFile('extension/shared/terms.json','utf8'));
const fakeChrome=(stored,opened)=>({runtime:{id:'ext',getURL:p=>'chrome-extension://ext/'+p,onMessage:{addListener(){}},onInstalled:{l:[],addListener(f){this.l.push(f);}}},
  storage:{local:{get:async d=>({...d,...stored}),set:async v=>Object.assign(stored,v)}},tabs:{create:async o=>{opened.push(o.url);}}});
const fetchTerms=async()=>({json:async()=>terms});

test('Terms text: one file for the welcome page and the Zalo dialog, about a nostalgic, internal, non-commercial plugin',()=>{
  assert.match(terms.version,/^\d{4}-\d{2}-\d{2}$/);
  const text=terms.points.flat().join(' ');
  for(const words of ['hoài niệm','Codex VN','thương mại','Không liên kết','không đọc mật khẩu','chính bạn bấm'])assert.match(text,new RegExp(words),words);
});

test('Installed (or updated to new terms): the welcome page opens, once the terms are accepted it does not',async()=>{
  const code=await readFile('extension/background/sw.js','utf8');
  for(const[stored,expect]of[[{},['chrome-extension://ext/welcome.html']],[{ymTerms:terms.version},[]]]){
    const opened=[],chrome=fakeChrome({...stored},opened);
    vm.runInNewContext(code,{chrome,importScripts(){},fetch:fetchTerms});
    for(const f of chrome.runtime.onInstalled.l)await f({reason:'install'});
    assert.deepEqual(opened,expect,JSON.stringify(stored));
  }
});

test('Welcome page: the six points; accepting is remembered and turns the desktop on; declining turns it off',async()=>{
  const html=await readFile('extension/welcome.html','utf8'),code=await readFile('extension/welcome.js','utf8');
  for(const[button,expect]of[['accept',{ymTerms:terms.version,ymDesktop:true}],['decline',{ymDesktop:false}]]){
    const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/,''),{runScripts:'outside-only'}),stored={},opened=[];
    dom.window.chrome=fakeChrome(stored,opened);dom.window.fetch=fetchTerms;dom.window.eval(code);await tick(20);
    const d=dom.window.document;
    assert.equal(d.querySelectorAll('#points li').length,6);assert.match(d.getElementById('points').textContent,/Codex VN/);
    d.getElementById(button).click();await tick(20);
    assert.deepEqual(stored,expect);assert.equal(d.body.dataset.state,button==='accept'?'accepted':'declined');
    if(button==='accept'){d.getElementById('open-zalo').click();await tick(5);assert.deepEqual(opened,['https://chat.zalo.me/']);}
    dom.window.close();
  }
});

test('Zalo dialog waits for Zalo\'s signed-in screen: a signed-out Zalo jumps to its QR page before anyone could read it',async()=>{
  const dom=new JSDOM('<!doctype html><body><div id="app">Đang tải</div></body>');
  for(const k of ['document','MutationObserver','HTMLElement'])globalThis[k]=dom.window[k];
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  const {acceptTerms,zaloSignedIn}=await import('../../src/yahoo/terms.mjs');
  const root=dom.window.document.createElement('div');dom.window.document.body.append(root);
  const stored={};const store={get:async d=>({...d,...stored}),set:async v=>Object.assign(stored,v)};
  let result=null;acceptTerms(root,{store,ready:()=>zaloSignedIn(dom.window.document)}).then(r=>{result=r;});
  await tick(50);
  assert.equal(root.querySelector('.ym-terms-dialog'),null,'no dialog while Zalo is not signed in');
  // Accepted meanwhile on the welcome page: when Zalo shows up, no dialog at all.
  stored.ymTerms=terms.version;
  const nav=dom.window.document.createElement('nav');nav.id='sidebarNav';dom.window.document.body.append(nav);
  await tick(50);
  assert.equal(result,true);assert.equal(root.querySelector('.ym-terms-dialog'),null);
  dom.window.close();
});
