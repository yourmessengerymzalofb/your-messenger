import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// A separate file: the desktop boots once per process. The popup no longer lists apps; an app
// unticked there before moves into the Tất cả dropdown, and every app keeps its own tab.
test('Old popup "Hiện trong danh sách" choice moves into the Tất cả dropdown',async()=>{
  const {dom,d,stored}=await zaloWithDesktop({hub:true,stored:{ymApps:{facebook:false,zalo:true},ymBuddyAllHidden:['yahoo']}});
  try{
    const root=d.getElementById('ym-root');
    root.classList.add('xp-signed-in');await tick(50);
    const buddies=root.querySelector('#buddy-window');
    assert.deepEqual([...buddies.querySelectorAll('.ym-buddy-tab')].map(t=>t.title.split(':')[0]),['Tất cả','Y!','Zalo','Facebook','Telegram']);
    assert.deepEqual(stored.ymBuddyAllHidden,['yahoo','facebook']);
    assert.equal(stored.ymApps,undefined,'the old key is gone');
    assert.deepEqual([...buddies.querySelectorAll('.ym-app-picker input')].map(c=>c.checked),[false,true,false,true]);
    const sections=[...buddies.querySelectorAll('.ym-combined .ym-source:not(.ym-unread-source)')];
    assert.deepEqual(sections.map(s=>s.hidden),[true,false,true,false]);
  }finally{dom.window.close();}
});
