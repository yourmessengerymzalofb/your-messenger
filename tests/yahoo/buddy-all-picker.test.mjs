import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Fake data only. The desktop boots once per page, so this case has a file of its own.
const fb={id:'facebook',label:'Facebook',connected:true,state:'ready',transcript:null,
  entries:[{key:'/messages/t/1',name:'Lan Anh',group:'Online',unread:true,avatar:'',time:''}]};

test('Tất cả opens a list of apps: only the apps picked show in Tất cả, its count and Chưa đọc',async()=>{
  const {dom,d,skin,stored,hubPorts}=await zaloWithDesktop({hub:true});
  try{
    const root=d.getElementById('ym-root');root.classList.add('xp-signed-in');await tick(50);
    const buddies=root.querySelector('#buddy-window'),slot=skin.attached.slot();
    const [all,,,facebookTab]=buddies.querySelectorAll('.ym-buddy-tab');
    const menu=buddies.querySelector('.ym-app-picker'),checks=()=>[...menu.querySelectorAll('input')];
    const box=buddies.querySelector('.ym-combined'),sections=[...box.querySelectorAll('.ym-source:not(.ym-unread-source)')];
    assert.equal(all.textContent,'Tất cả');assert.ok(menu.hidden);assert.equal(all.getAttribute('aria-haspopup'),'true');

    hubPorts[0].server.postMessage({type:'state',sources:[fb]});
    const zaloRow=d.createElement('button');zaloRow.className='contact-row';zaloRow.innerHTML='<span class="contact-text"><span class="contact-first"><b>Nhóm lớp</b><span class="contact-unread">3</span></span></span>';
    slot.append(zaloRow);await tick(10);
    const count=()=>{const c=all.querySelector('.ym-tab-unread');return c.hidden?'':c.textContent;};
    assert.equal(count(),'4');

    all.click();
    assert.ok(!menu.hidden);assert.equal(all.getAttribute('aria-expanded'),'true');
    assert.deepEqual([...menu.querySelectorAll('.ym-app-pick')].map(l=>l.textContent),['Yahoo','Zalo','Facebook','Telegram']);
    assert.ok(checks().every(c=>c.checked&&!c.disabled),'every app at first');

    // Only Zalo and Telegram.
    const set=(i,on)=>{checks()[i].checked=on;checks()[i].dispatchEvent(new d.defaultView.Event('change'));};
    set(0,false);set(2,false);await tick(10);
    assert.deepEqual(sections.map(s=>s.hidden),[true,false,true,false]);
    assert.equal(count(),'3','the Tất cả count leaves Facebook out');
    const unread=box.querySelector('.ym-unread-source');
    assert.deepEqual([...unread.querySelectorAll('.ym-unread-row')].map(c=>c.dataset.app),['zalo'],'Chưa đọc too');
    assert.ok(all.hasAttribute('data-ym-filtered'));assert.equal(all.title,'Tất cả: Zalo, Telegram');
    assert.deepEqual(stored.ymBuddyAllHidden,['yahoo','facebook']);
    assert.equal(facebookTab.querySelector('.ym-tab-unread').textContent,'1','the Facebook tab keeps its own count');

    // One app always stays.
    set(1,false);
    assert.equal(checks()[3].disabled,true,'Telegram, the last one, cannot be left out');
    set(3,false);
    assert.ok(checks()[3].checked);assert.ok(!sections[3].hidden);

    // A click elsewhere closes the list; the Facebook tab still shows Facebook.
    d.body.click();assert.ok(menu.hidden);assert.equal(all.getAttribute('aria-expanded'),'false');
    facebookTab.click();assert.deepEqual(sections.map(s=>s.hidden),[true,true,false,true]);
    all.click();assert.ok(!menu.hidden);
    menu.dispatchEvent(new d.defaultView.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.ok(menu.hidden);
    // Back to every app.
    all.click();for(const i of [0,1,2])set(i,true);await tick(10);
    assert.ok(sections.every(s=>!s.hidden));assert.ok(!all.hasAttribute('data-ym-filtered'));assert.equal(count(),'4');
    assert.deepEqual(stored.ymBuddyAllHidden,[]);
  }finally{dom.window.close();}
});
