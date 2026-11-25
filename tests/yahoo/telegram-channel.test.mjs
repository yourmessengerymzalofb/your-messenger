import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Fake data only. The router side is played by the test through the (shared) hub port.
const tg=(extra={})=>({id:'telegram',label:'Telegram',connected:true,state:'ready',transcript:null,profile:{avatar:''},
  entries:[{key:'#111',name:'Lan Anh',group:'Online',unread:true,avatar:'data:image/jpeg;base64,AAAA',time:'09:41'},{key:'#-1001',name:'Hội cờ tướng',group:'Nhóm',unread:false,avatar:'',time:''}],...extra});

test('Telegram gets a Telegram-blue buddy window and Yahoo chat windows mirroring the Telegram tab',async()=>{
  const {dom,d,hubPorts}=await zaloWithDesktop({hub:true,stored:{ymBuddyLayout:'separate'}});
  try{
    const root=d.getElementById('ym-root'),view=globalThis.YahooDesktopTelegram;
    assert.equal(hubPorts.length,1,'Facebook and Telegram share one hub connection');
    const hub=hubPorts[0],push=(...sources)=>hub.server.postMessage({type:'state',sources});
    root.classList.add('xp-signed-in');await tick(50);
    const win=root.querySelector('.ym-telegram-window');
    assert.ok(win,'Telegram buddy window mounted');assert.ok(root.querySelector('.ym-facebook-window'),'Facebook keeps its own window');
    push({id:'telegram',label:'Telegram',connected:false,state:'closed',entries:[],transcript:null});
    assert.match(win.querySelector('.ym-channel-status').textContent,/Chưa mở tab Telegram Web/);
    // A Facebook-only snapshot leaves the Telegram list as it was.
    push({id:'facebook',label:'Facebook',connected:false,state:'closed',entries:[],transcript:null});
    assert.match(win.querySelector('.ym-channel-status').textContent,/Telegram/);
    push(tg());await tick();
    assert.deepEqual([...win.querySelectorAll('summary')].map(n=>n.textContent),['Nhóm (1)','Bạn bè (1)'],'as on Zalo: groups first, then friends');
    const first=win.querySelector('.contact-row[data-ym-key="#111"]');
    assert.equal(first.querySelector('.tiny-avatar img').getAttribute('src'),'data:image/jpeg;base64,AAAA','Telegram avatars come as small inline copies');
    assert.ok(first.querySelector('.contact-unread'));
    assert.match(win.querySelector('.contact-row[data-ym-key="#-1001"]').textContent,/Nhóm/);
    first.click();assert.equal(hub.client.sent.length,0,'untrusted clicks never open a chat');

    const opening=view.openWindow('#111','Lan Anh');await tick(20);
    const ask=hub.client.sent.at(-1);
    assert.deepEqual([ask.type,ask.source,ask.key],['open','telegram','#111']);
    const chat=root.querySelector('.ym-telegram-chat');assert.ok(chat&&!chat.hidden);assert.equal(chat.dataset.ymChannel,'telegram');
    hub.server.postMessage({type:'openResult',requestId:ask.requestId,ok:true});await opening;
    push(tg({transcript:{key:'#111',title:'Lan Anh',status:'Đang hoạt động',canSend:true,messages:[
      {id:'1',from:'peer',sender:'',text:'chào bạn',time:'9:00',kind:'text'},{id:'2',from:'peer',sender:'',text:'',time:'9:01',kind:'sticker'},
      {id:'3',from:'me',sender:'',text:'ảnh nè',time:'9:02',kind:'image',images:['data:image/jpeg;base64,BBBB']}]}}));
    const q=name=>chat.querySelector('[data-chat-control="'+name+'"]');
    assert.equal(q('chat-title').textContent,'Lan Anh — Telegram');
    const lines=[...q('messages').querySelectorAll('.message-line')].map(n=>n.textContent);
    assert.match(lines[0],/^Lan Anh:chào bạn/);assert.match(lines[1],/\[Sticker\] — xem trên Telegram/);
    assert.match(lines[2],/^Bạn:ảnh nè/,'a caption shows with its photo');
    assert.equal(q('messages').querySelector('.ym-src-photos img').getAttribute('src'),'data:image/jpeg;base64,BBBB');
    assert.equal(q('peer-dot').className,'presence-dot');
    assert.ok(q('video-call').disabled&&q('voice-call').disabled,'no Telegram calls from YM!');
    assert.equal(view.call('#111','video'),false);

    q('message-input').value='tối nay 8h';q('message-input').dispatchEvent(new d.defaultView.Event('input'));
    const sending=view.submit('#111');await tick(5);
    const send=hub.client.sent.at(-1);assert.deepEqual([send.type,send.source,send.key,send.text],['send','telegram','#111','tối nay 8h']);
    hub.server.postMessage({type:'sendResult',requestId:send.requestId,ok:false,reason:'no-send'});await sending;
    assert.match(chat.querySelector('.ym-mirror-notice').textContent,/nút Gửi của Telegram/);
    assert.equal(q('message-input').value,'tối nay 8h','a refused send keeps the text');
    q('chat-close').click();assert.equal(root.querySelector('.ym-telegram-chat'),null);
  }finally{dom.window.close();}
});
