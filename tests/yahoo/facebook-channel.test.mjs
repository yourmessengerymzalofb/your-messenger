import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Fake data only. The router side is played by the test through the hub port.
const fb=(extra={})=>({id:'facebook',label:'Facebook',connected:true,state:'ready',transcript:null,
  entries:[{key:'/messages/t/1',name:'Lan Anh',group:'Online',unread:true,avatar:'',time:''},{key:'/messages/t/2',name:'Hội 9x',group:'Group',unread:false,avatar:'',time:''}],...extra});

test('Facebook gets its own dark-blue buddy window and Yahoo chat windows mirroring the Facebook tab',async()=>{
  const {dom,d,hubPorts}=await zaloWithDesktop({hub:true,stored:{ymBuddyLayout:'separate'}});
  try{
    const root=d.getElementById('ym-root'),view=globalThis.YahooDesktopFacebook;
    assert.equal(hubPorts.length,1,'one hub connection to the router');
    const hub=hubPorts[0],push=source=>hub.server.postMessage({type:'state',sources:[source]});
    root.classList.add('xp-signed-in');await tick(50);
    const win=root.querySelector('.ym-facebook-window');
    assert.ok(win,'Facebook buddy window mounted');assert.equal(win.dataset.window,'facebook-buddies');
    assert.ok(root.querySelector('.ym-zalo-window'),'Zalo keeps its own window');
    // No Facebook tab yet: a status line offers to open it; an untrusted click does nothing.
    push({id:'facebook',label:'Facebook',connected:false,state:'closed',entries:[],transcript:null});
    const status=win.querySelector('.ym-channel-status');
    assert.match(status.textContent,/Chưa mở Facebook Messages/);
    status.click();assert.equal(hub.client.sent.length,0);
    assert.ok(!status.classList.contains('ym-channel-loading'),'no spinner when nothing is loading');
    // Connecting: the status line spins until Facebook's list arrives.
    push({id:'facebook',label:'Facebook',connected:true,state:'connecting',entries:[],transcript:null});
    assert.ok(win.querySelector('.ym-channel-status').classList.contains('ym-channel-loading'));
    push({id:'facebook',label:'Facebook',connected:false,state:'closed',entries:[],transcript:null});
    // Ready: Yahoo contact rows grouped as on the Facebook skin.
    push(fb());await tick();
    assert.deepEqual([...win.querySelectorAll('summary')].map(n=>n.textContent),['Group (1)','Friends (1)'],'as on Zalo: groups first, then friends');
    const row=win.querySelector('.contact-row[data-ym-key="/messages/t/1"]');
    assert.ok(row.classList.contains('online'));assert.ok(row.querySelector('.contact-unread'));
    assert.match(win.querySelector('.statusbar').textContent,/2 hội thoại/);
    row.click();assert.equal(hub.client.sent.length,0,'untrusted clicks never open a conversation');
    // An identical snapshot keeps the same row nodes.
    push(fb());assert.equal(win.querySelector('.contact-row[data-ym-key="/messages/t/1"]'),row);

    // Opening asks the Facebook tab; the window is Yahoo's chat window in Facebook blue.
    const opening=view.openWindow('/messages/t/1','Lan Anh');await tick(20);
    const ask=hub.client.sent.at(-1);
    assert.deepEqual([ask.type,ask.source,ask.key],['open','facebook','/messages/t/1']);
    const chat=root.querySelector('.ym-facebook-chat');
    assert.ok(chat&&!chat.hidden,'chat window shown');
    assert.equal(chat.dataset.ymChannel,'facebook');
    assert.equal(chat.querySelector('[id]'),null,'no duplicate ids from the Yahoo template');
    assert.ok(root.querySelector('.xp-tasks .ym-channel-task img[src^="data:image/svg"]'),'Facebook task on the Yahoo taskbar');
    hub.server.postMessage({type:'openResult',requestId:ask.requestId,ok:true});await opening;
    push(fb({transcript:{key:'/messages/t/1',title:'Lan Anh',status:'Đang hoạt động',canSend:true,messages:[
      {id:'1',from:'peer',sender:'Lan Anh',text:'chào bạn',time:'9:00',kind:'text'},{id:'2',from:'me',sender:'',text:'',time:'9:01',kind:'image'}]}}));
    const q=name=>chat.querySelector('[data-chat-control="'+name+'"]');
    assert.equal(q('chat-title').textContent,'Lan Anh — Facebook');
    const lines=[...q('messages').querySelectorAll('.message-line')].map(n=>n.textContent);
    assert.match(lines[0],/^Lan Anh:chào bạn/);
    // A meeting link is a link to click, opening in a new tab.
    push(fb({transcript:{key:'/messages/t/1',title:'Lan Anh',status:'',canSend:true,messages:[{id:'1',from:'peer',sender:'Lan Anh',text:'Họp nè https://meet.google.com/abc-defg-hij.',time:'9:00',kind:'text',images:[]}]}}));
    const meet=q('messages').querySelector('.message-body a.ym-chat-link');
    assert.equal(meet.getAttribute('href'),'https://meet.google.com/abc-defg-hij');assert.equal(meet.target,'_blank');assert.match(meet.rel,/noopener/);
    assert.equal(q('messages').querySelector('.message-body').textContent,'Họp nè https://meet.google.com/abc-defg-hij.');
    // A photo the Facebook tab sent along shows as a picture, not a placeholder.
    push(fb({transcript:{key:'/messages/t/1',title:'Lan Anh',status:'',canSend:true,messages:[{id:'1',from:'peer',sender:'Lan Anh',text:'',time:'9:00',kind:'image',images:['https://scontent.example/photo.jpg']}]}}));
    const photo=q('messages').querySelector('.ym-fb-photos img');assert.equal(photo.getAttribute('src'),'https://scontent.example/photo.jpg');assert.equal(photo.referrerPolicy,'no-referrer');assert.doesNotMatch(q('messages').textContent,/xem trên Facebook/);
    push(fb({transcript:{key:'/messages/t/1',title:'Lan Anh',status:'Đang hoạt động',canSend:true,messages:[
      {id:'1',from:'peer',sender:'Lan Anh',text:'chào bạn',time:'9:00',kind:'text'},{id:'2',from:'me',sender:'',text:'',time:'9:01',kind:'image'}]}}));assert.match(lines[1],/^Bạn:\[Ảnh\] — xem trên Facebook/);
    assert.equal(q('peer-dot').className,'presence-dot','"Active now": YM!\'s yellow online face');
    // Facebook's list could not tell, but the open conversation says "Active now": Online in the list too.
    const unknown=[{key:'/messages/t/1',name:'Lan Anh',group:'Chưa rõ trạng thái',unread:false,avatar:'',time:''}];
    push(fb({entries:unknown,transcript:{key:'/messages/t/1',title:'Lan Anh',status:'Đang hoạt động',canSend:true,messages:[]}}));
    const lanRow=()=>root.querySelector('.contact-row[data-ym-key="/messages/t/1"]');
    assert.equal(lanRow().querySelector('.presence-dot').className,'presence-dot');assert.match(lanRow().closest('details').querySelector('summary').textContent,/^Friends/);
    push(fb({entries:unknown,transcript:{key:'/messages/t/1',title:'Lan Anh',status:'',canSend:true,messages:[]}}));
    assert.equal(q('peer-dot').className,'presence-dot offline','not active: grey, in the window and the list');
    assert.equal(lanRow().querySelector('.presence-dot').className,'presence-dot offline');
    // A call card: what the call was, with no 'see on Facebook' note.
    push(fb({transcript:{key:'/messages/t/1',title:'Lan Anh',status:'',canSend:true,messages:[{id:'3',from:'me',sender:'',text:'Cuộc gọi thoại nhỡ',time:'16:46',kind:'call'}]}}));
    assert.match(q('messages').querySelector('.message-line').textContent,/^Bạn:📞 Cuộc gọi thoại nhỡ16:46$/);
    assert.ok(q('buzz').disabled&&q('activities').disabled,'Yahoo-only controls are disabled');assert.equal(q('environment').disabled,false,'IMVironments: local background');
    // Same window as Yahoo's: the format bar shows, disabled (Facebook sends plain text); calls work.
    assert.equal(q('format-options').hidden,false);assert.ok(q('bold').disabled&&q('font').disabled);assert.match(q('bold').title,/không hỗ trợ chữ đậm/);
    assert.equal(q('video-call').disabled,false);assert.equal(q('voice-call').disabled,false);
    assert.ok(q('my-avatar-preview').querySelector('.default-avatar'),'a Yahoo face until Facebook shows the user picture');
    push(fb({profile:{avatar:'https://scontent.example/me.jpg'},transcript:{key:'/messages/t/1',title:'Lan Anh',status:'',canSend:true,messages:[{id:'1',from:'peer',sender:'Lan Anh',text:'chào bạn',time:'9:00',kind:'text'}]}}));
    assert.equal(q('my-avatar-preview').querySelector('img').getAttribute('src'),'https://scontent.example/me.jpg');
    // Webcam: the Facebook tab marks its own call button for the user; nothing is clicked for them.
    const calling=view.call('/messages/t/1','video');await tick(5);
    const call=hub.client.sent.at(-1);assert.deepEqual([call.type,call.source,call.key,call.media],['call','facebook','/messages/t/1','video']);
    hub.server.postMessage({type:'callResult',requestId:call.requestId,ok:true});await calling;
    assert.match(chat.querySelector('.ym-mirror-notice').textContent,/bấm nút gọi video đang được tô vàng/);
    assert.equal(q('message-input').disabled,false);
    // Conversation info (person icon, Avatars): Facebook's own panel, on the Facebook tab.
    assert.equal(q('toggle-chat-avatar').disabled,false);assert.equal(q('avatars-open').disabled,false);assert.match(q('toggle-chat-avatar').title,/Thông tin hội thoại/);
    q('toggle-chat-avatar').dispatchEvent(new d.defaultView.MouseEvent('click'));await tick(5);assert.notEqual(hub.client.sent.at(-1).type,'info','untrusted clicks do nothing');
    const asking=view.info('/messages/t/1');await tick(5);
    const ask2=hub.client.sent.at(-1);assert.deepEqual([ask2.type,ask2.source,ask2.key],['info','facebook','/messages/t/1']);
    hub.server.postMessage({type:'infoResult',requestId:ask2.requestId,ok:true});await asking;
    assert.match(chat.querySelector('.ym-mirror-notice').textContent,/thông tin hội thoại đang mở/);

    // A refused send keeps the text and says why; nothing is retried.
    q('message-input').value='xin chào';q('message-input').dispatchEvent(new d.defaultView.Event('input'));
    const sending=view.submit('/messages/t/1');await tick(5);
    const send=hub.client.sent.at(-1);
    assert.deepEqual([send.type,send.key,send.text],['send','/messages/t/1','xin chào']);
    hub.server.postMessage({type:'sendResult',requestId:send.requestId,ok:false,reason:'draft-not-empty'});await sending;
    assert.equal(q('message-input').value,'xin chào');
    assert.match(chat.querySelector('.ym-mirror-notice').textContent,/bản nháp/);
    assert.equal(hub.client.sent.filter(m=>m.type==='send').length,1);

    // A pasted picture waits above the text box ("1 ảnh"), and Send works for it alone.
    const W=d.defaultView,pasteFiles=files=>{const e=new W.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(e,'clipboardData',{value:{files}});q('message-input').dispatchEvent(e);return e;};
    q('message-input').value='';q('message-input').dispatchEvent(new W.Event('input'));
    const png=new W.File([new Uint8Array([137,80,78,71,13,10,26,10])],'shot.png',{type:'image/png'});
    const pasted=pasteFiles([png]);assert.ok(pasted.defaultPrevented,'the picture is not pasted as text');await tick(20);
    const tray=chat.querySelector('.ym-paste-tray');assert.equal(tray.hidden,false);assert.match(tray.textContent,/^1 ảnh/);
    assert.match(tray.querySelector('img').getAttribute('src'),/^data:image\/png;base64,/);
    assert.equal(q('send').disabled,false,'Send for a picture with no text');
    pasteFiles([new W.File(['x'],'a.txt',{type:'text/plain'})]);await tick(20);assert.equal(tray.querySelectorAll('img').length,1,'only pictures');
    const sendingPicture=view.submit('/messages/t/1');await tick(5);
    const pic=hub.client.sent.at(-1);assert.deepEqual([pic.type,pic.text,pic.images.length],['send','',1]);assert.match(pic.images[0],/^data:image\/png;base64,/);
    hub.server.postMessage({type:'sendResult',requestId:pic.requestId,ok:true});await sendingPicture;
    assert.equal(tray.hidden,true,'sent: the tray empties');assert.equal(q('send').disabled,true);
    // Removing one, or Xoá tất cả, before sending.
    pasteFiles([png,png]);await tick(20);assert.match(tray.textContent,/^2 ảnh/);
    tray.querySelector('.ym-paste-remove').click();assert.match(tray.textContent,/^1 ảnh/);
    [...tray.querySelectorAll('button')].find(b=>b.textContent==='Xoá tất cả').click();assert.equal(tray.hidden,true);

    // The Facebook tab moves to another conversation: the window offers to reconnect.
    push(fb({transcript:{key:'/messages/t/2',title:'Hội 9x',canSend:true,messages:[]}}));
    view.windows.get('/messages/t/1').error='';push(fb({transcript:{key:'/messages/t/2',title:'Hội 9x',canSend:true,messages:[{id:'3',from:'peer',text:'x',kind:'text'}]}}));
    assert.match(chat.querySelector('.ym-mirror-notice').textContent,/hội thoại khác/);
    assert.equal(q('message-input').disabled,true);
    // Closing removes the window and its task.
    q('chat-close').click();
    assert.equal(root.querySelector('.ym-facebook-chat'),null);assert.equal(view.windows.size,0);
  }finally{dom.window.close();}
});
