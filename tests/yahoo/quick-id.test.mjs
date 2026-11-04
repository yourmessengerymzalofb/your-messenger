import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';
import {suggestNick,makePassword} from '../../src/yahoo/quick-id.mjs';

// Waits for the fake server's reply to reach the page.
const until=async(ok,ms=4000)=>{const t=Date.now();while(!ok()&&Date.now()-t<ms)await tick(20);};

// Fake server only, with the live server's rule: "da_co_nick" is taken; an e-mail field, if sent,
// must be a real address (an empty one is refused); any other nick is created and signs in.
const profile=nickname=>({id:'u-'+nickname,nickname,status:'Available',avatar:'classic',presence:'online'});
const bot=(id,nickname)=>({id,nickname,avatar:'classic',presence:'online',online:true,virtual:true,status:'Available',unread:0});
const routes=m=>{
  if(m.path==='/api/contacts?directory=1')return {body:{strangers:[],contacts:[bot('bot:yahoo360','Yahoo!360'),bot('bot:game-chess','Cờ vua')],groupInvites:[],requests:[],communityPending:false}};
  if(m.path!=='/api/auth/register'&&m.path!=='/api/auth/login')return null;
  const b=JSON.parse(m.body);
  if(m.path==='/api/auth/register'){
    if('email' in b&&!/@/.test(b.email))return {status:400,body:{error:'Nhập địa chỉ email hợp lệ, ví dụ ban@example.com.'}};
    if(b.nickname==='da_co_nick')return {status:409,body:{error:'Nickname này đã có người dùng.'}};
  }
  return {body:{authenticated:true,profile:profile(b.nickname)}};
};

test('Nick and password suggestions fit the server rules',()=>{
  for(let i=0;i<50;i++){assert.match(suggestNick(),/^[a-z0-9._-]{3,24}$/);assert.match(makePassword(),/^[a-zA-Z2-9]{16}$/);}
});

test('Signed out: a guest Yahoo! Messenger with Zalo/Facebook tabs; one click creates a Yahoo! ID',async()=>{
  const {dom,d,requests,stored,skin}=await zaloWithDesktop({routes,hub:true});
  try{
    const root=d.getElementById('ym-root'),guest=root.querySelector('.ym-yahoo-window'),slot=skin.attached.slot();
    assert.ok('ymGuest' in root.dataset,'guest mode: Yahoo sign-in window hidden');
    assert.ok(guest,'guest Yahoo! Messenger window on the desktop');
    assert.equal(guest.querySelector('.titlebar .brand').textContent,'YM!','the guest window is YM!, not "Y! MESSENGER"');
    assert.deepEqual([...guest.querySelectorAll('.ym-buddy-tab')].map(t=>t.title),['Tất cả','Y!','Zalo','Facebook']);
    assert.ok(guest.querySelector('.ym-src-zalo').contains(slot),'Zalo usable without a Yahoo! ID');
    const join=guest.querySelector('.ym-src-yahoo .ym-yahoo-join');
    assert.match(join.textContent,/BUZZ!!!, chơi game/);
    const card=join.querySelector('.ym-quick-id'),nick=card.querySelector('input'),error=join.querySelector('.error');
    assert.ok(!card.hidden);assert.match(nick.value,/^[a-z]+_[a-z]+\d{2}$/);
    // "Đăng nhập" shows Yahoo's sign-in window, "Để sau" hides it again.
    join.querySelector('.ym-join-login').click();assert.equal(root.dataset.ymAuth,'open');
    root.querySelector('.ym-auth-later').click();assert.ok(!('ymAuth' in root.dataset));

    const create=card.querySelector('.ym-quick-create'),registers=()=>requests.filter(m=>m.path==='/api/auth/register');
    // A taken nick: the error shows in the prompt, a new nick is suggested, nothing stays saved.
    nick.value='da_co_nick';create.click();await until(()=>/người dùng/.test(error.textContent));
    assert.equal(registers().length,1);
    assert.match(error.textContent,/đã có người dùng/);
    assert.notEqual(nick.value,'da_co_nick');assert.equal(stored.ymQuickId,undefined);
    assert.equal(requests.filter(m=>m.path==='/api/auth/login').length,0,'no sign-in for a refused ID');

    // A free nick: the register call (generated password, no e-mail field), then Yahoo's own
    // sign-in form with the same ID.
    const logins=()=>requests.filter(m=>m.path==='/api/auth/login');
    nick.value='Gau_VuiVe42';create.click();await until(()=>logins().length===1);
    const body=JSON.parse(registers()[1].body);
    assert.equal(body.nickname,'gau_vuive42');assert.match(body.password,/^[a-zA-Z2-9]{16}$/);
    assert.equal(body.remember,true);assert.equal(body.invisible,false);assert.ok(!('email' in body),'no e-mail field');
    assert.deepEqual(JSON.parse(logins()[0].body),{nickname:'gau_vuive42',password:body.password,remember:true,invisible:false});
    assert.equal(stored.ymQuickId.password,body.password,'the password is saved in extension storage');
    await until(()=>root.classList.contains('xp-signed-in'),8000);
    assert.ok(root.classList.contains('xp-signed-in'),'Yahoo opens the signed-in desktop');
    // The buddy list draws (Zalo's own #contact-search earlier in the page must not be read).
    await until(()=>root.querySelector('#contacts .contact-row'),8000);
    assert.deepEqual([...root.querySelectorAll('#contacts .contact-first b')].map(b=>b.textContent),['Yahoo!360','Cờ vua']);
    assert.equal(stored.ymQuickId.pending,undefined);
    const dialog=root.querySelector('.ym-quick-dialog');
    assert.ok(dialog.open,'the password dialog is open');
    assert.equal(dialog.querySelector('.ym-quick-password').textContent,body.password);
    assert.match(dialog.textContent,/gau_vuive42/);
    dialog.querySelector('.ym-quick-actions button:last-child').click();assert.equal(dialog.isConnected,false,'Đã lưu closes it');
    // Signed in: the guest window goes, the tabs move into Yahoo's own buddy list.
    assert.equal(guest.isConnected,false);
    const buddies=root.querySelector('#buddy-window');
    assert.ok(buddies.querySelector('.ym-src-zalo').contains(slot));assert.ok(buddies.querySelector('.ym-src-yahoo #contacts'));

    // Đăng xuất: back to the guest window, no automatic sign-in, a quick sign-in button instead.
    root.classList.remove('xp-signed-in');await tick(50);
    assert.ok(guest.isConnected&&guest.querySelector('.ym-src-zalo').contains(slot),'Zalo back in the guest window');
    assert.equal(buddies.querySelector('.ym-buddy-tabs'),null,'Yahoo buddy list restored');
    assert.equal(buddies.querySelector('#contacts').closest('.ym-source'),null,'Yahoo contacts back in place');
    assert.equal(stored.ymQuickId.out,true);
    const quick=join.querySelector('.ym-quick-login');
    assert.ok(!quick.hidden);assert.ok(card.hidden);assert.equal(quick.textContent,'Đăng nhập nhanh: gau_vuive42');
    assert.equal(logins().length,1,'no automatic sign-in after Đăng xuất');
    quick.click();await until(()=>logins().length===2&&stored.ymQuickId.out===false);
    assert.equal(JSON.parse(logins()[1].body).nickname,'gau_vuive42');
    assert.equal(stored.ymQuickId.out,false);
  }finally{dom.window.close();}
});

test('Guest nicks fit the server rules',async()=>{
  const {guestNick}=await import('../../src/yahoo/quick-id.mjs');
  for(let i=0;i<50;i++)assert.match(guestNick(),/^guest_\d{6}$/);
});
