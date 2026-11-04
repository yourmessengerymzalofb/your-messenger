import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// One desktop per test file. Guest IDs turned on, but Yahoo's form remembers a nick (fake): this browser
// already has a Y! ID whose session ended, so no guest ID may take its place.
test('Remembered nick: no guest_ ID even with ymAutoGuest on',async()=>{
  const prefs=JSON.stringify({rememberedNick:'nick_cu_gia',defaultsVersion:1,language:'vi'});
  const {dom,d,requests}=await zaloWithDesktop({stored:{ymAutoGuest:true,ymLocal:{'ym-prefs':prefs}}});
  try{
    await tick(500);
    assert.equal(d.getElementById('ym-root').querySelector('#auth-nick').value,'nick_cu_gia');
    assert.equal(requests.filter(m=>m.path==='/api/auth/register').length,0,'the remembered ID is not replaced');
  }finally{dom.window.close();}
});
