import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {read,installEditing} from './helpers.mjs';
// Values come from the jsdom realm; compare their JSON shape.
const same=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);

// Synthetic, fake-data Facebook Messages page shaped like the accepted FB fixtures.
const page=`<!doctype html><body><div id="fb-root">
<div role="navigation"><h1>Chats</h1><div role="grid">
 <a href="/messages/t/111/"><div><div><div><img src="https://scontent.example/lan.jpg"></div><div><span dir="auto">Lan</span><span dir="auto">Hẹn mai nhé</span></div></div></div></a>
 <a href="/messages/t/222" aria-label="Unread message"><div><div><div><img src="data:image/png;base64,AA"></div><div><span dir="auto">Hội cờ tướng</span><span dir="auto">Unread message: tối nay?</span></div></div></div></a>
</div></div>
<div role="main"><a href="/messages/t/111"><h2>Lan</h2></a><div role="log">
 <div role="article"><button aria-label="Enter, Message sent Today at 9:41 AM by Lan: Chào"></button><div aria-roledescription="message" aria-label="At 9:41"><div dir="auto">Chào bạn</div></div></div>
 <div role="article"><button aria-label="Enter, Message sent Today at 9:42 AM by You: Hi"></button><div aria-roledescription="message"><div dir="auto">Chào Lan</div><div dir="auto">dòng hai</div></div></div>
 <div role="article"><div>card không có envelope</div></div>
 <div role="article"><button aria-label="Enter, Message sent Today at 9:43 AM by Lan"></button><div aria-roledescription="message"><img src="https://scontent.example/p.jpg"></div></div>
</div>
<div aria-label="Thread composer"><div contenteditable="true" role="textbox" aria-label="Message"></div><div role="button" aria-label="Press Enter to send" tabindex="0"></div></div>
</div></div></body>`;

async function boot(){
  const dom=new JSDOM(page,{url:'https://www.facebook.com/messages/t/111',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  for(const f of ['extension/adapters/facebook/actions.js','extension/adapters/facebook/transcript.js','extension/adapters/facebook/buddies.js','extension/shared/protocol.js','extension/shared/compose.js','extension/adapters/facebook/hub-adapter.js'])w.eval(await read(f));
  // jsdom does not navigate on link clicks; emulate Facebook's client-side routing.
  for(const a of w.document.querySelectorAll('a[href]'))a.addEventListener('click',e=>{e.preventDefault();w.history.pushState({},'',a.getAttribute('href'));});
  return {dom,w,d:w.document,hub:w.YahooHubFacebook};
}

test('Facebook adapter publishes thread links and enveloped messages only',async()=>{
  const {dom,hub}=await boot();
  try{
    const snap=hub.read();
    assert.equal(snap.state,'ready');
    same(snap.entries.map(e=>[e.key,e.name,e.unread]),[['/messages/t/111','Lan',false],['/messages/t/222','Hội cờ tướng',true]]);
    assert.equal(snap.transcript.key,'/messages/t/111');assert.equal(snap.transcript.canSend,true);
    const m=snap.transcript.messages;
    assert.equal(m.length,3,'the card without an accessibility envelope is skipped');
    same([m[0].from,m[0].sender,m[0].text],['peer','Lan','Chào bạn']);
    same([m[1].from,m[1].text],['me','Chào Lan\ndòng hai']);
    assert.match(m[1].time,/^09:42/);
    assert.equal(m[2].kind,'image');
  }finally{dom.window.close();}
});

test('Facebook open follows the native thread link; send uses native editor and Send control',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    installEditing(w);
    const editor=d.querySelector('[role="textbox"]'),send=d.querySelector('[aria-label="Press Enter to send"]');
    let sent='';send.addEventListener('click',()=>{sent=editor.textContent;editor.textContent='';});
    assert.equal((await hub.send('/messages/t/222','hi')).reason,'not-active');
    assert.equal((await hub.open('/messages/t/222')).ok,true);
    assert.equal(w.location.pathname,'/messages/t/222');
    const r=await hub.send('/messages/t/222','tối nay 8h');
    assert.equal(r.ok,true,r.reason);assert.equal(sent,'tối nay 8h');
  }finally{dom.window.close();}
});

