import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// A separate file: the desktop boots once per process. Popup choice: Facebook not listed.
test('Popup "Hiện trong danh sách": a hidden app gets no tab and no window',async()=>{
  const {dom,d}=await zaloWithDesktop({hub:true,stored:{ymApps:{facebook:false}}});
  try{
    const root=d.getElementById('ym-root');
    assert.deepEqual([...root.querySelectorAll('.ym-yahoo-window .ym-buddy-tab')].map(t=>t.title),['Tất cả','Y!','Zalo']);
    root.classList.add('xp-signed-in');await tick(50);
    assert.deepEqual([...root.querySelectorAll('#buddy-window .ym-buddy-tab')].map(t=>t.title),['Tất cả','Y!','Zalo']);
    assert.equal(root.querySelector('.ym-facebook-window'),null);
  }finally{dom.window.close();}
});
