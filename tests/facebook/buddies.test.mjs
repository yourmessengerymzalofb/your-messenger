import {resolver as __resolver} from '../_root.mjs';const R=__resolver('facebook');
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const source=await readFile(R('extension/buddies.js'),'utf8');
const row=(id,name,extra='')=>`<a data-yfr-role="contact" href="/messages/t/${id}"><div><div><div>${extra}</div><div><b data-yfr-role="contact-title">${name}</b><small data-yfr-role="contact-preview">Preview</small></div></div></div></a>`;
test('Grouped summaries reflect Active only, separate groups, proxy one click, collapse and restore source DOM',()=>{
 const dom=new JSDOM('<nav><div data-yfr-role="contact-list">'+row('a','Alice','<span aria-label="Active now"></span>')+row('b','Bob')+row('g','Team','<img alt="One"><img alt="Two">')+'</div></nav>',{runScripts:'outside-only'});try{
 const w=dom.window,d=w.document;w.eval(source);const adapter=w.YahooRetroBuddies(),nav=d.querySelector('nav'),list=d.querySelector('[data-yfr-role="contact-list"]'),alice=d.querySelector('a'),parent=alice.parentNode;let clicked=0;alice.onclick=e=>{e.preventDefault();clicked++;};adapter.sync(nav);
 assert.deepEqual([...d.querySelectorAll('.yfr-buddy-heading')].map(n=>n.textContent),['▾ Online (1)','▾ Offline (0)','▾ Group (1)','▾ Chưa rõ trạng thái (1)']);assert.equal(alice.parentNode,parent);assert.equal(list.getAttribute('data-yfr-group-source'),'hidden');d.querySelector('.yfr-buddy-entry').click();assert.equal(clicked,1);
 const heading=d.querySelector('.yfr-buddy-heading');heading.click();assert.equal(heading.getAttribute('aria-expanded'),'false');assert.equal(heading.nextSibling.hidden,true);
 alice.querySelector('[aria-label]').remove();adapter.sync(nav);assert.match(heading.textContent,/Online \(0\)/);assert.equal(heading.nextSibling.hidden,true);
 assert.equal(d.querySelector('.yfr-buddy-more'),null);adapter.clear();assert.equal(d.querySelector('.yfr-buddy-groups'),null);assert.equal(alice.parentNode,parent);assert.equal(list.hasAttribute('data-yfr-group-source'),false);
 }finally{dom.window.close();}
});
test('Groups filter teaches single-avatar group; status words in previews do not imply Active',()=>{
 const dom=new JSDOM('<nav><button role="tab" aria-selected="true">Groups</button><div data-yfr-role="contact-list">'+row('team','Team')+'</div></nav>',{runScripts:'outside-only'});try{const w=dom.window,d=w.document;w.eval(source);const adapter=w.YahooRetroBuddies(),nav=d.querySelector('nav');adapter.sync(nav);d.querySelector('[role="tab"]').setAttribute('aria-selected','false');d.querySelector('small').textContent='Active now';adapter.sync(nav);assert.match([...d.querySelectorAll('.yfr-buddy-heading')][2].textContent,/Group \(1\)/);assert.equal(w.YahooRetroClassifyBuddy(d.querySelector('a')), 'Chưa rõ trạng thái');adapter.clear();}finally{dom.window.close();}
});
test('Active now as visually hidden text by the avatar (Facebook 2026) counts; the same words in a preview do not',()=>{
 const hidden='<img alt=""><span><div style="position:absolute;clip:rect(0,0,0,0)">Active now</div></span>';
 const dom=new JSDOM('<nav><div data-yfr-role="contact-list">'+row('h','Hung Nguyen',hidden)+row('p','Preview person').replace('Preview<','Active now<')+'</div></nav>',{runScripts:'outside-only'});try{
 const w=dom.window,d=w.document;w.eval(source);const classify=w.YahooRetroClassifyBuddy,[hung,other]=d.querySelectorAll('a');
 assert.equal(classify(hung),'Online');assert.equal(classify(other),'Chưa rõ trạng thái');
 }finally{dom.window.close();}
});
test('Active 10 minutes ago or less counts as Online in the list (avatar text or a bare "7m" badge)',async()=>{
 const actions=await readFile(R('extension/actions.js'),'utf8'),badge=t=>`<img alt=""><span>${t}</span>`;
 const dom=new JSDOM('<nav><div data-yfr-role="contact-list">'+row('a','A',badge('7m'))+row('b','B',badge('Active 9m ago'))+row('c','C',badge('15m'))+row('d','D',badge('Active 2h ago'))+row('e','E').replace('Preview<','Active 3m ago<')+'</div></nav>',{runScripts:'outside-only'});try{
 const w=dom.window;w.eval(actions);w.eval(source);
 assert.deepEqual([...w.document.querySelectorAll('a')].map(a=>w.YahooRetroClassifyBuddy(a)),['Online','Online','Chưa rõ trạng thái','Offline','Chưa rõ trạng thái']);
 }finally{dom.window.close();}
});