test('Facebook send refuses when Send is missing and clears the inserted text',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    installEditing(w);d.querySelector('[aria-label="Press Enter to send"]').remove();
    const r=await hub.send('/messages/t/111','xin chào');
    assert.equal(r.reason,'no-send');assert.equal(d.querySelector('[role="textbox"]').textContent,'');
  }finally{dom.window.close();}
});

test('Facebook send waits for the Send button Facebook draws once the text is in',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    installEditing(w);
    // As observed: an empty composer shows Like; "Press enter to send" replaces it a moment after typing.
    const old=d.querySelector('[aria-label="Press Enter to send"]'),bar=old.parentElement;old.remove();
    const editor=d.querySelector('[role="textbox"]');let sent='';
    editor.addEventListener('input',()=>setTimeout(()=>{
      if(bar.querySelector('[aria-label="Press enter to send"]'))return;
      const b=d.createElement('div');b.setAttribute('role','button');b.setAttribute('aria-label','Press enter to send');
      b.addEventListener('click',()=>{sent=editor.textContent;editor.textContent='';});bar.append(b);
    },150));
    const r=await hub.send('/messages/t/111','alo');
    assert.equal(r.ok,true,r.reason);assert.equal(sent,'alo');
  }finally{dom.window.close();}
});

test('A cancelled Facebook send leaves nothing in its Lexical editor',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    installEditing(w);d.querySelector('[aria-label="Press Enter to send"]').remove();
    // Lexical keeps its text on a delete command and deletes the selection on its own input event.
    const editor=d.querySelector('[role="textbox"]'),insert=w.document.execCommand;editor.setAttribute('data-lexical-editor','true');
    w.document.execCommand=(cmd,...a)=>cmd==='delete'?true:insert(cmd,...a);
    editor.addEventListener('beforeinput',e=>{if(e.inputType==='deleteContentBackward'){e.preventDefault();editor.textContent='';}});
    const r=await hub.send('/messages/t/111','xin chào');
    assert.equal(r.reason,'no-send');assert.equal(editor.textContent,'');
  }finally{dom.window.close();}
});

