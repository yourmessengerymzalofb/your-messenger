import {resolver as __resolver} from '../_root.mjs';const R=__resolver('zalo');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=p=>readFile(R(''+p),'utf8'),fixture=await read('demo/index.html'),trusted={type:'click',isTrusted:true};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// Fake Zalo page only; chrome.storage is an in-memory stand-in.
async function boot(saved={},query=''){
  const dom=new JSDOM(fixture,{url:'https://chat.zalo.me/'+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,data={...saved},changed=[];
  w.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p},storage:{local:{get:async d=>({...d,...data}),set:async v=>{Object.assign(data,v);}},onChanged:{addListener:f=>changed.push(f)}}};
  for(const f of ['actions.js','buddies.js','windows.js','transcript.js','chrome.js'])w.eval(await read('extension/'+f));
  if(query)w.eval(await read('demo/fixture.js'));
  await w.YahooImv.ready;
  const skin=w.YahooZaloChrome({off(){}}),root=w.document.querySelector('#chatViewContainer');skin.sync(w.document.querySelector('#sidebarNav'),root);
  return {dom,w,d:w.document,root,skin,data};
}

test('Zalo chat is white by default; IMVironments picks a background kept on this computer only',async()=>{
  const {dom,w,d,root,skin,data}=await boot();
  try{
    const view=root.querySelector('#messageViewContainer'),css=await read('extension/skin.css');
    assert.equal(view.getAttribute('data-yzr-imv'),'classic');
    assert.match(css,/#messageViewContainer\{[^}]*background:#fff!important/,'white, as on Facebook');
    assert.match(css,/#messageViewContainer\[data-yzr-imv=hearts\]\{background:#ffcdce/);
    const button=[...root.querySelectorAll('.toolbar button')].find(b=>b.textContent.includes('IMVironments'));
    assert.equal(button.hasAttribute('aria-disabled'),false);assert.match(button.title,/chỉ hiện trên máy này/);
    assert.equal(button.onclick({type:'click',isTrusted:false}),false,'untrusted clicks do nothing');
    assert.equal(button.onclick({type:'click',isTrusted:true,currentTarget:button}),true);
    const menu=d.querySelector('.ym-imv-menu');assert.ok(menu);
    assert.deepEqual([...menu.querySelectorAll('[data-imv-choice]')].map(b=>b.dataset.imvChoice),['classic','hearts','sky','garden']);
    const hearts=menu.querySelector('[data-imv-choice=hearts]');
    hearts.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));assert.ok(d.querySelector('.ym-imv-menu'),'untrusted choice ignored');
    // jsdom cannot make a trusted click: choose through the store the menu uses.
    const peer=w.YahooZaloActions.peer(root);
    w.YahooImv.set('zalo:'+peer,'hearts');await wait(0);
    assert.equal(view.getAttribute('data-yzr-imv'),'hearts');
    assert.deepEqual(JSON.parse(JSON.stringify(data.ymImv)),{['zalo:'+peer]:'hearts'},'only in extension storage');
    w.YahooImv.set('zalo:'+peer,'classic');assert.equal(view.getAttribute('data-yzr-imv'),'classic');assert.deepEqual(JSON.parse(JSON.stringify(data.ymImv)),{});
    skin.dispose();assert.equal(view.hasAttribute('data-yzr-imv'),false,'removed with the skin');
  }finally{dom.window.close();}
});

test('Zalo format row has Zalo\'s rich-text tools; each uses the native control after the editor opens',async()=>{
  const {dom,w,root,skin}=await boot({},'?rtf=1');
  try{
    const row=root.querySelector('.format-options[data-yzr-owned]');
    assert.deepEqual([...row.querySelectorAll('[data-yzr-action]')].map(b=>b.dataset.yzrAction),['bold','italic','underline','strike','color','font','fontSize','clear','bullet','numbering','indent','outdent','undo','redo']);
    // Native ids as observed on chat.zalo.me; a fake toolbar stands in for the real one.
    const bar=root.querySelector('#chat-box-input-container-id'),clicks=[];
    for(const id of ['btn_RTF_Clear','btn_RTF_Bullet','btn_RTF_Numbering','btn_RTF_Tab','btn_RTF_Detab','btn_RTF_Undo','btn_RTF_Redo']){const b=w.document.createElement('div');b.setAttribute('data-id',id);b.className='z--btn--v2';b.addEventListener('click',()=>clicks.push(id));bar.append(b);}
    const keys=['clear','bullet','numbering','indent','outdent','undo','redo'];
    assert.deepEqual(keys.map(k=>w.YahooZaloActions.resolve(root,k)?.getAttribute('data-id')),['btn_RTF_Clear','btn_RTF_Bullet','btn_RTF_Numbering','btn_RTF_Tab','btn_RTF_Detab','btn_RTF_Undo','btn_RTF_Redo']);
    assert.equal(await row.querySelector('[data-yzr-action=bullet]').onclick({type:'click',isTrusted:false}),false,'untrusted does nothing');
    assert.deepEqual(clicks,[]);
    assert.equal(await row.querySelector('[data-yzr-action=bullet]').onclick(trusted),true);
    assert.deepEqual(clicks,['btn_RTF_Bullet']);
    skin.dispose();
  }finally{dom.window.close();}
});

test('Zalo conversation info (an <aside> beside the chat in Zalo\'s hidden layout) shows docked to the chat window',async()=>{
  const {dom,w,d,root,skin}=await boot();
  try{
    skin.dispose();
    const opened=[],proto=w.HTMLElement.prototype,matches=proto.matches;
    proto.showPopover=function(){this._open=true;opened.push(this);};proto.hidePopover=function(){this._open=false;};proto.matches=function(s){return s===':popover-open'?!!this._open:matches.call(this,s);};
    const wm=w.YahooZaloWindows();wm.bind(root,d.querySelector('#header'),'conversation');
    // Shape as observed on chat.zalo.me: aside.web > #chatInfo, next to #chatViewContainer; removed when closed.
    const aside=d.createElement('aside');aside.className='web';aside.innerHTML='<div class="cp-bg"></div><div id="chatInfo" class="chat-info"><span>Thông tin hội thoại</span></div>';aside.getClientRects=()=>[{}];
    const parent=root.parentElement;parent.append(aside);
    wm.syncPortals();
    assert.equal(opened.at(-1),aside);assert.equal(aside.parentElement,parent,'stays in its React parent');assert.ok(aside.hasAttribute('data-yzr-docked'));
    const px=k=>parseFloat(aside.style.getPropertyValue('--yzr-portal-'+k)),win=k=>parseFloat(root.style.getPropertyValue('--yzr-'+k));
    const side=px('x')===win('x')+win('w')||px('x')+px('w')===win('x')||px('x')+px('w')===w.innerWidth;
    assert.ok(side,'beside the window');assert.equal(px('y'),win('y'));assert.equal(px('w'),Math.min(344,w.innerWidth));
    wm.minimize(root);assert.equal(aside.matches(':popover-open'),false,'hidden with its window');
    wm.restore(root);assert.equal(aside.matches(':popover-open'),true,'back with its window');
    aside.remove();wm.syncPortals();assert.equal(aside.hasAttribute('popover'),false);assert.equal(aside.hasAttribute('data-yzr-docked'),false);
    const css=await read('extension/skin.css');assert.match(css,/\[data-yzr-portal\]\[data-yzr-docked\]\{[^}]*background:#fff/);
    wm.dispose();
  }finally{dom.window.close();}
});
