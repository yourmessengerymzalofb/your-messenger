import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// One desktop per test file. The guest ID turned off (ymAutoGuest false): the plugin offers the
// one-click ID and creates nothing by itself.
test('Guest ID turned off: no guest_ ID is made by itself; the one-click card waits for the user',async()=>{
  const {dom,d,requests}=await zaloWithDesktop({stored:{ymAutoGuest:false}});
  try{
    await tick(500);
    assert.equal(requests.filter(m=>m.path==='/api/auth/register').length,0,'no account created without a click');
    const card=d.getElementById('ym-root').querySelector('.ym-yahoo-join .ym-quick-id');
    assert.ok(card&&!card.hidden,'the one-click card is offered');
  }finally{dom.window.close();}
});
