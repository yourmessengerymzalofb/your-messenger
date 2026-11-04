import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Signed out, Zalo sends the tab to its sign-in page id.zalo.me, where the Zalo password or QR code is
// entered. The plugin promises (extension/safety.html) not to run there: no content script, no
// web-accessible files, no hub port, no proxy page.
test('Zalo sign-in page id.zalo.me: nothing of the plugin runs there',async()=>{
  const m=JSON.parse(await readFile('extension/manifest.json','utf8'));
  const hits=p=>/id\.zalo\.me/.test(p);
  assert.ok(m.content_scripts.every(c=>!c.matches.some(hits)),'no content script');
  assert.ok(m.web_accessible_resources.every(w=>!w.matches.some(hits)),'no web-accessible files');
  for(const f of ['extension/shared/registry.js','extension/background/yahoo-proxy.js']){
    const code=(await readFile(f,'utf8')).split('\n').filter(l=>!/^\s*\/\//.test(l)).join('\n');
    assert.doesNotMatch(code,/['"]https:\/\/id\.zalo\.me/,f);
  }
});
