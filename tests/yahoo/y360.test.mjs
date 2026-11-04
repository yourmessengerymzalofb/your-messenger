import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {YAHOO_ORIGINS} from '../../src/yahoo/net.mjs';

// extension/yahoo/y360.html frames only the Yahoo blog address given in its hash.
const page=async hash=>{
  const dom=new JSDOM(await readFile('extension/yahoo/y360.html','utf8'),{url:'chrome-extension://ext/yahoo/y360.html'+hash,runScripts:'outside-only'});
  dom.window.eval(await readFile('extension/yahoo/y360.js','utf8'));
  return dom;
};

test('Y! 360° wrapper page frames only /360 on the Yahoo origins',async()=>{
  const js=await readFile('extension/yahoo/y360.js','utf8');
  assert.deepEqual(JSON.parse(js.match(/const ORIGINS=(\[[^\]]*\])/)[1].replaceAll("'",'"')),YAHOO_ORIGINS,'same origins as net.mjs');
  for(const origin of YAHOO_ORIGINS){
    const dom=await page('#'+encodeURIComponent(origin+'/360?user=u1'));
    assert.equal(dom.window.document.querySelector('iframe').src,origin+'/360?user=u1');
    assert.ok(!dom.window.document.body.hasAttribute('data-bad'));dom.window.close();
  }
  for(const bad of ['https://evil.example/360','https://chat.ymvn.site/api/account','https://chat.ymvn.site/','javascript:alert(1)','']){
    const dom=await page('#'+encodeURIComponent(bad)),{document}=dom.window;
    assert.ok(!document.querySelector('iframe').hasAttribute('src'),bad);assert.ok(document.body.hasAttribute('data-bad'),bad);dom.window.close();
  }
});

test('Y! 360° wrapper also takes Messenger\'s /?return360=/360… (signed-in desktop), nothing else',async()=>{
  for(const ok of ['https://chat.ymvn.site/?return360=%2F360','https://chat.ymvn.site/?return360=%2F360%3Fuser%3Du1']){
    const dom=await page('#'+encodeURIComponent(ok));assert.equal(dom.window.document.querySelector('iframe').src,ok);dom.window.close();
  }
  for(const bad of ['https://chat.ymvn.site/?return360=%2Fsettings','https://chat.ymvn.site/?return360=%2F360&x=1','https://chat.ymvn.site/?other=%2F360','https://evil.example/?return360=%2F360']){
    const dom=await page('#'+encodeURIComponent(bad));assert.ok(!dom.window.document.querySelector('iframe').hasAttribute('src'),bad);dom.window.close();
  }
});

test('A waiting screen covers the frame until the blog itself has loaded',async()=>{
  // Signed in: Messenger's page loads first (session check), then the blog; only then the frame shows.
  let dom=await page('#'+encodeURIComponent('https://chat.ymvn.site/?return360=%2F360'));
  let {document,Event}=dom.window;const frame=document.querySelector('iframe'),waiting=()=>document.body.hasAttribute('data-waiting');
  assert.ok(waiting(),'Messenger\'s page in between is covered');
  assert.equal(document.querySelector('.wait').getAttribute('role'),'status');
  frame.dispatchEvent(new Event('load'));assert.ok(waiting(),'still covered after Messenger\'s page');
  frame.dispatchEvent(new Event('load'));assert.ok(!waiting(),'shown once the blog has loaded');
  dom.window.close();
  // /360 directly: covered until its own load.
  dom=await page('#'+encodeURIComponent('https://chat.ymvn.site/360'));({document,Event}=dom.window);
  assert.ok(document.body.hasAttribute('data-waiting'));
  document.querySelector('iframe').dispatchEvent(new Event('load'));assert.ok(!document.body.hasAttribute('data-waiting'));
  dom.window.close();
  // Not a blog address: no waiting screen over the notice.
  dom=await page('#'+encodeURIComponent('https://evil.example/360'));
  assert.ok(!dom.window.document.body.hasAttribute('data-waiting'));dom.window.close();
  // The blog never comes: shown anyway after a while.
  const js=await readFile('extension/yahoo/y360.js','utf8');assert.match(js,/const WAIT=12000/);assert.match(js,/timer=setTimeout\(ready,WAIT\)/);
});
