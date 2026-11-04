import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// The desktop boots once per page, so this case has a file (a process) of its own.
// The separate layout (one window per app) is covered by boot.test.mjs and facebook-channel.test.mjs.
test('The combined buddy list opens on the tab chosen last time',async()=>{
  const {dom,d}=await zaloWithDesktop({hub:true,stored:{ymBuddyTab:'facebook'}});
  try{
    const root=d.getElementById('ym-root');root.classList.add('xp-signed-in');await tick(50);
    const box=root.querySelector('.ym-combined');
    assert.equal(box.dataset.tab,'facebook');
    assert.deepEqual([...box.querySelectorAll('.ym-source:not(.ym-unread-source)')].map(s=>s.hidden),[true,true,false]);
    assert.equal(root.querySelector('.ym-buddy-tab[aria-selected=true]').dataset.tab,'facebook');
  }finally{dom.window.close();}
});
