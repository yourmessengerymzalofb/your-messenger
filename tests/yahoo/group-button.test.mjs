import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// A separate file: the desktop boots once per process. Fake data only.
test('"Tạo nhóm chat" follows the tab: hidden on Tất cả, Yahoo\'s own on Yahoo, the app\'s own on Zalo/Facebook',async()=>{
  const {dom,d}=await zaloWithDesktop({hub:true});
  try{
    const root=d.getElementById('ym-root');root.classList.add('xp-signed-in');await tick(50);
    const buddies=root.querySelector('#buddy-window'),row=buddies.querySelector('.group-actions'),button=row.querySelector('#create-group');
    const tabs=[...buddies.querySelectorAll('.ym-buddy-tab')],yahooTitle=button.title;
    assert.equal(row.hidden,true,'Tất cả: no app to create the group in');
    tabs[1].click();assert.equal(row.hidden,false);assert.equal(button.title,yahooTitle);
    tabs[2].click();assert.equal(row.hidden,false);assert.equal(button.title,'Tạo nhóm chat trên Zalo');
    // On an app tab Yahoo's own group dialog never opens; an untrusted click reaches nothing.
    let yahoo=0;button.addEventListener('click',()=>yahoo++);
    button.click();assert.equal(yahoo,0);assert.equal(d.querySelector('#dialog[open]'),null);
    tabs[3].click();assert.equal(button.title,'Tạo nhóm chat trên Facebook');button.click();assert.equal(yahoo,0);
    tabs[1].click();button.dispatchEvent(new d.defaultView.MouseEvent('click',{bubbles:true}));assert.equal(yahoo,1,'Yahoo tab: Yahoo\'s own button');
    // Đăng xuất puts the button back as Yahoo had it.
    root.classList.remove('xp-signed-in');await tick(50);
    assert.equal(row.hidden,false);assert.equal(button.title,yahooTitle);
  }finally{dom.window.close();}
});
