import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Fake data only. The router side is played by the test through the hub port.
test('Telegram list as on Zalo: Nhóm, then Bạn bè, then Bot; each page grows with Tải thêm',async()=>{
  const {dom,d,hubPorts}=await zaloWithDesktop({hub:true,stored:{ymBuddyLayout:'separate'}});
  try{
    const root=d.getElementById('ym-root'),hub=hubPorts[0];
    root.classList.add('xp-signed-in');await tick(50);
    const win=root.querySelector('.ym-telegram-window');
    const people=n=>Array.from({length:n},(_,i)=>({key:'#'+(100+i),name:'Bạn '+i,group:i===0?'Online':'Bạn bè',unread:i===24,avatar:'',time:''}));
    const groups=n=>Array.from({length:n},(_,i)=>({key:'#-100'+i,name:'Nhóm '+i,group:'Nhóm',unread:false,avatar:'',time:''}));
    const bot={key:'#900',name:'Thời tiết bot',group:'Bot',unread:true,avatar:'',time:''};
    const push=entries=>hub.server.postMessage({type:'state',sources:[{id:'telegram',label:'Telegram',connected:true,state:'ready',transcript:null,profile:{avatar:''},entries}]});
    push([...people(25),bot,...groups(7)]);await tick();
    const sections=()=>[...win.querySelectorAll('details.contact-group')];
    assert.deepEqual(sections().map(s=>s.querySelector('summary').textContent),['Nhóm (5/7)','Bạn bè (20/25)','Bot (1)']);
    const visible=s=>[...s.querySelectorAll('.contact-row')].filter(r=>!r.hidden).length;
    assert.deepEqual(sections().map(visible),[5,20,1]);
    const [nhom,ban,bots]=sections();
    assert.equal(bots.querySelector('.contact-row').dataset.ymBusiness,'Bot','bots go with OA / Page in Chưa đọc');
    assert.equal(bots.querySelector('.presence-dot'),null,'a bot has no online face');
    assert.equal(ban.querySelector('.contact-row').classList.contains('online'),true,'online friends keep the yellow face');
    // Paged-out rows stay findable: the search shows them, and their unread badge still counts.
    assert.ok(win.querySelector('.contact-row[data-ym-key="#124"]').hidden);
    const input=win.querySelector('.contact-search input');input.value='Ban 24';input.dispatchEvent(new d.defaultView.Event('input'));
    assert.equal(win.querySelector('.contact-row[data-ym-key="#124"]').hidden,false);assert.ok(win.querySelector('.ym-more').hidden,'no Tải thêm while searching');
    input.value='';input.dispatchEvent(new d.defaultView.Event('input'));
    assert.ok(win.querySelector('.contact-row[data-ym-key="#124"]').hidden);

    const moreOf=s=>s.querySelector('.ym-more'),asks=()=>hub.client.sent.filter(m=>m.type==='more');
    const summaries=()=>sections().map(s=>s.querySelector('summary').textContent);
    assert.equal(moreOf(nhom).textContent,'Tải thêm nhóm');assert.equal(moreOf(ban).textContent,'Tải thêm bạn bè');
    assert.equal(moreOf(bots),null,'bots are not paged');
    moreOf(nhom).click();assert.equal(asks().length,0,'untrusted clicks do nothing');
    // jsdom cannot make a trusted click: call the button's handler with the user's click.
    const user={isTrusted:true};
    // Tải thêm nhóm: the 2 loaded groups left are too few for a page, so the Telegram tab is asked for more chats.
    let asking=moreOf(nhom).onclick(user);await tick(5);
    assert.deepEqual([asks().length,asks()[0].source],[1,'telegram']);
    assert.equal(moreOf(sections()[0]).textContent,'Đang tải…');assert.ok(moreOf(sections()[0]).disabled);
    push([...people(30),bot,...groups(12)]);
    hub.server.postMessage({type:'moreResult',requestId:asks()[0].requestId,ok:true});await asking;
    assert.deepEqual(summaries(),['Nhóm (10/12)','Bạn bè (20/30)','Bot (1)']);
    // Tải thêm bạn bè, until the end of Telegram's list.
    asking=moreOf(sections()[1]).onclick(user);await tick(5);
    hub.server.postMessage({type:'moreResult',requestId:asks()[1].requestId,ok:false,reason:'end'});await asking;
    assert.deepEqual(summaries(),['Nhóm (10/12)','Bạn bè (30)','Bot (1)']);
    assert.equal(moreOf(sections()[1]),null,'all friends shown and nothing more to load');
    // The groups loaded but not shown still page in, with no more requests.
    await moreOf(sections()[0]).onclick(user);
    assert.deepEqual(summaries(),['Nhóm (12)','Bạn bè (30)','Bot (1)']);assert.equal(moreOf(sections()[0]),null);
    assert.equal(asks().length,2);
  }finally{dom.window.close();}
});
