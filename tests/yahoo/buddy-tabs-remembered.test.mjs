import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// The desktop boots once per page, so this case has a file (a process) of its own.
// The separate layout (one window per app) is covered by boot.test.mjs and facebook-channel.test.mjs.
test('The combined buddy list opens on the tab chosen last time, and Tất cả keeps the apps picked last time',async()=>{
  const {dom,d}=await zaloWithDesktop({hub:true,stored:{ymBuddyTab:'facebook',ymBuddyAllHidden:['yahoo','facebook','gone']}});
  try{
    const root=d.getElementById('ym-root');root.classList.add('xp-signed-in');await tick(50);
    const box=root.querySelector('.ym-combined');
    assert.equal(box.dataset.tab,'facebook');
    assert.deepEqual([...box.querySelectorAll('.ym-source:not(.ym-unread-source)')].map(s=>s.hidden),[true,true,false,true]);
    assert.equal(root.querySelector('.ym-buddy-tab[aria-selected=true]').dataset.tab,'facebook');
    // Tất cả: Yahoo and Facebook left out last time; an app no longer there is ignored.
    const all=root.querySelector('.ym-buddy-tab[data-tab=all]');all.click();
    assert.deepEqual([...box.querySelectorAll('.ym-source:not(.ym-unread-source)')].map(s=>s.hidden),[true,false,true,false]);
    assert.deepEqual([...root.querySelectorAll('.ym-app-pick input')].map(c=>c.checked),[false,true,false,true]);
    assert.ok(all.hasAttribute('data-ym-filtered'));
  }finally{dom.window.close();}
});
