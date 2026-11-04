import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// Fake data only: two channel lists, a Zalo conversation window and taskbar buttons.
test('New Zalo/Facebook messages: YM! sound, pulsing list window and the conversation task',async()=>{
  const dom=new JSDOM('<!doctype html><body><div id="ym-root"><div class="xp-tasks"></div><section data-window="guest"><div class="titlebar">YM!</div><div class="lists"></div></section></div><section class="conversation-window"><div class="titlebar yzr-titlebar"><span class="chat-title"><span>Lan Anh — Zalo</span></span></div></section></body>');
  const w=dom.window,d=w.document;
  for(const k of ['window','document','HTMLElement','Node','MutationObserver'])Object.defineProperty(globalThis,k,{value:w[k],configurable:true,writable:true});
  const {watchMessages}=await import('../../src/yahoo/alerts.mjs');
  const tick=()=>new Promise(r=>setTimeout(r,5));
  const root=d.getElementById('ym-root'),guest=root.querySelector('[data-window]'),guestTask=d.createElement('button');
  const task=name=>{const b=d.createElement('button');b.className='xp-task';b.innerHTML='<img alt=""><span></span>';b.querySelector('span').textContent=name;root.querySelector('.xp-tasks').append(b);return b;};
  root.querySelector('.xp-tasks').append(guestTask);const lanTask=task('Lan Anh'),otherTask=task('Hội 9x');
  const list=id=>{const l=d.createElement('div');guest.querySelector('.lists').append(l);return {id,list:l};};
  const zalo=list('zalo'),facebook=list('facebook');
  const row=(l,name,n)=>{const r=d.createElement('button');r.className='contact-row';r.innerHTML='<span class="contact-first"><b></b><span class="contact-unread"></span></span>';r.querySelector('b').textContent=name;r.querySelector('.contact-unread').textContent=n;l.list.append(r);return r;};
  row(zalo,'Nhóm lớp','9');const lan=row(zalo,'Lan Anh','');row(facebook,'Hội 9x','');
  const sounds=[];
  const alerts=watchMessages(root,[zalo,facebook],{settle:0,page:d,play:()=>sounds.push(1),taskFor:win=>win===guest?guestTask:null});
  await tick();
  assert.deepEqual(sounds,[],'unread from before the start is not new');
  const title=guest.querySelector('.titlebar'),zaloTitle=d.querySelector('.yzr-titlebar');
  assert.ok(!title.classList.contains('ym-unread-title'));

  // Lan Anh writes on Zalo: badge 0 → 1.
  lan.querySelector('.contact-unread').textContent='1';await tick();
  assert.equal(sounds.length,1,'chimeup');
  assert.ok(title.classList.contains('ym-unread-title'),'the buddy list window pulses');
  assert.ok(guestTask.classList.contains('has-new-message'),'its taskbar button too');
  assert.ok(lanTask.classList.contains('has-new-message'),'the conversation task pulses');
  assert.ok(zaloTitle.classList.contains('ym-unread-title'),'and the Zalo window title');
  assert.ok(!otherTask.classList.contains('has-new-message'));

  // A second message right away: no second chime (YM! does not ring twice in a row).
  lan.querySelector('.contact-unread').textContent='2';await tick();assert.equal(sounds.length,1);

  // Read on Zalo: the conversation stops pulsing; a click in the list window stops it there.
  lan.querySelector('.contact-unread').textContent='';await tick();
  assert.ok(!lanTask.classList.contains('has-new-message')&&!zaloTitle.classList.contains('ym-unread-title'));
  guest.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
  assert.ok(!title.classList.contains('ym-unread-title')&&!guestTask.classList.contains('has-new-message'));

  // A new Facebook conversation at the top of its list, already unread; sounds off: no chime, still pulses.
  await new Promise(r=>setTimeout(r,1600));
  const env=await import('../../src/yahoo/env.mjs');env.localStorage.setItem('ym-prefs',JSON.stringify({sound:false}));
  const fresh=row(facebook,'Minh','●');facebook.list.prepend(fresh);await tick();
  assert.equal(sounds.length,1,'YM! sounds off');assert.ok(title.classList.contains('ym-unread-title'));
  env.localStorage.setItem('ym-prefs',JSON.stringify({sound:true}));
  // Rows further down that show up later (Tải thêm) are not new messages.
  for(let i=0;i<4;i++)row(facebook,'Cũ '+i,'');row(facebook,'Cũ hơn','3');await tick();
  assert.equal(sounds.length,1);
  // Away (back to Zalo's own UI): Zalo rings itself.
  root.classList.add('ym-away');lan.querySelector('.contact-unread').textContent='1';await tick();
  assert.equal(sounds.length,1);
  alerts.destroy();dom.window.close();
});
