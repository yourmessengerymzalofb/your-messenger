import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

// Chrome's cookies permission reaches the cookies of every host the plugin has host access to. The
// plugin has host access to the YM v2 server only (Zalo and Facebook are content scripts, which give
// no cookie access), and its code reads cookies in one place, for that server (extension/safety.html).
test('No host access to Zalo or Facebook: their cookies are out of reach',async()=>{
  const m=JSON.parse(await readFile('extension/manifest.json','utf8'));
  assert.deepEqual(m.host_permissions,['https://chat.ymvn.site/*']);
  assert.equal(m.optional_host_permissions,undefined);
  assert.ok(!m.permissions.some(p=>/<all_urls>|:\/\/|scripting|tabs|activeTab/.test(p)),'no host-like, script-injection or tab-reading permission');
});

test('Cookies are read for the YM v2 server only, never for Zalo or Facebook',async()=>{
  const files=[];
  async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(/\.(m?js)$/.test(e.name))files.push(p);}}
  await walk('extension');await walk('src');
  const uses=[];
  for(const f of files){const code=await readFile(f,'utf8');if(/\bcookies\.(get|getAll|set|remove|getAllCookieStores)\b|chromeApi\.cookies|chrome\.cookies/.test(code))uses.push(path.relative('.',f).split(path.sep).join('/'));}
  assert.deepEqual(uses,['extension/background/yahoo-proxy.js']);
  const proxy=await readFile('extension/background/yahoo-proxy.js','utf8');
  assert.equal((proxy.match(/cookies\.getAll\(/g)||[]).length,1);
  assert.match(proxy,/cookies\.getAll\(\{url:origin\+'\/'\}\)/);
  assert.match(proxy,/const ORIGINS=\['https:\/\/chat\.ymvn\.site'\];/);
  assert.match(proxy,/if\(ORIGINS\.includes\(value\)\)origin=value;/,'origin is only ever one of ORIGINS');
  assert.doesNotMatch(proxy,/facebook|zalo\.me['"]/i);
});
