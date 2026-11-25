import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';

const root=new URL('../../extension/',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
const tick=(ms=0)=>new Promise(r=>setTimeout(r,ms));

async function popup(seed){
  const html=(await read('popup.html')).replace(/<script src="popup\.js"><\/script>/,'');
  const dom=new JSDOM(html,{runScripts:'outside-only'}),w=dom.window,stored={...seed},writes=[];
  let closed=false;w.close=()=>{closed=true;};
  w.chrome={runtime:{getManifest:()=>({version:'0.4.0'})},tabs:{create(){}},
    storage:{local:{get:async d=>({...d,...stored}),set:async v=>{writes.push(v);Object.assign(stored,v);}}}};
  w.eval(await read('popup.js'));await tick(10);
  const d=w.document,change=(el,on)=>{el.checked=on;el.dispatchEvent(new w.Event('change'));};
  return {w,d,stored,writes,change,closed:()=>closed};
}

test('Popup: choices wait for Lưu, which saves them with ymApplyAt',async()=>{
  const {d,stored,writes,change,closed}=await popup({});
  const save=d.getElementById('save'),desktop=d.getElementById('ym-desktop');
  assert.ok(desktop.checked);assert.ok(save.disabled,'nothing to save yet');
  assert.ok(!d.getElementById('ym-on').hidden);assert.ok(d.getElementById('ym-off').hidden);

  change(d.querySelector('input[value=separate]'),true);
  assert.ok(!save.disabled);assert.equal(writes.length,0,'not saved on change');
  change(desktop,false);
  assert.ok(d.getElementById('ym-on').hidden,'the layout belongs to the desktop');assert.ok(!d.getElementById('ym-off').hidden);
  change(desktop,true);

  save.click();await tick(10);
  assert.equal(writes.length,1);
  assert.deepEqual(Object.keys(writes[0]).sort(),['ymApplyAt','ymBuddyLayout']);
  assert.equal(stored.ymBuddyLayout,'separate');assert.equal(typeof stored.ymApplyAt,'number');
  assert.ok(save.disabled);assert.match(d.getElementById('save-hint').textContent,/Đã lưu/);
  await tick(1300);assert.ok(closed(),'the popup closes');
});

test('Popup: the guest Y! ID is titled as such',async()=>{
  const {d}=await popup({ymQuickId:{nickname:'guest_123456',password:'p',guest:true}});
  assert.ok(!d.getElementById('yahoo-id').hidden);
  assert.equal(d.getElementById('yahoo-id-title').textContent,'Y! ID khách trên máy này');
  assert.equal(d.getElementById('yahoo-id-nick').textContent,'guest_123456');
});

test('Zalo tab reloads on ymApplyAt only, and apply.js runs first on chat.zalo.me',async()=>{
  const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window,listeners=[];let reloads=0;
  w.chrome={storage:{onChanged:{addListener:f=>listeners.push(f)}}};
  w.fakeLocation={reload:()=>{reloads++;}};
  w.eval(`(location=>{${await read('adapters/zalo/apply.js')}})(window.fakeLocation)`);
  assert.equal(listeners.length,1);
  listeners[0]({yzrEnabled:{newValue:true}},'local');assert.equal(reloads,0);
  listeners[0]({ymApplyAt:{newValue:1}},'sync');assert.equal(reloads,0);
  listeners[0]({ymApplyAt:{newValue:2}},'local');assert.equal(reloads,1);
  const m=JSON.parse(await read('manifest.json'));
  const zalo=m.content_scripts.find(c=>c.js.includes('adapters/zalo/content.js'));
  assert.equal(zalo.js[0],'adapters/zalo/apply.js');
});
