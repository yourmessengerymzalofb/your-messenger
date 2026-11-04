import {resolver as __resolver} from '../_root.mjs';const R=__resolver('facebook');
import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';
const source=await readFile(R('extension/actions.js'),'utf8');
function setup(){const d=new JSDOM('<main></main>',{runScripts:'outside-only'});d.window.eval(source);return{d,w:d.window,root:d.window.document.querySelector('main'),actions:d.window.YahooRetroActions};}
test('All known native controls resolve and invoke exactly once only on explicit proxy action',()=>{const x=setup();try{
 for(const key of ['video','voice','attach','sticker','emoji','gif','voiceClip','info','send','like']){
  x.root.replaceChildren();const b=x.w.document.createElement('button');b.setAttribute('aria-label',x.actions.labels[key][0]);let count=0;b.onclick=()=>count++;x.root.append(b);
  assert.equal(count,0);assert.equal(x.actions.resolve(x.root,key),b);assert.equal(count,0);assert.equal(x.actions.invoke(x.root,key),true);assert.equal(count,1);
 }
}finally{x.d.window.close();}});
test('Vietnamese labels, disabled controls, ambiguity and stale/owned targets',()=>{const x=setup();try{
 const b=x.w.document.createElement('button');b.setAttribute('aria-label','Chọn nhãn dán');x.root.append(b);assert.equal(x.actions.resolve(x.root,'sticker'),b);b.disabled=true;assert.equal(x.actions.resolve(x.root,'sticker'),null);b.disabled=false;
 const other=b.cloneNode();x.root.append(other);assert.equal(x.actions.resolve(x.root,'sticker'),null);other.remove();
 b.setAttribute('data-yfr-owned','');assert.equal(x.actions.resolve(x.root,'sticker'),null);b.removeAttribute('data-yfr-owned');b.setAttribute('aria-disabled','true');assert.equal(x.actions.resolve(x.root,'sticker'),null);b.remove();assert.equal(x.actions.invoke(x.root,'sticker'),false);
}finally{x.d.window.close();}});
test('Available is based on header presence, never message-history words',()=>{const x=setup();try{
 x.root.innerHTML='<section role="region" aria-label="Conversation with Demo"><a href="/demo"><h2>Demo</h2><span>Active now</span></a><div role="log">Offline</div></section>';
 assert.equal(x.actions.presence(x.root),'Available');// Active 10 minutes ago or less counts as available; longer is offline.
 for(const [text,want] of [['Active 4m ago','Available'],['Active 10 minutes ago','Available'],['Hoạt động 7 phút trước','Available'],['Active 11m ago','Offline'],['Active 1h ago','Offline'],['Hoạt động 2 giờ trước','Offline']]){x.root.querySelector('span').textContent=text;assert.equal(x.actions.presence(x.root),want,text);}x.root.querySelector('span').textContent='';x.root.querySelector('[role=log]').textContent='Active now';assert.equal(x.actions.presence(x.root),'');
}finally{x.d.window.close();}});
test('Search focuses native input and never clicks an unrelated message control',()=>{const x=setup();try{const input=x.w.document.createElement('input');input.setAttribute('aria-label','Search Messenger');x.root.append(input);assert.equal(x.actions.invoke(x.root,'search'),true);assert.equal(x.w.document.activeElement,input);}finally{x.d.window.close();}});
