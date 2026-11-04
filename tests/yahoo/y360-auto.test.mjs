import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// One desktop per test file (boot.js starts once per process). Fake server only.
const until=async(ok,ms=10000)=>{const t=Date.now();while(!ok()&&Date.now()-t<ms)await tick(25);};
const me={id:'u-1',nickname:'whitenight1910',status:'Available',avatar:'classic',presence:'online'};
const bot=(id,nickname)=>({id,nickname,avatar:'classic',presence:'online',online:true,virtual:true,status:'Available',unread:0});

test('After sign-in Y! 360° opens beside YM!, last: after the buddy list has drawn',async()=>{
  const routes=m=>m.path==='/api/contacts?directory=1'?{body:{strangers:[],contacts:[bot('bot:yahoo360','Y!360')],groupInvites:[],requests:[],communityPending:false}}:null;
  const {dom,d}=await zaloWithDesktop({routes,account:{authenticated:true,profile:me,nicknameChangeable:false}});
  try{
    const root=d.getElementById('ym-root');
    await until(()=>root.classList.contains('xp-signed-in'));
    await until(()=>root.querySelector('#buddy-window #contacts .contact-row'));
    assert.equal(root.querySelector('.ym-y360-window:not([hidden])'),null,'not before the buddy list is up and the page is quiet');
    await until(()=>root.querySelector('.ym-y360-window')&&!root.querySelector('.ym-y360-window').hidden);
    const win=root.querySelector('.ym-y360-window'),frame=win.querySelector('iframe');
    assert.ok(!win.hidden,'Y! 360° is open');assert.equal(frame.dataset.ymUrl,'https://chat.ymvn.site/360');
    assert.ok(root.querySelector('.xp-tasks .ym-y360-task'));
    // A YM! window like Messenger 9's Insider, not a browser: purple title bar, no address bar, a link bar.
    assert.ok(win.classList.contains('window')&&!win.classList.contains('xp-explorer'));
    assert.equal(win.querySelector(':scope>.titlebar .brand').textContent,'Y!360°');
    assert.equal(win.querySelector('.xp-address'),null,'no address bar');
    assert.ok(win.querySelector('.ym-y360-panel iframe.ym-y360-frame'));
    assert.deepEqual([...win.querySelectorAll('.ym-y360-link')].map(n=>n.textContent),['Trang chủ Y!360','Làm mới','Mở trong tab mới']);
    assert.equal(win.querySelector('.ym-y360-external').getAttribute('href'),'https://chat.ymvn.site/360');
    // Home and Làm mới load the wrapper page again: a new address each time, or Chrome does nothing.
    const [home,reload]=win.querySelectorAll('button.ym-y360-link'),shown=()=>frame.dataset.ymFrame;
    const first=shown();reload.click();await tick();const second=shown();home.click();await tick(20);
    assert.ok(first&&second&&shown()&&new Set([first,second,shown()]).size===3,'every load is a new address');
    assert.match(shown(),/y360\.html\?n=\d+#https%3A%2F%2Fchat\.ymvn\.site%2F%3Freturn360%3D%252F360$/,'signed in: Messenger opens the blog');
    // Mở trong tab mới: a tab of its own, not this window again.
    const opened=[],open=globalThis.open;globalThis.open=(...a)=>{opened.push(a);return null;};
    try{win.querySelector('.ym-y360-external').click();}finally{globalThis.open=open;}
    assert.deepEqual(opened,[['https://chat.ymvn.site/360','_blank','noopener']]);assert.equal(shown().length>0,true);
    // Closed by the user: it stays closed (no second automatic open while signed in).
    win.querySelector('[aria-label="Đóng Y! 360°"]').click();await tick(2500);
    assert.ok(win.hidden,'stays closed');
  }finally{dom.window.close();}
});
