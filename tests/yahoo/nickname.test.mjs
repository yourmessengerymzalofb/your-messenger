import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';
import {nickProblem} from '../../src/yahoo/nickname.mjs';

// One desktop per test file: the built boot.js starts once per process. Fake server only.
const until=async(ok,ms=6000)=>{const t=Date.now();while(!ok()&&Date.now()-t<ms)await tick(20);};

test('Nick rules match the server: 3–24 a-z 0-9 . _ -, never a new guest_',()=>{
  assert.equal(nickProblem('ten.moi'),'');assert.equal(nickProblem('Ten_Moi-2'),'');
  for(const bad of ['ab','có dấu','a b','x'.repeat(25),'guest_123456'])assert.notEqual(nickProblem(bad),'',bad);
});

test('Signed in with the one change left: "Đổi nick" renames once, the saved ID follows, Yahoo reloads its profile',async()=>{
  let changeable=true,nick='guest_482915';const profile=()=>({id:'u-1',nickname:nick,status:'Available',avatar:'classic',presence:'online'});
  const routes=m=>{
    if(m.path==='/api/account')return {body:{authenticated:true,profile:profile(),nicknameChangeable:changeable}};
    if(m.path==='/api/profile'&&m.method==='PATCH'){const b=JSON.parse(m.body);
      if('nickname' in b){if(b.nickname==='da_co_nick')return {status:409,body:{error:'Nickname này đã có người dùng.'}};if(!changeable)return {status:409,body:{error:'Nickname chỉ đổi được một lần.'}};nick=b.nickname;changeable=false;}
      return {body:{profile:profile()}};}
    return null;
  };
  const {dom,d,requests,stored,w}=await zaloWithDesktop({routes,account:{authenticated:true,profile:profile(),nicknameChangeable:true},stored:{ymQuickId:{nickname:'guest_482915',password:'FAKEpassword2345',guest:true}}});
  try{
    const root=d.getElementById('ym-root');
    await until(()=>root.classList.contains('xp-signed-in'));
    const nickApi=globalThis.YahooDesktopNickname,button=root.querySelector('.ym-nick-change');
    await until(()=>!button.hidden);assert.equal(button.hidden,false,'shown while the change is left');
    // Only guest_ IDs: another nick with its change left sees no button.
    nick='whitenight1910';root.classList.remove('xp-signed-in');await tick(20);root.classList.add('xp-signed-in');await until(()=>requests.filter(m=>m.path==='/api/account').length>=3);await tick(50);
    assert.equal(button.hidden,true,'not offered to a chosen nick');
    nick='guest_482915';root.classList.remove('xp-signed-in');await tick(20);root.classList.add('xp-signed-in');await until(()=>!button.hidden);
    assert.equal(button.previousElementSibling.id,'profile-name');
    // A synthetic click does nothing: the change is the user's own.
    button.click();assert.equal(root.querySelector('.ym-nick-dialog'),null);
    nickApi.open();const dialog=root.querySelector('.ym-nick-dialog'),input=dialog.querySelector('input'),error=dialog.querySelector('.error'),form=dialog.querySelector('form');
    assert.equal(input.value,'guest_482915');assert.match(dialog.textContent,/Chỉ đổi được 1 lần/);
    const patches=()=>requests.filter(m=>m.path==='/api/profile'&&m.method==='PATCH');
    input.value='guest_999999';form.requestSubmit();assert.match(error.textContent,/guest_/);assert.equal(patches().length,0,'refused before asking the server');
    input.value='da_co_nick';form.requestSubmit();await until(()=>/người dùng/.test(error.textContent));assert.equal(patches().length,1);
    input.value='Ten.Moi';form.requestSubmit();await until(()=>!dialog.isConnected);
    assert.deepEqual(JSON.parse(patches()[1].body),{nickname:'ten.moi'});
    assert.equal(stored.ymQuickId.nickname,'ten.moi','the saved ID signs in with the new nick');assert.equal(stored.ymQuickId.guest,false);
    assert.equal(stored.ymQuickId.password,'FAKEpassword2345');
    assert.equal(button.hidden,true,'no second change');
    await until(()=>patches().length===3);assert.ok('presence' in JSON.parse(patches()[2].body),'Yahoo re-reads its profile through its own control');
    await until(()=>root.querySelector('#profile-name').textContent==='ten.moi');assert.equal(root.querySelector('#profile-name').textContent,'ten.moi');
    void w;
  }finally{dom.window.close();}
});
