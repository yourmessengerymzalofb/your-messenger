import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// One desktop per test file. Declining leaves Zalo as it is and turns the desktop off.
test('Terms declined: no desktop, Zalo untouched, desktop off until turned on in the popup',async()=>{
  const {dom,d,skin,stored,hubPorts}=await zaloWithDesktop({hub:true,stored:{ymTerms:undefined}});
  try{
    d.getElementById('ym-root').querySelector('.ym-terms-decline').click();
    await tick(100);
    assert.equal(d.getElementById('ym-root'),null,'the desktop is gone');
    assert.equal(d.querySelector('.ym-return'),null,'no return button either');
    assert.equal(stored.ymDesktop,false);assert.equal(stored.ymTerms,undefined);
    assert.equal(skin.attached,null);assert.equal(hubPorts.length,0);
    assert.equal(d.getElementById('conversationList').textContent,'Zalo');
  }finally{dom.window.close();}
});
