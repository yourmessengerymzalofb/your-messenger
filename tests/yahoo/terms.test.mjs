import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';
import {TERMS_VERSION} from '../../src/yahoo/terms.mjs';

// One desktop per test file. First run: the terms come before anything reads Zalo or Facebook.
const until=async(ok,ms=4000)=>{const t=Date.now();while(!ok()&&Date.now()-t<ms)await tick(20);};
test('First run: terms dialog first; nothing reads Zalo or Facebook until the user agrees',async()=>{
  const {dom,d,skin,stored,hubPorts}=await zaloWithDesktop({hub:true,stored:{ymTerms:undefined}});
  try{
    const root=d.getElementById('ym-root'),dialog=root.querySelector('.ym-terms-dialog');
    assert.ok(dialog?.open,'the terms dialog is open');
    const text=dialog.textContent;
    for(const words of ['hoài niệm','Codex VN','thương mại','Không liên kết','không đọc mật khẩu','chính bạn bấm'])assert.match(text,new RegExp(words),words);
    assert.equal(skin.attached,null,'the Zalo skin is not attached yet');
    assert.equal(hubPorts.length,0,'no Facebook hub connection yet');
    // Escape does not dismiss it.
    const cancel=new d.defaultView.Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);assert.ok(cancel.defaultPrevented);
    dialog.querySelector('.ym-terms-accept').click();
    await until(()=>skin.attached);
    assert.equal(stored.ymTerms,TERMS_VERSION,'acceptance is remembered for this terms version');
    assert.equal(dialog.isConnected,false);
    assert.ok(skin.attached,'the desktop goes on: Zalo attached');
    assert.ok(hubPorts.length>0,'and Facebook connected');
  }finally{dom.window.close();}
});