test('Facebook adapter source has no transport, storage or HTML injection',async()=>{
  const text=await read('extension/adapters/facebook/hub-adapter.js')+await read('extension/shared/bridge.js')+await read('extension/shared/compose.js');
  assert.doesNotMatch(text,/\bfetch\s*\(|XMLHttpRequest|WebSocket|document\.cookie|localStorage|sessionStorage|indexedDB|innerHTML|\beval\s*\(|storage\.local\.set/);
});

test('Facebook call marks the native call button for the user and clicks nothing; profile gives the picture only',async()=>{
  const {dom,d,hub}=await boot();
  try{
    const header=d.querySelector('[role="main"] a');
    header.insertAdjacentHTML('afterend','<div role="button" aria-label="Start a video call" tabindex="0"></div><div role="button" aria-label="Start a voice call" tabindex="0"></div>');
    d.body.insertAdjacentHTML('afterbegin','<div aria-label="Account, your profile"><svg aria-label="Your profile"><image xlink:href="https://scontent.example/me.jpg"></image></svg></div>');
    const video=d.querySelector('[aria-label="Start a video call"]');let clicks=0;video.addEventListener('click',()=>clicks++);
    assert.equal(hub.read().profile.avatar,'https://scontent.example/me.jpg');
    assert.equal((await hub.call('/messages/t/222','video')).reason,'not-active','only the conversation shown on Facebook');
    assert.equal((await hub.call('/messages/t/111','video')).ok,true);
    assert.equal(clicks,0,'nothing is clicked for the user');
    assert.match(video.style.outline,/solid/);
    const tip=d.querySelector('[data-yfr-owned][role="status"]');assert.match(tip.textContent,/gọi video/);
    video.click();assert.equal(tip.isConnected,false,'the mark goes once the user clicks');assert.equal(video.style.outline,'');
  }finally{dom.window.close();}
});

test('Facebook conversation info opens the Facebook panel for the shown chat, once',async()=>{
  const {dom,d,hub}=await boot();
  try{
    assert.equal((await hub.info('/messages/t/111')).reason,'no-info');
    d.querySelector('[role="main"] a').insertAdjacentHTML('afterend','<div role="button" aria-label="Conversation information" aria-expanded="false" tabindex="0"></div>');
    const b=d.querySelector('[aria-label="Conversation information"]');let clicks=0;b.addEventListener('click',()=>{clicks++;b.setAttribute('aria-expanded','true');});
    assert.equal((await hub.info('/messages/t/222')).reason,'not-active','only the conversation shown on Facebook');
    assert.equal((await hub.info('/messages/t/111')).ok,true);assert.equal(clicks,1);
    assert.equal((await hub.info('/messages/t/111')).ok,true);assert.equal(clicks,1,'an open panel is left open');
  }finally{dom.window.close();}
});

test('A sender profile picture inside a Facebook message is not a photo',async()=>{
  const {dom,d,hub}=await boot();
  try{
    // As observed: a 28px picture (100px source) named after the sender, in a button inside the message.
    d.querySelector('[role="log"]').insertAdjacentHTML('beforeend','<div role="article"><button aria-label="Enter, Message sent Today at 10:33 PM by Lan"></button><div aria-roledescription="message"><div role="button"><img alt="Lan" src="https://scontent.example/lan-face.jpg"></div><div dir="auto">Alo</div></div></div>');
    const img=d.querySelector('img[alt="Lan"]');for(const[k,v]of Object.entries({complete:true,naturalWidth:100,naturalHeight:100}))Object.defineProperty(img,k,{value:v});
    const m=hub.read().transcript.messages.at(-1);
    same([m.kind,m.text,m.images],['text','Alo',[]]);
  }finally{dom.window.close();}
});

test('Facebook photos and emoji reach the Yahoo window: https photos as is, emoji pictures as characters',async()=>{
  const {dom,d,hub}=await boot();
  try{
    const log=d.querySelector('[role="log"]');
    log.insertAdjacentHTML('beforeend','<div role="article"><button aria-label="Enter, Message sent Today at 9:44 AM by Lan: x"></button><div aria-roledescription="message"><div dir="auto">Chọn <img alt="🅱️" src="https://static.xx.fbcdn.net/e/b.png"> nhé</div><div role="button" aria-label="Open photo"><img alt="Open photo" src="https://scontent.example/photo.jpg"></div></div></div>');
    for(const img of log.querySelectorAll('img')){Object.defineProperty(img,'complete',{value:true});Object.defineProperty(img,'naturalWidth',{value:/static/.test(img.src)?16:800});Object.defineProperty(img,'naturalHeight',{value:/static/.test(img.src)?16:600});}
    const m=hub.read().transcript.messages.at(-1);
    assert.equal(m.text,'Chọn 🅱️ nhé');assert.equal(m.kind,'text');
    same(m.images,['https://scontent.example/photo.jpg'],'the emoji picture is not a photo');
    // Older messages carry no pictures (each snapshot crosses tabs).
    for(let i=0;i<16;i++)log.insertAdjacentHTML('beforeend','<div role="article"><button aria-label="Enter, Message sent Today at 9:50 AM by Lan: y"></button><div aria-roledescription="message"><div dir="auto">tin '+i+'</div></div></div>');
    assert.equal(hub.read().transcript.messages.find(x=>x.text==='Chọn 🅱️ nhé').images.length,0);
  }finally{dom.window.close();}
});

test('Facebook compose opens the native New message link only',async()=>{
  const {dom,w,d,hub}=await boot();
  try{
    assert.equal((await hub.compose()).reason,'no-compose');
    d.querySelector('[role="navigation"]').insertAdjacentHTML('afterbegin','<a href="/messages/new/" aria-label="New message"></a>');
    const link=d.querySelector('a[aria-label="New message"]');link.addEventListener('click',e=>{e.preventDefault();w.history.pushState({},'','/messages/new/');});
    assert.equal((await hub.compose()).ok,true);assert.equal(w.location.pathname,'/messages/new/');
  }finally{dom.window.close();}
});

test('Facebook delivery line (Sent/Seen) under your own message is not message text',async()=>{
  const {dom,d,hub}=await boot();
  try{
    d.querySelector('[role="log"]').insertAdjacentHTML('beforeend','<div role="article"><button aria-label="Enter, Message sent Today at 10:31 PM by You: x"></button><div aria-roledescription="message"><div dir="auto"><img alt="😛" src="https://static.xx.fbcdn.net/e/p.png"></div><span dir="auto">Sent</span></div></div>'
      +'<div role="article"><button aria-label="Enter, Message sent Today at 10:31 PM by You: good"></button><div aria-roledescription="message"><div dir="auto">good</div><span dir="auto">Sent 1m ago</span></div></div>'
      +'<div role="article"><button aria-label="Enter, Message sent Today at 10:32 PM by Lan: Sent"></button><div aria-roledescription="message"><div dir="auto">Sent</div></div></div>');
    const m=hub.read().transcript.messages;
    assert.equal(m.at(-3).text,'😛','own message: the emoji only');
    assert.equal(m.at(-2).text,'good','with its age (Sent 1m ago) too');
    assert.equal(m.at(-1).text,'Sent','a friend typing "Sent" keeps it');
  }finally{dom.window.close();}
});

test('Facebook call cards read as calls, not their time; the encryption notice is left out',async()=>{
  const {dom,d,hub}=await boot();
  try{
    // Shapes as observed on facebook.com/messages (e2ee), with fake names.
    d.querySelector('[role="log"]').insertAdjacentHTML('beforeend','<div role="article"><button aria-label="Enter, Message sent January 1, 1970, 8:00 AM by a participant: New messages and calls are secured"></button><div aria-roledescription="message"><div dir="auto">New messages and calls are secured with end-to-end encryption.</div></div></div>'
      +'<div role="article"><button aria-label="Enter, Message sent Thursday 4:46pm by You"></button><div aria-roledescription="message"><h4><span dir="auto">You sent</span></h4><div><h3><span dir="auto">Missed audio call</span></h3><div><span dir="auto">4:46 PM</span></div></div><div role="button"><span dir="auto">Call again</span></div></div></div>'
      +'<div role="article"><button aria-label="Enter, Message sent Thursday 4:47pm by Lan"></button><div aria-roledescription="message"><h3><span dir="auto">Video call</span></h3><span dir="auto">4:47 PM</span></div></div>');
    const m=hub.read().transcript.messages;
    assert.equal(m.some(x=>/secured/.test(x.text)),false,'no encryption notice');
    same(m.slice(-2).map(x=>[x.from,x.kind,x.text]),[['me','call','Cuộc gọi thoại nhỡ'],['peer','call','Cuộc gọi video']]);
  }finally{dom.window.close();}
});

test('Waiting in a background Facebook tab follows page changes, not chained timers',async()=>{
  const {dom,w,d}=await boot();
  try{
    // Background tabs run chained timers about once a minute: only the first deadline timer may run.
    const real=w.setTimeout.bind(w);let timers=0;w.setTimeout=(f,ms)=>{timers++;return real(f,ms);};
    const node=d.createElement('div');let started=Date.now();
    const done=w.YahooHubCompose.wait(()=>node.isConnected,5000);
    real(()=>d.body.append(node),30);
    assert.equal(await done,true);assert.ok(Date.now()-started<1000,'resolved by the page change');
    assert.equal(timers,1,'one deadline timer, no polling');
  }finally{dom.window.close();}
});
