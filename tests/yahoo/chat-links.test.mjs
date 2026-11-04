import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

// Fake data only.
const dom=new JSDOM('<!doctype html><body><div id="ym-root"><div class="messages"></div></div></body>',{url:'https://chat.zalo.me/'});
const w=dom.window,d=w.document;
for(const k of ['window','document','Node','NodeFilter','MutationObserver'])Object.defineProperty(globalThis,k,{value:w[k],configurable:true,writable:true});
const {appendLinked,linkifyNode,watchChatLinks,safeHref}=await import('../../src/yahoo/chat-links.mjs');
const tick=()=>new Promise(r=>setTimeout(r,5));

test('Addresses in message text become links; the text reads the same',()=>{
  const span=appendLinked(d.createElement('span'),'Họp nè https://meet.google.com/abc-defg-hij. Xem thêm (https://vi.wikipedia.org/wiki/A_(B)) và www.example.vn!');
  const links=[...span.querySelectorAll('a')];
  assert.deepEqual(links.map(a=>a.getAttribute('href')),['https://meet.google.com/abc-defg-hij','https://vi.wikipedia.org/wiki/A_(B)','https://www.example.vn/']);
  assert.equal(span.textContent,'Họp nè https://meet.google.com/abc-defg-hij. Xem thêm (https://vi.wikipedia.org/wiki/A_(B)) và www.example.vn!');
  for(const a of links){assert.equal(a.target,'_blank');assert.equal(a.rel,'noopener noreferrer');}
});

test('Only web addresses: no javascript:, data: or bare words',()=>{
  const span=appendLinked(d.createElement('span'),'javascript:alert(1) data:text/html,x mailto:a@b.c hello.world https://localhost');
  assert.equal(span.querySelectorAll('a').length,0);
  assert.equal(safeHref('javascript:alert(1)'),'');assert.equal(safeHref('https://a.example/x'),'https://a.example/x');
});

test('Y! chat messages get links too, and a click opens a new tab',async()=>{
  const root=d.getElementById('ym-root'),opened=[];
  globalThis.open=(...a)=>{opened.push(a);return null;};
  // jsdom cannot make a trusted click: keep the click handler to call it with the user's click.
  const add=root.addEventListener.bind(root),handlers={};root.addEventListener=(type,f,...rest)=>{handlers[type]=f;return add(type,f,...rest);};
  const watch=watchChatLinks(root);root.addEventListener=add;
  // As Y!'s chat window paints a message: text nodes around an emoticon picture.
  const line=d.createElement('div');line.className='message-line';
  line.innerHTML='<span class="sender">bạn:</span><span class="message-body">link nè https://meet.google.com/xyz <img alt=":)"> xong</span>';
  root.querySelector('.messages').append(line);await tick();
  const a=line.querySelector('a.ym-chat-link');
  assert.equal(a.getAttribute('href'),'https://meet.google.com/xyz');assert.equal(line.querySelector('img').alt,':)');
  // Untrusted clicks (page scripts) open nothing.
  a.click();assert.equal(opened.length,0);
  const click={target:a,button:0,isTrusted:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){}};
  handlers.click(click);
  assert.deepEqual(opened,[['https://meet.google.com/xyz','_blank','noopener,noreferrer']]);assert.equal(click.defaultPrevented,true);
  // A link env.mjs already handled (Y! 360° opens in its desktop window) is not opened again.
  handlers.click({...click,defaultPrevented:true});assert.equal(opened.length,1);
  // Already-linked text and buttons are left alone.
  const body=d.createElement('span');body.className='message-body';body.innerHTML='<a href="https://a.example/">https://a.example/</a><button>https://b.example/</button>';
  linkifyNode(body);assert.equal(body.querySelectorAll('a').length,1);
  watch.destroy();
});
