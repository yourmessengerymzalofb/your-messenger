import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

test('Desktop mounts over Zalo in #ym-root and shows the Yahoo sign-in, Zalo untouched',async()=>{
  const {dom,d,requests,skin}=await zaloWithDesktop({stored:{ymBuddyLayout:'separate'}});
  try{
  const root=d.getElementById('ym-root');
  assert.ok(root,'root mounted');assert.equal(root.parentElement,d.body);
  assert.ok(root.querySelector('#auth-nick'),'sign-in form rendered');
  assert.ok(root.querySelector('.xp-taskbar .ym-zalo-tray'),'tray button back to Zalo');
  assert.ok(root.classList.contains('login-screen'));
  assert.equal(d.getElementById('conversationList').textContent,'Zalo');
  assert.equal(d.body.className,'','Zalo body classes untouched');
  assert.ok(d.querySelectorAll('style[data-ym]').length>=2);
  assert.ok(requests.some(m=>m.op==='fetch'&&m.path==='/api/account'),'session check went through the proxy');
  assert.ok([...root.querySelectorAll('img[src]')].every(i=>!/^\/(assets|icons|avatars)\//.test(i.getAttribute('src'))),'no root-relative images');
  assert.ok(root.querySelector('img[src^="chrome-extension://ext/yahoo/static/"]'));
  // Session images never point at chat.zalo.me: server URLs are retagged and fetched via the proxy.
  const img=d.createElement('img');img.src='/api/chat-images/abc';
  assert.match(img.getAttribute('src'),/^data:image\/gif;base64,.*#ym-api\/chat-images\/abc$/);
  img.src='/assets/xp/bliss.jpg';assert.equal(img.getAttribute('src'),'chrome-extension://ext/yahoo/static/assets/xp/bliss.jpg');
  img.src='https://cdn.example/x.png';assert.equal(img.getAttribute('src'),'https://cdn.example/x.png');
  root.append(img);img.src='/api/avatars/u1';await tick(50);
  assert.ok(requests.some(m=>m.path==='/api/avatars/u1'),'avatar fetched through the proxy');
  // Y! 360° (/360) opens in a desktop window framing the Yahoo blog, never as chat.zalo.me/360;
  // other root-relative Yahoo paths open on the Yahoo site in a new tab.
  const opened=[],realOpen=globalThis.open;globalThis.open=url=>{opened.push(url);return null;};
  try{
    const link=href=>{const a=d.createElement('a');a.href=href;a.target='_blank';root.append(a);return a;};
    const own=link('/?watchGame=g1');own.onclick=e=>e.preventDefault();
    link('/360?user=u1').click();own.click();await tick(10);
    const win=root.querySelector('.ym-y360-window'),frame=win?.querySelector('iframe.ym-y360-frame');
    assert.ok(win&&!win.hidden,'Y! 360° window open on the desktop');
    assert.ok(root.querySelector('.xp-tasks .ym-y360-task'),'Y! 360° on the taskbar');
    const shown=()=>frame.dataset.ymUrl;
    assert.ok(!frame.hasAttribute('src'),'no chrome-extension:// src: Zalo removes such iframes; the frame is navigated instead');
    assert.match(shown(),/^https:\/\/chat\.ymvn\.site\/360\?user=u1$/);
    root.querySelector('#blog360-shortcut').click();await tick(10);
    assert.match(shown(),/^https:\/\/chat\.ymvn\.site\/360$/,'the desktop Blog 360 icon too');
    const bot=link(new URL('/360?user=bot',shown()).href);bot.click();await tick(10);
    assert.match(shown(),/\/360\?user=bot$/,'full Yahoo blog links from bot messages too');
    assert.equal(opened.length,0,'no tab for the blog; the client keeps its in-app links');
    link('/settings').click();
    assert.equal(opened.length,1);assert.match(opened[0],/^https:\/\/chat\.ymvn\.site\/settings$/);
    link('/360').dispatchEvent(new d.defaultView.MouseEvent('click',{bubbles:true,cancelable:true,ctrlKey:true}));
    assert.match(opened[1],/\/360$/,'Ctrl+click still gives the blog its own tab');
  }finally{globalThis.open=realOpen;}
  // Zalo works without a Yahoo! ID: its buddy window joins Yahoo's window manager at once, beside
  // a guest Yahoo! Messenger window (sign-up prompt) while Yahoo's sign-in window is hidden.
  const slot=skin.attached.slot(),zalo=root.querySelector('.ym-zalo-window');
  assert.ok(zalo&&zalo.contains(slot),'Zalo list lives in its own buddy window');
  const guest=root.querySelector('.ym-yahoo-window');
  assert.ok(guest?.querySelector('.ym-yahoo-join'),'guest Yahoo window with the sign-up prompt');
  assert.equal(guest.querySelector('.contact-search'),null,'no search box in separate mode');
  assert.ok('ymGuest' in root.dataset);
  root.classList.add('xp-signed-in');await tick(50);
  assert.equal(guest.isConnected,false,'the guest window goes once signed in');assert.ok(!('ymGuest' in root.dataset));
  assert.ok(zalo.isConnected&&zalo.contains(slot));
  assert.equal(zalo.dataset.window,'zalo-buddies');
  assert.ok(root.querySelector('.xp-tasks .ym-channel-task'),'Zalo button on the Yahoo taskbar');
  assert.equal(skin.attached.tasks(),root.querySelector('.xp-tasks'));
  // Back to Zalo and again.
  root.querySelector('.ym-zalo-tray').click();assert.ok(root.classList.contains('ym-away'));
  d.querySelector('.ym-return').click();assert.equal(root.classList.contains('ym-away'),false);
  }finally{dom.window.close();}
});
