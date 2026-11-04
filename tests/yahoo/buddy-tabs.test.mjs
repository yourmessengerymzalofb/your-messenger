import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tick} from '../hub/helpers.mjs';
import {zaloWithDesktop} from './desktop-fixture.mjs';

// Fake data only. Default layout: the Zalo and Facebook lists join Yahoo's buddy window as tabs.
const fb={id:'facebook',label:'Facebook',connected:true,state:'ready',transcript:null,
  entries:[{key:'/messages/t/1',name:'Lan Anh',group:'Online',unread:true,avatar:'',time:''},{key:'/messages/t/2',name:'Hội 9x',group:'Group',unread:false,avatar:'',time:''}]};

test('Combined buddy list: tabs for Tất cả / Yahoo / Zalo / Facebook in the Yahoo window',async()=>{
  const {dom,d,skin,stored,hubPorts}=await zaloWithDesktop({hub:true});
  try{
    const root=d.getElementById('ym-root');
    root.classList.add('xp-signed-in');await tick(50);
    const buddies=root.querySelector('#buddy-window'),slot=skin.attached.slot();
    assert.equal(root.querySelector('.ym-zalo-window'),null,'no separate Zalo window');
    assert.equal(root.querySelector('.ym-facebook-window'),null,'no separate Facebook window');
    assert.equal(root.querySelector('.xp-tasks .ym-channel-task'),null,'no extra taskbar buttons');
    const tabs=[...buddies.querySelectorAll('.ym-buddy-tab')];
    assert.deepEqual(tabs.map(t=>t.textContent),['Tất cả','Y!','Zalo','Facebook']);
    assert.equal(tabs[0].getAttribute('aria-selected'),'true');
    assert.ok(buddies.contains(slot),'the Zalo list lives in the Yahoo buddy window');
    const box=buddies.querySelector('.ym-combined'),sections=[...box.querySelectorAll('.ym-source:not(.ym-unread-source)')];
    assert.deepEqual(sections.map(s=>s.className),['ym-source ym-src-yahoo','ym-source ym-src-zalo ym-channel-source','ym-source ym-src-facebook ym-channel-source']);
    assert.ok(box.querySelector('.ym-src-yahoo #contacts'),'Yahoo contacts stay the same node');
    assert.ok(sections.every(s=>!s.hidden&&!s.querySelector('.ym-source-head').hidden),'Tất cả shows every app with a heading');

    // Unread counts: Facebook from the source, Zalo from the skin's rows.
    hubPorts[0].server.postMessage({type:'state',sources:[fb]});
    const zaloRow=d.createElement('button');zaloRow.className='contact-row';zaloRow.innerHTML='<span class="contact-text"><span class="contact-first"><b>Nhóm lớp</b><span class="contact-unread">3</span></span></span>';
    slot.append(zaloRow);await tick(10);
    const count=i=>{const c=tabs[i].querySelector('.ym-tab-unread');return c.hidden?'':c.textContent;};
    assert.deepEqual([0,1,2,3].map(count),['4','','3','1']);

    // Tất cả → "Chưa đọc": copies of the unread rows of every app; a click goes to the real row.
    const unread=box.querySelector('.ym-unread-source');
    assert.ok(!unread.hidden);assert.equal(unread.firstChild.textContent,'▾Chưa đọc (2)');
    const copies=[...unread.querySelectorAll('.ym-unread-row')];
    assert.deepEqual(copies.map(c=>[c.dataset.app,c.querySelector('.contact-first b').textContent]),[['zalo','Nhóm lớp'],['facebook','Lan Anh']]);
    const clicks=[];zaloRow.onclick=e=>clicks.push(e.type);
    copies[0].click();assert.deepEqual(clicks,['click'],'the Zalo row gets the click');
    assert.equal(box.firstElementChild,unread,'Chưa đọc comes first');
    // Its heading folds it away, remembered like an app's.
    const unreadHead=unread.querySelector('.ym-unread-head');unreadHead.click();
    assert.ok(unread.hasAttribute('data-folded'));assert.equal(unreadHead.getAttribute('aria-expanded'),'false');
    await tick();assert.deepEqual(stored.ymBuddyFolded,{unread:true});
    unreadHead.click();assert.ok(!unread.hasAttribute('data-folded'));await tick();

    // A heading in Tất cả folds that app away, remembered.
    const zaloHead=sections[1].querySelector('.ym-source-head');
    zaloHead.click();assert.ok(sections[1].hasAttribute('data-folded'));assert.equal(zaloHead.getAttribute('aria-expanded'),'false');
    await tick();assert.deepEqual(stored.ymBuddyFolded,{unread:false,zalo:true});
    zaloHead.click();assert.ok(!sections[1].hasAttribute('data-folded'));

    // A tab shows one app only and is remembered.
    tabs[2].click();
    assert.deepEqual(sections.map(s=>s.hidden),[true,false,true]);
    assert.ok(unread.hidden,'Chưa đọc lives in Tất cả only');
    assert.ok(sections[1].querySelector('.ym-source-head').hidden,'no heading inside a single-app tab');
    assert.equal(tabs[2].getAttribute('aria-selected'),'true');assert.equal(box.dataset.tab,'zalo');
    await tick();assert.equal(stored.ymBuddyTab,'zalo');

    // Yahoo's search box filters the other apps too.
    tabs[0].click();
    const search=root.querySelector('#contact-search');search.value='lan';search.dispatchEvent(new d.defaultView.Event('input'));
    const fbNames=[...sections[2].querySelectorAll('.contact-row')].filter(r=>!r.hidden).map(r=>r.querySelector('.contact-first b').textContent);
    assert.deepEqual(fbNames,['Lan Anh']);assert.equal(zaloRow.hidden,true);
    await tick();
    assert.deepEqual([...unread.querySelectorAll('.ym-unread-row')].map(c=>c.querySelector('.contact-first b').textContent),['Lan Anh'],'Chưa đọc follows the search');
    // Marks don't matter: "lop" and "Lớp" both find "Nhóm lớp".
    zaloRow.querySelector('b').textContent='Nhóm lớp';
    for(const q of ['lop','NHÓM LỚP','nhom lop']){search.value=q;search.dispatchEvent(new d.defaultView.Event('input'));assert.equal(zaloRow.hidden,false,q);}
    search.value='';search.dispatchEvent(new d.defaultView.Event('input'));await tick();
    assert.equal(unread.querySelectorAll('.ym-unread-row').length,2,'an empty search shows every unread row again');
  }finally{dom.window.close();}
});
