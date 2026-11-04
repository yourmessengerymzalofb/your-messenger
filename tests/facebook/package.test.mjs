import {resolver as __resolver} from '../_root.mjs';const R=__resolver('facebook');
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
const read=p=>readFile(R(''+p),'utf8');
test('Manifest least privilege; all executable assets packaged',async()=>{
 const m=JSON.parse(await read('extension/manifest.json'));
 assert.equal(m.manifest_version,3);
  // 0.2.0: Yahoo Desktop on Zalo may reach only the YM v2 server, through the service worker
  // proxy (README "Quy tắc an toàn"). Zalo/Facebook adapters stay network-free.
  assert.deepEqual(m.permissions,['storage','declarativeNetRequestWithHostAccess','cookies']);
  assert.deepEqual(m.host_permissions,['https://chat.ymvn.site/*']);
  assert.deepEqual(m.background,{service_worker:'background/sw.js'});
 // The Facebook tab keeps Facebook's own look: no skin, no styles, no pages exposed to it.
 assert.equal(m.web_accessible_resources.some(w=>w.resources.some(r=>r.startsWith('adapters/facebook/'))),false);
 const cs=m.content_scripts.find(c=>c.matches.some(p=>p.includes('facebook.com')));
 assert.deepEqual(cs.matches,['https://www.facebook.com/messages*','https://web.facebook.com/messages*']);
 assert.equal(cs.css,undefined);assert.equal(cs.js.some(p=>/facebook\/(chrome|content|layout|windows)\.js$/.test(p)),false,'reader only');
 const root=new URL('../../extension/',import.meta.url);
 for(const p of [...cs.js,m.action.default_popup]) assert.ok((await readFile(new URL(p,root),'utf8')).length);
});
test('Cosmetic code has no transport, token extraction, message hooks or remote code',async()=>{
 for(const name of await readdir(R('extension/'))) {
  if(!/\.(js|html|css)$/.test(name)) continue;
  const text=await read('extension/'+name);
  assert.doesNotMatch(text,/\bfetch\s*\(|XMLHttpRequest|WebSocket|document\.cookie|localStorage|sessionStorage|innerHTML|\beval\s*\(|chrome\.cookies|chrome\.webRequest/);
  assert.doesNotMatch(text,/<script[^>]+src=["']https?:|@import|url\(https?:/);
 }
});
