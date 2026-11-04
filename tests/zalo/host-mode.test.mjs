import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {virtual} from './native-virtual-fixture.mjs';
const read=p=>readFile(R(''+p),'utf8'),fixture=await read('demo/index.html');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// Yahoo Desktop 0.2 hosts the skin: a fake Yahoo buddy list slot and taskbar, fake Zalo data.
async function hosted(html=fixture){
  const dom=new JSDOM(html,{url:'https://chat.zalo.me/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
  w.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener(){}}},storage:{local:{get:async()=>({yzrEnabled:false}),set:async()=>{}},onChanged:{addListener(){}}}};
  for(const f of ['actions.js','buddies.js','windows.js','transcript.js','chrome.js'])w.eval(await read('extension/'+f));
  w.eval(await read('demo/fixture.js'));
  w.eval(await read('extension/content.js'));await wait(0);
  const desktop=d.createElement('div');desktop.id='ym-root';desktop.innerHTML='<div id="contacts"></div><footer class="taskbar"><div class="xp-tasks"></div></footer>';d.body.append(desktop);
  const slot=d.createElement('div');slot.className='ym-zalo-slot';desktop.querySelector('#contacts').append(slot);
  const notices=[];
  w.YahooZaloSkin.attach({slot:()=>slot,tasks:()=>desktop.querySelector('.xp-tasks'),notice:t=>notices.push(t)});
  await wait(300);
  return {dom,w,d,desktop,slot,notices};
}

test('Host mode: Zalo list goes into the Yahoo buddy list, no skin desktop of its own',async()=>{
  const {dom,d,slot}=await hosted();
  try{
    assert.equal(d.getElementById('yzr-desktop'),null,'no second desktop or taskbar');
    assert.equal(d.querySelector('#sidebarNav').hasAttribute('data-yzr-window'),false,'native sidebar is not turned into a window');
    assert.ok(d.documentElement.hasAttribute('data-yzr-active')&&d.documentElement.hasAttribute('data-yzr-host'));
    assert.ok(d.getElementById('yzr-controls').hidden,'"Bật Yahoo" button stays hidden');
    const names=[...slot.querySelectorAll('.contact-row b')].map(b=>b.textContent);
    assert.ok(names.includes('Minh Anh')&&names.includes('Tuấn'),names.join(','));
  }finally{dom.window.close();}
});

test('Host mode: a restored conversation waits in the Yahoo taskbar; pause hands Zalo back untouched',async()=>{
  const {dom,w,d,desktop}=await hosted();
  try{
    const main=d.querySelector('#chatViewContainer');
    assert.ok(main.classList.contains('conversation-window'),'native chat wrapped as a Yahoo window');
    assert.equal(main.getAttribute('data-yzr-minimized'),'true','not shown until the user opens a conversation');
    assert.equal(main.getAttribute('data-ym-channel'),'zalo','Zalo windows wear the Zalo colours');
    assert.match(main.querySelector('.chat-title').textContent,/ — Zalo$/);
    const task=desktop.querySelector('.xp-tasks .xp-task');assert.ok(task);assert.match(task.textContent,/Minh Anh/);
    w.YahooZaloSkin.pause(true);await wait(0);
    assert.equal(d.documentElement.hasAttribute('data-yzr-active'),false);
    assert.equal(main.classList.contains('conversation-window'),false,'native classes restored');
    assert.equal(main.hasAttribute('data-ym-channel'),false);
    assert.equal(desktop.querySelector('.xp-tasks .xp-task'),null,'tasks removed while paused');
    w.YahooZaloSkin.pause(false);await wait(0);
    assert.ok(d.documentElement.hasAttribute('data-yzr-active'));
  }finally{dom.window.close();}
});

