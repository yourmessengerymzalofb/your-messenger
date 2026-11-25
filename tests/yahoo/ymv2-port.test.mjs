import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {applyPatches} from '../../scripts/build-yahoo.mjs';

// YM v2 features from the site that need a port to run on chat.zalo.me.
const vendor=p=>readFile('vendor/yahoo-v2/'+p,'utf8');

test('The plugin install guide stays out of the plugin; the RTS shortcuts stay in',async()=>{
  const shell=applyPatches(await vendor('app/shell.ts'),'app/shell.ts');
  assert.doesNotMatch(shell,/data-plugin-guide-open/,'no desktop icon or sign-in link for the guide');
  assert.match(shell,/vivalartsGames\.map/,'the game shortcuts are still drawn');
  assert.match(shell,/href="\/360"/);
});

test('RTS game windows frame vivalarts.com through the extension page, never directly',async()=>{
  const code=applyPatches(await vendor('modules/activities/vivalarts-window.mjs'),'modules/activities/vivalarts-window.mjs');
  assert.doesNotMatch(code,/frame\.src=/);assert.match(code,/ymGameFrame\(frame,url\)/);
  // game.html shows only the game site, from its hash.
  const html=await readFile('extension/yahoo/game.html','utf8'),js=await readFile('extension/yahoo/game.js','utf8');
  const cases=[['#'+encodeURIComponent('https://vivalarts.com/'),'https://vivalarts.com/'],['#'+encodeURIComponent('https://evil.example/'),null],['#'+encodeURIComponent('http://vivalarts.com/'),null],['',null]];
  for(const[hash,src]of cases){
    const dom=new JSDOM(html.replace(/<script[^>]*><\/script>/,''),{url:'https://ext.example/yahoo/game.html'+hash,runScripts:'outside-only'});
    dom.window.eval(js);
    assert.equal(dom.window.document.querySelector('iframe').getAttribute('src'),src,hash);
    assert.equal(dom.window.document.body.hasAttribute('data-bad'),!src);
    dom.window.close();
  }
});

test('From the site: Ctrl+G sends a BUZZ from the focused YM chat; the song list is newest day first',async()=>{
  const chat=applyPatches(await vendor('client/chat-windows.mjs'),'client/chat-windows.mjs');
  assert.match(chat,/aria-keyshortcuts','Control\+G'/);
  assert.match(chat,/event\.key\.toLowerCase\(\)!=='g'/);assert.match(chat,/!event\.repeat\)buzzButton\.click\(\)/);
  const songs=await vendor('client/winamp-catalog.mjs');
  assert.match(songs,/\/api\/winamp\/tracks\?v=4/);assert.match(songs,/return shuffleLibrary\(tracks\)/);
  const {shuffleLibrary}=await import('../../vendor/yahoo-v2/modules/winamp/library-order.mjs');
  const day=Date.UTC(2026,10,8);
  const list=shuffleLibrary([{id:'old',updatedAt:0},{id:'new',updatedAt:day}],()=>0);
  assert.deepEqual(list.map(t=>t.id),['new','old']);
});
