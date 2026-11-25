import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// One desktop per test file: the built boot.js starts once per process.
const until=async(ok,ms=4000)=>{const t=Date.now();while(!ok()&&Date.now()-t<ms)await tick(20);};
const profile=nickname=>({id:'u-'+nickname,nickname,status:'Available',avatar:'classic',presence:'online'});
// Fake server only: anything not routed answers 404; register and login succeed.
const routes=m=>{
  if(m.path==='/api/contacts?directory=1')return {body:{strangers:[],contacts:[],groupInvites:[],requests:[],communityPending:false}};
  if(m.path!=='/api/auth/register'&&m.path!=='/api/auth/login')return null;
  return {body:{authenticated:true,profile:profile(JSON.parse(m.body).nickname)}};
};

test('First load, no Y! ID yet: the plugin makes a guest_ ID by itself (past a taken number) and signs in',async()=>{
  // Fake server: guest_100000 is taken. rand is not injectable through boot, so match any guest_ nick.
  let first=true;
  const guestRoutes=m=>{if(m.path==='/api/auth/register'){const b=JSON.parse(m.body);if(first&&/^guest_\d{6}$/.test(b.nickname)){first=false;return {status:409,body:{error:'Nickname này đã có người dùng.'}};}}return routes(m);};
  const {dom,d,requests,stored}=await zaloWithDesktop({routes:guestRoutes,stored:{ymAutoGuest:undefined}});
  try{
    const root=d.getElementById('ym-root'),registers=()=>requests.filter(m=>m.path==='/api/auth/register'),logins=()=>requests.filter(m=>m.path==='/api/auth/login');
    await until(()=>logins().length===1,8000);
    const names=registers().map(m=>JSON.parse(m.body).nickname);
    assert.equal(names.length,2,'a taken guest number is skipped');assert.ok(names.every(n=>/^guest_\d{6}$/.test(n)),names.join());
    assert.equal(JSON.parse(logins()[0].body).nickname,names[1]);
    assert.equal(stored.ymQuickId.nickname,names[1]);assert.equal(stored.ymQuickId.guest,true);
    await until(()=>root.classList.contains('xp-signed-in'),8000);
    const dialog=root.querySelector('.ym-quick-dialog');assert.ok(dialog?.open);assert.match(dialog.textContent,/tự tạo Y! ID khách/);
    // Signed out on purpose: no new guest ID, the quick button for this one instead.
    root.classList.remove('xp-signed-in');await tick(80);
    assert.equal(registers().length,2,'no second guest after Đăng xuất');
  }finally{dom.window.close();}
});