test('Host mode list: five groups first, more on request; the strangers folder is last, with an icon',async()=>{
  const v=await virtual({groupPage:5,strangerAt:3});
  try{
    const [groups,friends]=[...v.slot.querySelectorAll('details')];
    assert.equal(groups.querySelectorAll('.contact-row').length,5);
    assert.match(groups.querySelector('summary').textContent,/^Group \(5\/6\)$/);
    const more=groups.querySelector('.yzr-more-groups');assert.ok(more);
    more.onclick({isTrusted:false});assert.equal(groups.querySelectorAll('.contact-row').length,5,'untrusted clicks do nothing');
    more.onclick({isTrusted:true});await v.buddy.whenIdle();
    assert.equal(groups.querySelectorAll('.contact-row').length>5,true);
    const rows=[...friends.querySelectorAll('.contact-row')],last=rows.at(-1);
    assert.equal(last.querySelector('b').textContent,'Tin nhắn từ người lạ');
    assert.equal(last.querySelector('.tiny-avatar').dataset.yzrIcon,'strangers');
  }finally{v.dom.window.close();}
});

// Zalo's filter bar as on chat.zalo.me (fake markup): tabs Ưu tiên / Khác, and the "Người lạ" chip
// that opening the strangers folder turns on. The bar sits under the Yahoo desktop, out of reach.
const FILTERS='<div class="msg-filters-bar"><div class="flx tab-main"><div class="tab-item selected"><div>Ưu tiên</div></div><div class="tab-item"><div>Khác</div></div><div class="flx-1"></div></div></div>';
test('Host mode list: a Zalo filter (Người lạ, Khác) shows a note with the way back to the full list',async()=>{
  const html=fixture.replace('<div class="filters">Ưu tiên　　Khác</div>',FILTERS);assert.notEqual(html,fixture);
  const {dom,d,slot}=await hosted(html);
  try{
    const note=slot.querySelector('.yzr-filter-bar'),tabMain=d.querySelector('.msg-filters-bar .tab-main'),tabs=[...tabMain.querySelectorAll('.tab-item')];
    assert.ok(note.hidden,'no note on the main list');
    // The strangers row turns on the chip; Zalo also renders a new list (fake strangers only).
    const chip=d.createElement('div');chip.className='flx flx-al-c filter-preview-v2 mc-selected label-filter-prev';chip.innerHTML='<div class="flx">Người lạ</div><i class="fa fa-solid-close close"></i>';
    chip.querySelector('.close').onclick=()=>chip.remove();
    const list=d.getElementById('conversationList'),fresh=list.cloneNode(false);
    fresh.innerHTML='<div><div class="msg-item" role="row" tabindex="0"><div class="gridv2 conv-item"><i>K</i><div><b>Khách Lạ</b><p>Chào bạn</p></div></div></div></div>';
    list.replaceWith(fresh);tabMain.append(chip);await wait(80);
    const n=slot.querySelector('.yzr-filter-bar');
    assert.ok(n&&!n.hidden);assert.equal(n.firstChild.textContent,'Zalo đang lọc: Người lạ');
    assert.deepEqual([...slot.querySelectorAll('.contact-row b')].map(b=>b.textContent),['Khách Lạ'],'the list follows the new native grid');
    // The way back: untrusted clicks do nothing; a click closes Zalo's chip.
    n.querySelector('button').onclick({type:'click',isTrusted:false});assert.ok(chip.isConnected);
    n.querySelector('button').onclick({type:'click',isTrusted:true});assert.equal(chip.isConnected,false);
    await wait(80);assert.ok(slot.querySelector('.yzr-filter-bar').hidden);
    // The "Khác" tab: back means the first tab.
    tabs.forEach(t=>t.onclick=()=>{tabs.forEach(x=>x.classList.toggle('selected',x===t));});
    tabs[1].onclick();await wait(80);
    assert.equal(slot.querySelector('.yzr-filter-bar').firstChild.textContent,'Zalo đang lọc: Khác');
    slot.querySelector('.yzr-filter-bar button').onclick({type:'click',isTrusted:true});await wait(80);
    assert.ok(tabs[0].classList.contains('selected'));assert.ok(slot.querySelector('.yzr-filter-bar').hidden);
  }finally{dom.window.close();}
});
